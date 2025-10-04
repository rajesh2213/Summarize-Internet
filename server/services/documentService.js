const prisma = require("../config/prismaClient");
const { Status } = require("../generated/prisma");
const logger = require("../config/logHandler");
const cacheService = require("./cacheService");

async function updateDocumentStatus(id, status = Status.PROCESSING) {
  try {
    const updatedDocument = await prisma.document.update({
      where: { id },
      data: { status }
    });

    if(status === Status.ERROR) {
      await cacheService.invalidateDocument(id);
    } else if (status === Status.COMPLETED) {
      if (updatedDocument.url) {
        const documentWithSummary = {
          ...updatedDocument,
          hasSummary: true
        };
        await cacheService.cacheUrlDocument(
          updatedDocument.url, 
          documentWithSummary, 
          updatedDocument.source
        );
      }
    }
    
    return updatedDocument;
  } catch (error) {
    logger.error("Error updating document status:", { error });
    throw new Error("Error updating document status");
  }
}

async function getDocument(id, userId = null) {
  try {
    const cachedDocument = await cacheService.getCachedDocument(id, userId);
    if (cachedDocument) {
      return cachedDocument;
    }

    const document = await prisma.document.findFirst({
      where: {
        id,
        ...(userId ? { userId: userId } : { userId: null })
      },
      include: {
        transactions: {
          include: {
            summary: true
          }
        },
        artifact: true
      }
    });

    if (document) {
      await cacheService.cacheDocument(id, document, userId);
    }

    return document;
  } catch (error) {
    logger.error("Error getting document:", { error });
    throw new Error("Error getting document");
  }
}

module.exports = { updateDocumentStatus, getDocument };