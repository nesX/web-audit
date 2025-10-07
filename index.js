#!/usr/bin/env node

require('dotenv').config();
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { scanQueue } = require('./src/queue');
const db = require('./src/db');

const main = async (argv) => {
    const { url } = argv;

    try {
        // Initialize the database schema if it doesn't exist
        await db.initDb();

        // 1. Create a new scan record in the database
        const { rows: [scan] } = await db.query(
            'INSERT INTO scans (start_url, status) VALUES ($1, $2) RETURNING id',
            [url, 'starting']
        );
        const scanId = scan.id;

        // 2. Add the starting URL to the queue
        await scanQueue.add({ url, scanId, startUrl: url });

        // 3. Update scan status to 'running'
        await db.query('UPDATE scans SET status = $1 WHERE id = $2', ['running', scanId]);

        console.log(`Scan #${scanId} has been started for ${url}.`);
        console.log('Run one or more workers to process the queue:');
        console.log('node worker.js');

    } catch (error) {
        console.error('Failed to start scan:', error.message);
        process.exit(1);
    }
};


const manage = async (argv) => {
    const { op, scanId } = argv;
    if (op === 'status') {
        const { rows: [scan] } = await db.query('SELECT * from scans WHERE id = $1', [scanId]);
        if (!scan) {
            console.log(`Scan with id ${scanId} not found.`);
            return;
        }

        const { rows: [counts] } = await db.query(
            `SELECT
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
             FROM pages WHERE scan_id = $1`,
            [scanId]
        );

        console.log(`--- Scan #${scanId} Status ---`);
        console.log(`URL: ${scan.start_url}`);
        console.log(`Status: ${scan.status}`);
        console.log(`Started: ${scan.start_time}`);
        console.log('--- Page Progress ---');
        console.log(`Total pages discovered: ${counts.total}`);
        console.log(`Completed: ${counts.completed}`);
        console.log(`Pending: ${counts.pending}`);
        console.log(`Failed: ${counts.failed}`);

        if (counts.pending === '0' && scan.status === 'running') {
            await db.query('UPDATE scans SET status=$1, end_time=NOW() WHERE id=$2', ['completed', scanId]);
            console.log('Scan has been marked as completed.');
        }

    } else if (op === 'list') {
        const { rows: scans } = await db.query('SELECT id, start_url, status, start_time FROM scans ORDER BY id DESC');
        console.log('--- Recent Scans ---');
        scans.forEach(s => {
            console.log(`#${s.id}: ${s.start_url} - ${s.status} (${s.start_time})`);
        });
    }
};

yargs(hideBin(process.argv))
    .command(
        'scan <url>',
        'Start a new website scan',
        (yargs) => yargs.positional('url', { describe: 'The starting URL of the website to scan', type: 'string' }),
        main
    )
    .command(
        'manage <op> [scanId]',
        'Manage scans',
        (yargs) => {
            return yargs
                .positional('op', { describe: 'Operation to perform: status, list', choices: ['status', 'list'] })
                .positional('scanId', { describe: 'The ID of the scan to check status for', type: 'number' });
        },
        manage
    )
    .demandCommand(1, 'You must provide a command.')
    .help()
    .argv;

// Graceful shutdown
const gracefulShutdown = async () => {
    console.log('Closing connections...');
    await scanQueue.close();
    await db.pool.end();
    process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);