const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

const logDir = './logs';

const purgeLogs = () => {
    console.log('Running scheduled log file cleanup at 11 AM...');
    const cutoffTime = Date.now() - (5 * 24 * 60 * 60 * 1000);

    fs.readdir(logDir, (err, files) => {
        if (err) {
            console.error(`Error reading log directory (${logDir}): `, err)
            return
        }
        files.forEach(file => {
            const filePath = path.join(logDir, file)
            fs.stat(filePath, (err, stats) => {
                if (err) {
                    console.error(`Error getting stats of file ${file}: `, err)
                    return
                }
                if (stats.mtime.getTime() < cutoffTime) {
                    fs.unlink(filePath, (err) => {
                        if (err) {
                            console.error(`Error deleting file ${file}: `, err)
                        } else {
                            console.log(`Deleted old log file: ${file}`)
                        }
                    })
                }
            })
        })
    })
}

cron.schedule('57 16 * * *', purgeLogs, {
    timezone: 'Asia/Kolkata',
})

console.log('Log cleanup scheduler initialized. Cleanup will happen daily at 11 AM.')