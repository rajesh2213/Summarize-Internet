const logger = require('../config/logHandler')
const {initListener} = require('../config/pgListener')

const streamProgress = async (req, res, next) => {
    const {docId} = req.params
    
    try {
        const origin = req.headers.origin;
        const allowedOrigins = [
            'http://localhost:5173',
            'http://localhost:4000',
            'https://summarize-internet.vercel.app',
        ];
        const isExtension = origin && /^(chrome-extension|moz-extension|safari-extension|ms-browser-extension):\/\//.test(origin);
        const isAllowed = !origin || allowedOrigins.includes(origin) || isExtension;
        
        const headers = {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "Access-Control-Allow-Headers": "Cache-Control, Content-Type"
        };
        
        if (isAllowed && origin) {
            headers["Access-Control-Allow-Origin"] = origin;
            headers["Access-Control-Allow-Credentials"] = "true";
        } else if (!origin) {
            headers["Access-Control-Allow-Origin"] = "*";
        }
        
        res.writeHead(200, headers)

        res.write(`data: ${JSON.stringify({id: docId, stage: "CONNECTED"})}\n\n`)

        const heartbeat = setInterval(() => {
            try {
                res.write(`data: ${JSON.stringify({id: docId, stage: "HEARTBEAT"})}\n\n`)
            } catch (err) {
                logger.error(`[progressController] Heartbeat failed for docId: ${docId}`, err)
                clearInterval(heartbeat)
            }
        }, 30000)

        const unsubscribe = await initListener("progress_update", (payload) => {
            if(payload.id === docId) {
                res.write(`data: ${JSON.stringify(payload)}\n\n`)
                if(payload.stage === "COMPLETED" || payload.stage === "ERROR"){
                    clearInterval(heartbeat)
                    res.end()
                }
            }
        })

        req.on('close', () => {
            logger.info(`[progressController] Client disconnected for docId: ${docId}`)
            clearInterval(heartbeat)
            unsubscribe()
        })

        req.on('error', (err) => {
            logger.error(`[progressController] Request error for docId: ${docId}`, err)
            clearInterval(heartbeat)
            unsubscribe()
        })

    } catch (err) {
        logger.error(`[progressController] Error setting up progress stream for docId: ${docId}`, err)
        if (!res.headersSent) {
            res.status(500).json({error: "Failed to setup progress stream"})
        }
    }
}

module.exports = {
    streamProgress
}