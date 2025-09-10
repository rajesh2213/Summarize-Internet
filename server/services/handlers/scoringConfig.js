const siteConfigs = {
  base: {
    weights: {
      TEXT_LEN_PER_CHAR: 0.05,
      PUNCT_DENSITY: 200,
      LINK_DENSITY_PENALTY: 300,
      CHILD_SCORE_MULTIPLIER: 0.3,
      TAG_BOOST: 500,
      TAG_PENALTY: -500,
      HEADING_SNIPPET_BOOST: 600,
      BONUS: 400,
      READABILITY_BOOST: 1000
    },
    thresholds: {
      MIN_TEXT_LENGTH: 50,
      MIN_DETAILS_LENGTH: 200,
      MIN_CANDIDATE_SCORE: 1,
      MAX_LINK_DENSITY: 0.5
    },
    tags: {
      good: ["article", "main", "section", "div[class*='content']", "div[class*='post']"],
      bad: ["nav", "aside", "footer", "script", "style", "noscript", "header"],
      content: ["p", "div", "section", "article"]
    },
    selectors: {
      content: [
        'article',
        '[role="main"]',
        'main',
        '.content',
        '.post-content',
        '.entry-content',
        '.article-content',
        '.story-body'
      ],
      skip: [
        '.advertisement',
        '.ads',
        '.sidebar',
        '.related',
        '.comments',
        '.social-share',
        'nav',
        'footer',
        'header'
      ]
    }
  },

  reddit: {
    selectors: {
      content: [
        '[data-test-id="post-content"]',
        '.usertext-body',
        '[data-click-id="text"]',
        '.md'
      ],
      title: ['h1', '[data-test-id="post-content"] h1', '.title'],
      skip: ['.sidebar', '.promoted', '.subreddit-rules']
    },
    api: {
      jsonUrl: (url) => url.replace(/www\.reddit\.com/, 'www.reddit.com') + '.json',
      useJson: true
    }
  },

  hackernews: {
    api: { useJson: true },
    selectors: {
      content: ['.comment', '.toptext']
    }
  },

  github: {
    api: { useJson: true },
    selectors: {
      content: ['.readme', '.markdown-body', '.Box-body']
    }
  },

  stackoverflow: {
    api: { useJson: true },
    selectors: {
      content: ['.s-prose', '.post-text', '.question-hyperlink']
    }
  },

  devto: {
    api: { useJson: true },
    selectors: {
      content: ['#article-body', '.crayons-article__body']
    }
  },
  
  news: {
    weights: {
      HEADING_SNIPPET_BOOST: 800,
      TAG_BOOST: 600
    },
    selectors: {
      content: [
        '.story-body',
        '.article-body',
        '.post-content',
        '[data-module="ArticleBody"]',
        '.content-body'
      ]
    }
  },

  ecommerce: {
    weights: {
      TAG_BOOST: 300,
      HEADING_SNIPPET_BOOST: 200
    },
    thresholds: {
      MIN_DETAILS_LENGTH: 100
    },
    selectors: {
      content: [
        '.product-description',
        '.product-details',
        '.product-info',
        '[data-testid="product-description"]'
      ]
    }
  },

  blog: {
    weights: {
      TAG_BOOST: 600,
      HEADING_SNIPPET_BOOST: 500
    },
    selectors: {
      content: [
        '.post-content',
        '.entry-content',
        '.blog-post',
        'article .content'
      ]
    }
  }
};

module.exports = siteConfigs