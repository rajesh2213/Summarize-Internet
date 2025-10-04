require('dotenv').config();
const logger = require('../../config/logHandler');
const OpenAI = require('openai');
const { encoding_for_model } = require("tiktoken");
const cacheService = require('../cacheService');

class ContentSummarizer {
    constructor(options = {}) {
        this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        this.defaultModel = options.model || "gpt-4o-mini";
        this.maxToken = options.maxTokens || 16000;
        this.chunkSize = options.chunkSize || 90000;
        this.temperature = options.temperature || 0.3;
    }

    truncateContent(content, maxLen = 400000) {
        if (content.length < maxLen) return content;
        const truncated = content.substring(0, maxLen);
        const lastSpaceIdx = truncated.lastIndexOf(' ');
        return truncated.substring(0, lastSpaceIdx);
    }

    splitIntoChunks(content) {
        logger.info("Original content sample", { content: content.substring(0, 200) });

        const approxCharsPerChunk = this.chunkSize * 3.5;
        const chunks = [];

        for (let i = 0; i < content.length; i += approxCharsPerChunk) {
            let chunk = content.slice(i, i + approxCharsPerChunk);

            if (i + approxCharsPerChunk < content.length) {
                const lastSpace = chunk.lastIndexOf(" ");
                const lastNewline = chunk.lastIndexOf("\n");
                const lastPunctuation = Math.max(
                    chunk.lastIndexOf("."),
                    chunk.lastIndexOf("!"),
                    chunk.lastIndexOf("?")
                );

                const breakPoint = Math.max(lastSpace, lastNewline, lastPunctuation);
                if (breakPoint > chunk.length * 0.8) { 
                    chunk = chunk.slice(0, breakPoint + 1);
                }
            }

            if (chunk && chunk.trim().length > 0) {
                chunks.push(chunk.trim());
                logger.info("Chunk created", {
                    index: chunks.length - 1,
                    length: chunk.length,
                    sample: chunk.substring(0, 100) + "..."
                });
            }
        }

        logger.info("Chunking complete", { chunkCount: chunks.length });
        return chunks;
    }

    async summarizeChunks(content, model = this.defaultModel) {
        const cacheOptions = { model, temperature: 0.3, chunkSize: this.chunkSize };
        const cachedResult = await cacheService.getCachedAIChunk(content, cacheOptions);
        if (cachedResult) {
            logger.info("[ContentSummarizer] Using cached chunk summary");
            return cachedResult;
        }

        const prompt = `
        You are an expert assistant that summarizes arbitrary webpage content.

        1. Infer the content type: one of ["reddit", "youtube", "shopping", "twitch", "webpage", "data_dump", "generic"].
            If "data_dump":
            - Detect format: "json" | "log" | "code" | "raw_numbers"
            - Extract "notable_fields": ["field1", "field2", ...]
            - Summarize recurring "patterns" or anomalies
        2. Produce a JSON summary including a "content_type" field and type-specific fields:

        General fields:
        - "tldr": one-sentence TLDR
        - "bullets": ["key points", "insights"]
        - "key_sections": [{"heading": "section", "summary": "details"}]
        - "content_type": detected type

        Reddit content: topic, notable_comments, sentiment
        YouTube content: topic, key_timestamps, duration_estimate
        Shopping/Product content: product_name, price_range, key_features, ratings
        Webpage/Articles: page_type, topic, author, publication_date
        Twitch/Streaming: topic, chat_highlights, streamer
        `;

        logger.info("[ContentSummarizer] Chunked summary content, before feeding", { content })
        try {
            const res = await this.client.chat.completions.create({
                model,
                temperature: 0.3,
                response_format: { type: "json_object" },
                messages: [
                    { role: "system", content: prompt },
                    { role: "user", content: `Summarize this content:\n${content}` }
                ]
            });
            let parsed;
            try {
                parsed = JSON.parse(res.choices[0].message.content);
            } catch (e) {
                logger.warn("[ContentSummarizer] Failed to parse JSON, raw content returned", { raw: res.choices[0].message.content });
                return null;
            }
            
            await cacheService.cacheAIChunk(content, parsed, cacheOptions);
            logger.info("[ContentSummarizer] Cached chunk summary");
            
            return parsed;
        } catch (err) {
            logger.error("[ContentSummarizer] summarizeChunks failed", { errMessage: err.message, errStack: err.stack });
            const status = err.response.status;
            if (status === 429) throw new Error("Rate limited");
            if (status === 401) throw new Error("Invalid API key");
            if (status >= 500) throw new Error("OpenAI server error");
            logger.error("[ContentSummarizer] summarizeChunks failed", { errMessage: err.message, errStack: err.stack });
            return null;
        }
    }

