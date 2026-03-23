const router = require('express').Router()
const ext = require('../controllers/externalController')

router.get('/itunes', ext.itunes)
router.get('/jamendo', ext.jamendo)
router.get('/trending', ext.trending)
router.get('/resolve', ext.resolve)

module.exports = router
