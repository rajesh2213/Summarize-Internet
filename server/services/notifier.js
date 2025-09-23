const logger = require('../config/logHandler');
const prisma = require('../config/prismaClient')

async function notify(channel, payload) {
    const data = JSON.stringify(payload)
    
    try{
        await prisma.$executeRawUnsafe(
            `NOTIFY ${channel}, $tag$${data}$tag$`
        )
        logger.info(`[NOTIFIER] Sent an event on channel ${channel}`, {payload})
    } catch(err) {
        logger.error(`[NOTIFIER] Error sending an event on channel ${channel}`, {errMessage: err.message})
    }
}

async function notifyIngestedDoc(docId) {
    await notify("ingested_doc", {id: docId})
}

async function notifyNewDoc(docId) {
    await notify("new_document", {id: docId})
}

async function notifyProgress(docId, stage, extras = {}) {
    await notify("progress_update", {id: docId, stage, ...extras})  
}

module.exports = {
    notify,
    notifyIngestedDoc,
    notifyNewDoc,
    notifyProgress
}