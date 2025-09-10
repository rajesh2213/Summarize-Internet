require('dotenv').config()
const nodemailer = require('nodemailer');
const logger = require('./logHandler');

const sendVerificationEmail = async ({ email, username, token }) => {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });
        const verificationLink = `${process.env.API_BASE_URL}/api/auth/verify?token=${token}`
        console.log("VerToken: ", verificationLink)
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Verify Your Summarize-Internet Account.',
            html: `
                <h2>Hello ${username},</h2>
                <p>Thank you for registering! Please click the button below to verify your email address and activate your account.</p>
                <a href="${verificationLink}" 
                    style="background-color: #007bff;
                    color: white;
                    padding: 10px 20px;
                    text-decoration: none;
                    border-radius: 5px;
                    font-weight: bold;
                    display: inline-block;"
                >Verify Email</a>
                <p>If the button doesn't work, copy and paste the following link into your browser:</p>
                <p>${verificationLink}</p>
            `
        }
        transporter.sendMail(mailOptions)
        logger.info(`Verification email sent to ${email}`)
    }catch(err){
        logger.error(`Error sending verification email to ${email}:`, err)
        throw new Error('Failed to send verification email');
    }
}

module.exports = sendVerificationEmail