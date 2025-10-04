const logger = require('../../../config/logHandler')
require('dotenv').config()
const { spawn } = require('child_process');
const extractWeb = require('./extractWeb')
const ContentStandardizer = require('../ContentStandardize')
const cacheService = require('../../cacheService')

const standardizer = new ContentStandardizer();
let twitchTokenCache = { token: null, expiry: 0 };

async function getTwitchToken() {

    const now = Date.now()
    if (twitchTokenCache.token && now < twitchTokenCache.expiry) {
        return twitchTokenCache.token;
    }

    const res = await fetch(
        `https://id.twitch.tv/oauth2/token?client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${process.env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
        { method: 'POST' }
    )
    if (!res) throw new Error(`Failed to fetch Twitch token: ${res.status}`);
    const data = await res.json()

    twitchTokenCache = {
        token: data.access_token,
        expiry: now + data.expires_in * 1000 - 60_000
    }
    return twitchTokenCache.token;
}

async function fetchTwitchData(endpoint, param) {
    const token = await getTwitchToken()
    const url = new URL(`https://api.twitch.tv/helix/${endpoint}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));

    const res = await fetch(url, {
        headers: {
            'Client-ID': process.env.TWITCH_CLIENT_ID,
            Authorization: `Bearer ${token}`
        }
    })
    if (res.ok) {
        logger.error("Twitch API error", { Status: res.status })
        throw new Error(`Twitch API error: ${res.status}`);
        return
    }
    return res.json()
}

async function fetchChat(videoId) {
  return new Promise((resolve) => {
    const chat = [];
    try {
      const proc = spawn('tcd', ['--video', videoId, '--format', 'json', '--output', '-']);
      proc.stdout.on('data', (chunk) => {
        try {
          const lines = chunk.toString().split('\n').filter(Boolean);
          for (const line of lines) {
            chat.push(JSON.parse(line));
          }
        } catch (err) {
          logger.warn('Chat parse error', { error: err.message });
        }
      });
      proc.on('close', () => resolve(chat));
    } catch (err) {
      logger.warn('TCD spawn failed', { error: err.message });
      resolve([]);
    }
  });
}

async function extractTwitch(url) {
    const vodMatch = url.match(/videos\/(\d+)/);
    const channelMatch = url.match(/twitch\.tv\/([^/?]+)/);

    let isVod = false;
    let videoId = null;
    let channelName = null;

    if (vodMatch) {
        isVod = true
        videoId = vodMatch[1]
    } else if (channelMatch) {
        channelName = channelMatch[1]
    } else {
        try {
            artifact = await extractWeb(url)
            if (artifact) return artifact
            else throw new Error("Error extracting unconventional twitch data")
        } catch (error) {
            logger.warn("Error extracting unconventional twitch data", { errorMessage: error.errorMessage, errStack: error.stack })
            throw new Error("Error extracting unconventional twitch data")
        }
    }
    try {
        if (isVod) {
            let item = null;
            const cachedVodData = await cacheService.getCachedTwitchData(videoId);
            if (cachedVodData) {
                logger.info("[Twitch] Using cached VOD data for video:", videoId);
                item = cachedVodData;
            } else {
                const metaResp = await fetchTwitchData('videos', { id: videoId });
                item = metaResp.data?.[0];
                
                if (item) {
                    await cacheService.cacheTwitchData(videoId, item);
                    logger.info("[Twitch] Cached VOD data for video:", videoId);
                }
            }
            
            const chatMessages = await fetchChat(videoId);
            if (!item) {
                logger.error("No twitch vodeo found")
                throw new Error("No twitch video found")
            }

            const artifact = {
                title: item.title,
                description: item.description,
                channel: item.user_name,
                date: item.created_at,
                views: item.view_count,
                duration: item.duration,
                live: false,
                transcript: [],
                chat: chatMessages.map(c => ({
                    timestamp: c.comment?.created_at,
                    author: c.commenter?.display_name,
                    text: c.message?.body,
                })),
            }
            logger.info('[Content Extraction] Twitch VOD artifact', { artifact });
            return standardizer.standardizeVideo(artifact, url, 'twitch_vod', 'flatWithRoles', { includeMetadata: true });
        } else {
            const metaResp = await fetchTwitchData('streams', { user_login: channelName })
            const item = metaResp.data?.[0];
            if (!item) throw new Error('Stream is not live');

            const artifact = {
                title: item.title,
                channel: item.user_name,
                live: true,
                views: item.viewer_count,
                startedAt: item.started_at,
                transcript: [],
                chat: [],
            };
            logger.info('[Content Extraction] Twitch Live artifact', { artifact });
            return standardizer.standardizeVideo(artifact, url, 'twitch_live', 'flatWithRoles', { includeMetadata: true });
        }
    } catch (error) {
        logger.error("Error extracting twitch data", { errMessage: error.message, errStack: error.stack })
    }
}

module.exports = extractTwitch