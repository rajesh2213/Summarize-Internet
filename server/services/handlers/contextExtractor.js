const { Readability } = require('@mozilla/readability');
const logger = require('../../config/logHandler');
const {
    sanitizeFinalText,
    mergeFragments,
    plainText,
    shouldSkipNode,
    extractMetaData
} = require('./commonHandlers')

async function extractWithReadability(document, url) {
    try {
        const reader = new Readability(document, {
            keepClasses: false,
            charThreshold: 250
        });

        const article = reader.parse();

        if (article && article.textContent) {
            const text = article.textContent.trim();

            const junkIndicators = [
                'sign in', 'subscribe', 'login', 'unlock member-only',
                'newsletter', 'cookie', 'consent', 'one tap', 'gsi_overlay'
            ];
            const looksLikeJunk = junkIndicators.some(j =>
                text.toLowerCase().includes(j)
            );

            logger.info('[Readability] Parsed candidate', {
                url,
                title: article.title || '',
                length: text.length,
                preview: text.slice(0, 200).replace(/\s+/g, ' ')
            });

            if (text.length > 200 && !looksLikeJunk) {
                return {
                    title: article.title || '',
                    url,
                    content: text,
                    readabilityScore: Math.min(text.length * 0.001, 1)
                };
            } else {
                logger.info('[Readability] Rejected candidate (too short or junk)', {
                    url,
                    len: text.length,
                    looksLikeJunk
                });
            }
        } else {
            logger.info('[Readability] No article returned by reader.parse()', { url });
        }
    } catch (error) {
        logger.warn('Readability extraction failed:', { error: error.message });
    }

    return null;
}


function extractWithSelectors(document, config, url) {
    const results = [];

    if (!config.selectors?.content) return results;

    for (const selector of config.selectors.content) {
        try {
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
                if (shouldSkipNode(el, config)) continue;

                const text = plainText(el);
                if (text && text.length > config.thresholds.MIN_TEXT_LENGTH) {
                    results.push({
                        text: sanitizeFinalText(text),
                        score: text.length * 0.1 + 500,
                        source: 'selector'
                    });
                }
            }
        } catch (e) {
            logger.warn(`Invalid selector: ${selector}`);
        }
    }

    return results;
}

function extractArticleCards(document, url) {
    const cards = [];
    const cardNodes = document.querySelectorAll('h3.title a, h2.title a');

    cardNodes.forEach(card => {
        const parent = card.closest('.element, .main-row-element, .row, div');

        const title = card.textContent.trim();
        const link = card.href;
        const snippet = parent?.querySelector('.sub-text')?.textContent?.trim() || "";
        const img = parent?.querySelector('img')?.src || null;
        const author = parent?.querySelector('.author-name')?.textContent?.trim() || "";

        if (title && link) {
            cards.push({
                title,
                url: link,
                snippet,
                img,
                author
            });
        }
    });

    if (cards.length > 0) {
        return {
            title: extractMetaData('title', document, url),
            url,
            content: JSON.stringify(cards, null, 2),
            candidates: cards.length,
            strategies: ['article-cards']
        };
    }

    return null;
}

