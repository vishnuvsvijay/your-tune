require('dotenv').config()
const mongoose = require('mongoose')
const Song = require('./models/Song')

async function clean() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/musicapp'
  await mongoose.connect(uri)
  console.log('Connected to DB...')

  // Delete songs that have the Unsplash dummy picture URL (from previous turn) or are missing images
  // The UI was showing the fallback because song.coverImage was either missing or failing.
  // We'll remove songs that don't have a valid coverImage property or are from the previous seed that might be broken.
  
  const res = await Song.deleteMany({
    $or: [
      { coverImage: { $exists: false } },
      { coverImage: "" },
      { coverImage: null }
    ]
  })
  
  console.log(`Cleaned ${res.deletedCount} songs.`)
  process.exit(0)
}

clean()
