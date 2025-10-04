const logger = require('../../config/logHandler')
const {chromium} = require('playwright')

const fetchDynamicHtml = async (url, retries = 2) => {
  const { chromium } = require('playwright');
  const logger = require('../../config/logHandler');

  for (let attempt = 0; attempt <= retries; attempt++) {
    let browser = null;
    try {
      browser = await chromium.launch({ 
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });

      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 },
        ignoreHTTPSErrors: true,
      });

      const page = await context.newPage();
      
      page.setDefaultTimeout(15000); 
      page.setDefaultNavigationTimeout(15000);

      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
      });

      const waitStrategy = attempt === 0 ? 'networkidle' : 'domcontentloaded';
      
      await page.goto(url, { 
        waitUntil: waitStrategy,
        timeout: 15000 
      });
      
      const html = await page.content();
      await browser.close();
      
      logger.info(`Dynamic HTML fetched successfully for: ${url} (attempt ${attempt + 1})`);
      return html;
      
    } catch (error) {
      if (browser) {
        await browser.close();
      }
      
      if (attempt === retries) {
        logger.error(`Dynamic HTML fetch failed after ${retries + 1} attempts for: ${url}`, error);
        throw error;
      } else {
        logger.warn(`Dynamic HTML fetch attempt ${attempt + 1} failed for: ${url}, retrying...`, error.message);
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
};

module.exports = fetchDynamicHtml