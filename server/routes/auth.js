const express = require('express')
const router = express.Router()
const { register, login, me, demoAdmin } = require('../controllers/authController')
const { auth } = require('../middleware/auth')

router.post('/register', register)
router.post('/login', login)
router.get('/me', auth, me)
router.post('/demo-admin', demoAdmin)

module.exports = router
