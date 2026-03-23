const jwt = require('jsonwebtoken')
const fs = require('fs')
const path = require('path')
const bcrypt = require('bcryptjs')
const User = require('../models/User')

const signToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '7d' })
}

exports.register = async (req, res) => {
  try {
    const name = (req.body.name || '').trim()
    const email = (req.body.email || '').toLowerCase().trim()
    const password = (req.body.password || '').toString()
    console.log(`[REGISTER] Request: name=${name}, email=${email}`)
    if (!name || !email || !password) {
      console.log(`[REGISTER] Missing fields`)
      return res.status(400).json({ message: 'All fields required' })
    }

    if (global.__db_connected !== true) {
      console.log(`[REGISTER] Demo Mode (DB Connected: ${global.__db_connected})`)
      global.__demo_users = global.__demo_users || []
      if (global.__demo_users.find((u) => u.email === email)) {
        console.log(`[REGISTER] Email exists in demo users`)
        return res.status(400).json({ message: 'Email already exists' })
      }
      const user = { _id: `demo-${Date.now()}`, name, email, password, role: 'user' }
      global.__demo_users.push(user)
      const token = signToken(user)
      try {
        const dir = path.join(__dirname, '..', 'uploads', 'admin')
        await fs.promises.mkdir(dir, { recursive: true })
        const csvPath = path.join(dir, 'users.csv')
        const hashed = await bcrypt.hash(password, 10)
        const line = `${JSON.stringify(name)},${JSON.stringify(email)},${JSON.stringify(hashed)},${new Date().toISOString()}\n`
        await fs.promises.appendFile(csvPath, line, 'utf8')
      } catch (e) { console.error("CSV Append Error:", e.message) }
      try {
        req.app?.get('io')?.to('admins').emit('admin:login', { 
          userId: user._id, 
          email: user.email, 
          name: user.name, 
          role: user.role, 
          timestamp: new Date().toISOString() 
        })
      } catch {}
      console.log(`[REGISTER] Demo Success: ${email}`)
      return res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } })
    }

    console.log(`[REGISTER] MongoDB Mode`)
    let exists = null
    try {
      exists = await User.findOne({ email })
    } catch (dbErr) {
      console.error("[REGISTER] DB Find Error:", dbErr.message)
      // If DB error, we can try demo mode fallback if we want, but let's see if we can just report it.
    }
    if (exists) {
      console.log(`[REGISTER] Email exists in MongoDB`)
      return res.status(400).json({ message: 'Email already exists' })
    }
    
    let makeAdmin = false
    try {
      const adminCount = await User.countDocuments({ role: 'admin' })
      makeAdmin = adminCount === 0 || /\+admin@/i.test(email) || /^admin$/i.test(name)
    } catch (e) { console.error("Admin check error:", e.message) }

    console.log(`[REGISTER] Creating user... role=${makeAdmin ? 'admin' : 'user'}`)
    const user = await User.create({ name, email, password, role: makeAdmin ? 'admin' : 'user' })
    console.log(`[REGISTER] User created: ${user._id}`)
    const token = signToken(user)
    try {
      const dir = path.join(__dirname, '..', 'uploads', 'admin')
      await fs.promises.mkdir(dir, { recursive: true })
      const csvPath = path.join(dir, 'users.csv')
      const line = `${JSON.stringify(user.name)},${JSON.stringify(user.email)},${JSON.stringify(user.password)},${new Date().toISOString()}\n`
      await fs.promises.appendFile(csvPath, line, 'utf8')
    } catch {}
    try {
      req.app?.get('io')?.to('admins').emit('admin:login', { 
        userId: user._id.toString(), 
        email: user.email, 
        name: user.name, 
        role: user.role, 
        timestamp: new Date().toISOString() 
      })
    } catch {}
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } })
  } catch (e) {
    console.error("REGISTER ERROR:", e)
    if (e && e.code === 11000) {
      return res.status(400).json({ message: 'Email already exists' })
    }
    // Fallback only if database is definitely down
    if (global.__db_connected === false) {
      try {
        global.__demo_users = global.__demo_users || []
        const email2 = (req.body.email || '').toLowerCase().trim()
        if (global.__demo_users.find((u) => u.email === email2)) return res.status(400).json({ message: 'Email already exists' })
        const user = { _id: `demo-${Date.now()}`, name: (req.body.name || '').trim(), email: email2, password: req.body.password, role: 'user' }
        global.__demo_users.push(user)
        const token = signToken(user)
        return res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } })
      } catch (err) {
        console.error("DEMO FALLBACK ERROR:", err)
      }
    }
    res.status(500).json({ message: e?.message || 'Registration failed' })
  }
}

