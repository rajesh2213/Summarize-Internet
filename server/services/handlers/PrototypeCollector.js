const prisma = require('../../config/prismaClient');
const logger = require('../../config/logHandler');

class PrototypeCollector {
    constructor(embedFn) {
        this.embedFn = embedFn;
    }

    setEmbedder(embedFn) {
        this.embedFn = embedFn;
    }

    async savePrototype(text, similarityThreshold = 0.98) {
        if (!this.embedFn) throw new Error("Embedder not set");
        const embedding = await this.embedFn(text);
        if (!embedding) return null;

        try {
            const nearest = await this.findNearest(embedding, 1);
            if (nearest.length && nearest[0].similarity >= similarityThreshold) {
                return {
                    proto: nearest[0],
                    isDuplicate: true,
                };
            }

            const vectorString = `[${embedding.join(',')}]`;

            const created = await prisma.$queryRaw`
                INSERT INTO "prototypes" (id, text, embedding, "createdAt")
                VALUES (gen_random_uuid(), ${text}, ${vectorString}::vector, NOW())
                RETURNING id, text, "createdAt"
            `;

            return {
                proto: created[0],
                isDuplicate: false,
            };
        } catch (error) {
            logger.error('Failed to save prototype', { error: error.message, stack: error.stack });
            return {
                proto: { id: 'error', text, createdAt: new Date() },
                isDuplicate: false,
            };
        }
    }

    async loadPrototypes(limit = 1000) {
        try {
            return await prisma.$queryRaw`
                SELECT id, text, embedding, "createdAt" 
                FROM "prototypes"
                ORDER BY "createdAt" DESC
                LIMIT ${limit}
            `;
        } catch (error) {
            logger.error('Failed to load prototypes', { error: error.message });
            return [];
        }
    }

    async findNearest(embedding, topK = 5) {
        try {
            const vectorParam = `[${embedding.join(',')}]`;

            const result = await prisma.$queryRaw`
                SELECT id, text, "createdAt", 1 - (embedding <=> ${vectorParam}::vector) AS similarity
                FROM "prototypes"
                WHERE embedding IS NOT NULL
                ORDER BY embedding <=> ${vectorParam}::vector
                LIMIT ${topK}
            `;

            return result || [];
        } catch (error) {
            logger.error('Failed to find nearest prototypes', {
                error: error.message,
                stack: error.stack
            });
            return [];
        }
    }
}

module.exports = PrototypeCollector;