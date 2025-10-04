require('dotenv').config();
const crypto = require('crypto');
const redisClient = require('../config/redisClient');
const logger = require('../config/logHandler');

class CacheService {
    constructor() {
        this.defaultTTL = {
            DOCUMENT: 300,        
            USER: 1800,          
            SUMMARY: 3600,       
            ARTIFACT: 3600,      
            
            AI_SUMMARY: 86400,    
            AI_CHUNK: 43200,     
            
            YOUTUBE: 86400,       
            TWITCH: 1800,         
            REDDIT: 7200,        
            WEB_CONTENT: 7200,    
            
            EXTRACTED_CONTENT: 14400, 
            HTML_CONTENT: 3600,      
        };
    }

    generateKey(namespace, identifier, options = {}) {
        const { userId, source, type } = options;
        let key = `${namespace}:${identifier}`;
        
        if (userId) key += `:user:${userId}`;
        if (source) key += `:source:${source}`;
        if (type) key += `:type:${type}`;
        
        return key;
    }

    generateContentHash(content, options = {}) {
        const { model, temperature, chunkSize } = options;
        const hashInput = `${content}:${model || 'default'}:${temperature || 0.3}:${chunkSize || 90000}`;
        return crypto.createHash('sha256').update(hashInput).digest('hex');
    }

    async cacheDocument(docId, document, userId = null) {
        const key = this.generateKey('doc', docId, { userId });
        return await redisClient.set(key, document, this.defaultTTL.DOCUMENT);
    }

    async getCachedDocument(docId, userId = null) {
        const key = this.generateKey('doc', docId, { userId });
        return await redisClient.get(key);
    }

    async cacheUser(userId, user) {
        const key = this.generateKey('user', userId);
        return await redisClient.set(key, user, this.defaultTTL.USER);
    }

    async getCachedUser(userId) {
        const key = this.generateKey('user', userId);
        return await redisClient.get(key);
    }

    async cacheSummary(docId, summary, userId = null) {
        const key = userId ? this.generateKey('summary', docId, { userId }) : `summary:${docId}`;
        return await redisClient.set(key, summary, this.defaultTTL.SUMMARY);
    }

    async getCachedSummary(docId, userId = null) {
        const key = userId ? this.generateKey('summary', docId, { userId }) : `summary:${docId}`;
        return await redisClient.get(key);
    }

    async cacheUrlDocument(url, document, source) {
        const urlHash = crypto.createHash('sha256').update(url).digest('hex');
        const key = `url_doc:${urlHash}`;
        
        const ttl = this.calculateUrlTTL(source, document.createdAt);
        return await redisClient.set(key, document, ttl);
    }

    async getCachedUrlDocument(url) {
        const urlHash = crypto.createHash('sha256').update(url).digest('hex');
        const key = `url_doc:${urlHash}`;
        return await redisClient.get(key);
    }

    calculateUrlTTL(source, createdAt) {
        const now = new Date();
        const ageInHours = (now - new Date(createdAt)) / (1000 * 60 * 60);
        
        const baseTTL = {
            'YOUTUBE': 24 * 60 * 60,    
            'TWITCH': 2 * 60 * 60,       
            'WEBPAGE': 6 * 60 * 60,      
            'PDF': 24 * 60 * 60
        };
        
        const base = baseTTL[source] || baseTTL['WEBPAGE'];
        
        if (ageInHours > 24) {
            return Math.min(base * 2, 7 * 24 * 60 * 60);
        } else if (ageInHours > 6) {
            return base * 1.5; 
        }
        
        return base; 
    }

    async cacheAISummary(content, summary, options = {}) {
        const contentHash = this.generateContentHash(content, options);
        const key = this.generateKey('ai_summary', contentHash);
        return await redisClient.set(key, summary, this.defaultTTL.AI_SUMMARY);
    }

    async getCachedAISummary(content, options = {}) {
        const contentHash = this.generateContentHash(content, options);
        const key = this.generateKey('ai_summary', contentHash);
        return await redisClient.get(key);
    }

