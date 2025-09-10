require('dotenv').config()
const { Client} = require('pg');

const client = new Client({
    connectionString: process.env.DATABASE_URL
})
console.log("DATABASE_URL:", process.env.DATABASE_URL);

async function initListener(channel, onNotify) {
    await client.connect()
    await client.query(`LISTEN ${channel}`)

    client.on('notification', (msg) => {
        const payload = msg.payload ? JSON.parse(msg.payload) : {}
        onNotify(payload)
    })
    return client
}
module.exports = {initListener}