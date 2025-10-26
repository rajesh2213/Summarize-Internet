require('dotenv').config();
const Redis = require('ioredis');
const logger = require('./logHandler');

class RedisClient {
    constructor() {
        this.client = null;
        this.isConnected = false;
    }

    async connect() {
        try {
            // Debug Redis configuration
            console.log('🔍 Redis Debug:');
            console.log('REDIS_URL exists:', !!process.env.REDIS_URL);
            console.log('REDIS_URL value:', process.env.REDIS_URL ? process.env.REDIS_URL.substring(0, 20) + '...' : 'undefined');
            console.log('REDIS_HOST:', process.env.REDIS_HOST);
            console.log('REDIS_PORT:', process.env.REDIS_PORT);
            
            let redisConfig;
            
            if (process.env.REDIS_URL) {
                console.log('Using REDIS_URL configuration');
                redisConfig = {
                    url: process.env.REDIS_URL,
                    retryDelayOnFailover: 100,
                    maxRetriesPerRequest: 3,
                    lazyConnect: true,
                    connectTimeout: 10000,
                    commandTimeout: 5000,
                };
            } else {
                console.log('Using individual Redis variables configuration');
                redisConfig = {
                    host: process.env.REDIS_HOST || 'localhost',
                    port: process.env.REDIS_PORT || 6379,
                    password: process.env.REDIS_PASSWORD || undefined,
                    db: process.env.REDIS_DB || 0,
                    retryDelayOnFailover: 100,
                    maxRetriesPerRequest: 3,
                    lazyConnect: true,
                    connectTimeout: 10000,
                    commandTimeout: 5000,
                };
            }

            this.client = new Redis(redisConfig);

            this.client.on('connect', () => {
                logger.info('[Redis] Connected to Redis server');
                this.isConnected = true;
            });

            this.client.on('error', (err) => {
                logger.error('[Redis] Redis connection error:', err);
                this.isConnected = false;
            });

            this.client.on('close', () => {
                logger.warn('[Redis] Redis connection closed');
                this.isConnected = false;
            });

            await this.client.connect();
            return this.client;
        } catch (error) {
            logger.error('[Redis] Failed to connect to Redis:', error);
            throw error;
        }
    }

    async disconnect() {
        if (this.client) {
            await this.client.quit();
            this.isConnected = false;
            logger.info('[Redis] Disconnected from Redis server');
        }
    }

    async get(key) {
        if (!this.isConnected) {
            logger.warn('[Redis] Redis not connected, skipping get operation');
            return null;
        }
        try {
            const result = await this.client.get(key);
            return result ? JSON.parse(result) : null;
        } catch (error) {
            logger.error('[Redis] Error getting key:', error);
            return null;
        }
    }

    async set(key, value, ttlSeconds = null) {
        if (!this.isConnected) {
            logger.warn('[Redis] Redis not connected, skipping set operation');
            return false;
        }
        try {
            const serialized = JSON.stringify(value);
            if (ttlSeconds) {
                await this.client.setex(key, ttlSeconds, serialized);
            } else {
                await this.client.set(key, serialized);
            }
            return true;
        } catch (error) {
            logger.error('[Redis] Error setting key:', error);
            return false;
        }
    }

    async del(key) {
        if (!this.isConnected) {
            logger.warn('[Redis] Redis not connected, skipping delete operation');
            return false;
        }
        try {
            await this.client.del(key);
            return true;
        } catch (error) {
            logger.error('[Redis] Error deleting key:', error);
            return false;
        }
    }

    async exists(key) {
        if (!this.isConnected) {
            return false;
        }
        try {
            const result = await this.client.exists(key);
            return result === 1;
        } catch (error) {
            logger.error('[Redis] Error checking key existence:', error);
            return false;
        }
    }

    async flushPattern(pattern) {
        if (!this.isConnected) {
            logger.warn('[Redis] Redis not connected, skipping flush pattern operation');
            return false;
        }
        try {
            const keys = await this.client.keys(pattern);
            if (keys.length > 0) {
                await this.client.del(...keys);
                logger.info(`[Redis] Flushed ${keys.length} keys matching pattern: ${pattern}`);
            }
            return true;
        } catch (error) {
            logger.error('[Redis] Error flushing pattern:', error);
            return false;
        }
    }

    getClient() {
        return this.client;
    }

    isHealthy() {
        return this.isConnected && this.client;
    }
}

const redisClient = new RedisClient();

module.exports = redisClient;
