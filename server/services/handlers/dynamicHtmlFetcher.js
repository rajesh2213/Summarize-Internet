const logger = require('../../config/logHandler')
const {chromium} = require('playwright')

const fetchDynamicHtml = async (url) => {
  const { chromium } = require('playwright');
  const logger = require('../../config/logHandler');

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });

    await page.goto(url, { waitUntil: 'networkidle' });
    const html = await page.content();

    await browser.close();
    return html;
  } catch (error) {
    logger.error('Error fetching dynamic HTML: ', error);
  } finally {
    await browser.close();
  }
};

module.exports = fetchDynamicHtml