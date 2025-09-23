const logger = require('../../config/logHandler');
const ingest = require('./ingest');
const { updateDocumentStatus } = require('../documentService');
const { Status } = require('../../generated/prisma')
const ContentSummarizer = require('../handlers/ContentSummarizer');

const summarizer = new ContentSummarizer();

const runPipeline = async (job) => {
    try {
        if (!job) {
            throw new Error("Invalid job passed for pipeline");
        }

        const artifactRow = await ingest(job);
        if (!artifactRow?.uri || !artifactRow?.content) {
            throw new Error("Ingestion failed: missing uri or content");
        }
        logger.info("Ingest operation completed successfully", { jobId: job.id });

        const documentRow = await updateDocumentStatus(artifactRow.documentId, Status.COMPLETED);
        if (!documentRow) {
            throw new Error("Failed to update document status");
        }
        logger.info("Document status updated", { documentId: artifactRow.documentId });

        await notifier.notifyProgress(jobId, "SUMMARIZING")
        
        const summarizedContent = await summarizer.summarize(artifactRow.content);
        if (!summarizedContent) {
            throw new Error("Summarization returned empty content");
        }
        logger.info("Summarized content generated", { documentId: artifactRow.documentId, summarizedContent });

        return summarizedContent;
    } catch (error) {
        logger.error("Pipeline failed", {
            jobId: job?.id,
            errMessage: error.message,
            errStack: error.stack,
        });
        throw error;
    }
};

module.exports = { runPipeline };
