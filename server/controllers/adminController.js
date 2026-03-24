const User = require('../models/User')
const Song = require('../models/Song')
const Usage = require('../models/Usage')
const Playlist = require('../models/Playlist')
const fs = require('fs')
const path = require('path')

// --- GET DASHBOARD STATS (Strict Real-time counts from MongoDB) ---
exports.stats = async (req, res) => {
  try {
    const online = global.__onlineUsers ? global.__onlineUsers.size : 0
    
    // Fallback for non-connected DB or empty DB
    let data = { users: 0, songs: 0, playlists: 0, online: online, plays: 0, likes: 0 }

    if (global.__db_connected !== false) {
      const [usersCount, songsCount, playlistsCount, usageData, songsData] = await Promise.all([
        User.countDocuments(),
        Song.countDocuments(),
        Playlist.countDocuments(),
        Usage.aggregate([
          { $group: { _id: null, totalSeconds: { $sum: "$seconds" } } }
        ]),
        Song.aggregate([
          { $group: { _id: null, totalLikes: { $sum: { $size: { $ifNull: ["$likes", []] } } } } }
        ])
      ])
      
      data.users = usersCount || 0
      data.songs = songsCount || 0
      data.playlists = playlistsCount || 0
      data.plays = Math.floor((usageData[0]?.totalSeconds || 0) / 180) || 0
      data.likes = songsData[0]?.totalLikes || 0
    } else if (global.__demo_users) {
      data.users = global.__demo_users.length
      data.songs = 50 // Dummy for demo
      data.playlists = 10
      data.plays = 1200
      data.likes = 450
    }

    res.json({ data })
  } catch (error) {
    console.error("STATS ERROR:", error)
    res.json({ data: { users: 0, songs: 0, playlists: 0, online: 0, plays: 0, likes: 0 } })
  }
}

// --- GET RECENT PLAYLISTS (Who created what with duration) ---
exports.recentPlaylists = async (req, res) => {
  try {
    const playlists = await Playlist.find()
      .populate({
        path: 'songs',
        select: 'duration title artist'
      })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()
      
    const rows = playlists.map(pl => {
      // Calculate total runtime in seconds
      const totalSeconds = (pl.songs || []).reduce((acc, s) => acc + (parseInt(s.duration) || 210), 0)
      const mins = Math.floor(totalSeconds / 60)
      const secs = totalSeconds % 60

      return {
        id: pl._id,
        name: pl.name,
        creator: pl.userId?.name || 'Unknown',
        creatorEmail: pl.userId?.email || 'N/A',
        trackCount: pl.songs?.length || 0,
        runtime: `${mins}m ${secs}s`,
        songs: (pl.songs || []).map(s => ({ title: s.title, artist: s.artist })),
        createdAt: pl.createdAt
      }
    })
    
    res.json({ data: rows })
  } catch (error) {
    console.error("RECENT PLAYLISTS ERROR:", error)
    res.status(500).json({ data: [] })
  }
}

// --- GET LOGIN LOGS FROM CSV AND DB ---
exports.loginLogs = async (req, res) => {
  try {
    let rows = []
    
    // 1. Get from DB (Most recent)
    if (global.__db_connected) {
      const users = await User.find().sort({ updatedAt: -1 }).limit(20).lean()
      rows = users.map(u => ({
        timestamp: u.updatedAt || u.createdAt,
        userId: u._id,
        email: u.email,
        name: u.name,
        role: u.role,
        ip: 'N/A',
        ua: 'Live Session'
      }))
    }

    // 2. Get from CSV
    const csvPath = path.join(__dirname, '..', 'uploads', 'admin', 'logins.csv')
    if (fs.existsSync(csvPath)) {
      const text = await fs.promises.readFile(csvPath, 'utf8')
      const lines = text.trim().split(/\r?\n/).filter(Boolean).slice(-50).reverse()
      
      const csvRows = lines.map((line) => {
        const parts = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((p) => p.replace(/^"|"$/g, ''))
        return {
          timestamp: parts[0] || new Date().toISOString(),
          userId: parts[1] || 'unknown',
          email: parts[2] || 'unknown@email.com',
          name: parts[3] || 'Anonymous',
          role: parts[4] || 'user',
          ip: parts[5] || 'N/A',
          ua: parts[6] || 'N/A',
        }
      })
      rows = [...rows, ...csvRows].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 50)
    }
    
    res.json({ data: rows })
  } catch (error) {
    console.error("LOGS ERROR:", error)
    res.json({ data: [] })
  }
}

