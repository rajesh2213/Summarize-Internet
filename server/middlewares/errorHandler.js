const logger = require('../config/logHandler');

const errorHandler = (err, req, res, next) => {
    logger.error('Error: ', {
        error: err.stack || err,
        requestBody: req.body,
        route: req.originalUrl
    })

    const status = err.status || 500
    const message = status === 500 ? "Something went wrong..." : err.message || "Something went wrong..."
    const errors = err.errors || [message]

    res.status(status).json({
        status,
        message, 
        errors
    })
}

module.exports = errorHandler;