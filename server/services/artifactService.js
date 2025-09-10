require('dotenv').config()
//const { s3, PutObjectCommand } = require('../config/s3')
const { r2, PutObjectCommand, GetObjectCommand } = require("../config/r2");
const prisma = require("../config/prismaClient");
const { v4: uuidv4 } = require("uuid");
const logger = require("../config/logHandler");
//const { GetObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require("crypto")

async function uploadArtifact(content, folder = "artifacts") {
    try {
        const key = `${folder}/${uuidv4()}.txt`;
        const command = new PutObjectCommand({
            Bucket: process.env.CLOUDFLARE_R2_BUCKET,
            Key: key,
            Body: content,
            ContentType: "text/plain",
        });
        await r2.send(command);
        return key;
    } catch (error) {
        logger.error("Error uploading artifact to S3:", { error });
        throw new Error("Error uploading artifact to S3");
    }
}

async function saveCleanedArtifact(kind, documentId, content) {
    const hash = computeHash(content);

    let artifact = await prisma.artifact.findUnique({
        where: { hash },
    });

    if (!artifact) {
        try {
            const uri = await uploadArtifact(content, "cleaned");
            artifact = await prisma.artifact.create({
                data: {
                    kind,
                    uri,
                    hash,
                },
            });
        } catch (error) {
            logger.error("Error creating artifact record:", { error });
            throw new Error("Error creating artifact record");
        }
    }

    try {
        await prisma.document.update({
            where: { id: documentId },
            data: { artifactId: artifact.id },
        });
    } catch (error) {
        logger.error("Error linking artifact to document:", { error });
        throw new Error("Error linking artifact to document");
    }

    return {
        ...artifact,
        content,
    };
}

async function getArtifactContent(uri) {
    try {
        const command = new GetObjectCommand({
            Bucket: process.env.CLOUDFLARE_R2_BUCKET,
            Key: uri,
        })
        const res = await r2.send(command)
        const content = await streamToString(res.Body)
        return content
    } catch (error) {
        logger.error("Error fetching artifact content:", { error });
        throw new Error("Error fetching artifact content");
    }
}

async function getArtifactWithDocId(documentId) {
    try {
        const doc = await prisma.document.findUnique({
            where: { id: documentId },
            include: { artifact: true }
        })
        if (!doc) {
            logger.warn(`[artifactService] No document found for id=${documentId}`);
            return null;
        }
        if (!doc.artifact) {
            logger.warn(`[artifactService] Document ${documentId} has no linked artifact`);
            return null;
        }

        return doc.artifact;
    } catch (error) {
        logger.error("Error fetching artifact content:", { error });
        throw new Error("Error fetching artifact content");
    }
}

function computeHash(text) {
    return crypto.createHash("sha256").update(text, "utf8").digest("hex")
}

function streamToString(stream) {
    return new Promise((resolve, reject) => {
        const chunks = []
        stream.on("data", (chunk) => chunks.push(chunk))
        stream.on("error", reject)
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")))
    })
}

module.exports = { uploadArtifact, saveCleanedArtifact, getArtifactContent, computeHash, getArtifactWithDocId };
