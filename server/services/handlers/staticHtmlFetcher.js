const logger = require('../../config/logHandler');

const fetchStaticHtml = async (url) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); 

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
    return await res.text();
  } catch (error) {
    if (error.name === 'AbortError') {
      logger.warn(`Static HTML fetch timeout for: ${url}`);
    } else {
      logger.error("Error fetching static HTML: ", error);
    }
    throw error;
  }
};

module.exports = fetchStaticHtml;
