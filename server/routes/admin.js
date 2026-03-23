const express = require('express')
const router = express.Router()
const adminController = require('../controllers/adminController')
const { auth, requireRole } = require('../middleware/auth')

// Dashboard Stats (Publicly accessible for initial check, controller handles logic)
router.get('/stats', adminController.stats)
router.get('/playlists', auth, requireRole('admin'), adminController.recentPlaylists)

// User Management (Admin Only)
router.get('/users', auth, requireRole('admin'), adminController.users)
router.get('/users/export', auth, requireRole('admin'), adminController.usersExportCsv)
router.get('/usage', auth, requireRole('admin'), adminController.usage)
router.get('/logins', auth, requireRole('admin'), adminController.loginLogs)

// System Operations
router.post('/bootstrap', auth, adminController.bootstrap)
router.post('/import-local', auth, requireRole('admin'), adminController.importLocal)
// Login logs CSV
router.get('/logins/export', auth, requireRole('admin'), (req, res) => {
  const path = require('path')
  const fs = require('fs')
  try {
    const csvPath = path.join(__dirname, '..', 'uploads', 'admin', 'logins.csv')
    if (!fs.existsSync(csvPath)) {
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', 'attachment; filename="logins.csv"')
      return res.end('timestamp,userId,email,name,role,ip,ua\n')
    }
    res.sendFile(csvPath)
  } catch {
    res.status(500).json({ message: 'Export failed' })
  }
})

module.exports = router
