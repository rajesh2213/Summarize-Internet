const prisma = require("../config/prismaClient");
const { Status } = require("../generated/prisma");
const logger = require("../config/logHandler");

async function updateDocumentStatus(id, status = Status.PROCESSING) {
  try {
    return prisma.document.update({
      where: { id },
      data: { status }
    });
  } catch (error) {
    logger.error("Error updating document status:", { error });
    throw new Error("Error updating document status");
  }
}

module.exports = { updateDocumentStatus };