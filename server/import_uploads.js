require('dotenv').config()
const mongoose = require('mongoose')
const fs = require('fs')
const path = require('path')
const Song = require('./models/Song')

async function sync() {
  console.log('Starting sync process...')
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/musicapp'
  try {
    await mongoose.connect(uri)
    console.log('Connected to MongoDB:', uri)
  } catch (err) {
    console.error('Connection error:', err.message)
    process.exit(1)
  }

  const uploadsDir = path.join(__dirname, 'uploads')
  const importedDir = path.join(uploadsDir, 'imported')
  
  const scanDir = (dir, isImported = false) => {
    console.log('Scanning directory:', dir)
    if (!fs.existsSync(dir)) {
      console.warn('Directory not found:', dir)
      return []
    }
    return fs.readdirSync(dir).map(f => ({
      name: f,
      path: isImported ? `/uploads/imported/${f}` : `/uploads/${f}`,
      fullPath: path.join(dir, f)
    }))
  }

  const files = [
    ...scanDir(uploadsDir),
    ...scanDir(importedDir, true)
  ]

  console.log(`Found ${files.length} total items to check.`)
  let added = 0

  for (const fileObj of files) {
    const { name, path: fileUrl } = fileObj
    
    // Look for audio files
    if (/\.(mp3|m4a|wav|aac)$/i.test(name)) {
      console.log(`Checking file: ${name}`)
      
      const exists = await Song.findOne({ fileUrl })
      
      if (!exists) {
        console.log(`Song not in DB, adding: ${name}`)
        
        const payload = {
          title: name.replace(/^(song-|cover-)/, '').split(/[-.]/)[0] || 'Admin Song',
          artist: 'Admin Upload',
          fileUrl: fileUrl,
          coverImage: '', // Hard to guess cover for imported files
          adminUpload: true
        }

        await Song.create(payload)
        console.log(`Successfully synced: ${name}`)
        added++
      } else {
        console.log(`Song already exists: ${name}`)
      }
    }
  }

  console.log(`Sync complete! Added ${added} new entries to the database.`)
  process.exit(0)
}

sync()
