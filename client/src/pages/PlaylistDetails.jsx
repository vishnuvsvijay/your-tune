import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../store/auth'
import { usePlayer } from '../store/player'
import api from '../services/api'
import { socket } from '../sockets'
import { FaPlay, FaHeart, FaRegHeart, FaEllipsisV, FaRandom, FaMusic, FaThumbsUp, FaRegThumbsDown } from 'react-icons/fa'
import { IoShuffleOutline } from 'react-icons/io5'

function PlaylistDetails() {
  const { id } = useParams()
  const { user } = useAuth()
  const { currentSong, playing, setCurrentSong } = usePlayer()
  const [playlist, setPlaylist] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      // We'll use the public endpoint if available, or try to find it in the user's playlists
      const res = await api.get('/playlists/public').catch(() => null)
      const allPublic = res?.data?.data || []
      let found = allPublic.find(p => p._id === id)
      
      if (!found) {
        const mineRes = await api.get('/playlists/me').catch(() => null)
        const myPlaylists = mineRes?.data?.data || []
        found = myPlaylists.find(p => p._id === id)
      }
      
      setPlaylist(found)
    } catch (err) {
      console.error("Failed to load playlist", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    
    const onUpdate = (msg) => {
      if (msg.id === id) load()
    }

    socket.on('playlist:updated', onUpdate)
    return () => {
      socket.off('playlist:updated', onUpdate)
    }
  }, [id])

  const handlePlayAll = () => {
    if (playlist?.songs?.length > 0) {
      setCurrentSong(playlist.songs[0], playlist.songs)
    }
  }

  const handleShuffle = () => {
    if (playlist?.songs?.length > 0) {
      const shuffled = [...playlist.songs].sort(() => Math.random() - 0.5)
      setCurrentSong(shuffled[0], shuffled)
    }
  }

  const isCurrentPlaylistPlaying = useMemo(() => {
    return playing && playlist?.songs?.some(s => s._id === currentSong?._id)
  }, [playing, playlist, currentSong])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030303] text-white flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!playlist) {
    return (
      <div className="min-h-screen bg-[#030303] text-white flex flex-col items-center justify-center gap-4">
        <FaMusic className="text-6xl text-gray-700" />
        <h2 className="text-2xl font-bold">Playlist not found</h2>
        <button onClick={() => window.history.back()} className="text-cyan-400 hover:underline">Go back</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#030303] text-white font-sans pb-24 overflow-y-auto custom-scrollbar">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row items-center md:items-end gap-10 mb-10 bg-gradient-to-b from-cyan-900/20 to-transparent p-10 rounded-[40px]">
          {/* Large Cover Image */}
          <div className="relative group shrink-0">
            <div className="w-64 h-64 md:w-80 md:h-80 rounded-[32px] bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center shadow-[0_20px_50px_rgba(0,255,255,0.1)] overflow-hidden relative border border-white/5">
              {playlist.songs?.[0]?.coverImage ? (
                <img src={playlist.songs[0].coverImage} className="w-full h-full object-cover" alt="" />
              ) : (
                <FaMusic className="text-white/20 text-[120px]" />
              )}
              <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors"></div>
            </div>
          </div>

          {/* Info Section */}
          <div className="flex-1 flex flex-col items-center md:items-start gap-6 text-center md:text-left">
            <div>
              <h1 className="text-6xl md:text-8xl font-black mb-4 tracking-tighter italic">{playlist.name}</h1>
              <div className="flex items-center justify-center md:justify-start gap-3 text-xl font-bold">
                <div className="w-10 h-10 rounded-full bg-[#3d3d3d] flex items-center justify-center text-sm border border-white/10 shadow-lg">
                  {playlist.userId?.name?.[0]?.toUpperCase() || 'U'}
                </div>
                <span className="text-gray-300">{playlist.userId?.name || 'Community'}</span>
              </div>
            </div>

            <div className="flex flex-col gap-1 text-gray-400 font-bold">
              <p>Playlist • {new Date(playlist.createdAt).getFullYear()}</p>
              <p>{playlist.songs?.length || 0} songs • {Math.floor((playlist.songs?.length || 0) * 3.5 / 60)} hours {Math.floor((playlist.songs?.length || 0) * 3.5 % 60)} minutes</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-6 mt-4">
              <button 
                onClick={handleShuffle}
                className="w-14 h-14 rounded-full bg-white/5 hover:bg-white/10 transition flex items-center justify-center text-2xl border border-white/10 shadow-xl"
              >
                <IoShuffleOutline />
              </button>
              <button 
                onClick={handlePlayAll}
                className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 active:scale-95 transition shadow-[0_0_30px_rgba(255,255,255,0.3)]"
              >
                {isCurrentPlaylistPlaying ? (
                  <div className="flex gap-1.5 items-end h-8">
                    <div className="w-2 bg-black animate-[music-bar_0.6s_ease-in-out_infinite]"></div>
                    <div className="w-2 bg-black animate-[music-bar_0.8s_ease-in-out_infinite]"></div>
                    <div className="w-2 bg-black animate-[music-bar_0.7s_ease-in-out_infinite]"></div>
                  </div>
                ) : (
                  <FaPlay className="ml-1 text-3xl" />
                )}
              </button>
              <button className="w-14 h-14 rounded-full bg-white/5 hover:bg-white/10 transition flex items-center justify-center text-xl border border-white/10 shadow-xl">
                <FaEllipsisV />
              </button>
            </div>
          </div>
        </div>

        {/* Song List */}
        <div className="mt-12 px-4">
          {playlist.songs?.length > 0 ? (
            <div className="flex flex-col gap-2">
              {playlist.songs.map((song, index) => (
                <SongRow 
                  key={song._id} 
                  song={song} 
                  index={index} 
                  queue={playlist.songs} 
                  currentSong={currentSong}
                  playing={playing}
                  setCurrentSong={setCurrentSong}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-32 bg-white/5 rounded-[40px] border-2 border-dashed border-white/5">
              <FaMusic className="text-8xl mx-auto mb-6 opacity-10" />
              <h3 className="text-2xl font-black italic mb-2">No songs in this playlist</h3>
              <p className="text-gray-500 font-medium">Add some music to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SongRow({ song, index, queue, currentSong, playing, setCurrentSong }) {
  const isCurrent = currentSong?._id === song._id
  const { user } = useAuth()
  const [liked, setLiked] = useState(false)

  useEffect(() => {
    if (user && song.likes) {
      setLiked(song.likes.some(id => (typeof id === 'string' ? id === user.id : id?._id === user.id)))
    }
  }, [song, user])
  
  const handlePlay = () => {
    setCurrentSong(song, queue)
  }

  const toggleLike = async (e) => {
    e.stopPropagation()
    const prev = liked
    setLiked(!prev)
    const res = await api.post(`/songs/${song._id}/like`).catch(() => null)
    if (!res) {
      setLiked(prev)
    }
  }

  return (
    <div 
      className={`group flex items-center gap-6 px-6 py-4 rounded-2xl hover:bg-white/5 transition-all cursor-pointer ${isCurrent ? 'bg-white/10 shadow-xl' : ''}`}
      onClick={handlePlay}
    >
      {/* Thumbnail / Play Button */}
      <div className="relative shrink-0">
        <img 
          src={song.coverImage || song.img || song.image || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=200&auto=format&fit=crop'} 
          alt="" 
          className="w-16 h-16 rounded-xl object-cover shadow-2xl group-hover:opacity-40 transition-opacity"
          onError={(e) => {
            e.currentTarget.src = 'https://images.unsplash.com/photo-1459749411177-042180ce673c?q=80&w=200&auto=format&fit=crop'
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          {isCurrent && playing ? (
            <div className="flex gap-1 items-end h-6">
              <div className="w-1.5 bg-white animate-[music-bar_0.6s_ease-in-out_infinite]"></div>
              <div className="w-1.5 bg-white animate-[music-bar_0.8s_ease-in-out_infinite]"></div>
              <div className="w-1.5 bg-white animate-[music-bar_0.7s_ease-in-out_infinite]"></div>
            </div>
          ) : (
            <FaPlay className="text-white text-xl" />
          )}
        </div>
      </div>

      {/* Title & Artist */}
      <div className="flex-1 min-w-0">
        <h4 className={`text-lg font-bold truncate ${isCurrent ? 'text-cyan-400' : 'text-white'}`}>
          {song.title}
        </h4>
        <p className="text-sm text-gray-500 font-bold truncate">
          {song.artist || 'Unknown Artist'} • {song.album || 'Single'}
        </p>
      </div>

      {/* Actions & Duration */}
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-4">
          <button className="text-gray-600 hover:text-white transition text-xl">
            <FaRegThumbsDown />
          </button>
          <button 
            onClick={toggleLike}
            className={`transition text-xl ${liked ? 'text-cyan-400' : 'text-gray-600 hover:text-white'}`}
          >
            <FaThumbsUp />
          </button>
          <button className="text-gray-600 hover:text-white transition text-xl">
            <FaEllipsisV />
          </button>
        </div>
        
        <div className="text-sm font-bold text-gray-500 tabular-nums w-12 text-right">
          {song.duration ? (typeof song.duration === 'number' ? `${Math.floor(song.duration / 60)}:${(song.duration % 60).toString().padStart(2, '0')}` : song.duration) : '3:30'}
        </div>
      </div>
    </div>
  )
}

export default PlaylistDetails
