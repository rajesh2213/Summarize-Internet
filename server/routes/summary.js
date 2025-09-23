const {Router} = require('express')
const summaryRoute = Router()
const {body} = require('express-validator')
const validationHandler = require('../middlewares/validationHandler')
const summaryController = require('../controllers/summaryController')
const checkAuthentication = require('../middlewares/isAuthenticated')

summaryRoute.post('/summarize', [
    body('url').notEmpty().withMessage('URL is required')
        .isURL().withMessage("Please provide a valid URL.")
], validationHandler, checkAuthentication(false), summaryController.postSummaryRequest)

summaryRoute.get('/summary/:docId', checkAuthentication(false), summaryController.getSummary)

module.exports = summaryRoute