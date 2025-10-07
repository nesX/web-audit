import { URL } from 'url';
import axios from 'axios';
import cheerio from 'cheerio';
import scanQueue from './src/lib/queue.js';
import { query } from './src/lib/db.js';
import { logger, auditLogger } from './src/lib/logger.js';

const SEOScan = {
    async getHTML(url) {
        try {
            const { data } = await axios.get(url);
            return data;
        } catch (error) {
            logger.error(`Error fetching ${url}: ${error.message}`);
            throw new Error(`Failed to fetch URL: ${url}`);
        }
    },

    async analyzePage(pageId, url) {
        const html = await this.getHTML(url);
        const $ = cheerio.load(html);

        // Analyze title and description
        const title = $('title').text();
        const description = $('meta[name="description"]').attr('content') || '';
        this.checkSEO(pageId, url, title, description);

        // Update page with title and description
        await query(
            'UPDATE pages SET title = $1, description = $2, processed = true, updated_at = NOW() WHERE id = $3',
            [title, description, pageId]
        );

        // Find and enqueue internal links
        const domain = new URL(url).hostname;
        $('a').each((i, link) => {
            const href = $(link).attr('href');
            if (href) {
                const absoluteUrl = new URL(href, url).href;
                if (new URL(absoluteUrl).hostname === domain) {
                    this.addLinkToQueue(pageId, absoluteUrl);
                }
            }
        });
    },

    checkSEO(pageId, url, title, description) {
        // Title checks
        if (!title) {
            this.logObservation(pageId, 'MISSING_TITLE', `The page ${url} is missing a title.`);
        } else if (title.length < 10 || title.length > 70) {
            this.logObservation(pageId, 'INVALID_TITLE_LENGTH', `Title length for ${url} is ${title.length}. Recommended: 10-70 chars.`);
        }

        // Description checks
        if (!description) {
            this.logObservation(pageId, 'MISSING_DESCRIPTION', `The page ${url} is missing a meta description.`);
        } else if (description.length < 70 || description.length > 160) {
            this.logObservation(pageId, 'INVALID_DESCRIPTION_LENGTH', `Description length for ${url} is ${description.length}. Recommended: 70-160 chars.`);
        }
    },

    async addLinkToQueue(pageId, url) {
        const { rows } = await query('SELECT id FROM pages WHERE url = $1 AND scan_id = (SELECT scan_id FROM pages WHERE id = $2)', [url, pageId]);
        if (rows.length === 0) {
            const scanResult = await query('SELECT scan_id FROM pages WHERE id = $1', [pageId]);
            const scanId = scanResult.rows[0].scan_id;
            const insertResult = await query('INSERT INTO pages (scan_id, url) VALUES ($1, $2) ON CONFLICT (scan_id, url) DO NOTHING RETURNING id', [scanId, url]);
            if (insertResult.rows.length > 0) {
                const newPageId = insertResult.rows[0].id;
                scanQueue.add({ pageId: newPageId, url });
                logger.info(`Added to queue: ${url}`);
            }
        }
    },

    async logObservation(pageId, type, message) {
        await query('INSERT INTO observations (page_id, type, message) VALUES ($1, $2, $3)', [pageId, type, message]);
        auditLogger.warn(message);
    }
};

scanQueue.process(async (job) => {
    const { pageId, url } = job.data;
    logger.info(`Processing: ${url}`);
    try {
        await SEOScan.analyzePage(pageId, url);
    } catch (error) {
        logger.error(`Failed to process ${url}: ${error.message}`);
        throw error; // Let Bull handle the retry
    }
});

logger.info('Worker started and listening for jobs...');