const logger = require("../../config/logHandler");
const { pipeline } = require("@xenova/transformers");
const PrototypeCollector = require("./prototypeCollector");

class Score {
    constructor(options = {}) {
        const {
            heuristicWeight = 0.40,
            dynamicWeight = 0.30,
            prototypeWeight = 0.20,
            centroidWeight = 0.10,
        } = options;

        const sum = heuristicWeight + dynamicWeight + prototypeWeight + centroidWeight;
        this.heuristicWeight = heuristicWeight / sum;
        this.dynamicWeight = dynamicWeight / sum;
        this.prototypeWeight = prototypeWeight / sum;
        this.centroidWeight = centroidWeight / sum;

        this.modelLoaded = false;
        this.prototypeEmbeddings = [];
        this.collector = new PrototypeCollector(this._embedText.bind(this));

        this._candEmbeddings = new Map();
        this.debug = options.debug ?? true;

        this.minContentLength = options.minContentLength ?? 50;
        this.minScoreThreshold = options.minScoreThreshold ?? 0.25;

        this.maxEmbeddingLength = options.maxEmbeddingLength ?? 800;
        this._embeddingCache = new Map();
        this.maxCacheSize = options.maxCacheSize ?? 500;
    }

    async init() {
        if (!this.modelLoaded) {
            this.embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
            this.modelLoaded = true;
            this.collector.setEmbedder(this._embedText.bind(this));
        }
    }

    _calcHeuristicScore(candidate) {
        if (!candidate) return 0;
        let score = 0;

        const title = candidate.metadata?.title || "";
        const content = candidate.content || "";
        const url = candidate.metadata?.url || "";
        const source = candidate.source || "";
        const contentLength = content.length;

        if (title.length > 30 && this._isQualityTitle(title)) {
            score += 0.25;
        } else if (title.length > 10) {
            score += 0.15;
        } else if (title.length > 0) {
            score += 0.08;
        }

        if (contentLength > 2000) score += 0.35;
        else if (contentLength > 1000) score += 0.28;
        else if (contentLength > 500) score += 0.20;
        else if (contentLength > 200) score += 0.12;
        else if (contentLength > 50) score += 0.06;

        score += this._assessContentStructure(content, source);
        score += this._assessMetadataCompleteness(candidate);
        score = this._applyQualityPenalties(score, content, title, url);

        return Math.min(score, 1.0);
    }

    _isQualityTitle(title) {
        const hasCapitalization = /[A-Z]/.test(title);
        const hasProperWords = title.split(/\s+/).length >= 3;
        const notAllCaps = title !== title.toUpperCase();
        const notNavigationText = !/(home|menu|nav|click|here)/i.test(title);

        return hasCapitalization && hasProperWords && notAllCaps && notNavigationText;
    }

    _assessContentStructure(content, source) {
        let structureScore = 0;

        const structureMarkers = {
            '[TITLE]': 0.05,
            '[POST]': 0.05,
            '[ARTICLE]': 0.05,
            '[TRANSCRIPT]': 0.05,
            '[COMMENT]': 0.02,
            '<h1>': 0.03,
            '<h2>': 0.02,
            '<p>': 0.02,
        };

        for (const [marker, bonus] of Object.entries(structureMarkers)) {
            if (content.includes(marker)) {
                structureScore += bonus;
            }
        }

        const sourceBonus = {
            'json_api': 0.08,
            'structured_data': 0.06,
            'readability': 0.04,
            'html_parsing': 0.03
        };

        structureScore += sourceBonus[source] || 0;

        const paragraphs = (content.match(/\n\s*\n/g) || []).length;
        if (paragraphs > 2) structureScore += 0.03;

        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
        if (sentences.length > 3) structureScore += 0.03;

        return Math.min(structureScore, 0.25);
    }

    _assessMetadataCompleteness(candidate) {
        let metadataScore = 0;
        const metadata = candidate.metadata || {};

        if (metadata.publishedAt || metadata.date || candidate.date) metadataScore += 0.05;
        if (metadata.author || candidate.author) metadataScore += 0.03;
        if (metadata.url && this._isValidUrl(metadata.url)) metadataScore += 0.03;

        if (metadata.description) metadataScore += 0.02;
        if (metadata.tags || metadata.keywords) metadataScore += 0.01;
        if (metadata.image) metadataScore += 0.01;

        return Math.min(metadataScore, 0.15);
    }

