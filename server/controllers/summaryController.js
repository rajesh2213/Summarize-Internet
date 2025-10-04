const {Source} = require('../generated/prisma')
const summaryModel = require('../models/summaryModel')
const prisma = require('../config/prismaClient')
const notifier = require('../services/notifier')
const cacheService = require('../services/cacheService')
const logger = require('../config/logHandler')


const postSummaryRequest = async (req, res, next) => {
    try{    
        const { url } = req.body
        const userId = req.user ? req.user.id : null
        if(!url){
            const errorObj = {
                errors: ["Please provide a url."],
                message: "Please provide a url.",
                status: 400
            }
            return next(errorObj)
        }

        let source;
        try{
            const parsedUrl = new URL(url);
            if(parsedUrl.hostname.includes('youtube.com')){
                source = Source.YOUTUBE
            }else if(parsedUrl.hostname.includes('twitch.tv')){
                source = Source.TWITCH
            }else{
                source = Source.WEBPAGE
            }
        }catch(error){
            const errorObj = {
                errors: ["Invalid URL format."],
                message: "Invalid URL format.",
                status: 400
            };
            return next(errorObj);
        }

        const cachedDocument = await cacheService.getCachedUrlDocument(url);
        if (cachedDocument) {
            logger.info(`[summaryController] Found cached document for URL: ${url}`);
            
            if (cachedDocument.hasSummary === true) {
                logger.info(`[summaryController] Document already exists with summary for URL: ${url}`);
                return res.status(200).json({
                    message: `Document already exists with summary`,
                    id: cachedDocument.id,
                    status: cachedDocument.status,
                    existing: true
                });
            } else if (cachedDocument.status === 'QUEUED' || cachedDocument.status === 'PROCESSING') {
                logger.info(`[summaryController] Document is already being processed for URL: ${url}`);
                return res.status(200).json({
                    message: `Document is already being processed`,
                    id: cachedDocument.id,
                    status: cachedDocument.status,
                    existing: true
                });
            } else if (cachedDocument.status === 'COMPLETED' && cachedDocument.hasSummary !== false) {
                logger.info(`[summaryController] Document already exists with summary for URL: ${url}`);
                return res.status(200).json({
                    message: `Document already exists with summary`,
                    id: cachedDocument.id,
                    status: cachedDocument.status,
                    existing: true
                });
            }
        }

        const existingDocument = await prisma.document.findFirst({
            where: {
                url: url,
                ...(userId ? { userId: userId } : { userId: null })
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        if (existingDocument) {
            const hasSummary = await prisma.transaction.findFirst({
                where: {
                    documentId: existingDocument.id,
                    status: 'COMPLETED'
                },
                include: {
                    summary: true
                }
            });

            const documentWithSummary = {
                ...existingDocument,
                hasSummary: hasSummary && hasSummary.summary.length > 0
            };

            await cacheService.cacheUrlDocument(url, documentWithSummary, source);

            if (documentWithSummary.hasSummary) {
                logger.info(`[summaryController] Found existing document for URL: ${url}`);
                return res.status(200).json({
                    message: `Document already exists with summary`,
                    id: existingDocument.id,
                    existing: true
                });
            } else if (existingDocument.status === 'QUEUED' || existingDocument.status === 'PROCESSING') {
                logger.info(`[summaryController] Document already being processed for URL: ${url}`);
                return res.status(200).json({
                    message: `Document is already being processed`,
                    id: existingDocument.id,
                    existing: true
                });
            }
        }

        const document = await summaryModel.createDocument(url, source, userId)
        
        const documentWithSummary = {
            ...document,
            hasSummary: false,
            status: document.status
        };
        await cacheService.cacheUrlDocument(url, documentWithSummary, source);
        
        await notifier.notifyProgress(document.id, "QUEUED")
        
        res.status(200).json({message: `Document is in ${document.status} state`, id: document.id})
    }catch (err) {
        const errorObj = {
            errors: [err.message || "Internal server error"],
            message: "Internal server error",
            status: 500
        }
        return next(errorObj)
    }
}

const getSummary = async (req, res, next) => {
    try {
        const { docId } = req.params
        const userId = req.user ? req.user.id : null

        const cachedSummary = await cacheService.getCachedSummary(docId);
        if (cachedSummary) {
            return res.status(200).json(cachedSummary);
        }

        const document = await prisma.document.findFirst({
            where: {
                id: docId
            },
            include: {
                transactions: {
                    include: {
                        summary: true
                    }
                }
            }
        })

        if (!document) {
            const errorObj = {
                errors: ["Document not found or access denied"],
                message: "Document not found or access denied",
                status: 404
            }
            return next(errorObj)
        }

        const latestTransaction = document.transactions[0]
        if (!latestTransaction || !latestTransaction.summary || latestTransaction.summary.length === 0) {
            const errorObj = {
                errors: ["Summary not found"],
                message: "Summary not found",
                status: 404
            }
            return next(errorObj)
        }

        const summary = latestTransaction.summary[0]
        const responseData = {
            summary: summary.content,
            type: summary.type,
            createdAt: summary.createdAt
        }

        await cacheService.cacheSummary(docId, responseData);

        res.status(200).json(responseData)

    } catch (err) {
        const errorObj = {
            errors: [err.message || "Internal server error"],
            message: "Internal server error",
            status: 500
        }
        return next(errorObj)
    }
}

module.exports = {
    postSummaryRequest,
    getSummary
}