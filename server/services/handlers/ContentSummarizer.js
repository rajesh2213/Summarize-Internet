require('dotenv').config();
const logger = require('../../config/logHandler');
const OpenAI = require('openai');
const { encoding_for_model } = require("tiktoken");

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
        const encoder = encoding_for_model(this.defaultModel);
        const tokens = encoder.encode(content);
        const chunks = [];
        for (let i = 0; i < tokens.length; i += this.chunkSize) {
            let end = Math.min(i + this.chunkSize, tokens.length);
            let chunk = encoder.decode(tokens.slice(i, end));

            if (end < tokens.length) {
                const lastSpace = chunk.lastIndexOf(" ");
                if (lastSpace > 0) {
                    chunk = chunk.slice(0, lastSpace);
                    end = i + encoder.encode(chunk).length;
                }
            }
            chunks.push(chunk);
            i = end;
        }
        return chunks;
    }

    async summarizeChunks(content, model = this.defaultModel) {
        const prompt = `
        You are an expert assistant that summarizes arbitrary webpage content.

        1. Infer the content type: one of ["reddit", "youtube", "shopping", "twitch", "webpage", "generic"].
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
            return JSON.parse(res.choices[0].message.content);
        } catch (err) {
            logger.error("[ContentSummarizer] summarizeChunks failed", { errMessage: err.message, errStack: err.stack });
            if (err.message.includes("429")) throw err;
            logger.error("[ContentSummarizer] summarizeChunks failed", { errMessage: err.message, errStack: err.stack });
            return null;
        }
    }

    async summarize(content, options = {}) {
        if (!content || (typeof content === "string" && content.trim() === '')) {
            logger.warn("[ContentSummarizer] summarize called with empty content");
            return null;
        }
        console.log('OPENAI_API_KEY: '+process.env.OPENAI_API_KEY);

        try {
            const inputText = typeof content === "object" ? JSON.stringify(content) : content;
            const model = options.model || this.defaultModel;
            const temperature = options.temperature || this.temperature;

            const chunks = this.splitIntoChunks(inputText);
            const partials = await Promise.all(
                chunks.map(chunk => this.summarizeChunks(chunk))
            );

            if (partials.every(p => p === null)) return null;

            const mergePrompt = `
            You are an expert assistant that merges multiple partial summaries into a coherent final summary.
            Preserve all type-specific fields (like topic, key_timestamps, notable_comments, sentiment, product_name, price_range, key_features, etc.).
            Merge overlapping info. If some chunks detect different content types, pick the most consistent one.
            `;

            const res = await this.client.chat.completions.create({
                model,
                temperature,
                messages: [
                    { role: "system", content: mergePrompt },
                    { role: "user", content: JSON.stringify(partials.filter(p => p !== null), null, 2) }
                ]
            });

            return JSON.parse(res.choices[0].message.content);
        } catch (err) {
            logger.error("[ContentSummarizer] summarize failed", { errMessage: err.message, errStack: err.stack });
            if (err.message.includes("429")) throw err;
            logger.error("[ContentSummarizer] summarize failed", { errMessage: err.message, errStack: err.stack });
            return null;
        }
    }
}

module.exports = ContentSummarizer;
