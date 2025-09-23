const {Router} = require('express')
const progressRouter = Router()
const {streamProgress} = require('../controllers/progressController')
const checkAuthentication = require('../middlewares/isAuthenticated')

progressRouter.get('/progress/:docId', checkAuthentication(false), streamProgress)

module.exports = progressRouter