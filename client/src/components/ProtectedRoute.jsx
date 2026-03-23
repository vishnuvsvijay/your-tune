import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../store/auth'
import api from '../services/api'
import { useEffect, useState } from 'react'

function ProtectedRoute({ children, role, gate }) {
  const { token, user, setUser, setToken } = useAuth()
  const location = useLocation()
  const [ready, setReady] = useState(!role)
  const gateEnabled = gate === 'admin' || role === 'admin'
  const [gateOk, setGateOk] = useState(() => (gateEnabled ? sessionStorage.getItem('admin_gate_ok') === '1' : true))
  const [pwd, setPwd] = useState('')
  useEffect(() => {
    let mounted = true
    const ensureAdmin = async () => {
      const looksJwt = token && token.split('.').length === 3
      if (!role || !looksJwt) {
        const fromLs = localStorage.getItem('token')
        if (fromLs && fromLs.split('.').length === 3) {
          setToken(fromLs)
          return setReady(true)
        } else {
          const qs = new URLSearchParams(location.search)
          const t = qs.get('token')
          if (t && t.split('.').length === 3) {
            setToken(t)
            return setReady(true)
          }
          return setReady(true)
        }
      }
      if (user?.role === role) return setReady(true)
      const me = await api.get('/auth/me').catch(() => null)
      if (me?.data?.user && mounted) {
        setUser(me.data.user)
        if (me.data.user.role === role) return setReady(true)
      }
      setReady(true)
    }
    ensureAdmin()
    return () => {
      mounted = false
    }
  }, [role, token, user?.role, setUser, setToken, location.search])
  const looksJwt2 = token && token.split('.').length === 3
  // For admin gate, show the gateway even without JWT
  if (!looksJwt2 && !gateEnabled && role !== 'admin') {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  if (!ready) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  // Mandatory gate check for admin area
  if (gateEnabled && !gateOk) {
    const handleAdminLogin = async () => {
      const input = pwd.trim().toLowerCase()
      if (input === 'admin 123' || input === 'admin123') {
        try {
          const res = await api.post('/auth/demo-admin').catch(() => null)
          if (res?.data?.token && res?.data?.user) {
            setToken(res.data.token)
            setUser(res.data.user)
            sessionStorage.setItem('admin_gate_ok', '1')
            setGateOk(true)
          } else {
            alert('Admin initialization failed. Check server status.')
          }
        } catch (err) {
          alert('Error connecting to admin portal.')
        }
      } else {
        alert('Incorrect admin password.')
      }
    }

    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md">
          <div className="mb-10 text-center">
            <h1 className="text-4xl font-black italic tracking-tighter flex justify-center gap-3 mb-2">
              <span className="text-cyan-400 uppercase">Your</span>
              <span className="text-yellow-400 uppercase">Tunes</span>
            </h1>
            <p className="text-gray-500 font-bold uppercase tracking-[0.2em] text-xs">Admin Gateway</p>
          </div>

          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-yellow-500 to-orange-600 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
            <div className="relative w-full bg-black border border-white/5 rounded-3xl p-8 shadow-2xl">
              <h2 className="text-white text-2xl font-black mb-1">Restricted Area</h2>
              <p className="text-gray-500 mb-8 text-sm">Enter admin password to continue</p>
              
              <div className="space-y-6">
                <div>
                  <label className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-2 block ml-1">Password</label>
                  <input 
                    value={pwd} 
                    onChange={(e) => setPwd(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                    placeholder="••••••••" 
                    type="password" 
                    autoFocus
                    className="w-full p-4 rounded-2xl bg-[#111114] text-white border border-white/5 focus:border-cyan-500 outline-none transition-all placeholder:text-gray-700" 
                  />
                </div>

                <button 
                  onClick={handleAdminLogin}
                  className="w-full p-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase tracking-widest transition-all shadow-lg shadow-cyan-900/20 active:scale-[0.98]"
                >
                  Enter Dashboard
                </button>
              </div>

              <div className="mt-8 pt-6 border-t border-white/5 text-center">
                <p className="text-gray-500 text-sm font-bold">
                  Not an admin? <button onClick={() => window.location.replace('http://localhost:5000/')} className="text-cyan-400 hover:text-cyan-300 transition ml-1">Go Back</button>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // After passing the gate, check roles and auth
  if (!looksJwt2 && !gateEnabled) return <Navigate to="/login" replace />
  if (user?.role === 'admin') return children
  if (role && (!user || user.role !== role)) return <Navigate to="/" replace />

  return children
}

export default ProtectedRoute
