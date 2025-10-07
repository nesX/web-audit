-- Table to store overall scan information
CREATE TABLE scans (
    id SERIAL PRIMARY KEY,
    url VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table to store information about each page scanned
CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    url VARCHAR(2048) NOT NULL,
    title TEXT,
    description TEXT,
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(scan_id, url)
);

-- Table to log observations (SEO issues) for each page
CREATE TABLE observations (
    id SERIAL PRIMARY KEY,
    page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL, -- e.g., 'MISSING_TITLE', 'DUPLICATE_DESCRIPTION', 'BROKEN_IMAGE'
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes to speed up queries
CREATE INDEX idx_pages_url ON pages(url);
CREATE INDEX idx_observations_type ON observations(type);