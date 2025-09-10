require('dotenv').config()
const logger = require('../../../config/logHandler');
const { google } = require('googleapis')
const youtube = google.youtube('v3');
const { secondsToMins, sanitizeFinalText } = require('../commonHandlers')
const extractWeb = require('./extractWeb')
const ContentStandardizer = require('../ContentStandardize')

const standardizer = new ContentStandardizer();

async function extractYT(url) {
    const { TranscriptList } = await import('@osiris-ai/youtube-captions-sdk');

    const idMatch = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})(?:\?|&|$)/);
    if (!idMatch) {
        try {
            artifact = await extractWeb(url)
            if (artifact) return artifact
            else throw new Error("Error extracting unconventional youtube data")
        } catch (error) {
            logger.warn("Error extracting unconventional youtube data", { errorMessage: error.errorMessage, errStack: error.stack })
            throw new Error("Error extracting unconventional youtube data")
        }
    }
    const videoId = idMatch[1];

    try {
        const transcriptList = await TranscriptList.fetch(videoId);
        const transcript = transcriptList.find(['en', 'en-US', 'en-GB']) ?? transcriptList.all()[0];
        let processedData = ''
        let data = null;
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
            title: item.snippet?.title,
            description: item.snippet?.description,
            channel: item.snippet?.channelTitle,
            publishedAt: item.snippet?.publishedAt,
            views: item.statistics?.viewCount,
            duration: item.contentDetails?.duration,
        };


        //const artifact = { transcript: sanitizeFinalText(processedData), metaData: meta }
        logger.info("[Content Extraction] YT artifact", { artifact })
        return standardizer.standardizeVideo(artifact, url, "yt_fetch", 'flatWithRoles', { includeMetadata: true })
    } catch (err) {
        console.error("Error extracting YouTube transcript:", err);
        return null;
    }
}

module.exports = extractYT;  
