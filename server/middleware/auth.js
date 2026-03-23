const jwt = require('jsonwebtoken')
const User = require('../models/User')

const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || ''
    let token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token && req.query?.token) token = req.query.token
    if (!token) return res.status(401).json({ message: 'No token' })
  // Guest bypass removed: login is mandatory
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'devsecret')
    let user
    if (global.__db_connected === false) {
      user = (global.__demo_users || []).find((u) => u._id === payload.id)
      if (user) user = { ...user }
    } else {
      user = await User.findById(payload.id).select('-password')
      if (!user) {
        const demo = (global.__demo_users || []).find((u) => u._id === payload.id)
        if (demo) user = { ...demo }
      }
    }
    if (!user) return res.status(401).json({ message: 'Invalid token' })
    req.user = user
    next()
  } catch (e) {
    return res.status(401).json({ message: 'Unauthorized' })
  }
}

const requireRole = (role) => (req, res, next) => {
  if (!req.user || req.user.role !== role) return res.status(403).json({ message: 'Forbidden' })
  next()
}

module.exports = { auth, requireRole }
