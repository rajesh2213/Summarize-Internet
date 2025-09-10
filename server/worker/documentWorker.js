const { initListener } = require('../config/pgListener');
const prisma = require('../config/prismaClient');
const { Status } = require('../generated/prisma');
const { updateDocumentStatus } = require('../services/documentService');
const ingest = require('../services/pipeline/ingest');
const logger = require('../config/logHandler');

const FALLBACK_INTERVAL = 5 * 60 * 1000;

async function claimAndProcessJob() {
    const job = await prisma.$transaction(async (tx) => {
        const jobs = await tx.$queryRaw`
        SELECT id, url, user_id, status, source, "createdAt"
        FROM documents
        WHERE status = 'QUEUED'
        ORDER BY "createdAt" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED;
        `;
        if (!jobs.length) return null;

        const job = jobs[0];
        const updated = await tx.document.updateMany({
            where: { id: job.id, status: Status.QUEUED },
            data: { status: Status.PROCESSING },
        });

        return updated.count ? job : null;
    });

    if (!job) return;

    try {
        logger.info(`[documentWorker] Processing ${job.id}`);
        const artifact = await ingest(job);
        logger.info(`[documentWorker] document ingested`, { artifact });
        if (artifact?.uri) {
            const updateDoc = await updateDocumentStatus(job.id, Status.INGESTED);
            logger.info(`[documentWorker] Updated doc status for docId: ${updateDoc.id}`);
            if (updateDoc) {
                logger.info(`[documentWorker] Trigerring ingested_doc event for docId: ${updateDoc.id}`);
                await prisma.$executeRawUnsafe(
                    `NOTIFY ingested_doc, '${JSON.stringify({ id: updateDoc.id })}'`
                );
            }
        } else {
            await updateDocumentStatus(job.id, Status.ERROR);
        }
    } catch (err) {
        logger.error("[documentWorker] Ingest failed", { jobId: job.id, errMessage: err.message, errStack: err.stack });
        await updateDocumentStatus(job.id, Status.ERROR);
    }
}

async function documentWorkerLoop() {
    await initListener('new_document', async (payload) => {
        logger.info(`[documentWorker] Notification received for document ${payload.id}`);
        await claimAndProcessJob();
    });

    setInterval(async () => {
        logger.info("[documentWorker] Fallback polling");
        await claimAndProcessJob();
    }, FALLBACK_INTERVAL);

    logger.info("[documentWorker] Listening for new jobs...");
}

documentWorkerLoop().catch((err) => {
    console.error("[documentWorker] Fatal error:", err);
    process.exit(1);
});
