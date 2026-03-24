import { useEffect, useState } from 'react'
import api from '../services/api'
import { useAuth } from '../store/auth'
import { useNavigate } from 'react-router-dom'
import { FaUsers, FaMusic, FaBroadcastTower, FaUpload, FaChartBar, 
  FaSignOutAlt, FaCloudUploadAlt, FaWaveSquare, FaFire, FaHeart, FaPlay, FaListUl
} from 'react-icons/fa'
import { FiArrowLeft, FiSearch, FiAlertTriangle } from 'react-icons/fi'
import { socket } from '../sockets'

const ApiWarning = () => {
  if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl mb-6 flex items-start gap-4">
        <FiAlertTriangle className="text-xl shrink-0 mt-1" />
        <div>
          <h4 className="font-black text-lg">API Configuration Error</h4>
          <p className="text-sm font-medium text-white/60">
            The backend URL is not set. Your frontend is likely trying to call itself, which will fail. 
            You must set the <code className="bg-red-900/50 px-1 py-0.5 rounded">VITE_API_URL</code> environment variable in your Vercel project settings.
          </p>
        </div>
      </div>
    )
  }
  return null
}

function AdminDashboard() {
  const { token, user, logout } = useAuth()
  const navigate = useNavigate()
  
  const [stats, setStats] = useState({ users: 0, songs: 0, online: 0, playlists: 0, plays: 0, likes: 0 })
  const [loading, setLoading] = useState(true)
  const [upload, setUpload] = useState({ title: '', artist: '' })
  const [audioFile, setAudioFile] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [recentSongs, setRecentSongs] = useState([])
  const [recentPlaylists, setRecentPlaylists] = useState([])
  const [loginLogs, setLoginLogs] = useState([])
  const [selectedPlaylist, setSelectedPlaylist] = useState(null) // For modal details

  const fetchData = async () => {
    try {
      const [res, playlistsRes, songsRes, logsRes] = await Promise.all([
        api.get('/admin/stats').catch(() => null),
        api.get('/admin/playlists').catch(() => null),
        api.get('/songs/admin-uploads').catch(() => null),
        api.get('/admin/logins').catch(() => null)
      ])

      if (res?.data?.data) setStats(res.data.data)
      if (playlistsRes?.data?.data) setRecentPlaylists(playlistsRes.data.data)
      if (songsRes?.data?.data) setRecentSongs(songsRes.data.data.slice(0, 6))
      if (logsRes?.data?.data) setLoginLogs(logsRes.data.data)
    } catch (err) {
      console.error("Dashboard Sync Error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()

    // Real-time socket updates
    socket.on('admin:stats', (newStats) => {
      setStats(prev => ({ ...prev, ...newStats }))
    })

    socket.on('playlist:updated', () => {
      fetchData() // Refresh playlists and stats
    })

    socket.on('usage:update', ({ userId, delta }) => {
      setStats(prev => ({ ...prev, online: prev.online + (delta > 0 ? 1 : 0) }))
    })

    socket.on('song:created', fetchData)

    socket.on('admin:login', (log) => {
      setLoginLogs(prev => [log, ...prev].slice(0, 50))
      setStats(prev => ({ ...prev, online: prev.online + 1 }))
    })

    return () => {
      socket.off('admin:stats')
      socket.off('playlist:updated')
      socket.off('usage:update')
      socket.off('song:created')
      socket.off('admin:login')
    }
  }, [])

  const handleUpload = async () => {
    if (!upload.title || !upload.artist || !audioFile) return alert('Fill details')
    const fd = new FormData()
    fd.append('title', upload.title)
    fd.append('artist', upload.artist)
    fd.append('song', audioFile)
    if (imageFile) fd.append('cover', imageFile)

    try {
      await api.post(`/songs?token=${token}`, fd, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      alert('Success! Song uploaded successfully.')
      setUpload({ title: '', artist: '' })
      setAudioFile(null)
      setImageFile(null)
      fetchData() // Refresh list
    } catch (err) { 
      let msg = 'Upload failed'
      let detail = ''
      if (err.response) {
        msg = err.response.data?.message || `Server Error: ${err.response.status}`
        detail = err.response.data?.error || ''
        if (err.response.status === 404) msg = "API Endpoint not found. Check VITE_API_URL."
        if (err.response.status === 413) msg = "File too large. Maximum size is 50MB."
      } else if (err.request) {
        msg = "Network Error: Could not reach the server. Is the backend running?"
      } else {
        msg = err.message
      }
      
      alert(`Upload Error: ${msg}${detail ? '\nDetail: ' + detail : ''}`)
      console.error("Full Upload Error:", err)
    }
  }

  // UI rendering starts here
  return (
    <div className="flex h-screen bg-[#000000] text-white overflow-hidden font-sans">
      {/* SIDEBAR */}
      <div className="w-64 bg-[#0a0a0a] flex flex-col border-r border-white/5 shrink-0">
        <div className="p-8 mb-4 flex items-center gap-2">
          <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center text-black shadow-lg">
            <FaWaveSquare />
          </div>
          <span className="text-xl font-black italic tracking-tighter">YOUR TUNE</span>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <div className="bg-white/5 text-green-500 flex items-center gap-4 px-4 py-3 rounded-xl font-bold text-sm cursor-pointer">
            <FaChartBar /> Dashboard
          </div>
          <div className="text-white/40 hover:text-white flex items-center gap-4 px-4 py-3 rounded-xl font-bold text-sm cursor-pointer transition-all">
            <FaUpload /> Library
          </div>
        </nav>

        <div className="p-6 border-t border-white/5">
          <button onClick={() => navigate('/')} className="flex items-center gap-3 text-white/40 hover:text-white text-xs font-bold mb-4">
            <FiArrowLeft /> Back to App
          </button>
          <button onClick={logout} className="flex items-center gap-3 text-red-500/60 hover:text-red-500 text-xs font-bold">
            <FaSignOutAlt /> Sign Out
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#000000]">
        <header className="h-20 px-8 flex items-center justify-between bg-black/40 backdrop-blur-md border-b border-white/5">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-black uppercase tracking-widest text-white/80">Admin Console</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-white/40">{user?.email}</span>
            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-black font-black text-sm">
              {user?.email?.[0].toUpperCase() || 'A'}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-10 py-10 pb-32 scrollbar-hide">
          <ApiWarning />
          {/* STATS ROW */}
          <div className="grid grid-cols-4 gap-6 mb-12">
            {[
              { label: 'Total Songs', val: stats.songs, icon: FaMusic, col: 'text-white' },
              { label: 'Online Now', val: stats.online, icon: FaBroadcastTower, col: 'text-green-500' },
              { label: 'Total Playlists', val: stats.playlists, icon: FaListUl, col: 'text-cyan-500' },
              { label: 'Total Favorites', val: stats.likes, icon: FaHeart, col: 'text-red-500' }
            ].map((s, idx) => (
              <div key={idx} className="bg-[#0f0f0f] p-6 rounded-2xl border border-white/5 shadow-lg hover:border-white/10 transition-all">
                <s.icon className={`${s.col} text-xl mb-4`} />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">{s.label}</p>
                <p className="text-3xl font-black mt-1">{s.val || 0}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-12 gap-10">
            {/* RECENT PLAYLISTS & LOGS */}
            <div className="col-span-4 space-y-8">
              {/* PLAYLIST TRACKER */}
              <div className="bg-[#0f0f0f] p-6 rounded-3xl border border-white/5 shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-500">Recent Playlists</h3>
                  <span className="bg-cyan-500/10 text-cyan-500 text-[10px] font-black px-2 py-0.5 rounded-full">
                    {recentPlaylists.length} NEW
                  </span>
                </div>
                
                <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                  {recentPlaylists.length > 0 ? recentPlaylists.map((pl, i) => (
                    <div 
                      key={i} 
                      onClick={() => setSelectedPlaylist(pl)}
                      className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-all group cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-xs font-black text-white truncate uppercase tracking-wider">{pl.name}</p>
                        <span className="text-[9px] font-bold text-cyan-500/60 whitespace-nowrap uppercase">{pl.trackCount} Songs • {pl.runtime}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-500 flex items-center justify-center text-[8px] font-black border border-cyan-500/20">
                          {pl.creator?.[0]?.toUpperCase()}
                        </div>
                        <p className="text-[10px] font-bold text-white/40 truncate">Created by {pl.creator}</p>
                      </div>
                    </div>
                  )) : (
                    <div className="py-10 text-center opacity-20">
                       <FaListUl className="text-2xl mx-auto mb-2" />
                       <p className="text-[8px] font-black uppercase tracking-widest">No playlists created yet</p>
                    </div>
                  )}
                </div>
              </div>

              {/* USER LOGIN LOGS */}
              <div className="bg-[#0f0f0f] p-6 rounded-3xl border border-white/5 shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">Access Logs</h3>
                  <span className="bg-blue-500/10 text-blue-500 text-[10px] font-black px-2 py-0.5 rounded-full">
                    {loginLogs.length} LOGS
                  </span>
                </div>
                
                <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                  {loginLogs.length > 0 ? loginLogs.map((log, i) => (
                    <div key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-all group">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white text-[10px] font-black shrink-0 shadow-lg">
                        {log.name?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-black text-white truncate uppercase tracking-wider">{log.name || 'Unknown User'}</p>
                        </div>
                        <p className="text-[9px] font-bold text-white/40 truncate mt-0.5">{log.email}</p>
                        <p className="text-[8px] text-white/20 font-black uppercase tracking-widest mt-1">
                          {new Date(log.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  )) : (
                    <div className="py-10 text-center opacity-20">
                       <FaUsers className="text-2xl mx-auto mb-2" />
                       <p className="text-[8px] font-black uppercase tracking-widest">No access logs found</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* MUSIC GRID (YouTube Music Style) */}
            <div className="col-span-8 space-y-8">
              <div className="bg-[#0f0f0f] p-8 rounded-3xl border border-white/5 shadow-2xl mb-8">
                <h3 className="text-xs font-black mb-8 uppercase tracking-widest text-green-500">Quick Upload</h3>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border-2 border-dashed border-white/10 rounded-2xl p-6 text-center hover:border-green-500/40 transition-all bg-black cursor-pointer relative group">
                      <input type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0])} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                      <FaCloudUploadAlt className="mx-auto text-2xl mb-2 text-white/20 group-hover:text-green-500/40 transition-colors" />
                      <p className="text-[9px] font-bold text-white/40 uppercase truncate px-2">{audioFile ? audioFile.name : 'Audio File'}</p>
                    </div>

                    <div className="border-2 border-dashed border-white/10 rounded-2xl p-6 text-center hover:border-blue-500/40 transition-all bg-black cursor-pointer relative group">
                      <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0])} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                      {imageFile ? (
                        <img src={URL.createObjectURL(imageFile)} className="w-full h-8 object-cover rounded-md mb-2 opacity-50" alt="Preview" />
                      ) : (
                        <FaCloudUploadAlt className="mx-auto text-2xl mb-2 text-white/20 group-hover:text-blue-500/40 transition-colors" />
                      )}
                      <p className="text-[9px] font-bold text-white/40 uppercase truncate px-2">{imageFile ? imageFile.name : 'Cover Image'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <input placeholder="Track Title" value={upload.title} onChange={(e) => setUpload({...upload, title: e.target.value})} className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-4 text-sm outline-none focus:border-green-500/50" />
                    <input placeholder="Artist" value={upload.artist} onChange={(e) => setUpload({...upload, artist: e.target.value})} className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-4 text-sm outline-none focus:border-green-500/50" />
                  </div>
                  <button onClick={handleUpload} className="w-full py-4 bg-green-500 text-black font-black rounded-xl hover:scale-[1.02] transition-all shadow-lg shadow-green-500/10 uppercase tracking-widest text-xs">
                    PUBLISH TRACK
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-black mb-8 italic">Admin Uploads</h3>
                <div className="grid grid-cols-3 gap-6">
                  {recentSongs.map((song, i) => (
                    <div key={song._id || i} className="group bg-[#0f0f0f] hover:bg-white/[0.04] p-5 rounded-2xl transition-all border border-white/5 cursor-pointer">
                      <div className="relative aspect-square mb-5 rounded-xl overflow-hidden shadow-xl">
                        <img 
                          src={song.coverImage || `https://api.dicebear.com/7.x/identicon/svg?seed=${song.title || i}`} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500" 
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                          <div className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center shadow-2xl"><FaPlay className="ml-1 text-sm" /></div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold text-sm truncate text-white">{song.title}</p>
                        <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.1em]">{song.artist}</p>
                        <div className="flex items-center gap-3 pt-2">
                           <span className="flex items-center gap-1 text-[10px] font-bold text-red-500/60"><FaHeart className="text-[8px]" /> {song.likes?.length || 0}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* PLAYLIST DETAIL MODAL */}
      {selectedPlaylist && (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-[#0f0f0f] w-full max-w-2xl rounded-[40px] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-10 bg-gradient-to-br from-cyan-500/10 to-transparent flex items-start justify-between">
              <div>
                <h3 className="text-4xl font-black italic text-white mb-2 tracking-tighter">{selectedPlaylist.name}</h3>
                <div className="flex items-center gap-3 text-cyan-500 font-bold uppercase tracking-widest text-[10px]">
                  <span>{selectedPlaylist.trackCount} Tracks</span>
                  <span className="w-1 h-1 bg-white/20 rounded-full"></span>
                  <span>{selectedPlaylist.runtime} Runtime</span>
                </div>
                <div className="mt-6 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center text-black font-black text-[10px]">
                    {selectedPlaylist.creator?.[0]?.toUpperCase()}
                  </div>
                  <p className="text-sm font-bold text-white/60">Created by <span className="text-white">{selectedPlaylist.creator}</span></p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedPlaylist(null)}
                className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all border border-white/10"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-10 pb-10 custom-scrollbar">
              <div className="space-y-2">
                {selectedPlaylist.songs.map((s, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-transparent hover:border-white/5 transition-all">
                    <div className="w-8 text-[10px] font-black text-white/20">{idx + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{s.title}</p>
                      <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{s.artist}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminDashboard