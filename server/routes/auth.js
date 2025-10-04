const {body} = require("express-validator")
const {Router} = require("express")
const authRouter = Router()
const authController = require("../controllers/authController")
const validationHandler = require("../middlewares/validationHandler")
const {resendLimiter} = require('../config/rateLimiter')

authRouter.post('/register', [
    body('email').trim().notEmpty().withMessage('Email is required')
        .isEmail().withMessage("Invalid email address"),
    body('firstName').trim().notEmpty().withMessage("First name is required"),
    body('username').trim().notEmpty().withMessage("Username is required"),
    body('password').trim().notEmpty().withMessage("Password is required")
        .isLength({min: 8}).withMessage("Password must be atleast 8 characters long")
        .matches(/[A-Z]/).withMessage("Password must contain at least one uppercase letter")
        .matches(/[a-z]/).withMessage("Password must contain at least one lowercase letter")
        .matches(/[0-9]/).withMessage("Password must contain at least one number")
        .matches(/[\W]/).withMessage("Password must contain at least one special character")
], validationHandler, authController.register)

authRouter.post('/login', [
    body('email').trim().notEmpty().withMessage("Email is required")
        .isEmail().withMessage("Invalid email address"),
    body('password').trim().notEmpty().withMessage("Password is required")
], validationHandler, authController.login)

authRouter.post('/logout', authController.logout)

authRouter.post('/refresh-token', authController.refreshToken)

authRouter.get('/verify', authController.verifyUser)

authRouter.post('/resend-verification', resendLimiter, [
    body('email').isEmail().withMessage('Invalid email address')
], validationHandler, authController.resendVerificationEmail);


module.exports = authRouter