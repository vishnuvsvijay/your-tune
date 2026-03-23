import { useEffect, useState, useMemo } from 'react'
import Navbar from '../components/Navbar'
import { useAuth } from '../store/auth'
import { usePlayer } from '../store/player'
import api from '../services/api'
import { socket } from '../sockets'
import { FaPlay, FaHistory, FaRegHeart, FaEllipsisV, FaRandom, FaThumbsUp, FaRegThumbsDown } from 'react-icons/fa'
import { IoShuffleOutline } from 'react-icons/io5'

function ReplayMix() {
  const { user } = useAuth()
  const { currentSong, playing, setCurrentSong } = usePlayer()
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/songs/replay-mix')
      setSongs(res.data.data || [])
    } catch (err) {
      console.error("Failed to load replay mix", err)
      setSongs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    
    // Listen for real-time play events to update the list
    const onReplayUpdate = () => {
      load()
    }

    socket.on('replay:updated', onReplayUpdate)
    return () => {
      socket.off('replay:updated', onReplayUpdate)
    }
  }, [user?.id])

  const handlePlayAll = () => {
    if (songs.length > 0) {
      setCurrentSong(songs[0], songs)
    }
  }

  const handleShuffle = () => {
    if (songs.length > 0) {
      const shuffled = [...songs].sort(() => Math.random() - 0.5)
      setCurrentSong(shuffled[0], shuffled)
    }
  }

  const isCurrentPlaylistPlaying = useMemo(() => {
    return playing && songs.some(s => s._id === currentSong?._id)
  }, [playing, songs, currentSong])

  return (
    <div className="min-h-screen bg-[#030303] text-white font-sans pb-24 overflow-y-auto custom-scrollbar">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row items-center md:items-end gap-10 mb-10 bg-gradient-to-b from-blue-900/30 to-transparent p-10 rounded-[40px]">
          {/* Large Cover Image */}
          <div className="relative group shrink-0">
            <div className="w-64 h-64 md:w-80 md:h-80 rounded-[32px] bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-[0_20px_50px_rgba(0,255,255,0.2)] overflow-hidden relative">
              <FaHistory className="text-white text-[160px] drop-shadow-2xl" />
              <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors"></div>
            </div>
          </div>

          {/* Info Section */}
          <div className="flex-1 flex flex-col items-center md:items-start gap-6 text-center md:text-left">
            <div>
              <h1 className="text-6xl md:text-8xl font-black mb-4 tracking-tighter italic uppercase">Replay Mix</h1>
              <div className="flex items-center justify-center md:justify-start gap-3 text-xl font-bold">
                <div className="w-10 h-10 rounded-full bg-[#3d3d3d] flex items-center justify-center text-sm border border-white/10 shadow-lg">
                  {user?.name?.[0]?.toUpperCase() || 'U'}
                </div>
                <span className="text-gray-300">{user?.name || 'User'}</span>
              </div>
            </div>

            <div className="flex flex-col gap-1 text-gray-400 font-bold">
              <p>Personalized mix • {new Date().getFullYear()}</p>
              <p>{songs.length} songs • {Math.floor(songs.length * 3.5 / 60)} hours {Math.floor(songs.length * 3.5 % 60)} minutes</p>
              <p className="max-w-md mt-4 text-sm leading-relaxed opacity-60">
                Your most played songs in one place. Updated in real-time as you listen.
              </p>
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
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : songs.length > 0 ? (
            <div className="flex flex-col gap-2">
              {songs.map((song, index) => (
                <SongRow 
                  key={song._id} 
                  song={song} 
                  index={index} 
                  queue={songs} 
                  currentSong={currentSong}
                  playing={playing}
                  setCurrentSong={setCurrentSong}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-32 bg-white/5 rounded-[40px] border-2 border-dashed border-white/5">
              <FaHistory className="text-8xl mx-auto mb-6 opacity-10" />
              <h3 className="text-2xl font-black italic mb-2">No history yet</h3>
              <p className="text-gray-500 font-medium">Start listening to songs and your Replay Mix will appear here.</p>
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
      alert('Failed to update like status')
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
          <button 
            onClick={toggleLike}
            className={`transition text-xl ${liked ? 'text-cyan-400' : 'text-gray-600 hover:text-white'}`}
          >
            {liked ? <FaThumbsUp /> : <FaThumbsUp />}
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

export default ReplayMix
