import { useState } from 'react'
import api from '../services/api'
import { useAuth } from '../store/auth'
import { useNavigate, Link } from 'react-router-dom'

function Login() {
  const navigate = useNavigate()
  const { setToken, setUser } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setOk('')
    const { data } = await api.post('/auth/login', form).catch((err) => {
      return { data: { message: err?.response?.data?.message || 'Login failed' } }
    })
    if (data?.token && data?.user) {
      setToken(data.token)
      setUser(data.user)
      try { sessionStorage.setItem('welcome_banner', `Welcome, ${data.user.name}!`) } catch { void 0 }
      setOk('Login successful')
      setTimeout(() => navigate('/', { replace: true }), 700)
    } else {
      setError(data?.message || 'Login failed: Incorrect email or password')
    }
  }

  // guest mode removed

  

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-black italic tracking-tighter flex justify-center gap-3 mb-2">
            <span className="text-cyan-400 uppercase">Your</span>
            <span className="text-yellow-400 uppercase">Tunes</span>
          </h1>
          <p className="text-gray-500 font-bold uppercase tracking-[0.2em] text-xs">Streaming in Realtime</p>
        </div>

        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-yellow-500 to-orange-600 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
          <form onSubmit={submit} className="relative w-full bg-black border border-white/5 rounded-3xl p-8 shadow-2xl">
            <h2 className="text-white text-2xl font-black mb-1">Welcome Back</h2>
            <p className="text-gray-500 mb-8 text-sm">Sign in to your account</p>
            
            {error && <div className="mb-6 text-red-400 bg-red-900/20 border border-red-900/50 p-4 rounded-xl text-sm font-bold">{error}</div>}
            {ok && <div className="mb-6 text-emerald-400 bg-emerald-900/20 border border-emerald-900/50 p-4 rounded-xl text-sm font-bold">{ok}</div>}
            
            <div className="space-y-6">
              <div>
                <label className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-2 block ml-1">Email Address</label>
                <input 
                  value={form.email} 
                  onChange={(e) => setForm({ ...form, email: e.target.value.toLowerCase() })} 
                  placeholder="you@example.com" 
                  type="email" 
                  required
                  className="w-full p-4 rounded-2xl bg-[#111114] text-white border border-white/5 focus:border-cyan-500 outline-none transition-all placeholder:text-gray-700" 
                />
              </div>
              
              <div>
                <label className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-2 block ml-1">Password</label>
                <input 
                  value={form.password} 
                  onChange={(e) => setForm({ ...form, password: e.target.value })} 
                  placeholder="••••••••" 
                  type="password" 
                  required
                  className="w-full p-4 rounded-2xl bg-[#111114] text-white border border-white/5 focus:border-cyan-500 outline-none transition-all placeholder:text-gray-700" 
                />
              </div>

              <button
            type="submit"
            className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-black py-4 rounded-xl transition-all shadow-lg shadow-cyan-900/20 uppercase tracking-widest text-sm"
          >
            Sign In
          </button>
            </div>

            <div className="mt-8 pt-6 border-t border-white/5 text-center">
              <p className="text-gray-500 text-sm font-bold">
                Don't have an account? <Link to="/register" className="text-cyan-400 hover:text-cyan-300 transition ml-1">Register</Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Login
