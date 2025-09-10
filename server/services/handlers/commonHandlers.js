const logger = require("../../config/logHandler");

function plainText(node) {
  if (!node) return "";

  const tag = node.tagName?.toLowerCase();
  if (["script", "style", "noscript", "iframe"].includes(tag)) return "";

  if (node.nodeType === 3) return node.nodeValue.trim();

  let parts = [];
  for (const child of node.childNodes) {
    const t = plainText(child);
    if (t) parts.push(t);
  }

  return parts.join(" ");
}

function looksLikeJsonBlob(text) {
  return (
    text.length > 200 &&
    /^[\{\[]/.test(text.trim()) &&
    /[{[,:}\]]/.test(text) &&
    text.split('\n').length < 3
  );
}

function isHidden(el) {
  if (!el.getAttribute) return false;
  const style = el.getAttribute('style') || '';
  const computedStyle = el.style || {};

  return /display:\s*none|visibility:\s*hidden/.test(style) ||
    computedStyle.display === 'none' ||
    computedStyle.visibility === 'hidden';
}

function shouldSkipNode(node, config) {
  if (!node || !node.tagName) return true;

  const tag = node.tagName.toLowerCase();
  if (config.tags.bad.includes(tag)) return true;
  if (isHidden(node)) return true;
  if (looksLikeJsonBlob(node.textContent || '')) return true;

  if (config.selectors?.skip) {
    for (const selector of config.selectors.skip) {
      try {
        if (node.matches && node.matches(selector)) return true;
      } catch (e) {
        logger.error("Error skiping skip selectors: ", { error: e })
      }
    }
  }

  return false;
}

function mergeFragments(candidates) {
  const map = new Map();

  for (const c of candidates) {
    const key = c.node || c.text;

    if (map.has(key)) {
      const existing = map.get(key);
      const combinedText = existing.text + ' ' + c.text;
      const dedupedText = Array.from(new Set(combinedText.split(/(?<=[.!?])\s+/))).join(' ');
      existing.text = sanitizeFinalText(dedupedText);
      existing.score += c.score;
    } else {
      map.set(key, { ...c });
    }
  }

  return Array.from(map.values());
}

function sanitizeFinalText(text) {
  return text
    // HTML comments, scripts, styles
    .replace(/<!--.*?-->|<script.*?>.*?<\/script>|<style.*?>.*?<\/style>/gis, ' ')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // JSON-y chars ", ', \, /
    .replace(/["'\\\/]/g, '') 
    // special junk
    .replace(/\u00A0/g, '')
    .replace(/[*[\]]/g, '')
    .replace(/---|--/g, '')
    .replace(/♪/g, '')
    // leftover pipes and spaces
    .replace(/\s*\|\s*/g, ' ')
    .trim();
}

function extractMetaData(header, document, baseUrl) {
  const getMeta = (sel) => {
    const el = document.querySelector(sel);
    return el ? (el.content || el.innerText || '').trim() : null;
  };

  switch (header) {
    case 'title': {
      const titleSelectors = [
        'meta[property="og:title"]',
        'meta[name="twitter:title"]',
        'meta[name="title"]',
        'meta[itemprop="headline"]',
        'title',
        'h1'
      ];

      for (const sel of titleSelectors) {
        const title = getMeta(sel);
        if (title) {
          return title.replace(/ [\|\-–:] .+$/, '').trim();
        }
      }

      if (baseUrl) {
        try {
          const u = new URL(baseUrl);
          const pathTitle = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '');
          return pathTitle.replace(/[-_]/g, ' ').trim();
        } catch (e) {
          logger.error("Error fetching title: ", { error: e })
        }
      }
      return 'Untitled';
    }

    case 'date': {
      return getMeta('meta[property="article:published_time"]') ||
        getMeta('meta[name="date"]') ||
        getMeta('meta[name="publish-date"]') ||
        getMeta('time[datetime]') ||
        null;
    }

    default:
      return null;
  }
}

function secondsToMins(num) {
  const totalSec = Math.trunc(num)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  const formattedSec = String(sec).padStart(2, '0')
  return `${min}.${formattedSec}`
}

module.exports = {
  shouldSkipNode,
  isHidden,
  plainText,
  looksLikeJsonBlob,
  sanitizeFinalText,
  mergeFragments,
  extractMetaData,
  secondsToMins,
}