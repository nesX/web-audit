# Application Architecture

This document outlines the architecture of the SEO Web Audit tool, a Node.js application designed to crawl a website and analyze its pages for common SEO issues.

## Core Components

The application is built around a few key components that work together to enable concurrent, queue-based web crawling and analysis.

### 1. Command-Line Interface (CLI) - `index.js`

- **Purpose:** The main entry point for the user. It's responsible for parsing commands and initiating the scan.
- **Framework:** `yargs` is used to define and manage the CLI commands.
- **Workflow:**
  - The `scan <url>` command is invoked by the user.
  - It creates a new `scan` record in the PostgreSQL database.
  - It inserts the initial URL into the `pages` table.
  - It adds the first job (containing the `pageId` and `url`) to the Bull queue.

### 2. Job Queue - `src/lib/queue.js`

- **Purpose:** Manages the queue of URLs to be scanned, preventing duplicate work and enabling concurrent processing.
- **Technology:** [Bull](https://github.com/OptimalBits/bull), backed by Redis.
- **Workflow:**
  - The queue, named `scan`, holds jobs, where each job represents a page to be analyzed.
  - Workers pick up jobs from this queue.
  - It is configured with a rate limiter and job retry policies (`backoff`) to handle transient network errors gracefully.

### 3. Worker - `worker.js`

- **Purpose:** The workhorse of the application. It runs as a separate process that consumes jobs from the queue. Multiple worker processes can be run simultaneously to increase throughput.
- **Workflow:**
  1. **Dequeue Job:** The worker pulls a job from the `scan` queue.
  2. **Fetch HTML:** It uses `axios` to download the HTML content of the URL from the job data.
  3. **Parse & Analyze:** It uses `cheerio` to parse the HTML. The core analysis logic then checks for:
     - Title presence and length.
     - Meta description presence and length.
     - (Future) Broken images, duplicate content, etc.
  4. **Log Observations:** Any SEO issues found are logged to `logs/observations.log` and saved to the `observations` table in the database.
  5. **Discover & Enqueue Links:** It extracts all internal links from the page. Each new, unique internal link is added as a new job to the queue to be processed by a worker.

### 4. Database - `src/lib/db.js` & `database.sql`

- **Purpose:** Provides data persistence for scan results and job tracking.
- **Technology:** PostgreSQL, accessed via the `pg` (node-postgres) library.
- **Schema (`database.sql`):**
  - `scans`: Stores a record for each top-level scan initiated.
  - `pages`: Stores every unique URL discovered during a scan, along with its title and description. The `processed` flag helps track its state.
  - `observations`: Stores a record for each specific SEO issue found on a page.
- **Data Access (`src/lib/db.js`):** A dedicated module that abstracts all database interactions. It exports a connection pool and query functions to ensure that database logic is not mixed with business logic in other parts of the application.

### 5. Logging - `src/lib/logger.js`

- **Purpose:** Provides structured logging for application monitoring and auditing.
- **Technology:** `winston`.
- **Log Files:**
  - `logs/app.log`: Records general application events, such as when a scan starts, a job is processed, or an error occurs. It's used for debugging and monitoring the application's health.
  - `logs/observations.log`: Records a human-readable list of all SEO issues found, making it easy to see the audit results at a glance.

## Data Flow

1. **Initiation:** `node index.js scan <some-url>`
2. **DB Record:** A new row is created in `scans` and `pages`.
3. **Queueing:** The initial URL is added to the `scan` queue in Redis.
4. **Processing:** A `worker.js` process picks up the job.
5. **Analysis:** The worker fetches the page, analyzes it, and stores results (title, description) in the `pages` table.
6. **Logging:** Any issues are saved to the `observations` table and `logs/observations.log`.
7. **Crawling:** New internal links found on the page are added to the `pages` table and enqueued for processing.
8. **Continuation:** The cycle continues until the queue is empty.