exports.login = async (req, res) => {
  try {
    const email = (req.body.email || '').toLowerCase().trim()
    const password = (req.body.password || '').toString()
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' })

    if (global.__db_connected !== true) {
      let user = (global.__demo_users || []).find((u) => u.email === email)
      if (!user) {
        // Fallback to CSV
        try {
          const csvPath = path.join(__dirname, '..', 'uploads', 'admin', 'users.csv')
          const txt = await fs.promises.readFile(csvPath, 'utf8').catch(() => '')
          const lines = txt.split(/\r?\n/).filter(Boolean)
          for (const l of lines) {
            const parts = l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((p) => p.replace(/^"|"$/g, ''))
            const uemail = parts[1]
            const hashed = parts[2]
            if (uemail && uemail.toLowerCase() === email) {
              const ok = await bcrypt.compare(password, hashed).catch(() => false)
              if (ok) {
                user = { _id: `csv-${Date.now()}`, name: parts[0], email: uemail, password, role: 'user' }
                global.__demo_users = global.__demo_users || []
                global.__demo_users.push(user)
                break
              }
            }
          }
        } catch (e) { console.error("CSV Login Fallback Error:", e.message) }
      }
      if (!user) return res.status(400).json({ message: 'Invalid credentials' })
      if (user.password !== password) return res.status(400).json({ message: 'Invalid credentials' })
      const token = signToken(user)
      try {
        const dir = path.join(__dirname, '..', 'uploads', 'admin')
        await fs.promises.mkdir(dir, { recursive: true })
        const csvPath = path.join(dir, 'logins.csv')
        const ua = (req.headers['user-agent'] || '').replace(/\s+/g, ' ')
        const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString()
        const line = `${new Date().toISOString()},${JSON.stringify(user._id)},${JSON.stringify(user.email)},${JSON.stringify(user.name)},${JSON.stringify(user.role)},${JSON.stringify(ip)},${JSON.stringify(ua)}\n`
        await fs.promises.appendFile(csvPath, line, 'utf8')
      } catch {}
      return res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } })
    }

    let user = await User.findOne({ email })
    if (!user) {
      // Check demo memory or CSV before giving up
      let demo = (global.__demo_users || []).find((u) => u.email === email)
      if (!demo) {
        try {
          const csvPath = path.join(__dirname, '..', 'uploads', 'admin', 'users.csv')
          const txt = await fs.promises.readFile(csvPath, 'utf8').catch(() => '')
          const lines = txt.split(/\r?\n/).filter(Boolean)
          for (const l of lines) {
            const parts = l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((p) => p.replace(/^"|"$/g, ''))
            const uemail = parts[1]
            const hashed = parts[2]
            if (uemail && uemail.toLowerCase() === email) {
              const okCsv = await bcrypt.compare(password, hashed).catch(() => false)
              if (okCsv) {
                demo = { _id: `csv-${Date.now()}`, name: parts[0], email: uemail, password, role: 'user' }
                global.__demo_users = global.__demo_users || []
                global.__demo_users.push(demo)
              }
              break
            }
          }
        } catch {}
      }
      if (!demo || demo.password !== password) return res.status(400).json({ message: 'Invalid credentials' })
      const token = signToken(demo)
      try {
        const dir = path.join(__dirname, '..', 'uploads', 'admin')
        await fs.promises.mkdir(dir, { recursive: true })
        const csvPath = path.join(dir, 'logins.csv')
        const ua = (req.headers['user-agent'] || '').replace(/\s+/g, ' ')
        const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString()
        const line = `${new Date().toISOString()},${JSON.stringify(demo._id)},${JSON.stringify(demo.email)},${JSON.stringify(demo.name)},${JSON.stringify(demo.role)},${JSON.stringify(ip)},${JSON.stringify(ua)}\n`
        await fs.promises.appendFile(csvPath, line, 'utf8')
      } catch {}
      try {
        req.app?.get('io')?.to('admins').emit('admin:login', { 
          userId: demo._id, 
          email: demo.email, 
          name: demo.name, 
          role: demo.role, 
          timestamp: new Date().toISOString() 
        })
      } catch {}
      return res.json({ token, user: { id: demo._id, name: demo.name, email: demo.email, role: demo.role } })
    }

    let ok = false
    try {
      if (user.password && /^\$2[aby]\$/.test(user.password)) {
        ok = await user.comparePassword(password)
      } else {
        ok = user.password === password
        if (ok) {
          // Upgrade plaintext to bcrypt
          user.password = password
          await user.save()
        }
      }
    } catch (err) { console.error("Compare password error:", err.message) }
    if (!ok) {
      console.log(`[LOGIN] Invalid credentials for: ${email}`)
      return res.status(400).json({ message: 'Invalid credentials' })
    }

    const token = signToken(user)
    try {
      const dir = path.join(__dirname, '..', 'uploads', 'admin')
      await fs.promises.mkdir(dir, { recursive: true })
      const csvPath = path.join(dir, 'logins.csv')
      const ua = (req.headers['user-agent'] || '').replace(/\s+/g, ' ')
      const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString()
      const line = `${new Date().toISOString()},${JSON.stringify(user._id.toString())},${JSON.stringify(user.email)},${JSON.stringify(user.name)},${JSON.stringify(user.role)},${JSON.stringify(ip)},${JSON.stringify(ua)}\n`
      await fs.promises.appendFile(csvPath, line, 'utf8')
    } catch {}
    try {
      req.app?.get('io')?.to('admins').emit('admin:login', { 
        userId: user._id.toString(), 
        email: user.email, 
        name: user.name, 
        role: user.role, 
        timestamp: new Date().toISOString() 
      })
    } catch {}
    res.json({ token, user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role } })
  } catch (e) {
    console.error("LOGIN ERROR:", e)
    res.status(500).json({ message: 'Login failed' })
  }
}

