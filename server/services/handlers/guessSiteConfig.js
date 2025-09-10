const { baseConfig, newsConfig, ecommerceConfig } = require("./scoringConfig");

function guessSiteType(document) {
  const text = document.body.textContent || "";

  // NEWS / BLOG detection
  if (
    document.querySelector("article, time, .byline, meta[property='article:published_time']") ||
    /by\s+[A-Z][a-z]+/.test(text)
  ) {
    return "news";
  }

  // E-COMMERCE
  if (
    document.querySelector(".price, [itemprop=price], [class*=product], [id*=cart], [class*=review]") ||
    /\$\d+(\.\d{2})?/.test(text)
  ) {
    return "ecommerce";
  }

  // WIKI
  if (
    document.querySelector("#toc, .mw-parser-output, .infobox") ||
    /wikipedia/i.test(document.title)
  ) {
    return "wiki";
  }

  // FORUM / Q&A
  if (
    document.querySelector(".comment, .thread, .post, .reply, [id*=thread]") ||
    /Replies:\s*\d+|Joined:\s*\d{4}/i.test(text)
  ) {
    return "forum";
  }

  return "generic";
}

function getConfigForDocument(document) {
  const type = guessSiteType(document);

  switch (type) {
    case "news":
      return newsConfig;
    case "ecommerce":
      return ecommerceConfig;
    default:
      return baseConfig;
  }
}

function detectSiteType(url, document) {
  const hostname = new URL(url).hostname.toLowerCase();
  
  // Direct site mapping
  if (hostname.includes('reddit.com')) return 'reddit';
  if (hostname.includes('news.ycombinator.com')) return 'hackernews';
  if (hostname.includes('github.com')) return 'github';
  if (hostname.includes('stackoverflow.com')) return 'stackoverflow';
  if (hostname.includes('dev.to')) return 'devto';
  if (hostname.includes('medium.com')) return 'blog';
  
  // Pattern-based detection
  const ecommerceIndicators = [
    '.product-price', '.add-to-cart', '.buy-now', 
    '[data-testid="price"]', '.checkout'
  ];
  
  for (const selector of ecommerceIndicators) {
    if (document.querySelector(selector)) return 'ecommerce';
  }
  
  const newsIndicators = [
    'meta[property="article:published_time"]',
    '.byline', '.author', '.published-date',
    '[data-module="ArticleBody"]'
  ];
  
  for (const selector of newsIndicators) {
    if (document.querySelector(selector)) return 'news';
  }
  
  const blogIndicators = [
    '.post-content', '.entry-content', '.blog-post',
    'article.post', '.wp-block-post'
  ];
  
  for (const selector of blogIndicators) {
    if (document.querySelector(selector)) return 'blog';
  }
  
  return 'base';
}


module.exports = {
  getConfigForDocument,
  detectSiteType
}