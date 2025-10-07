const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool(config.db);

const initDb = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Table for scans
        await client.query(`
            CREATE TABLE IF NOT EXISTS scans (
                id SERIAL PRIMARY KEY,
                start_url TEXT NOT NULL,
                status VARCHAR(20) DEFAULT 'running',
                start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                end_time TIMESTAMP WITH TIME ZONE
            );
        `);

        // Table for pages
        await client.query(`
            CREATE TABLE IF NOT EXISTS pages (
                id SERIAL PRIMARY KEY,
                scan_id INTEGER REFERENCES scans(id),
                url TEXT NOT NULL UNIQUE,
                title TEXT,
                description TEXT,
                status VARCHAR(20) DEFAULT 'pending'
            );
        `);

        // Table for observations
        await client.query(`
            CREATE TABLE IF NOT EXISTS observations (
                id SERIAL PRIMARY KEY,
                page_id INTEGER REFERENCES pages(id),
                type VARCHAR(50),
                message TEXT
            );
        `);

        await client.query('COMMIT');
        console.log('Database schema initialized successfully.');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Error initializing database schema:', e);
        throw e;
    } finally {
        client.release();
    }
};

module.exports = {
    pool,
    initDb,
    query: (text, params) => pool.query(text, params),
};