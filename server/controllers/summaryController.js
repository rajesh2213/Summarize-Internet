const {Source} = require('../generated/prisma')
const summaryModel = require('../models/summaryModel')

const postSummaryRequest = async (req, res, next) => {
    try{    
        const { url } = req.body
        const userId = req.user.id
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
        res.status(200).json({message: `Document is in ${document.status} state`, document})
    }catch (err) {
        const errorObj = {
            errors: [err.message || "Internal server error"],
            message: "Internal server error",
            status: 500
        }
        return next(errorObj)
    }
}

module.exports = {
    postSummaryRequest
}