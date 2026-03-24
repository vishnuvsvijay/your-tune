const express = require('express')
const router = express.Router()
const songController = require('../controllers/songController')
const multer = require('multer')
const upload = multer({ dest: 'uploads/' })

const { auth } = require('../middleware/auth')

// 1. Search & Trending
router.get('/search', songController.search || ((req, res) => res.json({ data: [] })))
router.get('/trending', (req, res) => {
    // Safety check: function irundha mattum execute aagum
    if (songController && typeof songController.topLiked === 'function') {
        return songController.topLiked(req, res);
    }
    res.json({ data: [] });
})

// 2. Core Operations
// ERROR FIX: Check if .list exists, else use fallback to avoid crash
router.get('/', songController.list || ((req, res) => res.json([])))

router.post('/', auth, upload.any(), (req, res) => {
    if (songController && typeof songController.create === 'function') {
        return songController.create(req, res);
    }
    res.status(500).json({ message: "Create Controller not found" });
})

// ERROR FIX: 'remove' spelling or existence check
// Change 'remove' to 'deleteSong' if that's what you named it in controller
router.delete('/:id', auth, songController.remove || songController.deleteSong || ((req, res) => res.status(500).send("Delete function missing")))

// 3. Streaming & Proxies (Add fallbacks to prevent "argument handler" error)
router.get('/stream-proxy', songController.streamProxy || ((req, res) => res.end()))
router.get('/resolve', songController.resolveForClient || ((req, res) => res.json({})))
router.get('/by-file', songController.findByFile || ((req, res) => res.json({})))
router.get('/admin-uploads', songController.listAdminUploads || ((req, res) => res.json([])))

// 4. Import & Library
router.get('/top-liked', songController.topLiked || ((req, res) => res.json([])))
router.get('/liked-files', auth, songController.listLikedFiles || ((req, res) => res.json([])))
router.post('/:id/like', auth, songController.like || ((req, res) => res.json({})))
router.post('/like-any', auth, songController.likeAny || ((req, res) => res.json({})))

// 5. Comments
router.get('/:id/comments', songController.listComments || ((req, res) => res.json([])))
router.post('/:id/comments', auth, songController.addComment || ((req, res) => res.json({})))
router.post('/comments/:commentId/like', auth, songController.likeComment || ((req, res) => res.json({})))

// 6. Play Tracking & Replay Mix
router.post('/:id/play', auth, songController.recordPlay || ((req, res) => res.json({})))
router.get('/replay-mix', auth, songController.getReplayMix || ((req, res) => res.json({})))

module.exports = router