const logger = require('../../config/logHandler')
const { ArtifactKind } = require('../../generated/prisma')
const extractWeb = require('../handlers/ingest/extractWeb')
const extractYT = require('../handlers/ingest/extractYT')
const { saveCleanedArtifact } = require('../artifactService')
const extractTwitch = require('../handlers/ingest/extractTwitch')
const notifier = require('../notifier')

async function ingest(job) {
    try {
        let artifact;
        logger.info("Injesting job", { job })
        if (!job) return logger.info("Not a valid job to injest:", job)
        switch (job.source) {
            case "WEBPAGE": {
                artifact = await extractWeb(job.id, job.url)
                if (!artifact) {
                    await notifier.notifyProgress(job.id, "ERROR")
                    throw new Error("Failed to extract Web content");
                }
                logger.info("[Cleaned Artifact] Extracted web content",)
                const result = await saveCleanedArtifact(ArtifactKind.TEXT, job.id, artifact.content)
                await notifier.notifyProgress(job.id, "INGESTING")
                return result
            }
            case 'YOUTUBE': {
                artifact = await extractYT(job.id, job.url)
                if (!artifact) {
                    await notifier.notifyProgress(job.id, "ERROR")
                    throw new Error("Failed to extract YouTube content");
                }
                logger.info("[Cleaned Artifact] Extracted yt content", { artifact: artifact.content })
                const result = await saveCleanedArtifact(ArtifactKind.TEXT, job.id, artifact.content)
                await notifier.notifyProgress(job.id, "INGESTING")
                return result
            }
            case 'TWITCH': {
                artifact = await extractTwitch(job.id, job.url)
                if (!artifact) {
                    await notifier.notifyProgress(job.id, "ERROR")
                    throw new Error("Failed to extract Twitch content");
                }
                logger.info("[Cleaned Artifact] Extracted twitch content", { artifact: artifact.content })
                const result = await saveCleanedArtifact(ArtifactKind.TEXT, job.id, artifact.content)
                await notifier.notifyProgress(job.id, "INGESTING")
                return result
            }
        }
    } catch (error) {
        console.log(error)
        logger.error("Error while injesting: ", { error })
        await notifier.notifyProgress(job.id, "ERROR")
        throw new Error("Error while injesting")
    }
}

module.exports = ingest