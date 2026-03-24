const jwt = require('jsonwebtoken')
const User = require('../models/User')

const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || ''
    let token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token && req.query?.token) token = req.query.token
    if (!token) {
      console.warn("[Auth] No token provided in request")
      return res.status(401).json({ message: 'No authentication token provided' })
    }
  // Guest bypass removed: login is mandatory
    let payload
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET || 'devsecret')
    } catch (jwtErr) {
      console.error("[Auth] JWT Verification Failed:", jwtErr.message)
      return res.status(401).json({ message: 'Invalid or expired token' })
    }
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