    _isValidUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch {
            return false;
        }
    }

    _applyQualityPenalties(score, content, title, url) {
        if (content.length < this.minContentLength) {
            score *= 0.3;
        }

        const words = content.toLowerCase().split(/\s+/);
        const uniqueWords = new Set(words);
        const uniqueRatio = uniqueWords.size / Math.max(words.length, 1);
        if (uniqueRatio < 0.3) {
            score *= 0.7;
        }

        const navIndicators = ['menu', 'navigation', 'sidebar', 'footer', 'header'];
        if (navIndicators.some(indicator =>
            title.toLowerCase().includes(indicator) ||
            content.toLowerCase().includes(indicator + ' item')
        )) {
            score *= 0.8;
        }

        const errorIndicators = ['404', 'not found', 'error', 'page not available'];
        if (errorIndicators.some(indicator =>
            title.toLowerCase().includes(indicator) ||
            content.toLowerCase().includes(indicator)
        )) {
            score *= 0.1;
        }

        return score;
    }

    async _embedText(text) {
        if (!text?.trim()) return null;

        const cacheKey = text.length > 100 ?
            text.slice(0, 100) + `_${text.length}` : text;

        if (this._embeddingCache.has(cacheKey)) {
            return this._embeddingCache.get(cacheKey);
        }

        const cleanText = this._cleanTextForEmbedding(text);
        const truncatedText = cleanText.length > this.maxEmbeddingLength ?
            cleanText.slice(0, this.maxEmbeddingLength) : cleanText;

        try {
            const output = await this.embedder(truncatedText, {
                pooling: "mean",
                normalize: true
            });

            const embedding = output.data;

            if (this._embeddingCache.size >= this.maxCacheSize) {
                const firstKey = this._embeddingCache.keys().next().value;
                this._embeddingCache.delete(firstKey);
            }

            this._embeddingCache.set(cacheKey, embedding);
            return embedding;
        } catch (err) {
            logger.warn("Embedding failed", {
                textLength: text.length,
                textPreview: text.slice(0, 50),
                message: err.message
            });
            return null;
        }
    }

    _cleanTextForEmbedding(text) {
        return text
            .replace(/\[TITLE\]|\[POST\]|\[ARTICLE\]|\[COMMENT\]|\[TRANSCRIPT\]/g, '')
            .replace(/https?:\/\/[^\s]+/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    async _calcDynamicScore(candidate) {
        await this.init();

        const refText = this._buildReferenceText(candidate);
        const candText = this._extractMainContent(candidate);
        if (!refText.trim() || !candText.trim()) return 0;

        const [refVec, candVec] = await Promise.all([
            this._embedText(refText),
            this._embedText(candText),
        ]);

        return this._cosineSim(candVec, refVec);
    }

    _buildReferenceText(candidate) {
        const parts = [];

        if (candidate.metadata?.title) {
            parts.push(candidate.metadata.title);
        }

        if (candidate.metadata?.url) {
            try {
                const url = new URL(candidate.metadata.url);
                const pathParts = url.pathname.split('/').filter(p => p.length > 2);
                parts.push(pathParts.join(' '));
            } catch { }
        }

        if (candidate.metadata?.description) {
            parts.push(candidate.metadata.description.slice(0, 200));
        }

        return parts.join(' ').slice(0, 300);
    }

    _extractMainContent(candidate) {
        let content = candidate.content || "";

        const extractors = [
            () => {
                const articleMatch = content.match(/\[ARTICLE\](.*?)(?:\[|\s*$)/s);
                if (articleMatch) return articleMatch[1];

                const postMatch = content.match(/\[POST\](.*?)(?:\[COMMENT\]|$)/s);
                if (postMatch) return postMatch[1];

                return null;
            },

            () => {
                const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 100);
                return paragraphs[0] || null;
            },

            () => content.slice(0, 600)
        ];

        for (const extractor of extractors) {
            const extracted = extractor();
            if (extracted && extracted.trim().length > 50) {
                return this._cleanTextForEmbedding(extracted);
            }
        }

        return this._cleanTextForEmbedding(content.slice(0, 600));
    }

    _cosineSim(vecA, vecB) {
        if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

        let dot = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dot += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);

        return normA && normB ? dot / (normA * normB) : 0;
    }

    async _getEmbeddingForCandidate(candidate) {
        const key = candidate.metadata?.url ||
            candidate.metadata?.title ||
            candidate.content?.slice(0, 100) ||
            'unknown';

        if (this._candEmbeddings.has(key)) {
            return this._candEmbeddings.get(key);
        }

        const text = `${candidate.metadata?.title || ""} ${this._extractMainContent(candidate)}`;
        if (!text.trim()) return null;

        const vec = await this._embedText(text);
        if (vec) {
            this._candEmbeddings.set(key, vec);
        }
        return vec;
    }

    async _calcPrototypeScore(candidate) {
        await this.init();
        const candVec = await this._getEmbeddingForCandidate(candidate);
        if (!candVec) return 0;

        const nearest = await this.collector.findNearest(candVec, 1);
        return nearest.length ? nearest[0].similarity : 0;
    }

    async _calcCentroidScore(candidate, allCandidates) {
        await this.init();
        if (!allCandidates?.length || allCandidates.length < 2) return 0.5;

        const candVec = await this._getEmbeddingForCandidate(candidate);
        if (!candVec) return 0;

        const vectors = await Promise.all(
            allCandidates.map(c => this._getEmbeddingForCandidate(c))
        );
        const valid = vectors.filter(Boolean);

        if (valid.length < 2) return 0.5;

        const dim = valid[0].length;
        const centroid = new Array(dim).fill(0);

        for (const v of valid) {
            for (let i = 0; i < dim; i++) {
                centroid[i] += v[i];
            }
        }

        for (let i = 0; i < dim; i++) {
            centroid[i] /= valid.length;
        }

        return this._cosineSim(candVec, centroid);
    }

    async scoreExtraction(candidate, allCandidates = []) {
        try {
            if (!candidate.content || candidate.content.length < this.minContentLength) {
                logger.warn("Candidate failed minimum content length check", {
                    source: candidate.source,
                    contentLength: candidate.content?.length || 0
                });
                return 0;
            }

            const [dScore, pScore, cScore] = await Promise.all([
                this._calcDynamicScore(candidate),
                this._calcPrototypeScore(candidate),
                this._calcCentroidScore(candidate, allCandidates),
            ]);

            const hScore = this._calcHeuristicScore(candidate);

            const finalScore =
                this.heuristicWeight * hScore +
                this.dynamicWeight * dScore +
                this.prototypeWeight * pScore +
                this.centroidWeight * cScore;

            if (this.debug) {
                logger.info("Score breakdown", {
                    candidate: candidate.source || "unknown",
                    heuristic: { raw: hScore, weighted: this.heuristicWeight * hScore },
                    dynamic: { raw: dScore, weighted: this.dynamicWeight * dScore },
                    prototype: { raw: pScore, weighted: this.prototypeWeight * pScore },
                    centroid: { raw: cScore, weighted: this.centroidWeight * cScore },
                    final: finalScore,
                    contentLength: candidate.content?.length || 0,
                    passesThreshold: finalScore >= this.minScoreThreshold
                });
            }

            return finalScore;
        } catch (error) {
            logger.error("Error scoring candidate", {
                message: error.message,
                stack: error.stack,
                candidateSource: candidate.source,
                url: candidate.metadata?.url
            });
            return 0;
        }
    }

    getStatistics() {
        return {
            weights: {
                heuristic: this.heuristicWeight,
                dynamic: this.dynamicWeight,
                prototype: this.prototypeWeight,
                centroid: this.centroidWeight
            },
            thresholds: {
                minContentLength: this.minContentLength,
                minScoreThreshold: this.minScoreThreshold
            },
            cacheStats: {
                embeddingCacheSize: this._embeddingCache.size,
                candidateEmbeddingsCacheSize: this._candEmbeddings.size
            }
        };
    }
}

module.exports = Score;