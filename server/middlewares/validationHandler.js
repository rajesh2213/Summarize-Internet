const {validationResult} = require('express-validator')
const logger = require('../config/logHandler')

const validationHandler = (req, res, next) => {
    const errors = validationResult(req)
    if(!errors.isEmpty()){
        const errorObj = {
            errors: errors.array().map(e => e.msg),
            message: "Invalid input data",
            status: 422
        };
        logger.warn('Validation failed', { errors: errorObj.errors, route: req.originalUrl });
        return next(errorObj);
    }
    next();
};

module.exports = validationHandler;