const prisma = require("../config/prismaClient");
const { Status, SummaryType } = require("../generated/prisma");
const logger = require("../config/logHandler");

async function createTransaction(documentId) {
    try {
        return await prisma.transaction.create({
            data: {
                status: Status.PROCESSING,
                documentId
            }
        })
    } catch (error) {
        logger.error("Error creating transaction", { errMessage: error.message, errStack: error.stack });
        throw new Error(error);
    }
}

async function updateTransactionStatus(id, status = Status.PROCESSING) {
    try {
        return await prisma.transaction.update({
            where: { id },
            data: {
                status
            }
        })
    } catch (error) {
        logger.error("Error updating transaction status", { errMessage: error.message, errStack: error.stack });
        throw new Error(error);
    }
}

async function createSummary(type = SummaryType.TLDR, content, artifactUrl, transactionId) {
    try {
        return await prisma.summary.create({
            data: {
                type,
                content,
                artifactUrl,
                transactionId
            }
        })
    } catch (error) {
        logger.error("Error creating summary", { errMessage: error.message, errStack: error.stack });
        throw new Error(error);
    }
}

module.exports = {
    createTransaction,
    updateTransactionStatus,
    createSummary
}