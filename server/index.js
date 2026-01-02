require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors')
const cookieParser = require('cookie-parser')
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const passport = require('./config/passport');
const errorHandler = require('./middlewares/errorHandler')
const authRouter = require('./routes/auth')
const summaryRouter = require('./routes/summary')
const progressRouter = require('./routes/progress')
const redisClient = require('./config/redisClient');
const logger = require('./config/logHandler');

require('./cron-jobs/purgeLogs')
require("./cron-jobs/purgeUnverifiedUsers")

async function initializeDatabase() {
    try {
        console.log('=== RUNNING DATABASE MIGRATIONS ===');
        const { execSync } = require('child_process');
        execSync('npx prisma migrate deploy --schema=./prisma/schema.prisma', { stdio: 'inherit' });
        console.log('=== MIGRATIONS COMPLETED SUCCESSFULLY ===');
    } catch (error) {
        console.error('=== MIGRATION FAILED ===', error.message);
    }
}

async function initializeRedis() {
    try {
        await redisClient.connect();
        logger.info('Redis connected successfully');
    } catch (error) {
        logger.error('Failed to connect to Redis:', error);
    }
}

app.set('trust proxy', 1);

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) {
            console.log('[CORS] No origin header, allowing request');
            return callback(null, true);
        }

        console.log(`[CORS] Checking origin: ${origin}`);

        const allowedOrigins = [
            'http://localhost:5173',
            'http://localhost:4000',
            'https://summarize-internet.vercel.app',
        ];

        if (allowedOrigins.includes(origin)) {
            console.log(`[CORS] Origin allowed (exact match): ${origin}`);
            return callback(null, true);
        }

        if (/^https:\/\/summarize-internet.*\.vercel\.app$/.test(origin)) {
            console.log(`[CORS] Origin allowed (Vercel pattern): ${origin}`);
            return callback(null, true);
        }

        if (/^(chrome-extension|moz-extension|safari-extension|ms-browser-extension):\/\//.test(origin)) {
            console.log(`[CORS] Origin allowed (extension): ${origin}`);
            return callback(null, true);
        }

        console.warn(`[CORS] Blocked origin: ${origin}`);
        callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-Requested-With', 
        'Accept', 
        'Origin',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers'
    ],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
    maxAge: 86400 
};

app.use(cors(corsOptions));

app.options('*', cors(corsOptions));

app.use(express.json({ limit: '25mb'}));
app.use(express.urlencoded({ extended: true}));
app.use(cookieParser());

async function startServer() {
    await initializeDatabase();
    await initializeRedis();
    
    app.use(session({
        store: new RedisStore({ 
            client: redisClient.getClient(),
            prefix: 'sess:',
            ttl: 24 * 60 * 60 
        }),
        secret: process.env.SESSION_SECRET || 'your-session-secret-key',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000 
        }
    }))

    app.use(passport.initialize())
    app.use(passport.session())

    app.get('/health', (req, res) => {
        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development'
        });
    });

    app.get('/api/cors-test', (req, res) => {
        res.json({
            message: 'CORS is working',
            origin: req.headers.origin,
            timestamp: new Date().toISOString()
        });
    });

    app.use('/api/auth', authRouter)
    app.use('/api/v1', summaryRouter)
    app.use('/api/v1', progressRouter)

    app.use(errorHandler)

    app.listen(process.env.PORT , () => logger.info(`Server is running on port: ${process.env.PORT}`))
}

startServer().catch(console.error);