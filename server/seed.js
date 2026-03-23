require('dotenv').config()
const mongoose = require('mongoose')
const Song = require('./models/Song')
const axios = require('axios')

const YOUTUBE_API_KEY = 'AIzaSyDmSTYdSkweyXhppZvjOYhhTVolubrR39Y';

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/musicapp'
  await mongoose.connect(uri)
  console.log('Connected to DB for seeding...')

  const queries = [
    'Arijit Singh official audio song',
    'Tamil hits 2024 official audio song',
    'Anirudh Ravichander best official audio song',
    'Sid Sriram latest official audio song',
    'Telugu trending official audio song',
    'Global pop hits 2024 official audio song',
    'ARR Rahman classics official audio song',
    'Yuvan Shankar Raja vibes official audio song'
  ]

  let totalAdded = 0

  for (const q of queries) {
    console.log(`Searching for: ${q}`)
    try {
      const res = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          part: 'snippet',
          maxResults: 10,
          q,
          type: 'video',
          videoCategoryId: '10', // Music
          key: YOUTUBE_API_KEY
        }
      })
      
      const songs = res.data?.items || []
      
      for (const s of songs) {
        const payload = {
          title: s.snippet.title.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"'),
          artist: s.snippet.channelTitle.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"'),
          album: 'YouTube Music',
          genre: 'Popular',
          coverImage: s.snippet.thumbnails?.high?.url || s.snippet.thumbnails?.default?.url,
          fileUrl: `https://www.youtube.com/watch?v=${s.id.videoId}`,
          adminUpload: true
        }

        const exists = await Song.findOne({ title: payload.title, artist: payload.artist })
        if (!exists) {
          await Song.create(payload)
          totalAdded++
        }
      }
    } catch (e) {
      console.error(`Search failed for ${q}:`, e.message)
    }
  }

  console.log(`Seeding complete! Added ${totalAdded} new songs.`)
  process.exit(0)
}

seed()
