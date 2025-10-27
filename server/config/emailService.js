require('dotenv').config()
const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const logger = require('./logHandler');

const sendVerificationEmail = async ({ email, username, token }) => {
    try {
        const baseUrl = process.env.API_BASE_URL || 'http://localhost:4000';
        const verificationLink = `${baseUrl}/api/auth/verify?token=${token}`;
        
        if (process.env.SENDGRID_API_KEY && process.env.EMAIL_FROM) {
            sgMail.setApiKey(process.env.SENDGRID_API_KEY);
            
            const msg = {
                to: email,
                from: process.env.EMAIL_FROM,
                subject: 'Verify Your Summarize-Internet Account',
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
            };

            await sgMail.send(msg);
            logger.info(`Verification email sent via SendGrid to ${email}`);
            return;
        }

        if (process.env.EMAIL_USER === 'your-email@gmail.com' || process.env.EMAIL_PASS === 'your-app-password') {
            logger.info(`Verification email logged to console for ${email} (email not configured)`);
            logger.info(`Verification link: ${verificationLink}`);
            return;
        }

        logger.info('Attempting Gmail SMTP connection', {
            emailUser: process.env.EMAIL_USER,
            emailPassLength: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0,
            emailPassPreview: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.substring(0, 4) + '...' : 'not set'
        });

        // fallback
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS?.replace(/\s/g, ''), 
            },
            connectionTimeout: 10000, 
            greetingTimeout: 5000,    
            socketTimeout: 10000,     
        });

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
        };

        const emailPromise = transporter.sendMail(mailOptions);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Email sending timeout')), 15000)
        );
        
        await Promise.race([emailPromise, timeoutPromise]);
        logger.info(`Verification email sent via Gmail to ${email}`);

    } catch(err) {
        logger.error(`Error sending verification email to ${email}:`, {
            error: err.message,
            code: err.code,
            response: err.response,
            email: email,
            emailService: process.env.SENDGRID_API_KEY ? 'SendGrid' : 'Gmail'
        });
        throw new Error(`Failed to send verification email: ${err.message}`);
    }
}

module.exports = sendVerificationEmail