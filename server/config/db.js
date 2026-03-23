const mongoose = require('mongoose')

global.__db_connected = false

module.exports = async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/musicapp'
  try {
    mongoose.connection.on('connected', () => {
      global.__db_connected = true
      console.log('MongoDB connected')
    })
    mongoose.connection.on('error', (err) => {
      global.__db_connected = false
      console.error('MongoDB error', err.message)
    })
    mongoose.connection.on('disconnected', () => {
      global.__db_connected = false
      console.log('MongoDB disconnected')
    })

    await mongoose.connect(uri, { autoIndex: true })
  } catch (err) {
    console.error('MongoDB connection error', err.message)
    global.__db_connected = false
    return
  }
}