// --- GET ALL USERS (Admin View) ---
exports.users = async (req, res) => {
  try {
    // Basic sorting and limit for better performance
    const users = await User.find().select('-password').sort({ createdAt: -1 }).limit(100)
    res.json({ data: users })
  } catch {
    res.status(500).json({ message: "Failed to fetch users" })
  }
}

// --- EXPORT USERS TO CSV ---
exports.usersExportCsv = async (req, res) => {
  try {
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="users_export.csv"')
    
    const header = 'Name,Email,Role,JoinedDate\n'
    res.write(header)

    // Handling demo mode data export
    if (global.__db_connected === false) {
      const demoUsers = global.__demo_users || []
      demoUsers.forEach(u => {
        res.write(`${JSON.stringify(u.name)},${JSON.stringify(u.email)},${u.role},${new Date().toISOString()}\n`)
      })
      return res.end()
    }

    // Processing real database data
    const dbUsers = await User.find().select('name email role createdAt').lean()
    dbUsers.forEach(u => {
      // Constructing CSV row data
      res.write(`${JSON.stringify(u.name)},${JSON.stringify(u.email)},${u.role || 'user'},${u.createdAt ? u.createdAt.toISOString() : ''}\n`)
    })
    res.end()
  } catch (error) {
    res.status(500).json({ message: 'Export logic failed' })
  }
}

// --- USAGE ANALYTICS (Simpler structure) ---
exports.usage = async (req, res) => {
  try {
    const Usage = require('../models/Usage')
    const now = Date.now()
    // Constant for one month in milliseconds
    const t1m = new Date(now - 2592000000)

    // Aggregate query to sum up usage seconds
    const agg = await Usage.aggregate([
      { $match: { at: { $gte: t1m } } },
      { $group: { _id: '$userId', m1: { $sum: '$seconds' } } }
    ])

    const usageMap = new Map(agg.map((r) => [r._id.toString(), r.m1]))
    const usersList = await User.find().select('name email').limit(100).lean()
    
    const processedOut = usersList.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      totalSeconds: usageMap.get(u._id.toString()) || 0,
    }))
    res.json({ data: processedOut })
  } catch {
    res.json({ data: [] })
  }
}

// --- ADMIN BOOTSTRAP (For initial setup) ---
exports.bootstrap = async (req, res) => {
  try {
    const adminExists = await User.exists({ role: 'admin' })
    if (adminExists) return res.status(403).json({ message: 'Admin already registered' })
    
    // Getting current user from auth middleware
    const currentUser = await User.findById(req.user._id)
    if (!currentUser) return res.status(404).json({ message: 'Current user not found' })
    
    currentUser.role = 'admin'
    await currentUser.save()
    res.json({ ok: true, user: { id: currentUser._id, name: currentUser.name, email: currentUser.email, role: currentUser.role } })
  } catch (error) {
    res.status(500).json({ message: 'Admin bootstrap failed' })
  }
}

// --- LOCAL MUSIC IMPORT FROM UPLOADS ---
exports.importLocal = async (req, res) => {
  try {
    const uploadsPath = path.join(__dirname, '..', 'uploads')
    // File format whitelist
    const extensions = ['.mp3', '.m4a', '.wav', '.ogg', '.flac']
    
    if (!fs.existsSync(uploadsPath)) return res.status(404).json({ message: 'Media folder not found' })
    
    const mediaFiles = await fs.promises.readdir(uploadsPath)
    let processedImport = 0

    for (const file of mediaFiles) {
      const extName = path.extname(file).toLowerCase()
      if (!extensions.includes(extName)) continue

      const fileUrl = `/uploads/${file}`
      // Duplication check using file URL
      const alreadyExists = await Song.findOne({ fileUrl })
      if (alreadyExists) continue

      // Database entry creation
      await Song.create({
        title: path.parse(file).name,
        artist: 'SYSTEM_GEN',
        fileUrl,
        coverImage: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?q=80&w=600&auto=format&fit=crop', // Placeholder structure
      })
      processedImport++
    }

    // Triggering dynamic update event for connected clients
    const socketIo = req.app.get('io')
    if (socketIo) socketIo.emit('song:created', { trigger: 'bulk' })

    return res.json({ ok: true, imported: processedImport })
  } catch (error) {
    console.error("Local Import Error:", error)
    return res.status(500).json({ message: 'Media import failed' })
  }
}