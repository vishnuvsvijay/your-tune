const jwt = require('jsonwebtoken')
const User = require('../models/User')
const Song = require('../models/Song')
const Usage = require('../models/Usage')
const Playlist = require('../models/Playlist')

module.exports = function registerSockets(io) {
  global.__onlineUsers = new Map()

  const emitAdminStats = async () => {
    try {
      const stats = {
        users: global.__db_connected === false ? (global.__demo_users || []).length : await User.countDocuments(),
        songs: global.__db_connected === false ? 0 : await Song.countDocuments(),
        playlists: global.__db_connected === false ? 0 : await Playlist.countDocuments(),
        online: global.__onlineUsers.size,
      }
      io.to('admins').emit('admin:stats', stats)
    } catch (err) {
      console.error("Admin stats emit error:", err)
    }
  }

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token
      if (!token) return next()
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'devsecret')
      let user
      if (global.__db_connected === false) {
        user = (global.__demo_users || []).find((u) => u._id === payload.id)
      } else {
        user = await User.findById(payload.id).select('-password')
      }
      if (user) socket.user = user
      next()
    } catch (e) {
      next()
    }
  })

  io.on('connection', async (socket) => {
    if (socket.user) {
      global.__onlineUsers.set(socket.user._id.toString(), true)
      socket.join(socket.user._id.toString())
      if (socket.user.role === 'admin') {
        socket.join('admins')
      }
      io.emit('user:online', { userId: socket.user._id })
      await emitAdminStats()
    }

    socket.on('usage:tick', async (payload = {}) => {
      try {
        if (!socket.user) return
        const seconds = Math.max(0, Math.min(60, Number(payload.seconds) || 0))
        if (seconds <= 0) return
        const at = new Date()
        if (global.__db_connected === false) {
          global.__usageEvents = global.__usageEvents || []
          global.__usageEvents.push({ userId: socket.user._id.toString(), seconds, at })
        } else {
          await Usage.create({ userId: socket.user._id, seconds, at })
        }
        io.to('admins').emit('usage:update', { userId: socket.user._id.toString(), delta: seconds })
      } catch {}
    })

    socket.on('disconnect', async () => {
      if (socket.user) {
        global.__onlineUsers.delete(socket.user._id.toString())
        io.emit('user:offline', { userId: socket.user._id })
        await emitAdminStats()
      }
    })
  })
}
