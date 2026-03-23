import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Profile from './pages/Profile'
import AdminDashboard from './pages/AdminDashboard'
import Liked from './pages/Liked'
import ReplayMix from './pages/ReplayMix'
import Library from './pages/Library'
import Explore from './pages/Explore'
import PlaylistDetails from './pages/PlaylistDetails'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './store/auth'
import { connectSocket, disconnectSocket } from './sockets'
import PlayerBar from './components/PlayerBar'
import api from './services/api'

function App() {
  const { token, setUser, logout } = useAuth()
  const looksJwt = token && token.split('.').length === 3

  useEffect(() => {
    if (looksJwt) {
      // Verify session on load/refresh
      api.get('/auth/me').then(res => {
        if (res.data?.data) {
          setUser(res.data.data)
        }
      }).catch(() => {
        console.error("Session expired or invalid")
        logout()
      })
    }
  }, [])

  useEffect(() => {
    try {
      const { pathname, search } = window.location
      const port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80')
      const isAdmin = /^\/admin(\/.*)?$/.test(pathname)
      
      // If we are on port 5000 and the path is /admin, redirect to 5001
      if (isAdmin && port === '5000') {
        window.location.replace(`http://localhost:5001${pathname}${search}`)
        return
      }
      // If we are on port 5001 and the path is NOT /admin, redirect back to 5000
      if (!isAdmin && port === '5001') {
        window.location.replace(`http://localhost:5000${pathname}${search}`)
        return
      }
    } catch { /* noop */ }
  }, [])
  useEffect(() => {
    if (looksJwt) {
      connectSocket(token)
    } else {
      disconnectSocket()
    }
  }, [looksJwt, token])

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Auth Routes */}
        <Route path="/login" element={!looksJwt ? <Login /> : <Navigate to="/" />} />
        <Route path="/register" element={!looksJwt ? <Register /> : <Navigate to="/" />} />

        {/* Protected Routes - Enforce Auth */}
        <Route path="/" element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        } />
        
        <Route path="/explore" element={
          <ProtectedRoute>
            <Explore />
          </ProtectedRoute>
        } />

        <Route path="/profile" element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        } />
        <Route path="/liked" element={
          <ProtectedRoute>
            <Liked />
          </ProtectedRoute>
        } />

        <Route path="/replay-mix" element={
          <ProtectedRoute>
            <ReplayMix />
          </ProtectedRoute>
        } />

        <Route path="/admin" element={
          <ProtectedRoute gate="admin">
            <AdminDashboard />
          </ProtectedRoute>
        } />

        <Route path="/library" element={
          <ProtectedRoute>
            <Library />
          </ProtectedRoute>
        } />

        <Route path="/playlist/:id" element={
          <ProtectedRoute>
            <PlaylistDetails />
          </ProtectedRoute>
        } />

        {/* Catch-all: Redirect to Login if not auth, else Home */}
        <Route path="*" element={<Navigate to={looksJwt ? "/" : "/login"} />} />
      </Routes>
      <PlayerBar />
    </BrowserRouter>
  )
}

export default App
