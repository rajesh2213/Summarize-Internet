const prisma = require('../config/prismaClient');
const logger = require('../config/logHandler');
const ContentSummarizer = require('../services/handlers/ContentSummarizer');
const { createTransaction, updateTransactionStatus, createSummary } = require('../services/transactionService');
const { getArtifactWithDocId, getArtifactContent } = require('../services/artifactService');
const { Status, SummaryType } = require('../generated/prisma');
const { updateDocumentStatus } = require('../services/documentService');
const { initListener } = require('../config/pgListener');
const notifier = require('../services/notifier');
const redisClient = require('../config/redisClient');

const summarizer = new ContentSummarizer();
const FALLBACK_INTERVAL = 5 * 60 * 1000;

async function retryWithBackoff(fn, maxRetries = 5, initialDelay = 5000) {
  let attempt = 0
  let delay = initialDelay

  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      if (error.message.includes("429")) {
        attempt++;
        logger.warn(`[summarizationWorker] Rate limit hit, retrying attempt ${attempt} in ${delay}ms`);
        await new Promise(res => setTimeout(res, delay));
        delay *= 2;
      } else {
        attempt++;
        logger.warn(`[summarizationWorker] Internal server error ${attempt} in ${delay}ms`);
        await new Promise(res => setTimeout(res, delay));
        delay *= 2;
      }
    }
  }
  throw new Error(`Max retries reached due to rate limits`);
}

async function claimAndProcessSummarizationJob() {
  const doc = await prisma.$transaction(async (tx) => {
    const docs = await tx.$queryRaw`
      SELECT id
      FROM documents
      WHERE status = 'INGESTED'
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED;
    `;
    return docs.length ? docs[0] : null;
  });

  if (!doc) return;

  logger.info(`[summarizationWorker] Processing document ${doc.id}`);
  logger.info(`[summarizationWorker] Document`, { doc });

  const tx = await createTransaction(doc.id);
  try {
    const artifact = await getArtifactWithDocId(doc.id);
    logger.info(`[summarizationWorker] Fetched artifact row`, { artifact });
    logger.info(`[summarizationWorker] Fetched artifact row: ${JSON.stringify(artifact)}`);

    if (!artifact) {
      logger.error("[summarizationWorker] No artifact found for document", { docId: doc.id });
      await updateTransactionStatus(tx.id, Status.ERROR);
      await updateDocumentStatus(doc.id, Status.ERROR);
      await notifier.notifyProgress(doc.id, "ERROR")
      return;
    }
    const artifactContent = await getArtifactContent(artifact.uri);
    const summaryContent = await retryWithBackoff(() => summarizer.summarize(artifactContent));
    await notifier.notifyProgress(doc.id, "SUMMARIZING")
    
    if (!summaryContent) {
      logger.warn(`[summarizationWorker] Summary failed but continuing gracefully for doc ${doc.id}`);
      await updateTransactionStatus(tx.id, Status.ERROR);
      await updateDocumentStatus(doc.id, Status.ERROR);
      await notifier.notifyProgress(doc.id, "ERROR")
      return;
    }

    logger.info(`[summarizationWorker] Summarized document id: ${doc.id}`, {sumVal: summaryContent});
    await notifier.notifyProgress(doc.id, "FINALIZING")
    const summaryRow = await createSummary(
      SummaryType.TLDR,
      summaryContent,
      artifact.uri,
      tx.id
    );

    if (summaryRow) {
      await updateTransactionStatus(tx.id, Status.COMPLETED);
      await updateDocumentStatus(doc.id, Status.COMPLETED);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await notifier.notifyProgress(doc.id, "COMPLETED", { summary: summaryContent })
      logger.info(`[summarizationWorker] Completed document ${doc.id}`);
    } else {
      await updateTransactionStatus(tx.id, Status.ERROR);
      await updateDocumentStatus(doc.id, Status.ERROR);
      await notifier.notifyProgress(doc.id, "ERROR")
    }
  } catch (err) {
    logger.error("[summarizationWorker] Summarization failed", { docId: doc.id, errMessage: err.message, errStack: err.stack });
    await updateTransactionStatus(tx.id, Status.ERROR);
    await updateDocumentStatus(doc.id, Status.ERROR);
    await notifier.notifyProgress(doc.id, "ERROR")
  }
}

async function summarizationWorkerLoop() {
  try {
    await redisClient.connect();
    logger.info('[summarizationWorker] Redis connected successfully');
  } catch (error) {
    logger.error('[summarizationWorker] Failed to connect to Redis:', error);
  }

  await initListener("ingested_doc", async (payload) => {
    logger.info(`[summarizationWorker] Notification received for document ${payload.id}`);
    await claimAndProcessSummarizationJob();
  });

  setInterval(async () => {
    logger.info("[summarizationWorker] Fallback polling");
    await claimAndProcessSummarizationJob();
  }, FALLBACK_INTERVAL);

  logger.info("[summarizationWorker] Listening for new INGESTED docs...");
}

summarizationWorkerLoop().catch((err) => {
  console.error("[summarizationWorker] Fatal error:", err);
  process.exit(1);
});
