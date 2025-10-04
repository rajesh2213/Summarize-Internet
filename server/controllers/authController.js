require('dotenv').config()
const { ValidationResult } = require("express-validator")
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const logger = require('../config/logHandler')
const jwt = require('jsonwebtoken')
const sendVerificationEmail = require('../config/emailService.js')
const authModel = require('../models/authModel.js')

const register = async (req, res, next) => {
    try {
        const { email, firstName, lastName, username, password } = req.body
        const user = await authModel.getUserByEmail(email)
        if (user) {
            const errorObj = {
                errors: ["User with this email already exists"],
                message: "User already exists",
                status: 422
            }
            logger.info('User with this email already exists: ', { email })
            return next(errorObj)
        }
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await sendVerificationEmail({
            email,
            username,
            token: verificationToken,
        });

        const newUser = await authModel.createUser({
            email,
            firstName,
            lastName,
            username,
            password,
            isVerified: false,
            verificationToken: verificationToken,
            verificationTokenExpiresAt: verificationTokenExpiresAt,
        })

        res.status(201).json({ message: "User registered successfully, Please check your email to verify your account. ", user: newUser })
        logger.info(`User registered successfully [isVerified: ${newUser.isVerified}]: `, { newUser })
    } catch (err) {
        const errorObj = {
            errors: ["Something went wrong..."],
            message: err.message || "Internal server error",
            status: 500
        }
        return next(errorObj)
    }
}

const resendVerificationEmail = async (req, res, next) => {
    try {
        const { email } = req.body;
        const user = await authModel.getUserByEmail(email);

        if (!user || user.isVerified) {
            logger.info(`Resend request for non-existent or verified user: ${email}`);
            return res.status(200).json({ message: "If an account with that email exists, a new verification email has been sent." });
        }

        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await authModel.updateUserVerificationToken(email, verificationToken, verificationTokenExpiresAt);

        await sendVerificationEmail({
            email: user.email,
            username: user.username,
            token: verificationToken,
        });

        res.status(200).json({ message: "A new verification email has been sent successfully." });
    } catch (err) {
        logger.error(`Error in resend verification email for ${req.body.email}:`, err);
        const errorObj = {
            errors: ["Failed to resend verification email"],
            message: "Internal server error",
            status: 500
        };
        return next(errorObj);
    }
};


const verifyUser = async (req, res, next) => {
    try {
        const { token } = req.query;
        if (!token) {
            return res.redirect(`${process.env.APP_BASE_URL}/verify-user?status=fail&message=token_is_missing`);
        }
        console.log("TOKEN: ", token)
        const user = await authModel.getUserByVerificationToken(token)
        if (!user) {
            const errorObj = {
                errors: ["Invalid or expired token"],
                message: "Invalid or expired token",
                status: 404
            }
            logger.warn("Invalid or expired token", errorObj)
            return res.redirect(`${process.env.APP_BASE_URL}/verify-user?status=fail&message=invalid_or_expired_token`);
        }
        if (user.isVerified) {
            logger.info("Account is already verified", errorObj)
            return res.redirect(`${process.env.APP_BASE_URL}/verify-user?status=success&message=account_already_verified`);
        }
        if (user.verificationTokenExpiresAt < Date.now()) {
            const errorObj = {
                errors: ["Verification link expired"],
                message: "Verification link expired",
                status: 400
            }
            logger.warn("Verification link expired", errorObj)
            return res.redirect(`${process.env.APP_BASE_URL}/verify-user?status=fail&message=verification_link_expired`);
        }
        const updatedUser = await authModel.updateUserVerificationStatus(user.id);
        logger.info("Account verified successfully")
        return res.redirect(`${process.env.APP_BASE_URL}/verify-user?status=success&message=account_verified_successfully`);
    } catch (err) {
        const errorObj = {
            errors: [err.message || "Internal server error"],
            message: "Internal server error",
            status: 500
        };
        logger.error('Error during email verification', { error: err.message, token: req.query.token });
        return next(errorObj);
    }
}

const login = async (req, res, next) => {
    const { email, password } = req.body
    const pwd = password
    try {
        const user = await authModel.getUserByEmail(email)
        if (!user) {
            const errorObj = {
                errors: ["User with this email does not exist"],
                message: "User not found",
                status: 404
            }
            return next(errorObj)
        }

        const matchPwd = await bcrypt.compare(pwd, user.password)
        if (!matchPwd) {
            const errorObj = {
                errors: ["Invalid credentials"],
                message: "Invalid credentials",
                status: 401
            }
            return next(errorObj)
        }

        if (!user.isVerified) {
            return res.redirect(`${process.env.APP_BASE_URL}/verify-user?status=pending&message=pending_user_email_verification`);
        }

        const accessToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30m' })
        const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' })
        const { password, isVerified, verificationToken, verificationTokenExpiresAt, ...userData } = user
        
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: process.env.NODE_ENV === 'production' ? 'Strict' : 'None',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/'
        })
        return res.status(200).json({ message: "Login successful", user: userData, accessToken })
    } catch (err) {
        const errorObj = {
            errors: [err.message || "Internal server error"],
            message: "Internal server error",
            status: 500
        }
        return next(errorObj)
    }
}

const logout = (req, res) => {
    console.log('Refresh TOKEN')
    console.log(req.cookies)
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'Strict' : 'None',
        path: '/'
    })
    res.status(200).json({ message: "Logged out successfully" })
}

const refreshToken = async (req, res, next) => {
    const refToken = req.cookies.refreshToken
    if (!refToken) {
        const errorObj = {
            errors: ["No refresh token"],
            message: "Unauthorized",
            status: 401
        }
        return next(errorObj)
    }

    try {
        const decoded = jwt.verify(refToken, process.env.JWT_SECRET)
        const user = await authModel.getUserById(decoded.id)
        if (!user) {
            const errorObj = {
                errors: ["User not found"],
                message: "Unauthorized",
                status: 401
            }
            return next(errorObj)
        }
        if (!user.isVerified) {
             const errorObj = {
                errors: ["User account is no longer verified"],
                message: "Unauthorized",
                status: 401
            };
            return next(errorObj);
        }
        const accessToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30m' })
        const { password, ...userData } = user
        return res.status(200).json({ message: "Token refreshed successfully", user: userData, accessToken })
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
    register,
    login,
    logout,
    refreshToken,
    verifyUser,
    resendVerificationEmail
}