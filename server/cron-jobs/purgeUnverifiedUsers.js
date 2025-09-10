const cron = require('node-cron')
const authModel = require('../models/authModel')
const logger = require('../config/logHandler')

const purgeUnverifiedUsers = async () => {
    logger.info('Running scheduled job: Purging unverified users...')
    try{
        const deletedUsers = await authModel.deleteUnverifiedUsers()
        logger.info(`Deleted ${deletedUsers.count} unverified users from the database`)
    }catch(error) {
        logger.error("Failed to delete all unverified users: ",error)
    }
}

module.exports = purgeUnverifiedUsers