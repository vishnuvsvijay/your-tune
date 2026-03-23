const Playlist = require('../models/Playlist')

exports.listMine = async (req, res) => {
  const data = await Playlist.find({ userId: req.user._id }).populate('songs')
  res.json({ data })
}

exports.listPublic = async (req, res) => {
  try {
    const data = await Playlist.find({ published: true })
      .populate('songs')
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
    res.json({ data })
  } catch (err) {
    res.status(500).json({ data: [] })
  }
}

exports.create = async (req, res) => {
  const songs = Array.isArray(req.body.songs) ? req.body.songs.slice(0, 20) : []
  const pl = await Playlist.create({ 
    name: req.body.name, 
    userId: req.user._id, 
    songs,
    published: true
  })
  req.app.get('io').emit('playlist:updated', { id: pl._id })
  
  // Real-time update for admin stats
  const User = require('../models/User')
  const Song = require('../models/Song')
  const io = req.app.get('io')
  try {
    const stats = {
      users: await User.countDocuments(),
      songs: await Song.countDocuments(),
      playlists: await Playlist.countDocuments(),
      online: global.__onlineUsers ? global.__onlineUsers.size : 0,
    }
    io.to('admins').emit('admin:stats', stats)
  } catch (err) {
    console.error("Admin stats emit error (playlist create):", err)
  }

  res.json({ data: pl })
}

exports.addSong = async (req, res) => {
  const { playlistId, songId } = req.body
  const pl = await Playlist.findOne({ _id: playlistId, userId: req.user._id })
  if (!pl) return res.status(404).json({ message: 'Playlist not found' })
  if (!pl.songs.some((s) => s.toString() === songId)) pl.songs.push(songId)
  await pl.save()
  req.app.get('io').to(req.user._id.toString()).emit('playlist:updated', { id: pl._id })
  res.json({ data: pl })
}

exports.removeSong = async (req, res) => {
  const { playlistId, songId } = req.body
  const pl = await Playlist.findOne({ _id: playlistId, userId: req.user._id })
  if (!pl) return res.status(404).json({ message: 'Playlist not found' })
  pl.songs = pl.songs.filter((s) => s.toString() !== songId)
  await pl.save()
  req.app.get('io').to(req.user._id.toString()).emit('playlist:updated', { id: pl._id })
  res.json({ data: pl })
}
