require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors')
const cookieParser = require('cookie-parser')
const passport = require('./config/passport');
const errorHandler = require('./middlewares/errorHandler')
const authRouter = require('./routes/auth')
const summaryRouter = require('./routes/summary')

require('./cron-jobs/purgeLogs')
require("./cron-jobs/purgeUnverifiedUsers")

app.use(express.json({ limit: '25mb'}));
app.use(express.urlencoded({ extended: true}));
app.use(cookieParser());
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}))
app.use(passport.initialize())

app.use('/api/auth', authRouter)
app.use('/api/v1', summaryRouter)
app.use(errorHandler)

app.listen(process.env.PORT , () => console.log(`Server is running on port: ${process.env.PORT}`))