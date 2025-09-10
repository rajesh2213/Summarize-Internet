const rateLimit = require('express-rate-limit'); 

const resendLimiter = rateLimit({
    windowMs: 20 * 1000, 
    max: 1, 
    message: {
        errors: ["Too many resend requests from this IP, please try again after a minute."],
        message: "Too many requests",
        status: 429
    },
    standardHeaders: true, 
    legacyHeaders: false, 
});

module.exports = {resendLimiter}