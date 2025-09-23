require('dotenv').config()
const logger = require('../../../config/logHandler');
const { google } = require('googleapis')
const youtube = google.youtube('v3');
const { secondsToMins, sanitizeFinalText } = require('../commonHandlers')
const extractWeb = require('./extractWeb')
const ContentStandardizer = require('../ContentStandardize')
const notifier = require('../../notifier')

const standardizer = new ContentStandardizer();

async function extractYT(jobId, url) {
    const { TranscriptList } = await import('@osiris-ai/youtube-captions-sdk');

    const idMatch = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})(?:\?|&|$)/);
    if (!idMatch) {
        try {
            await notifier.notifyProgress(jobId, "FETCHING_HTML")
            artifact = await extractWeb(url)
            if (artifact) return artifact
            else {
                await notifier.notifyProgress(jobId, "ERROR")
                throw new Error("Error extracting unconventional youtube data")
            }
        } catch (error) {
            logger.warn("Error extracting unconventional youtube data", { errorMessage: error.errorMessage, errStack: error.stack })
            await notifier.notifyProgress(jobId, "ERROR")
            throw new Error("Error extracting unconventional youtube data")
        }
    }
    const videoId = idMatch[1];

    try {
        await notifier.notifyProgress(jobId, "FETCHING_HTML")
        const transcriptList = await TranscriptList.fetch(videoId);
        if (!transcriptList) {
            logger.warn("No transcript list available for this video", { videoId });
            await notifier.notifyProgress(jobId, "ERROR");
            try {
                artifact = await extractWeb(url)
                if (artifact) return artifact
                else {
                    await notifier.notifyProgress(jobId, "ERROR")
                    throw new Error("Error extracting unconventional youtube data")
                }
            } catch (error) {
                logger.warn("Error extracting unconventional youtube data", { errorMessage: error.errorMessage, errStack: error.stack })
                await notifier.notifyProgress(jobId, "ERROR")
                throw new Error("Error extracting unconventional youtube data")
            }
        }
        const transcript = transcriptList.find(['en', 'en-US', 'en-GB']) ?? transcriptList.all()[0];
        let processedData = ''
        let data = null;
        await notifier.notifyProgress(jobId, "CLEANING")
        if (transcript) {
            data = await transcript.fetch();
            processedData = data.snippets
                .map(c => `${secondsToMins(c.start)}-${secondsToMins(c.start + c.duration)}:${c.text}`)
                .join(",");
        } else {
            logger.warn("No transcripts available");
        }

        const metaResp = await youtube.videos.list({
            part: ['snippet', 'statistics', 'contentDetails'],
            id: [videoId],
            key: process.env.YOUTUBE_API_KEY,
        });
        const item = metaResp.data.items?.[0] ?? {};
        const meta = {
            title: item.snippet?.title,
            description: item.snippet?.description,
            channelTitle: item.snippet?.channelTitle,
            publishedAt: item.snippet?.publishedAt,
            viewCount: item.statistics?.viewCount,
            duration: item.contentDetails?.duration,
        };
        const artifact = {
            transcript: data
                ? data.snippets.map(c => ({
                    start: c.start,
                    duration: c.duration,
                    text: sanitizeFinalText(c.text),
                }))
                : [],
            title: item.snippet?.title ?? null,
            description: item.snippet?.description ?? null,
            channel: item.snippet?.channelTitle ?? null,
            publishedAt: item.snippet?.publishedAt ?? null,
            views: item.statistics?.viewCount ?? null,
            duration: item.contentDetails?.duration ?? null,
        };

        //const artifact = { transcript: sanitizeFinalText(processedData), metaData: meta }
        logger.info("[Content Extraction] YT artifact", { artifact })
        return standardizer.standardizeVideo(artifact, url, "yt_fetch", 'flatWithRoles', { includeMetadata: true })
    } catch (err) {
        logger.error("Error extracting YouTube transcript:", err);
        await notifier.notifyProgress(jobId, "ERROR")
        return null;
    }
}

module.exports = extractYT;  
