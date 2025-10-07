require('dotenv').config();
const { scanQueue } = require('./src/queue');
const { processPage } = require('./src/crawler');
const { analyzePage } = require('./src/analyzer');
const db = require('./src/db');

const MAX_CONCURRENT_JOBS = 5;

// The main processor function for our queue
scanQueue.process(MAX_CONCURRENT_JOBS, async (job) => {
    const { url, scanId, startUrl } = job.data;
    console.log(`[Worker] Processing: ${url} for scan ${scanId}`);

    const client = await db.pool.connect();
    try {
        // 1. Check if page already exists for this scan to handle race conditions
        let { rows: [page] } = await client.query('SELECT id, status FROM pages WHERE url = $1 AND scan_id = $2', [url, scanId]);

        // If page exists and is not pending, skip.
        if (page && page.status !== 'pending') {
            console.log(`[Worker] Skipping already processed URL: ${url}`);
            return;
        }

        // 2. Mark page as processing or insert it
        await client.query('BEGIN');
        if (page) {
            await client.query('UPDATE pages SET status = $1 WHERE id = $2', ['processing', page.id]);
        } else {
            const { rows: [newPage] } = await client.query(
                'INSERT INTO pages (scan_id, url, status) VALUES ($1, $2, $3) RETURNING id',
                [scanId, url, 'processing']
            );
            page = newPage;
        }

        // 3. Process and analyze the page
        const { html, links } = await processPage(url, startUrl);
        const report = await analyzePage(url, html);

        // 4. Save results to the database
        await client.query(
            'UPDATE pages SET title = $1, description = $2, status = $3 WHERE id = $4',
            [report.title, report.description, 'completed', page.id]
        );

        if (report.observations.length > 0) {
            const observationInserts = report.observations.map(obs => {
                return client.query(
                    'INSERT INTO observations (page_id, type, message) VALUES ($1, $2, $3)',
                    [page.id, obs.type, obs.message]
                );
            });
            await Promise.all(observationInserts);
        }

        // 5. Add new links to the queue
        for (const link of links) {
            const { rows: [existingLink] } = await client.query('SELECT id FROM pages WHERE url = $1 AND scan_id = $2', [link, scanId]);
            if (!existingLink) {
                 // To prevent duplicates, we add a check here, though a unique constraint in the DB is the best guarantee.
                await client.query('INSERT INTO pages (scan_id, url, status) VALUES ($1, $2, $3) ON CONFLICT (url, scan_id) DO NOTHING', [scanId, link, 'pending']);
                await scanQueue.add({ url: link, scanId, startUrl });
            }
        }

        await client.query('COMMIT');
        console.log(`[Worker] Finished processing: ${url}`);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`[Worker] Error processing ${url}:`, error.message);
        // Mark page as failed
        await client.query('UPDATE pages SET status = $1 WHERE url = $2 AND scan_id = $3', ['failed', url, scanId]);
        // Optionally re-throw to let Bull handle retries
        throw error;
    } finally {
        client.release();
    }
});

console.log('Worker is running and waiting for jobs...');

scanQueue.on('completed', (job) => {
    console.log(`Job ${job.id} with url ${job.data.url} has been completed.`);
});

scanQueue.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed with error ${err.message}`);
});