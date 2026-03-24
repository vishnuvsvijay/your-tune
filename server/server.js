require('dotenv').config()
const express = require('express')
const http = require('http')
const cors = require('cors')
const path = require('path')
const fs = require('fs')
const connectDB = require('./config/db')

// Route Imports
const songRoutes = require('./routes/songs')
const authRoutes = require('./routes/auth')
const adminRoutes = require('./routes/admin')
const externalRoutes = require('./routes/external')
const playlistRoutes = require('./routes/playlists')
const registerSockets = require('./sockets')

const app = express()
const server = http.createServer(app)

// Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()
})

// Middleware
const uploadsPath = path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true })
}

const allowedOrigins = [
  'http://localhost:5000',
  'http://localhost:5001',
  'https://music-player-react-one.vercel.app', // Adding a known origin if applicable or making it dynamic
  process.env.FRONTEND_URL
].filter(Boolean)

app.use(cors({ 
  origin: (origin, callback) => {
    // In production, if origin is missing (like in some server-to-server calls) or in allowedOrigins
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  }, 
  credentials: true 
}))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

// Static Folder for Manual Uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// --- API Routes ---
// SEARCH FIX: Search request-ah songRoutes-ku thiruppi vidrom
app.use('/api/search', songRoutes) 
app.use('/api/songs', songRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/external', externalRoutes)
app.use('/api/playlists', playlistRoutes)

app.get('/api/health', (req, res) => res.json({ status: "Server is flying! 🚀", db: global.__db_connected }))

// Global error handler for debugging
app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR:", err.stack)
  res.status(500).json({ message: "Internal Server Error", error: err.message })
})

// Socket.io Setup (Cleaned up)
const { Server } = require('socket.io')
const io = new Server(server, { 
    cors: { origin: true, credentials: true } 
})
registerSockets(io)
app.set('io', io)

// Dev convenience:
const proxyToVite = (req, res) => {
  console.log(`[Proxy] Proxying ${req.method} ${req.originalUrl} to Vite (Port 5000)`)
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: req.originalUrl,
    method: req.method,
    headers: { ...req.headers, host: 'localhost:5000' },
  }
  const p = http.request(options, (pr) => {
    console.log(`[Proxy] Vite responded with ${pr.statusCode} for ${req.originalUrl}`)
    res.statusCode = pr.statusCode || 200
    Object.entries(pr.headers || {}).forEach(([k, v]) => {
      try { res.setHeader(k, v) } catch {}
    })
    pr.pipe(res)
  })
  p.on('error', (err) => {
    console.error(`[Proxy] Proxy Error for ${req.originalUrl}:`, err.message)
    res.status(503).send('Vite dev server not available on :5000')
  })
  if (req.readable) req.pipe(p)
  else p.end()
}

// Global Middleware for Port-based access
app.use((req, res, next) => {
  if (/^\/(api|uploads)\b/.test(req.path)) return next()
  
  // Always proxy to Vite in development to ensure real-time updates and proper asset loading
  // This allows the admin portal to run on port 5001 while loading assets from port 5000 seamlessly
  return proxyToVite(req, res)
})

// Frontend Serve Logic (Kept for reference but bypassed by the proxy above in dev)
const clientDist = path.join(__dirname, '..', 'client', 'dist')
if (fs.existsSync(clientDist)) {
  // app.use(express.static(clientDist)) // Bypassed for dev
}

// Server Start Logic
const start = async () => {
  try {
    // 1. Connect to Database First
    await connectDB()

    // 2. Start Listening
    const PORT = process.env.PORT || 5001
    server.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is busy. Kill the process or use another port.`)
      } else {
        console.error(`❌ Server Error:`, e.message)
      }
    })

    server.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`)
        if (global.__db_connected) {
          console.log(`📡 Real-time Database: Active (MongoDB)`)
        } else {
          console.warn(`⚠️  Real-time Database: Inactive (Demo Mode Enabled)`)
          console.log(`💡 Tip: Ensure MongoDB is running on 127.0.0.1:27017`)
        }
    })
  } catch (err) {
    console.error("Critical Server Failure:", err.message)
  }
}

start()
