import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { query } from './src/lib/db.js';
import scanQueue from './src/lib/queue.js';
import { logger } from './src/lib/logger.js';

yargs(hideBin(process.argv))
  .command(
    'scan <url>',
    'Start a new SEO scan for the given URL',
    (yargs) => {
      return yargs.positional('url', {
        describe: 'The root URL to start scanning from',
        type: 'string',
      });
    },
    async (argv) => {
      const { url } = argv;
      logger.info(`Starting scan for: ${url}`);

      try {
        // 1. Create a new scan entry in the database
        const scanRes = await query('INSERT INTO scans (url) VALUES ($1) RETURNING id', [url]);
        const scanId = scanRes.rows[0].id;
        logger.info(`Created scan with ID: ${scanId}`);

        // 2. Add the first page to the pages table
        const pageRes = await query(
          'INSERT INTO pages (scan_id, url) VALUES ($1, $2) RETURNING id',
          [scanId, url]
        );
        const pageId = pageRes.rows[0].id;

        // 3. Add the first job to the queue
        await scanQueue.add({ pageId, url });
        logger.info(`Successfully queued initial URL: ${url}`);

        console.log('Scan initiated. See logs/app.log for progress.');
        // The process should not exit immediately, to allow workers to process.
        // In a real app, you might want to disconnect DB/Redis connections gracefully.
        scanQueue.on('completed', (job) => {
            logger.info(`Job ${job.id} has completed.`);
        });

      } catch (error) {
        logger.error(`Failed to start scan: ${error.message}`);
        process.exit(1);
      }
    }
  )
  .demandCommand(1, 'You need to provide a command.')
  .help()
  .argv;