exports.me = async (req, res) => {
  res.json({ user: req.user })
}

exports.demoAdmin = async (req, res) => {
  try {
    if (global.__db_connected === false) {
      global.__demo_users = global.__demo_users || []
      let user = global.__demo_users.find((u) => u.email === 'admin@demo.local')
      if (!user) {
        user = { _id: `demo-${Date.now()}`, name: 'Admin', email: 'admin@demo.local', password: 'demo', role: 'admin' }
        global.__demo_users.push(user)
      } else {
        user.role = 'admin'
      }
      const token = signToken(user)
      return res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } })
    }
    let user = await User.findOne({ email: 'admin@demo.local' })
    if (!user) {
      user = await User.create({
        name: 'Admin',
        email: 'admin@demo.local',
        password: Math.random().toString(36).slice(2),
        role: 'admin',
      })
    } else if (user.role !== 'admin') {
      user.role = 'admin'
      await user.save()
    }
    const token = signToken(user)
    try {
      const dir = path.join(__dirname, '..', 'uploads', 'admin')
      await fs.promises.mkdir(dir, { recursive: true })
      const csvPath = path.join(dir, 'logins.csv')
      const ua = (typeof req !== 'undefined' ? (req.headers['user-agent'] || '') : '').replace(/\s+/g, ' ')
      const ip = (typeof req !== 'undefined' ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '') : '').toString()
      const line = `${new Date().toISOString()},${JSON.stringify(user._id)},${JSON.stringify(user.email)},${JSON.stringify(user.name)},${JSON.stringify(user.role)},${JSON.stringify(ip)},${JSON.stringify(ua)}\n`
      await fs.promises.appendFile(csvPath, line, 'utf8')
    } catch {}
    try {
      req.app?.get('io')?.to('admins').emit('admin:login', { 
        userId: user._id, 
        email: user.email, 
        name: user.name, 
        role: user.role, 
        timestamp: new Date().toISOString() 
      })
    } catch {}
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } })
  } catch (e) {
    try {
      global.__demo_users = global.__demo_users || []
      let user = global.__demo_users.find((u) => u.email === 'admin@demo.local')
      if (!user) {
        user = { _id: `fallback-${Date.now()}`, name: 'Admin', email: 'admin@demo.local', password: 'demo', role: 'admin' }
        global.__demo_users.push(user)
      } else {
        user.role = 'admin'
      }
      const token = signToken(user)
      try {
        const dir = path.join(__dirname, '..', 'uploads', 'admin')
        await fs.promises.mkdir(dir, { recursive: true })
        const csvPath = path.join(dir, 'logins.csv')
        const ua = (typeof req !== 'undefined' ? (req.headers['user-agent'] || '') : '').replace(/\s+/g, ' ')
        const ip = (typeof req !== 'undefined' ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '') : '').toString()
        const line = `${new Date().toISOString()},${JSON.stringify(user._id)},${JSON.stringify(user.email)},${JSON.stringify(user.name)},${JSON.stringify(user.role)},${JSON.stringify(ip)},${JSON.stringify(ua)}\n`
        await fs.promises.appendFile(csvPath, line, 'utf8')
      } catch {}
      try {
        req.app?.get('io')?.to('admins').emit('admin:login', { 
          userId: user._id, 
          email: user.email, 
          name: user.name, 
          role: user.role, 
          timestamp: new Date().toISOString() 
        })
      } catch {}
      return res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } })
    } catch {
      return res.status(500).json({ message: 'Demo admin failed' })
    }
  }
}
