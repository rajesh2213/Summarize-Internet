const { resolve } = require('path');
const logger = require('../../../config/logHandler');

class JsonApiFetcher {
  constructor() {
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 ContentExtractor/1.0';
    this.accessToken = null;
    this.tokenExpiry = 0;
  }

  _timeout(ms) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(new Error("Request timed out"))
      }, ms)
    })
  }

  async fetchJson(url, options = {}) {
    const timeoutMs = options.timeout || 10000;
    try {
      const fetchPromise = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
          ...options.headers
        },
        ...options
      });

      const response = await Promise.race([
        fetchPromise,
        this._timeout(timeoutMs)
      ])

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error(`JSON fetch failed for ${url}:`, error.message);
      throw error;
    }
  }

  async _getRedditAccessToken() {
    const now = Date.now();
    if (this.accessToken && now < this.tokenExpiry - 60000) {
      return this.accessToken;
    }

    const creds = Buffer.from(`${process.env.REDDIT_CLIENTID}:${process.env.REDDIT_CLIENT_SECRET}`).toString('base64');
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('username', process.env.REDDIT_USERNAME);
    params.append('password', process.env.REDDIT_PASSWORD);

    const res = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${creds}`,
        'User-Agent': this.userAgent,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    if (!res.ok) throw new Error(`Reddit token request failed: ${res.statusText}`);
    const data = await res.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = now + (data.expires_in * 1000);
    return this.accessToken;
  }

  async fetchReddit(url, maxRetries = 3, initialDelay = 2000) {
    let attempt = 0;
    let delay = initialDelay;

    while (attempt < maxRetries) {
      try {
        const token = await this._getRedditAccessToken();
        let cleanUrl = url.replace(/^https?:\/\/(www\.)?reddit\.com/, '');
        if (!cleanUrl.startsWith('/')) cleanUrl = '/' + cleanUrl;
        if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);

        const apiUrl = `https://oauth.reddit.com${cleanUrl}`;
        const data = await this.fetchJson(apiUrl, { headers: { Authorization: `Bearer ${token}` } });

        // Single post permalink
        if (Array.isArray(data)) {
          const posts = data[0]?.data?.children || [];
          const comments = data[1]?.data?.children || [];

          if (posts.length > 0) {
            return posts.map((p, idx) => ({
              title: p.data.title || '',
              content: p.data.selftext || p.data.title || '',
              author: p.data.author || '',
              created: new Date(p.data.created_utc * 1000).toISOString(),
              url: `https://reddit.com${p.data.permalink}`,
              score: p.data.score || 0,
              comments: idx === 0
                ? comments.map(c => c.data.body).filter(Boolean)
                : []
            }));
          }
        }

        // Subreddit listing (multiple posts)
        const posts = data?.data?.children || [];
        return posts.map(p => ({
          title: p.data.title || '',
          content: p.data.selftext || p.data.title || '',
          author: p.data.author || '',
          created: new Date(p.data.created_utc * 1000).toISOString(),
          url: `https://reddit.com${p.data.permalink}`,
          score: p.data.score || 0,
          comments: []
        }));

      } catch (error) {
        attempt++;
        if (error.message.includes("403")) {
          logger.warn(`[JsonApiFetcher] Reddit 403 Blocked, retry attempt ${attempt} in ${delay}ms`);
        } else {
          logger.warn(`[JsonApiFetcher] Reddit fetch error, retry attempt ${attempt} in ${delay}ms`);
        }

        if (attempt >= maxRetries) {
          logger.error(`[JsonApiFetcher] Reddit fetch failed permanently for ${url}:`, error.message);
          return [];
        }

        await new Promise(res => setTimeout(res, delay));
        delay *= 2;
      }
    }
  }

  // Medium
  async fetchMedium(url) {
    try {
      // Extract username or publication from URL
      const match = url.match(/medium\.com\/(@[\w-]+|[\w-]+)/);
      if (!match) throw new Error('Invalid Medium URL format');

      const feedUrl = `https://medium.com/feed/${match[1]}`;

      logger.info('Medium requires RSS parsing, not direct JSON');
      return null;

    } catch (error) {
      logger.error('Medium fetch failed:', error);
      return null;
    }
  }

  // Hacker News 
  async fetchHackerNews(url) {
    try {
      const itemMatch = url.match(/news\.ycombinator\.com\/item\?id=(\d+)/);
      if (!itemMatch) return null;

      const itemId = itemMatch[1];
      const apiUrl = `https://hacker-news.firebaseio.com/v0/item/${itemId}.json`;

      const data = await this.fetchJson(apiUrl);

      return {
        title: data.title || '',
        content: data.text || data.title || '',
        author: data.by || '',
        score: data.score || 0,
        created: new Date(data.time * 1000).toISOString(),
        url: data.url || url,
        comments_count: data.descendants || 0
      };

    } catch (error) {
      logger.error('Hacker News fetch failed:', error);
      return null;
    }
  }

  // GitHub 
  async fetchGitHub(url) {
    try {
      const repoMatch = url.match(/github\.com\/([\w-]+)\/([\w-]+)/);
      const issueMatch = url.match(/github\.com\/([\w-]+)\/([\w-]+)\/issues\/(\d+)/);
      const prMatch = url.match(/github\.com\/([\w-]+)\/([\w-]+)\/pull\/(\d+)/);

      if (issueMatch) {
        const [, owner, repo, number] = issueMatch;
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${number}`;
        const data = await this.fetchJson(apiUrl);

        return {
          title: data.title || '',
          content: data.body || '',
          author: data.user?.login || '',
          created: data.created_at,
          url: data.html_url
        };
      }

      if (prMatch) {
        const [, owner, repo, number] = prMatch;
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`;
        const data = await this.fetchJson(apiUrl);

        return {
          title: data.title || '',
          content: data.body || '',
          author: data.user?.login || '',
          created: data.created_at,
          url: data.html_url
        };
      }

      if (repoMatch) {
        const [, owner, repo] = repoMatch;
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
        const readmeUrl = `https://api.github.com/repos/${owner}/${repo}/readme`;

        const [repoData, readmeData] = await Promise.allSettled([
          this.fetchJson(apiUrl),
          this.fetchJson(readmeUrl)
        ]);

        const repo_info = repoData.status === 'fulfilled' ? repoData.value : {};
        const readme = readmeData.status === 'fulfilled' ?
          Buffer.from(readmeData.value.content, 'base64').toString() : '';

        return {
          title: repo_info.full_name || '',
          content: (repo_info.description || '') + '\n\n' + readme,
          author: repo_info.owner?.login || '',
          created: repo_info.created_at,
          url: repo_info.html_url,
          stars: repo_info.stargazers_count || 0
        };
      }

    } catch (error) {
      logger.error('GitHub fetch failed:', error);
      return null;
    }
  }

  // Stack Overflow 
  async fetchStackOverflow(url) {
    try {
      const questionMatch = url.match(/stackoverflow\.com\/questions\/(\d+)/);
      if (!questionMatch) return null;

      const questionId = questionMatch[1];
      const apiUrl = `https://api.stackexchange.com/2.3/questions/${questionId}?order=desc&sort=activity&site=stackoverflow&filter=withbody`;

      const data = await this.fetchJson(apiUrl);
      const question = data.items?.[0];

      if (question) {
        return {
          title: question.title || '',
          content: question.body || '',
          author: question.owner?.display_name || '',
          score: question.score || 0,
          created: new Date(question.creation_date * 1000).toISOString(),
          url: url,
          tags: question.tags || []
        };
      }

    } catch (error) {
      logger.error('Stack Overflow fetch failed:', error);
      return null;
    }
  }

  // Dev.to
  async fetchDevTo(url) {
    try {
      const articleMatch = url.match(/dev\.to\/([\w-]+)\/([\w-]+)/);
      if (!articleMatch) return null;

      const [, username, slug] = articleMatch;
      const apiUrl = `https://dev.to/api/articles/${username}/${slug}`;

      const data = await this.fetchJson(apiUrl);

      return {
        title: data.title || '',
        content: data.body_markdown || data.description || '',
        author: data.user?.name || '',
        created: data.published_at,
        url: data.url,
        tags: data.tag_list || []
      };

    } catch (error) {
      logger.error('Dev.to fetch failed:', error);
      return null;
    }
  }

  async fetchFromJsonApi(url) {
    const hostname = new URL(url).hostname.toLowerCase();

    if (hostname.includes('reddit.com')) {
      return await this.fetchReddit(url);
    }

    if (hostname.includes('news.ycombinator.com')) {
      return await this.fetchHackerNews(url);
    }

    if (hostname.includes('github.com')) {
      return await this.fetchGitHub(url);
    }

    if (hostname.includes('stackoverflow.com')) {
      return await this.fetchStackOverflow(url);
    }

    if (hostname.includes('dev.to')) {
      return await this.fetchDevTo(url);
    }

    if (hostname.includes('medium.com')) {
      return await this.fetchMedium(url);
    }
    return null;
  }
}

