const logger = require('../config/logHandler');
const prisma = require('../config/prismaClient')
const bcrypt = require('bcryptjs')

const createUser = async ({
    email,
    firstName,
    lastName,
    username,
    password,
    isVerified,
    verificationToken,
    verificationTokenExpiresAt,
}) => {
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await prisma.user.create({
            data: {
                email,
                firstName,
                lastName,
                username,
                password: hashedPassword,
                isVerified,
                verificationToken,
                verificationTokenExpiresAt,
            },
        });
        return newUser;
    } catch (error) {
        logger.error('Error creating user:', error);
        throw new Error('Database error while creating user');
    }
};

const getUserById = async (id) => {
    try {
        return await prisma.user.findUnique({
            where: {
                id
            }
        })
    } catch (error) {
        logger.error('Error fetching user with ID:', error);
        throw new Error('Database error fetching user with ID');
    }
}

const getUserByEmail = async (email) => {
    try {
        return await prisma.user.findUnique({
            where: {
                email
            }
        })
    } catch (error) {
        logger.error('Error fetching user with email:', error);
        throw new Error('Database error fetching user with email');
    }
}

const updateUserVerificationToken = async (email, verificationToken, verificationTokenExpiresAt) => {
    try{
        return await prisma.user.update({
            where: {
                email
            },
            data: {
                verificationToken,
                verificationTokenExpiresAt
            }
        })
    }catch(error){
        logger.error('Error updating verification token:', error);
        throw new Error('Database error while updating verification token');
    }
}

const getUserByVerificationToken = async (verificationToken) => {
    try {
        return await prisma.user.findUnique({
            where: {
                verificationToken
            }
        })
    } catch (error) {
        logger.error('Error fetching user with verification token:', error);
        throw new Error('Database error fetching user with verification token');
    }
}

const updateUserVerificationStatus = async (userId) => {
    try{
        return await prisma.user.update({
            where: {
                id: userId
            },
            data: {
                isVerified: true
            }
        })
    } catch (error) {
        logger.error('Error updating user verified status:', error);
        throw new Error('Database error while updating user verified status');
    }
}

const deleteUnverifiedUsers = () => {
    try{
        const twentyFourHoursAgo = new Date(Date.now() - (24 * 60 * 60 * 1000))
        return prisma.user.deleteMany({
            where: {
                isVerified: false,
                verificationTokenExpiresAt: {
                    lf: twentyFourHoursAgo
                }
            }
        })
    } catch(error) {
        logger.error('Error deleting unverfied users: ',error)
        throw new Error('Database error while deleting unverified users')
    }
}

module.exports = {
    createUser,
    getUserById,
    getUserByEmail,
    getUserByVerificationToken,
    updateUserVerificationToken,
    updateUserVerificationStatus,
    deleteUnverifiedUsers
}