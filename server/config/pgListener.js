require('dotenv').config()
const { Client} = require('pg');
const logger = require('./logHandler');


async function initListener(channel, onNotify) {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    })
    
    try {
        await client.connect()
        await client.query(`LISTEN ${channel}`)

        client.on('notification', (msg) => {
            try {
                const payload = msg.payload ? JSON.parse(msg.payload) : {}
                onNotify(payload)
            } catch (err) {
                logger.error(`[pgListener] Error parsing notification payload:`, err)
            }
        })

        client.on('error', (err) => {
            logger.error(`[pgListener] Database connection error:`, err)
        })

        return () => {
            try {
                client.end()
            } catch (err) {
                logger.error(`[pgListener] Error closing connection:`, err)
            }
        }
    } catch (err) {
        logger.error(`[pgListener] Failed to initialize listener:`, err)
        throw err
    }
}
module.exports = {initListener}