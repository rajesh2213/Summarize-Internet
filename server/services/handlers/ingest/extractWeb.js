const { JSDOM } = require('jsdom');
const logger = require('../../../config/logHandler');
const fetchStaticHtml = require('../staticHtmlFetcher');
const fetchDynamicHtml = require('../dynamicHtmlFetcher');
const { JsonApiFetcher, StructuredDataExtractor } = require('../site-specific/json-fetchers');
const { extractMainFromHtml, extractWithReadability } = require('../contextExtractor')
const { detectSiteType } = require('../guessSiteConfig')
const { standardizeResult } = require('../commonHandlers')
const siteConfigs = require('../scoringConfig')
const Score = require('../Score')
const ContentStandardizer = require('../ContentStandardize')
const notifier = require('../../notifier')
const cacheService = require('../../cacheService')

const standardizer = new ContentStandardizer();
const jsonFetcher = new JsonApiFetcher();
const structuredExtractor = new StructuredDataExtractor();

async function extractWeb(jobId, url, options = {}) {
    const EXTRACTION_TIMEOUT = 45000; 
    
    try {
        logger.info(`Starting extraction for: ${url}`);

        const cachedContent = await cacheService.getCachedWebContent(url);
        if (cachedContent) {
            logger.info("[Web Extraction] Using cached content for URL:", url);
            return cachedContent;
        }

        const extractionPromise = performExtraction(jobId, url, options);
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Extraction timeout exceeded')), EXTRACTION_TIMEOUT);
        });

        return await Promise.race([extractionPromise, timeoutPromise]);

    } catch (error) {
        logger.error("Error extracting web content", { message: error.message, stack: error.stack });
        return {
            title: 'Extraction Failed',
            content: '',
            author: '',
            date: '',
            url,
            source: 'error',
            metadata: {
                error: error.message,
                extraction_method: 'failed'
            }
        };
    }
}

async function performExtraction(jobId, url, options = {}) {
    try {

        logger.info('Fetching static HTML...');
        await notifier.notifyProgress(jobId, "FETCHING_HTML")
        let html = await fetchStaticHtml(url);

        const isEmpty = !html || html.length < 200;

        const textOnly = html
            ? html.replace(/<script[\s\S]*?<\/script>/gi, '')
                .replace(/<style[\s\S]*?<\/style>/gi, '')
                .replace(/<[^>]+>/g, '')
                .trim()
            : '';

        const textChars = textOnly.length;
        const density = html ? textChars / html.length : 0;

        const shellIndicators = ['<app-root', '<shreddit-app', '<div id="root"', '<div id="__next"'];
        const looksLikeShell = html && shellIndicators.some(sig => html.includes(sig));

        if (isEmpty || textChars < 300 || density < 0.05 || looksLikeShell) {
            logger.info('Static HTML looks insufficient, falling back to dynamic fetch...');
            try {
                html = await fetchDynamicHtml(url);
            } catch (dynamicError) {
                logger.warn('Dynamic fetch also failed, proceeding with static HTML', { 
                    staticError: dynamicError.message,
                    staticHtmlLength: html?.length || 0
                });
            }
        }

        if (!html || html.length < 200) {
            logger.info('Failed to fetch adequate HTML content');
        }

        const dom = new JSDOM(html, { url });
        const document = dom.window.document;

        const tasks = [
            (async () => {
                try {
                    const jsonResult = await jsonFetcher.fetchFromJsonApi(url);
                    if (jsonResult) {
                        const standardized = standardizer.standardizeResult(jsonResult, url, 'json_api', 'flatWithRoles', { includeMetadata: true });
                        return standardized;
                    }
                } catch (error) {
                    logger.warn('[Content extraction] JSON API extraction failed', { error: error.message });
                }
            })(),

            (async () => {
                try {
                    const redabilityExtract = await extractWithReadability(document, url);
                    if (redabilityExtract && redabilityExtract.content) {
                        const standardized = standardizer.standardizeResult([redabilityExtract], url, 'readability', 'flatWithRoles', { includeMetadata: true });
                        return standardized;
                    }
                } catch (error) {
                    logger.warn('[Content extraction] Readability data extraction failed', { error: error.message });
                }
            })(),

            (async () => {
                try {
                    const structuredData = structuredExtractor.extractJsonLd(document);
                    if (structuredData.length > 0) {
                        const structured = structuredData.filter(item =>
                            item.content && item.content.length > 100
                        );
                        if (structured) {
                            const standardized = standardizer.standardizeResult(structured, url, 'structured_data', 'flatWithRoles', { includeMetadata: true });
                            return standardized;
                        }
                    }
                } catch (error) {
                    logger.warn('[Content extraction] Structured data extraction failed', { error: error.message });
                }
            })(),

            (async () => {
                try {
                    const siteType = detectSiteType(url, document);
                    const config = {
                        ...siteConfigs.base,
                        ...siteConfigs[siteType]
                    };
                    logger.info(`Detected site type: ${siteType}`);
                    const extractedObj = extractMainFromHtml(document, config, url);
                    if (extractedObj) {
                        const standardized = standardizer.standardizeResult(extractedObj, url, 'html_parsing', 'flatWithRoles', { includeMetadata: true })
                        return standardized;
                    }
                } catch (error) {
                    logger.warn('[Content extraction] Heuristic data extraction failed', { error: error.message })
                }
            })()
        ]

        const result = await Promise.allSettled(tasks)
        const candidates = result.filter(r => r.status === 'fulfilled' && r.value)
            .map(r => r.value)

        if (candidates.length === 0) {
            logger.error('All extraction methods failed')
            throw new Error('All extraction methods failed')
        }
        await notifier.notifyProgress(jobId, "CLEANING")
        const scorer = new Score()
        await scorer.init()
        const scoredCandidates = [];

        for (const candidate of candidates) {
            try {
                const score = await scorer.scoreExtraction(candidate, candidates);
                scoredCandidates.push({ candidate, score });
            } catch (err) {
                logger.warn('Failed to score candidate', { url: candidate.metadata.url, error: err.message });
            }
        }

        const bestCandidate = scoredCandidates
            .sort((a, b) => {
                if (a.candidate.source === "json_api") return -1;
                if (b.candidate.source === "json_api") return 1;
                return b.score - a.score;
            })[0];

        if (!bestCandidate) {
            logger.error('No valid candidate after scoring');
            throw new Error('No valid candidate after scoring');
        }
        
        if (scorer.embedder && scorer.collector.embedFn) {
            try {
                const prototypeResult = await scorer.collector.savePrototype(bestCandidate.candidate.content);
                if (prototypeResult && prototypeResult.proto) {
                    const { proto, isDuplicate } = prototypeResult;
                    if (isDuplicate) {
                        logger.info("Skipping save prototype, prototype similar to the current content already exists", {proto});
                    } else {
                        logger.info("New prototype saved:", {proto});
                    }
                } else {
                    logger.warn("savePrototype returned null or invalid result (embeddings not available), skipping prototype save");
                }
            } catch (prototypeError) {
                logger.warn("Failed to save prototype, continuing anyway", { error: prototypeError.message });
            }
        } else {
            logger.warn("Skipping prototype save as embedder is not available");
        }

        await cacheService.cacheWebContent(url, bestCandidate.candidate);
        logger.info("[Web Extraction] Cached content for URL:", url);

        return bestCandidate.candidate;

    } catch (error) {
        logger.error("Error in performExtraction", { message: error.message, stack: error.stack });
        throw error;
    }
}

module.exports = extractWeb;