    async mergeSummaries(partials, model, temperature) {
        const batchSize = 5
        let current = partials
        const mergePrompt = `
            You are an expert assistant that merges multiple partial summaries into a coherent final summary.
            Preserve all type-specific fields (like topic, key_timestamps, notable_comments, sentiment, product_name, price_range, key_features, etc.).
            Merge overlapping info. If some chunks detect different content types, pick the most consistent one.
        `;

        while (current.length > 1) {
            const nextRound = []
            for (let i = 0; i < current.length; i += batchSize) {
                const batch = current.slice(i, i + batchSize)
                const contentStr = JSON.stringify(batch)
                logger.info("[ContentSummarizer] Merged summary content, before feeding", { contentStr })

                const res = await this.client.chat.completions.create({
                    model,
                    temperature,
                    response_format: { type: "json_object" },
                    messages: [
                        { role: "system", content: mergePrompt },
                        { role: "user", content: contentStr }
                    ]
                });
                try {
                    nextRound.push(JSON.parse(res.choices[0].message.content));
                } catch (e) {
                    logger.warn("[ContentSummarizer] Batch merge JSON parse failed", { raw: res.choices[0].message.content });
                }
            }
            if (nextRound.length === 0) {
                logger.error("[ContentSummarizer] All batch merges failed");
                return { raw: res.choices[0].message.content };
            }
            current = nextRound
        }
        return current[0];
    }

    async summarize(content, options = {}) {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("Missing OPENAI_API_KEY in environment");
        }
        if (!content || (typeof content === "string" && content.trim() === '')) {
            logger.warn("[ContentSummarizer] summarize called with empty content");
            return null;
        }

        try {
            const inputText = typeof content === "object" ? JSON.stringify(content, null, 2) : content;
            const model = options.model || this.defaultModel;
            const temperature = options.temperature || this.temperature;

            const cacheOptions = { model, temperature, chunkSize: this.chunkSize };
            const cachedSummary = await cacheService.getCachedAISummary(inputText, cacheOptions);
            if (cachedSummary) {
                logger.info("[ContentSummarizer] Using cached full summary");
                return cachedSummary;
            }

            const chunks = this.splitIntoChunks(inputText);
            const partials = await Promise.all(
                chunks.map(chunk => this.summarizeChunks(chunk))
            );

            if (partials.every(p => p === null)) return null;

            const resultContent = await this.mergeSummaries(partials.filter(p => p !== null), model, temperature);
            
            await cacheService.cacheAISummary(inputText, resultContent, cacheOptions);
            logger.info("[ContentSummarizer] Cached full summary");
            
            logger.info("[ContentSummarizer] Result summary content", { resultContent })
            return resultContent
        } catch (err) {
            logger.error("[ContentSummarizer] summarize failed", { errMessage: err.message, errStack: err.stack });
            const status = err.response.status;
            if (status === 429) throw new Error("Rate limited");
            if (status === 401) throw new Error("Invalid API key");
            if (status >= 500) throw new Error("OpenAI server error");
            logger.error("[ContentSummarizer] summarize failed", { errMessage: err.message, errStack: err.stack });
            return null;
        }
    }
}

module.exports = ContentSummarizer;