function computeScoreAndCollect(node, config, candidates) {
    if (!node || node.nodeType !== 1) return null;
    if (shouldSkipNode(node, config)) return null;

    const role = (node.getAttribute('role') || '').toLowerCase();
    const clsId = ((node.getAttribute('class') || '') + ' ' + (node.id || '')).toLowerCase();
    const junkTokens = [
        'footer', 'header', 'nav', 'menu', 'subscribe', 'signin', 'login', 'paywall', 'cookie',
        'banner', 'overlay', 'modal', 'popup', 'consent', 'newsletter', 'sidebar', 'share',
        'social', 'comments', 'ad', 'advert', 'gsi_overlay', 'onettap', 'onettapoverlay'
    ];
    if (['navigation', 'banner', 'complementary', 'contentinfo'].includes(role) ||
        junkTokens.some(t => clsId.includes(t))) {
        return null;
    }

    const MIN_TEXT = config?.thresholds?.MIN_TEXT_LENGTH ?? 120;
    const text = plainText(node);
    if (!text || text.length < MIN_TEXT) return null;

    const textLen = text.length;
    const linkText = Array.from(node.querySelectorAll('a')).map(li => li.textContent).join('');
    const linkDensity = linkText.length / Math.max(textLen, 1);

    const MAX_LINK = config?.thresholds?.MAX_LINK_DENSITY ?? 0.45;
    if (linkDensity > MAX_LINK) return null;

    const paragraphs = node.querySelectorAll('p').length;
    const paragraphRatio = paragraphs / Math.max(node.children.length || 1, 1);
    const punctChars = (text.match(/[.,;:!?]/g) || []).length;
    const punctDensity = punctChars / Math.max(textLen, 1);

    const weights = {
        TEXT_LEN_PER_CHAR: config?.weights?.TEXT_LEN_PER_CHAR ?? 0.002,
        PUNCT_DENSITY: config?.weights?.PUNCT_DENSITY ?? 200,
        LINK_DENSITY_PENALTY: config?.weights?.LINK_DENSITY_PENALTY ?? 300,
        BONUS: config?.weights?.BONUS ?? 50,
        TAG_BOOST: config?.weights?.TAG_BOOST ?? 30,
        TAG_PENALTY: config?.weights?.TAG_PENALTY ?? 40,
        HEADING_SNIPPET_BOOST: config?.weights?.HEADING_SNIPPET_BOOST ?? 50,
        CHILD_SCORE_MULTIPLIER: config?.weights?.CHILD_SCORE_MULTIPLIER ?? 0.1
    };

    let rawScore = 0;
    rawScore += textLen * weights.TEXT_LEN_PER_CHAR;
    rawScore += punctDensity * weights.PUNCT_DENSITY;
    rawScore -= linkDensity * weights.LINK_DENSITY_PENALTY;

    const MIN_DETAILS = config?.thresholds?.MIN_DETAILS_LENGTH ?? 400;
    if (textLen > MIN_DETAILS && paragraphRatio > 0.5) {
        rawScore += textLen * (1 - linkDensity);
        rawScore += 50 * punctDensity;
    }

    const goodTags = (config?.tags?.good ?? ['article', 'main', 'section']).map(t => t.toLowerCase());
    const badTags = (config?.tags?.bad ?? ['aside', 'nav', 'footer']).map(t => t.toLowerCase());
    const nodeTag = node.tagName?.toLowerCase();

    if (goodTags.includes(nodeTag)) rawScore += weights.TAG_BOOST;
    if (badTags.includes(nodeTag)) rawScore -= weights.TAG_PENALTY;

    if (node.querySelector('h1, h2, h3') && node.querySelector('p')) {
        rawScore += weights.HEADING_SNIPPET_BOOST;
    }

    let childrenScore = 0;
    for (const child of node.children || []) {
        const childResult = computeScoreAndCollect(child, config, candidates);
        if (childResult) {
            childrenScore += childResult.score * weights.CHILD_SCORE_MULTIPLIER;
        }
    }

    const normalizedScore = rawScore / Math.log(textLen + 2);
    const score = normalizedScore + childrenScore;

    const candidate = {
        node,
        text: sanitizeFinalText(text),
        score,
        source: 'scoring'
    };

    candidates.push(candidate);
    return candidate;
}

function extractMainFromHtml(document, config, url) {
    const allCandidates = [];

    const defaultSelectors = [
        'article', 'main', '[role="main"]',
        '.article', '.story', '.story-body', '.articleBody',
        '#content', '.content', '.content__body'
    ];
    const contentSelectors = (config?.selectors?.content?.length
        ? config.selectors.content
        : defaultSelectors);

    const selectorConfig = {
        ...config,
        selectors: { ...(config?.selectors || {}), content: contentSelectors }
    };

    const selectorResults = extractWithSelectors(document, selectorConfig, url);
    logger.info('[Heuristic] Selector results', {
        url,
        count: selectorResults.length,
        previews: selectorResults.slice(0, 3).map(r => ({
            len: r.text.length,
            score: Math.round(r.score),
        }))
    });
    allCandidates.push(...selectorResults);

    const scoringCandidates = [];
    computeScoreAndCollect(
        document.body || document.documentElement,
        selectorConfig,
        scoringCandidates
    );

    scoringCandidates.sort((a, b) => b.score - a.score);
    const topScoring = scoringCandidates.slice(0, 20);
    logger.info('[Heuristic] Top scoring candidates', {
        url,
        count: topScoring.length,
        previews: topScoring.slice(0, 5).map(c => ({
            len: c.text.length,
            score: Math.round(c.score),
        }))
    });
    allCandidates.push(...topScoring);

    if (allCandidates.length === 0) {
        const cardsResult = extractArticleCards(document, url);
        if (!cardsResult) return { title: extractMetaData('title', document, url), url, content: "" };
        allCandidates.push(cardsResult);
    }

    const mergedCandidates = mergeFragments(allCandidates);
    const topCandidates = mergedCandidates
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

    const MIN_TEXT = selectorConfig?.thresholds?.MIN_TEXT_LENGTH ?? 120;

    let content = topCandidates
        .filter(c => c.text && c.text.length > MIN_TEXT)
        .map(c => c.text)
        .join(' | ');

    if (!content || !content.trim()) {
        const best = (mergedCandidates[0] || topScoring[0] || selectorResults[0]);
        content = best?.text || '';
        logger.info('[Heuristic] Using fallback best-single candidate', {
            url,
            len: content.length,
        });
    } else {
        logger.info('[Heuristic] Merged content summary', {
            url,
            len: content.length,
        });
    }

    if (!content || content.length < MIN_TEXT) {
        logger.info('[Heuristic] Falling back to article-cards strategy', { url });
        const cardsResult = extractArticleCards(document, url);
        if (cardsResult) return cardsResult;
    }

    return {
        title: extractMetaData('title', document, url),
        url,
        content,
        candidates: topCandidates.length,
        strategies: [...new Set(allCandidates.map(c => c.source))]
    };
}

module.exports = {
    extractMainFromHtml,
    extractWithReadability
}