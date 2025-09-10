const logger = require('../../config/logHandler')
const { ArtifactKind } = require('../../generated/prisma')
const extractWeb = require('../handlers/ingest/extractWeb')
const extractYT = require('../handlers/ingest/extractYT')
const { saveCleanedArtifact } = require('../artifactService')
const extractTwitch = require('../handlers/ingest/extractTwitch')

async function ingest(job) {
    try {
        let artifact;
        logger.info("Injesting job", { job })
        if (!job) return logger.info("Not a valid job to injest:", job)
        switch (job.source) {
            case "WEBPAGE": {
                artifact = await extractWeb(job.url)
                if (!artifact) logger.error("Error extracting Web content")
                logger.info("[Cleaned Artifact] Extracted web content", { artifact: artifact.content })
                return await saveCleanedArtifact(ArtifactKind.TEXT, job.id, artifact.content)
            }
            case 'YOUTUBE': {
                artifact = await extractYT(job.url)
                logger.info("[Cleaned Artifact] Extracted yt content", { artifact: artifact.content })
                return await saveCleanedArtifact(ArtifactKind.TEXT, job.id, artifact.content)
            }
            case 'TWITCH': {
                artifact = await extractTwitch(job.url)
                logger.info("[Cleaned Artifact] Extracted twitch content", { artifact: artifact.content })
                return await saveCleanedArtifact(ArtifactKind.TEXT, job.id, artifact.content)
            }
        }
    } catch (error) {
        console.log(error)
        logger.error("Error while injesting: ", { error })
        throw new Error("Error while injesting")
    }
}

module.exports = ingest