    async cacheAIChunk(chunk, summary, options = {}) {
        const contentHash = this.generateContentHash(chunk, options);
        const key = this.generateKey('ai_chunk', contentHash);
        return await redisClient.set(key, summary, this.defaultTTL.AI_CHUNK);
    }

    async getCachedAIChunk(chunk, options = {}) {
        const contentHash = this.generateContentHash(chunk, options);
        const key = this.generateKey('ai_chunk', contentHash);
        return await redisClient.get(key);
    }

    async cacheYouTubeData(videoId, data) {
        const key = this.generateKey('youtube', videoId);
        return await redisClient.set(key, data, this.defaultTTL.YOUTUBE);
    }

    async getCachedYouTubeData(videoId) {
        const key = this.generateKey('youtube', videoId);
        return await redisClient.get(key);
    }

    async cacheTwitchData(streamId, data) {
        const key = this.generateKey('twitch', streamId);
        return await redisClient.set(key, data, this.defaultTTL.TWITCH);
    }

    async getCachedTwitchData(streamId) {
        const key = this.generateKey('twitch', streamId);
        return await redisClient.get(key);
    }

    async cacheRedditData(postId, data) {
        const key = this.generateKey('reddit', postId);
        return await redisClient.set(key, data, this.defaultTTL.REDDIT);
    }

    async getCachedRedditData(postId) {
        const key = this.generateKey('reddit', postId);
        return await redisClient.get(key);
    }

    async cacheWebContent(url, content) {
        const urlHash = crypto.createHash('sha256').update(url).digest('hex');
        const key = this.generateKey('web_content', urlHash);
        return await redisClient.set(key, content, this.defaultTTL.WEB_CONTENT);
    }

    async getCachedWebContent(url) {
        const urlHash = crypto.createHash('sha256').update(url).digest('hex');
        const key = this.generateKey('web_content', urlHash);
        return await redisClient.get(key);
    }

    async cacheExtractedContent(url, content, source) {
        const urlHash = crypto.createHash('sha256').update(url).digest('hex');
        const key = this.generateKey('extracted', urlHash, { source });
        return await redisClient.set(key, content, this.defaultTTL.EXTRACTED_CONTENT);
    }

    async getCachedExtractedContent(url, source) {
        const urlHash = crypto.createHash('sha256').update(url).digest('hex');
        const key = this.generateKey('extracted', urlHash, { source });
        return await redisClient.get(key);
    }

    async invalidateDocument(docId, userId = null) {
        const key = this.generateKey('doc', docId, { userId });
        await redisClient.del(key);
        
        const summaryKey = this.generateKey('summary', docId, { userId });
        await redisClient.del(summaryKey);
        
        logger.info(`[CacheService] Invalidated cache for document: ${docId}`);
    }

    async invalidateUser(userId) {
        const key = this.generateKey('user', userId);
        await redisClient.del(key);
        logger.info(`[CacheService] Invalidated cache for user: ${userId}`);
    }

    async invalidateAISummaries() {
        await redisClient.flushPattern('ai_summary:*');
        await redisClient.flushPattern('ai_chunk:*');
        logger.info('[CacheService] Invalidated all AI summary caches');
    }

    async getCacheStats() {
        if (!redisClient.isHealthy()) {
            return { status: 'unhealthy', message: 'Redis not connected' };
        }

        try {
            const client = redisClient.getClient();
            const info = await client.info('memory');
            const dbSize = await client.dbsize();
            
            return {
                status: 'healthy',
                dbSize,
                memory: info
            };
        } catch (error) {
            logger.error('[CacheService] Error getting cache stats:', error);
            return { status: 'error', message: error.message };
        }
    }

    async cacheMultiple(operations) {
        const results = [];
        for (const operation of operations) {
            try {
                const result = await this[operation.method](...operation.args);
                results.push({ success: true, result });
            } catch (error) {
                results.push({ success: false, error: error.message });
            }
        }
        return results;
    }
}

module.exports = new CacheService();
