const axios = require('axios');
const TMDB_BASE_URL = 'https://image.tmdb.org';

const cache = new Map();
const CACHE_DURATION = 60 * 60 * 1000;
const MAX_CACHE_SIZE = 500;

function cleanExpiredCache() {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
        if (now > value.expiry) cache.delete(key);
    }
}
setInterval(cleanExpiredCache, CACHE_DURATION);

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const fullPath = req.url;
        const cacheKey = fullPath;

        if (cache.has(cacheKey)) {
            const cached = cache.get(cacheKey);
            if (Date.now() < cached.expiry) {
                res.setHeader('Content-Type', cached.contentType);
                res.setHeader('Cache-Control', 'public, max-age=86400');
                return res.status(200).send(cached.data);
            }
            cache.delete(cacheKey);
        }

        const tmdbUrl = `${TMDB_BASE_URL}${fullPath}`;
        const response = await axios.get(tmdbUrl, { responseType: 'arraybuffer' });

        if (cache.size > MAX_CACHE_SIZE) {
            const firstKey = cache.keys().next().value;
            cache.delete(firstKey);
        }

        const buf = Buffer.from(response.data);
        cache.set(cacheKey, {
            data: buf,
            contentType: response.headers['content-type'],
            expiry: Date.now() + CACHE_DURATION
        });

        res.setHeader('Content-Type', response.headers['content-type']);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.status(200).send(buf);
    } catch (error) {
        console.error('Image proxy error:', error.message);
        res.status(error.response?.status || 500).end();
    }
};
