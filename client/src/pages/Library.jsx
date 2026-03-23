import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import PlayerBar from '../components/PlayerBar'
import { useAuth } from '../store/auth'
import SongCard from '../components/SongCard'
import api from '../services/api'
import { socket } from '../sockets'

function Library() {
  const { user, token } = useAuth()
  const serverBase = (import.meta.env.VITE_API_URL || 'http://localhost:5001/api').replace(/\/api$/, '')
  const [songs, setSongs] = useState([])
  const [playlists, setPlaylists] = useState([])
  const [likedFiles, setLikedFiles] = useState([])
  const [adminUploads, setAdminUploads] = useState([])
  const [newPlName, setNewPlName] = useState('')
  const [selPl, setSelPl] = useState('')
  const [selSong, setSelSong] = useState('')

  useEffect(() => {
    api.get('/songs').then((res) => setSongs(res.data.data || []))
    api.get('/songs/admin-uploads').then((res) => setAdminUploads(res.data.data || [])).catch(() => setAdminUploads([]))
    if (user) {
      api.get('/playlists/me').then((res) => setPlaylists(res.data.data || []))
      api.get('/songs/liked-files').then((res) => setLikedFiles(res.data.data || [])).catch(() => setLikedFiles([]))
    }
    const onCreated = async () => {
      const [res1, res2] = await Promise.all([
        api.get('/songs').catch(() => null),
        api.get('/songs/admin-uploads').catch(() => null),
      ])
      setSongs(res1?.data?.data || [])
      setAdminUploads(res2?.data?.data || [])
    }
    socket.on('song:created', onCreated)
    return () => socket.off('song:created', onCreated)
  }, [user])

  const buildLiked = async () => {
    const res = await api.post('/songs/build-liked-folder').catch(() => null)
    if (res?.data?.ok) alert('Liked folder built')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e] text-white">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="inline-block relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl blur opacity-30"></div>
            <h2 className="relative text-2xl font-black text-white px-3 py-2 rounded-xl border border-white/10 bg-[#11131a]">Library</h2>
          </div>
        </div>
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <a href="/" className="p-3 rounded-lg bg-[#1a1f2b] border border-white/10 text-white text-center">Home</a>
          <a href="/profile" className="p-3 rounded-lg bg-[#1a1f2b] border border-white/10 text-white text-center">Profile</a>
          {user && <a href={`${serverBase}/uploads/liked/${user?.id}/`} target="_blank" rel="noopener" className="p-3 rounded-lg bg-[#1a1f2b] border border-white/10 text-white text-center">Open Liked</a>}
        </div>
        {user && (
          <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#11131a] p-4 rounded-2xl border border-white/10 shadow-2xl">
              <h3 className="text-sm text-slate-400 mb-1">User</h3>
              <div className="text-lg font-black">{user.name}</div>
              <div className="text-slate-300">{user.email}</div>
            </div>
            <div className="bg-[#11131a] p-4 rounded-2xl border border-white/10 shadow-2xl">
              <h3 className="text-sm text-slate-400 mb-2">Library Actions</h3>
              <div className="flex flex-wrap gap-3">
                <a href={`${serverBase}/api/songs/download?token=${token}`} target="_blank" rel="noopener" className="px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold">Download Library</a>
                <a href={`${serverBase}/api/songs/playlist-m3u?token=${token}`} target="_blank" rel="noopener" className="px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold">All Songs (Playlist)</a>
                <button onClick={buildLiked} className="px-3 py-2 rounded-lg bg-[#1a1f2b] border border-white/10">Liked Folder</button>
              </div>
            </div>
            <div className="bg-[#11131a] p-4 rounded-2xl border border-white/10 shadow-2xl">
              <h3 className="text-sm text-slate-400 mb-2">Quick Links</h3>
              <div className="text-xs text-slate-300">Your ID: {user.id || user._id}</div>
              <div className="text-xs text-slate-300">Role: {user.role}</div>
            </div>
          </div>
        )}
        
        {user && (
          <div className="mb-6 bg-[#11131a] border border-white/10 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-white text-lg mb-3">Playlists</h3>
            <div className="flex flex-wrap gap-3 items-center">
              <input value={newPlName} onChange={(e) => setNewPlName(e.target.value)} placeholder="New playlist name" className="p-2 rounded-lg bg-[#1a1f2b] text-white border border-white/10" />
              <button
                onClick={async () => {
                  if (!newPlName.trim()) return;
                  const res = await api.post('/playlists', { name: newPlName.trim() }).catch(() => null)
                  if (res?.data?.data) {
                    setNewPlName('')
                    const plRes = await api.get('/playlists/me').catch(() => null)
                    setPlaylists(plRes?.data?.data || [])
                  } else {
                    alert('Failed to create playlist')
                  }
                }}
                className="px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold"
              >
                Create
              </button>
              {playlists.length > 0 && (
                <>
                  <select value={selPl} onChange={(e) => setSelPl(e.target.value)} className="p-2 rounded-lg bg-[#1a1f2b] text-white border border-white/10">
                    <option value="">Select playlist</option>
                    {playlists.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                  <select value={selSong} onChange={(e) => setSelSong(e.target.value)} className="p-2 rounded-lg bg-[#1a1f2b] text-white border border-white/10">
                    <option value="">Select song</option>
                    {songs.map((s) => <option key={s._id} value={s._id}>{s.title} — {s.artist}</option>)}
                  </select>
                  <button
                    onClick={async () => {
                      if (!selPl || !selSong) return;
                      const res = await api.post('/playlists/add', { playlistId: selPl, songId: selSong }).catch(() => null)
                      if (res?.data?.data) {
                        const plRes = await api.get('/playlists/me').catch(() => null)
                        setPlaylists(plRes?.data?.data || [])
                        alert('Added to playlist')
                      } else {
                        alert('Failed to add to playlist')
                      }
                    }}
                    className="px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold"
                  >
                    Add to Playlist
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        {user && (
          <div className="mb-6">
            <h3 className="text-white text-lg mb-3">Liked Playlist</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {songs.filter((s) => (s.likes || []).some((u) => u === user?.id || u?._id === user?.id)).map((s) => (
                <SongCard key={s._id} song={s} queue={songs.filter((ss) => (ss.likes || []).some((u) => u === user?.id || u?._id === user?.id))} />
              ))}
            </div>
          </div>
        )}
        {(adminUploads.length > 0 || songs.some((s) => s.adminUpload)) && (
          <div className="mb-6">
            <h3 className="text-white text-lg mb-3">Uploaded by Admin</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(adminUploads.length > 0 ? adminUploads : songs.filter((s) => s.adminUpload)).map((s) => (
                <SongCard key={s._id} song={s} queue={(adminUploads.length > 0 ? adminUploads : songs.filter((q) => q.adminUpload))} />
              ))}
            </div>
          </div>
        )}
        {likedFiles.length > 0 && (
          <div className="mb-6">
            <h3 className="text-white text-lg mb-3">Liked Files</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {likedFiles.map((f) => (
                <div key={f.url} className="bg-[#11131a] rounded-2xl p-3 border border-white/10">
                  <img src="https://images.unsplash.com/photo-1511379938547-c1f69419868d?q=80&w=600&auto=format&fit=crop" alt="" className="w-full h-40 object-cover rounded" />
                  <div className="mt-2">
                    <div className="font-medium text-white">{f.name}</div>
                    <div className="text-sm text-neutral-300">Liked File</div>
                  </div>
                  <a href={f.url} download className="mt-2 block text-center bg-[#1a1f2b] border border-white/10 text-white py-2 rounded">Download</a>
                  <audio src={f.url} controls className="w-full mt-2" />
                </div>
              ))}
            </div>
          </div>
        )}
        {user && playlists.length > 0 && (
          <div className="mb-6">
            <h3 className="text-white text-lg mb-3">Your Playlists</h3>
            {playlists.map((pl) => (
              <div key={pl._id} className="mb-4">
                <div className="text-white font-medium mb-2">{pl.name} <span className="text-neutral-400">({pl.songs?.length || 0})</span></div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {(pl.songs || []).map((s) => (
                    <SongCard key={s._id} song={s} queue={pl.songs} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <PlayerBar />
    </div>
  )
}

export default Library
