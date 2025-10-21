require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors')
const cookieParser = require('cookie-parser')
const passport = require('./config/passport');
const errorHandler = require('./middlewares/errorHandler')
const authRouter = require('./routes/auth')
const summaryRouter = require('./routes/summary')
const progressRouter = require('./routes/progress')
const redisClient = require('./config/redisClient');
const logger = require('./config/logHandler');

require('./cron-jobs/purgeLogs')
require("./cron-jobs/purgeUnverifiedUsers")

async function initializeRedis() {
    try {
        await redisClient.connect();
        logger.info('Redis connected successfully');
    } catch (error) {
        logger.error('Failed to connect to Redis:', error);
    }
}

initializeRedis();

app.use(express.json({ limit: '25mb'}));
app.use(express.urlencoded({ extended: true}));
app.use(cookieParser());
app.use(cors({
    origin: [
        'http://localhost:5173',
        'chrome-extension://*',
        'moz-extension://*',
        'safari-extension://*',
        'ms-browser-extension://*'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}))
app.use(passport.initialize())

app.use('/api/auth', authRouter)
app.use('/api/v1', summaryRouter)
app.use('/api/v1', progressRouter)

app.use(errorHandler)

app.listen(process.env.PORT , () => logger.info(`Server is running on port: ${process.env.PORT}`))