class StructuredDataExtractor {
  extractJsonLd(document) {
    const results = [];
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');

    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        const structured = this.parseStructuredData(data);
        if (structured) results.push(structured);
      } catch (error) {
        logger.warn('Failed to parse JSON-LD:', error.message);
      }
    }

    return results;
  }

  parseStructuredData(data) {
    if (Array.isArray(data)) {
      return data.map(item => this.parseStructuredData(item)).filter(Boolean);
    }

    const type = data['@type'] || '';

    if (['Article', 'NewsArticle', 'BlogPosting'].includes(type)) {
      return {
        title: data.headline || data.name || '',
        content: data.articleBody || data.description || '',
        author: data.author?.name || data.author || '',
        published: data.datePublished || '',
        url: data.url || '',
        type: 'article'
      };
    }

    if (type === 'Product') {
      return {
        title: data.name || '',
        content: data.description || '',
        price: data.offers?.price || '',
        currency: data.offers?.priceCurrency || '',
        url: data.url || '',
        type: 'product'
      };
    }

    if (type === 'Recipe') {
      return {
        title: data.name || '',
        content: [
          data.description || '',
          'Instructions: ' + (data.recipeInstructions?.map(i => i.text).join(' ') || ''),
          'Ingredients: ' + (data.recipeIngredient?.join(', ') || '')
        ].filter(Boolean).join('\n\n'),
        author: data.author?.name || data.author || '',
        url: data.url || '',
        type: 'recipe'
      };
    }

    return null;
  }
}

module.exports = {
  JsonApiFetcher,
  StructuredDataExtractor
};