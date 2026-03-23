const axios = require('axios')
const path = require('path')
const Song = require('../models/Song')
const ytdl = require('@distube/ytdl-core')
const play = require('play-dl')
const ytSearch = require('yt-search')
const YOUTUBE_API_KEY = 'AIzaSyDmSTYdSkweyXhppZvjOYhhTVolubrR39Y'; // Corrected key placement
let Comment
try { Comment = require('../models/Comment') } catch {}

const Usage = require('../models/Usage')

// 1. Stream Proxy: Handles both direct audio links and YouTube audio extraction
exports.streamProxy = async (req, res) => {
  try {
    const target = req.query.url || ''
    console.log(`[StreamProxy] Request for URL: ${target.slice(0, 50)}...`)
    if (!target) return res.status(400).end()

    // --- YouTube Audio Extraction Logic ---
    if (play.yt_validate(target) === 'video') {
      try {
        console.log(`[Play-DL] Step 1: Validated URL, getting stream for ${target}`)
        
        // Using play-dl for a MUCH more stable stream
        const streamInfo = await play.stream(target, {
          quality: 2, // highest audio
          discordPlayerCompatibility: true
        })

        if (!streamInfo || !streamInfo.stream) {
          throw new Error("Failed to extract stream using play-dl")
        }

        console.log(`[Play-DL] Step 2: Stream extracted successfully`)

        // Set headers for smooth streaming
        res.setHeader('Content-Type', 'audio/mpeg')
        res.setHeader('Accept-Ranges', 'bytes')
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Cache-Control', 'no-cache')
        
        res.status(200)

        // Stream from play-dl to response
        streamInfo.stream.pipe(res)
        
        // Handle client disconnect
        req.on('close', () => {
          console.log("[Play-DL] Client disconnected, destroying stream")
          if (streamInfo.stream.destroy) streamInfo.stream.destroy()
        })
        return
      } catch (err) {
        console.error("[Play-DL] Audio Extraction Error:", err.message)
        // Fallback to the old ytdl-core if play-dl fails (though play-dl is better)
        try {
            console.log("[Play-DL Fallback] Attempting ytdl-core fallback...")
            const info = await ytdl.getInfo(target);
            const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });
            if (format) {
                res.setHeader('Content-Type', format.mimeType);
                ytdl(target, { format }).pipe(res);
                return;
            }
        } catch (ytdlErr) {
            console.error("[YTDL Fallback] Also failed:", ytdlErr.message);
        }
        return res.status(500).json({ message: "YouTube audio extraction failed", error: err.message })
      }
    }

    // --- Standard HTTP Stream Proxy ---
    if (!/^https?:\/\//i.test(target)) return res.status(400).end()
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': '*/*',
    }
    if (req.headers.range) headers.Range = req.headers.range
    const upstream = await axios.get(target, {
      responseType: 'stream',
      headers,
      validateStatus: () => true,
      timeout: 15000,
    })
    const status = upstream.status || (req.headers.range ? 206 : 200)
    const passHeaders = ['content-type', 'content-length', 'accept-ranges', 'content-range', 'cache-control']
    
    res.status(status)
    for (const h of passHeaders) {
      const v = upstream.headers?.[h]
      if (v) res.setHeader(h, v)
    }
    upstream.data.pipe(res)
  } catch (e) {
    console.error("Stream Proxy Error:", e.message)
    res.status(500).end()
  }
}

// 2. Resolve for Client: Saavn-ah thookiyaachu! 
// YouTube search-ah namma frontend-laye handle pandrom, so inga direct links-ah mattum check pannum.
exports.resolveForClient = async (req, res) => {
  try {
    const url = (req.query.url || '').trim()
    
    // YouTube video ID check
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be') || url.includes('v=')

    if (url && (isYouTube || /\.(mp3|m4a|wav|aac)(\?.*)?$/i.test(url))) {
      return res.json({ url })
    }

    // Default-ah antha URL-aye thirumba anupuvom, prachana varaathu
    res.json({ url })
  } catch (e) {
    res.json({ url: req.query.url || '' })
  }
}

// 3. List Songs from MongoDB
exports.list = async (req, res) => {
  try {
    const rows = await Song.find().sort({ createdAt: -1 }).lean()
    res.json({ data: rows })
  } catch {
    res.json({ data: [] })
  }
}

// 3.1 Search Combined (Admin + YouTube)
exports.search = async (req, res) => {
  try {
    const query = (req.query.q || '').trim()
    if (!query) return res.json({ data: [] })
    
    console.log(`[ServerSearch] 🔍 Query: "${query}"`);

    // 1. Fetch Admin Uploaded Songs from MongoDB
    let adminSongs = []
    try {
      adminSongs = await Song.find({
        adminUpload: true,
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { artist: { $regex: query, $options: 'i' } }
        ]
      }).sort({ createdAt: -1 }).limit(20).lean()
      console.log(`[ServerSearch] 🏠 DB match count: ${adminSongs.length}`);
    } catch (dbErr) {
      console.error("[ServerSearch] ❌ DB Error:", dbErr.message);
    }
    
    const formattedAdmin = adminSongs.map(s => ({
      id: s._id.toString(),
      _id: s._id.toString(),
      title: s.title,
      artist: s.artist,
      img: s.coverImage || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(s.title)}`,
      isYoutube: false,
      fileUrl: s.fileUrl,
      adminUpload: true,
      likes: s.likes || []
    }));

    // 2. Fetch from YouTube API (With Fallback to yt-search)
    let youtubeSongs = [];
    let ytError = false;

    if (YOUTUBE_API_KEY) {
      try {
        console.log(`[ServerSearch] 🌐 Fetching YouTube results via API...`);
        const ytRes = await axios.get('https://www.googleapis.com/youtube/v3/search', {
          params: {
            part: 'snippet',
            maxResults: 25,
            q: `${query} official audio song`,
            type: 'video',
            videoCategoryId: '10', // Music category
            relevanceLanguage: 'en',
            key: YOUTUBE_API_KEY
          },
          timeout: 4000
        });
        
        const rawSongs = (ytRes.data.items || []).map(item => {
          const cleanTitle = (str) => (str || '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/\[.*?\]/g, '')
            .replace(/\(.*?\)/g, '')
            .replace(/official video/gi, '')
            .replace(/music video/gi, '')
            .replace(/official audio/gi, '')
            .replace(/video/gi, '')
            .replace(/lyrics/gi, '')
            .replace(/  +/g, ' ')
            .trim();

          const decode = (str) => (str || '')
            .replace(/&amp;/g, '&')
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"');

          return {
            id: item.id.videoId,
            title: cleanTitle(item.snippet.title),
            artist: decode(item.snippet.channelTitle).replace(/ - Topic/gi, ''),
            img: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
            isYoutube: true,
            fileUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
            likes: [],
            isTopic: item.snippet.channelTitle.toLowerCase().endsWith('- topic')
          };
        });

        const unwantedKeywords = ['news', 'vlog', 'tour', 'city tour', 'recipe', 'cooking', 'tutorial', 'how to', 'review', 'unboxing', 'live stream', 'reaction', 'teaser', 'trailer', 'behind the scenes', 'bts', 'performance', 'live concert', 'full movie', 'scene', 'clip'];
        
        youtubeSongs = rawSongs.filter(song => {
          const lowerTitle = song.title.toLowerCase();
          const lowerArtist = song.artist.toLowerCase();
          return song.isTopic || !unwantedKeywords.some(keyword => lowerTitle.includes(keyword) || lowerArtist.includes(keyword));
        });

        youtubeSongs.sort((a, b) => (b.isTopic ? 1 : 0) - (a.isTopic ? 1 : 0));
        console.log(`[ServerSearch] 🎥 YouTube API match count: ${youtubeSongs.length}`);
      } catch (err) {
        console.error("[ServerSearch] ❌ YouTube API Error (Quota/Key):", err.message);
        ytError = true;
      }
    } else {
      ytError = true;
    }

    // FALLBACK: Use yt-search if API fails or quota exceeded
    if (ytError || youtubeSongs.length === 0) {
      try {
        console.log(`[ServerSearch] 🔄 Fallback: Fetching via yt-search...`);
        // Searching with "topic music" or "official audio" helps get YouTube Music style tracks
        const searchRes = await ytSearch(`${query} topic music`);
        const videos = (searchRes.videos || []).slice(0, 25);
        
        const rawFallback = videos.map(v => {
          const cleanTitle = (str) => (str || '')
            .replace(/\[.*?\]/g, '')
            .replace(/\(.*?\)/g, '')
            .replace(/official video/gi, '')
            .replace(/music video/gi, '')
            .replace(/official audio/gi, '')
            .replace(/video/gi, '')
            .replace(/lyrics/gi, '')
            .replace(/  +/g, ' ')
            .trim();

          return {
            id: v.videoId,
            title: cleanTitle(v.title),
            artist: v.author?.name?.replace(/ - Topic/gi, '') || 'Unknown',
            img: v.image || v.thumbnail,
            isYoutube: true,
            fileUrl: v.url,
            likes: [],
            isTopic: (v.author?.name || '').toLowerCase().includes('topic')
          };
        });

        const unwantedKeywords = ['news', 'vlog', 'tour', 'city tour', 'recipe', 'cooking', 'tutorial', 'how to', 'review', 'unboxing', 'live stream', 'reaction', 'teaser', 'trailer', 'behind the scenes', 'bts', 'performance', 'live concert', 'full movie', 'scene', 'clip'];
        
        youtubeSongs = rawFallback.filter(song => {
          const lowerTitle = song.title.toLowerCase();
          const lowerArtist = song.artist.toLowerCase();
          return song.isTopic || !unwantedKeywords.some(keyword => lowerTitle.includes(keyword) || lowerArtist.includes(keyword));
        });

        // Sort Topic channels (YouTube Music tracks) to the top
        youtubeSongs.sort((a, b) => (b.isTopic ? 1 : 0) - (a.isTopic ? 1 : 0));
        
        console.log(`[ServerSearch] 🔄 yt-search match count: ${youtubeSongs.length}`);
      } catch (fallbackErr) {
        console.error("[ServerSearch] ❌ Fallback Search Error:", fallbackErr.message);
      }
    }

    // Combine results: Admin first, then YouTube
    const combined = [...formattedAdmin, ...youtubeSongs];
    
    // De-duplicate by ID (using string comparison)
    const unique = [];
    const seenIds = new Set();
    for (const song of combined) {
      const sid = song.id.toString();
      if (!seenIds.has(sid)) {
        seenIds.add(sid);
        unique.push(song);
      }
    }

    console.log(`[ServerSearch] ✅ Total unique results: ${unique.length}`);
    res.json({ data: unique })
  } catch (err) {
    console.error("[ServerSearch] ❌ Global Search Error:", err)
    res.status(500).json({ data: [], error: err.message })
  }
}

// 4. Like/Unlike Logic
exports.like = async (req, res) => {
  try {
    const userId = req.user?._id?.toString() || req.user?.id
    if (!userId) return res.status(401).json({ message: 'Unauthorized' })
    
    const s = await Song.findById(req.params.id)
    if (!s) return res.status(404).json({ message: 'Not found' })
    
    const has = (s.likes || []).some(u => u.toString() === userId)
    s.likes = has ? s.likes.filter(u => u.toString() !== userId) : [...(s.likes || []), userId]
    
    await s.save()

    // Real-time update for likes
    req.app.get('io').emit('song:liked', { 
      songId: s._id, 
      likes: s.likes.length, 
      userId,
      isLiked: !has // Tells the frontend if the user just liked or unliked
    })

    // Manage 'liked' folder if it's a local file
    if (s.fileUrl && s.fileUrl.startsWith('/uploads/')) {
      try {
        const fs = require('fs')
        const path = require('path')
        const likedDir = path.join(__dirname, '..', 'uploads', 'liked', userId)
        const fileName = path.basename(s.fileUrl)
        const destPath = path.join(likedDir, fileName)

        if (!has) {
          // Just liked: copy file
          if (!fs.existsSync(likedDir)) fs.mkdirSync(likedDir, { recursive: true })
          const sourcePath = path.join(__dirname, '..', s.fileUrl)
          if (fs.existsSync(sourcePath) && !fs.existsSync(destPath)) {
            fs.copyFileSync(sourcePath, destPath)
          }
        } else {
          // Just unliked: remove file
          if (fs.existsSync(destPath)) {
            fs.unlinkSync(destPath)
          }
        }
      } catch (err) {
        console.error("Failed to sync liked song folder:", err.message)
      }
    }

    res.json({ data: s })
  } catch (err) {
    console.error("LIKE ERROR:", err)
    res.status(500).json({ message: 'Failed' })
  }
}

// 5. Admin Upload Logic
exports.create = async (req, res) => {
  try {
    const songFile = req.files.find(f => f.mimetype.startsWith('audio/'))
    const coverFile = req.files.find(f => f.mimetype.startsWith('image/'))
    
    if (!songFile) return res.status(400).json({ message: 'No audio file found' })

    const meta = {
      title: req.body.title || path.parse(songFile.originalname).name,
      artist: req.body.artist || 'Unknown',
      fileUrl: `/uploads/${songFile.filename}`,
      coverImage: coverFile ? `/uploads/${coverFile.filename}` : '',
      adminUpload: true,
      uploadedBy: req.user?._id
    }
    const doc = await Song.create(meta)
    res.json({ data: doc })
  } catch (e) {
    res.status(500).json({ message: 'Upload failed' })
  }
}

// Keep other essential exports like remove, listComments, addComment, topLiked...
exports.remove = async (req, res) => {
  try { await Song.findByIdAndDelete(req.params.id); res.json({ ok: true }) } catch { res.status(500).end() }
}

exports.topLiked = async (req, res) => {
  try {
    const rows = await Song.aggregate([
      { $addFields: { likeCount: { $size: { $ifNull: ['$likes', []] } } } },
      { $sort: { likeCount: -1 } },
      { $limit: 30 }
    ])
    res.json({ data: rows })
  } catch { res.json({ data: [] }) }
}

// Comments implementation logic
exports.listComments = async (req, res) => {
  try {
    if (!Comment) return res.json({ data: [] });
    // Fetch comments and their replies
    const rows = await Comment.find({ songId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
    
    // Sort so parent comments are first, then group replies
    const sorted = rows.reverse()
    res.json({ data: sorted })
  } catch (err) {
    console.error("List comments error:", err)
    res.json({ data: [] })
  }
}

exports.addComment = async (req, res) => {
  try {
    if (!Comment) return res.status(500).end();
    const out = await Comment.create({
      songId: req.params.id,
      userId: req.user._id,
      name: req.user.name || 'User',
      text: req.body.text,
      parentId: req.body.parentId || null // Support for replies
    })
    
    // Real-time update for comments
    req.app.get('io').emit('song:comment', { 
      songId: req.params.id, 
      comment: out,
      isReply: !!req.body.parentId
    })
    
    res.json({ data: out })
  } catch (err) {
    console.error("Add comment error:", err)
    res.status(500).end()
  }
}

exports.likeComment = async (req, res) => {
  try {
    if (!Comment) return res.status(500).end();
    const c = await Comment.findById(req.params.commentId)
    if (!c) return res.status(404).end()
    const userId = req.user?._id?.toString()
    
    const has = (c.likedBy || []).some(u => u.toString() === userId)
    if (has) {
      c.likedBy = c.likedBy.filter(u => u.toString() !== userId)
      c.likes = Math.max(0, (c.likes || 0) - 1)
    } else {
      c.likedBy = [...(c.likedBy || []), userId]
      c.likes = (c.likes || 0) + 1
    }
    
    await c.save()

    // Real-time update for comment likes
    req.app.get('io').emit('comment:liked', { 
      commentId: c._id, 
      likes: c.likes, 
      likedBy: c.likedBy,
      songId: c.songId
    })

    res.json({ data: c })
  } catch (err) {
    console.error("Like comment error:", err)
    res.status(500).end()
  }
}

exports.findByFile = async (req, res) => {
  try {
    const url = req.query.url || ''
    const s = await Song.findOne({ fileUrl: url })
    res.json({ data: s })
  } catch { res.json({ data: null }) }
}

exports.listAdminUploads = async (req, res) => {
  try {
    const rows = await Song.find({ adminUpload: true }).sort({ createdAt: -1 }).lean()
    res.json({ data: rows })
  } catch { res.json({ data: [] }) }
}

exports.listLikedFiles = async (req, res) => {
  try {
    const userId = req.user?._id
    const rows = await Song.find({ likes: userId }).sort({ createdAt: -1 }).lean()
    res.json({ data: rows })
  } catch { res.json({ data: [] }) }
}

exports.likeAny = async (req, res) => {
  try {
    const userId = req.user?._id?.toString()
    const { title, artist, fileUrl, coverImage } = req.body
    
    let s = await Song.findOne({ fileUrl })
    if (!s) {
      s = await Song.create({ 
        title, 
        artist, 
        fileUrl, 
        coverImage, 
        likes: [userId] 
      })
    } else {
      const has = (s.likes || []).some(u => u.toString() === userId)
      if (!has) {
        s.likes = [...(s.likes || []), userId]
        await s.save()
      }
    }

    // Real-time update for likes
    req.app.get('io').emit('song:liked', { 
      songId: s._id, 
      likes: s.likes.length, 
      userId,
      isLiked: true 
    })

    // Save liked song to 'liked' folder if it's a local file
    if (s.fileUrl && s.fileUrl.startsWith('/uploads/')) {
      try {
        const fs = require('fs')
        const path = require('path')
        const sourcePath = path.join(__dirname, '..', s.fileUrl)
        const likedDir = path.join(__dirname, '..', 'uploads', 'liked', userId)
        if (!fs.existsSync(likedDir)) fs.mkdirSync(likedDir, { recursive: true })
        
        const fileName = path.basename(s.fileUrl)
        const destPath = path.join(likedDir, fileName)
        if (fs.existsSync(sourcePath) && !fs.existsSync(destPath)) {
          fs.copyFileSync(sourcePath, destPath)
        }
      } catch (err) {
        console.error("Failed to copy liked song to folder (likeAny):", err.message)
      }
    }

    res.json({ data: s })
  } catch (err) {
    console.error("LIKE ANY ERROR:", err)
    res.status(500).json({ message: "Failed to like song" })
  }
}

// 6. Play Tracking & Replay Mix
exports.recordPlay = async (req, res) => {
  try {
    const userId = req.user?._id?.toString() || req.user?.id
    const songId = req.params.id
    if (!userId || !songId) return res.status(400).end()

    let song = await Song.findById(songId)
    
    // If the song doesn't exist (e.g., it was a YouTube song not yet in DB)
    // and metadata was provided, create it
    if (!song && req.body.title) {
      song = await Song.create({
        title: req.body.title,
        artist: req.body.artist || 'Unknown',
        fileUrl: req.body.fileUrl,
        coverImage: req.body.coverImage || req.body.img,
        likes: []
      })
    }

    if (!song) return res.status(404).json({ message: "Song not found and no metadata provided" })

    // Create a new usage record (represents one play event)
    await Usage.create({ 
      userId, 
      songId: song._id, 
      seconds: 180, // Default play duration for stats calculation
      at: new Date() 
    })

    // Emit real-time update for the Replay Mix view if someone is looking at it
    req.app.get('io').to(`user:${userId}`).emit('replay:updated')
    
    res.json({ ok: true, songId: song._id })
  } catch (err) {
    console.error("[RecordPlay] Error:", err)
    res.status(500).end()
  }
}

exports.getReplayMix = async (req, res) => {
  try {
    const userId = req.user?._id?.toString() || req.user?.id
    if (!userId) return res.status(401).end()

    // Aggregate to find most recently played unique songs for this user
    const history = await Usage.aggregate([
      { $match: { userId: new require('mongoose').Types.ObjectId(userId) } },
      { $sort: { at: -1 } },
      { $group: { 
          _id: "$songId", 
          lastPlayed: { $first: "$at" },
          playCount: { $sum: 1 }
      }},
      { $sort: { lastPlayed: -1 } },
      { $limit: 50 } // Limit to top 50 recently played songs
    ])

    const songIds = history.map(h => h._id)
    const songs = await Song.find({ _id: { $in: songIds } }).lean()
    
    // Sort songs back into the order of play (most recent first)
    const sorted = songIds.map(id => songs.find(s => s._id.toString() === id.toString())).filter(Boolean)

    res.json({ data: sorted })
  } catch (err) {
    console.error("[GetReplayMix] Error:", err)
    res.status(500).json({ data: [] })
  }
}