const prisma = require('../config/prismaClient')
const logger = require('../config/logHandler')
const notifier = require('../services/notifier')

const createDocument = async (url, source, userId) => {
    try {
        const doc = await prisma.document.create({
            data: {
                url,
                source,
                userId
            }
        })
        // await prisma.$executeRawUnsafe(
        //     `NOTIFY new_document, '${JSON.stringify({ id: doc.id })}'`
        // );
        await notifier.notifyNewDoc(doc.id)
        return doc
    } catch (error) {
        logger.error('Error creating document:', error);
        throw new Error('Database error while creating document');
    }
}

const createTransaction = async (userId, documentId) => {
    try {
        return await prisma.transaction.create({
            data: {
                userId,
                documentId
            }
        })
    } catch (error) {
        logger.error('Error creating transaction:', error)
        throw new Error("Database error while creating transaction")
    }
}

module.exports = {
    createDocument,
    createTransaction
}
