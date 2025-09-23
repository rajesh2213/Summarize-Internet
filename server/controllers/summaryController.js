const {Source} = require('../generated/prisma')
const summaryModel = require('../models/summaryModel')
const prisma = require('../config/prismaClient')
const notifier = require('../services/notifier')


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
        const document = await summaryModel.createDocumet(url, source, userId)
        
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

        const document = await prisma.document.findFirst({
            where: {
                id: docId,
                ...(userId ? { userId: userId } : { userId: null })
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
        res.status(200).json({
            summary: summary.content,
            type: summary.type,
            createdAt: summary.createdAt
        })

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