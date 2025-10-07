const cheerio = require('cheerio');
const axios = require('axios');
const { URL } = require('url');

const SEO_RECOMMENDATIONS = {
    title: {
        min: 30,
        max: 65,
    },
    description: {
        min: 70,
        max: 160,
    },
};

const analyzePage = async (url, html) => {
    const $ = cheerio.load(html);
    const observations = [];

    // 1. Analyze Title
    const title = $('title').text();
    if (!title) {
        observations.push({ type: 'SEO', message: 'Missing title tag.' });
    } else if (title.length < SEO_RECOMMENDATIONS.title.min || title.length > SEO_RECOMMENDATIONS.title.max) {
        observations.push({
            type: 'SEO',
            message: `Title length is ${title.length}. Recommended: ${SEO_RECOMMENDATIONS.title.min}-${SEO_RECOMMENDATIONS.title.max} characters.`,
        });
    }

    // 2. Analyze Meta Description
    const description = $('meta[name="description"]').attr('content');
    if (!description) {
        observations.push({ type: 'SEO', message: 'Missing meta description.' });
    } else if (description.length < SEO_RECOMMENDATIONS.description.min || description.length > SEO_RECOMMENDATIONS.description.max) {
        observations.push({
            type: 'SEO',
            message: `Meta description length is ${description.length}. Recommended: ${SEO_RECOMMENDATIONS.description.min}-${SEO_RECOMMENDATIONS.description.max} characters.`,
        });
    }

    // 3. Check for broken images
    const imageChecks = [];
    $('img').each((i, img) => {
        const src = $(img).attr('src');
        if (src) {
            try {
                const absoluteSrc = new URL(src, url).href;
                const imageCheck = axios.head(absoluteSrc, { timeout: 5000 })
                    .catch(() => {
                        observations.push({ type: 'Image', message: `Broken image found: ${absoluteSrc}` });
                    });
                imageChecks.push(imageCheck);
            } catch (error) {
                // Ignore invalid image URLs
            }
        }
    });

    await Promise.all(imageChecks);

    return {
        url,
        title,
        description,
        observations,
    };
};

module.exports = {
    analyzePage,
};