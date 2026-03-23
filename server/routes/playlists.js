const router = require('express').Router()
const { auth } = require('../middleware/auth')
const ctrl = require('../controllers/playlistController')

router.get('/me', auth, ctrl.listMine)
router.get('/public', ctrl.listPublic)
router.post('/', auth, ctrl.create)
router.post('/add', auth, ctrl.addSong)
router.post('/remove', auth, ctrl.removeSong)

module.exports = router
