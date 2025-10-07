const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

/**
 * Fetches a single page and extracts all internal links.
 * @param {string} pageUrl - The URL of the page to process.
 * @param {string} startUrl - The initial URL of the scan, used to identify the domain.
 * @returns {Promise<{html: string, links: string[]}>} - The page's HTML and an array of absolute internal links.
 */
const processPage = async (pageUrl, startUrl) => {
    const domain = new URL(startUrl).hostname;
    const internalLinks = new Set();

    try {
        const response = await axios.get(pageUrl, { timeout: 10000 });
        const html = response.data;
        const $ = cheerio.load(html);

        $('a').each((i, link) => {
            const href = $(link).attr('href');
            if (href) {
                try {
                    const absoluteUrl = new URL(href, pageUrl).href;
                    // Ensure the link is within the same domain and is an HTTP/S link
                    if (new URL(absoluteUrl).hostname === domain && ['http:', 'https:'].includes(new URL(absoluteUrl).protocol)) {
                        internalLinks.add(absoluteUrl);
                    }
                } catch (error) {
                    // Ignore invalid URLs
                }
            }
        });

        return {
            html,
            links: [...internalLinks],
        };
    } catch (error) {
        console.error(`Failed to process ${pageUrl}: ${error.message}`);
        throw error;
    }
};

module.exports = {
    processPage,
};