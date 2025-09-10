const passport = require('../config/passport')
const logger = require('../config/logHandler')

const checkAuthentication = (failIfNotAuthenticated = false) => {
    return (req, res, next) => {
        passport.authenticate('jwt', { session: false }, (err, user, info) => {
            if (err) {
                logger.error(err);
                const errorObj = {
                        errors: ["Internal server error"],
                        message: "Authentication error",
                        status: 500
                    };
                    return next(errorObj);
            }
            if (!user) {
                if (failIfNotAuthenticated) {
                    const errorObj = {
                        errors: ["Unauthorized"],
                        message: "Unauthorized",
                        status: 401
                    };
                    return next(errorObj);
                } else {
                    logger.info('Unauthenticated request received, continuing...');
                    req.user = null;
                    return next();
                }
            }
            req.user = user;
            next();
        })(req, res, next);
    };
};

module.exports = checkAuthentication;
