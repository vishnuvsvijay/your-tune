const axios = require('axios')
const Song = require('../models/Song')

exports.itunes = async (req, res) => {
  try {
    const term = req.query.term || ''
    const limit = Math.max(1, Math.min(parseInt(req.query.limit || '25', 10) || 25, 50))
    if (!term) return res.json({ data: [] })
    const { data } = await axios.get('https://itunes.apple.com/search', {
      params: { term, media: 'music', limit },
    })
    const mapped = (data?.results || []).map((r) => ({
      externalId: r.trackId,
      title: r.trackName,
      artist: r.artistName,
      album: r.collectionName,
      genre: r.primaryGenreName,
      fileUrl: r.previewUrl,
      coverImage: r.artworkUrl100?.replace('100x100bb', '600x600bb') || r.artworkUrl100,
      full: false,
    }))
    res.json({ data: mapped })
  } catch (e) {
    res.json({ data: [] })
  }
}

exports.jamendo = async (req, res) => {
  try {
    const term = req.query.term || ''
    const clientId = process.env.JAMENDO_CLIENT_ID || ''
    const limit = Math.max(1, Math.min(parseInt(req.query.limit || '25', 10) || 25, 50))
    if (!term || !clientId) return res.json({ data: [] })
    const { data } = await axios.get('https://api.jamendo.com/v3.0/tracks/', {
      params: {
        client_id: clientId,
        format: 'json',
        limit,
        fuzzysearch: true,
        namesearch: term,
        audioformat: 'mp31',
        include: 'musicinfo+licenses',
      },
    })
    const mapped = (data?.results || []).map((r) => ({
      externalId: r.id,
      title: r.name,
      artist: r.artist_name,
      album: r.album_name,
      genre: r.musicinfo?.tags?.length ? r.musicinfo.tags[0] : '',
      fileUrl: r.audio, // full stream
      coverImage: r.image,
      full: true,
    }))
    res.json({ data: mapped })
  } catch (e) {
    res.json({ data: [] })
  }
}

const YOUTUBE_API_KEY = 'AIzaSyDmSTYdSkweyXhppZvjOYhhTVolubrR39Y';

exports.trending = async (req, res) => {
  const limit = Math.max(1, Math.min(parseInt(req.query.limit || '20', 10) || 20, 50))
  const terms = [
    'top hits 2024 official audio',
    'trending tamil songs 2024 official audio',
    'new hindi songs official audio',
    'global top songs official audio',
  ]
  try {
    const results = []
    const seen = new Set()
    
    // Shuffle terms to get varied trending content
    const shuffledTerms = terms.sort(() => Math.random() - 0.5)

    for (const term of shuffledTerms) {
      try {
        const ytRes = await axios.get('https://www.googleapis.com/youtube/v3/search', {
          params: {
            part: 'snippet',
            maxResults: Math.ceil(limit / terms.length) + 5,
            q: term,
            type: 'video',
            videoCategoryId: '10', // Music
            key: YOUTUBE_API_KEY
          }
        })

        const items = ytRes.data?.items || []
        for (const item of items) {
          const id = item.id.videoId
          if (!id || seen.has(id)) continue
          seen.add(id)

          const decode = (str) => (str || '')
            .replace(/&amp;/g, '&')
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"');

          results.push({
            externalId: id,
            title: decode(item.snippet.title),
            artist: decode(item.snippet.channelTitle),
            album: 'YouTube Music',
            genre: '',
            fileUrl: `https://www.youtube.com/watch?v=${id}`,
            coverImage: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
            full: true,
          })
          if (results.length >= limit) break
        }
        if (results.length >= limit) break
      } catch (err) {
        console.error(`YouTube trending fetch failed for ${term}:`, err.message)
      }
    }
    
    return res.json({ data: results.slice(0, limit) })
  } catch (err) {
    console.error("Global trending error:", err.message)
    res.json({ data: [] })
  }
}

exports.resolve = async (req, res) => {
  try {
    const title = req.query.title || ''
    const artist = req.query.artist || ''
    const original = req.query.fileUrl || ''
    const clientId = process.env.JAMENDO_CLIENT_ID || ''
    const isPreview = typeof original === 'string' && /itunes\.apple\.com|samplelib\.com/i.test(original)
    if (!clientId || (!title && !artist)) {
      return res.json({ fileUrl: original, full: false })
    }
    if (!isPreview) {
      return res.json({ fileUrl: original, full: true })
    }
    const term = [title, artist].filter(Boolean).join(' ')
    const { data } = await axios.get('https://api.jamendo.com/v3.0/tracks/', {
      params: {
        client_id: clientId,
        format: 'json',
        limit: 1,
        fuzzysearch: true,
        namesearch: term,
        audioformat: 'mp31',
      },
    })
    const track = (data?.results || [])[0]
    if (track?.audio) return res.json({ fileUrl: track.audio, full: true })
    return res.json({ fileUrl: original, full: false })
  } catch {
    return res.json({ fileUrl: req.query.fileUrl || '', full: false })
  }
}
