import { usePlayer } from '../store/player'
import api from '../services/api'
import { useAuth } from '../store/auth'
import { FaPlay, FaHeart, FaRegHeart } from 'react-icons/fa'
import { useState, useEffect } from 'react'
import { socket } from '../sockets'

function SongCard({ song, queue }) {
  const { currentSong, setCurrentSong } = usePlayer()
  const { user } = useAuth()
  const [liked, setLiked] = useState(false)

  useEffect(() => {
    if (user && song) {
      const isLiked = Array.isArray(song.likes) && song.likes.some(id => 
        (typeof id === 'string' ? id === user.id : id?._id === user.id)
      )
      setLiked(isLiked)
    }
  }, [song, user])

  useEffect(() => {
    const onLike = ({ songId, likes, userId, isLiked }) => {
      if ((song._id === songId || song.id === songId) && userId === user?.id) {
        setLiked(isLiked)
      }
    }
    socket.on('song:liked', onLike)
    return () => socket.off('song:liked', onLike)
  }, [song, user])

  const handlePlay = (e) => {
    // If clicking on like button, don't play
    if (e.target.closest('.like-btn')) return

    const initialUrl = song.fileUrl || song.audio || song.url || ''
    setCurrentSong({ 
      ...song, 
      fileUrl: initialUrl, 
      coverImage: song.coverImage || song.img 
    }, queue)
  }

  const handleLike = async (e) => {
    e.stopPropagation()
    if (!user) return
    try {
      if (song._id) {
        const res = await api.post(`/songs/${song._id}/like`)
        if (res.data.data) {
          setLiked(res.data.data.likes.some(id => (typeof id === 'string' ? id === user.id : id?._id === user.id)))
        }
      } else {
        const payload = {
          title: song.title,
          artist: song.artist,
          fileUrl: song.fileUrl,
          coverImage: song.coverImage || song.img
        }
        const res = await api.post('/songs/like-any', payload)
        if (res.data.data) {
          setLiked(true)
        }
      }
    } catch (err) {
      console.error("Like failed", err)
    }
  }

  return (
    <div className="group bg-[#1a1a1e] rounded-2xl p-4 hover:bg-[#25252b] transition-all duration-300 border border-white/5 cursor-pointer" onClick={handlePlay}>
      <div className="relative aspect-square rounded-xl overflow-hidden mb-4 shadow-2xl">
        <img
          src={song.coverImage || song.img || song.image || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=600&auto=format&fit=crop'}
          alt=""
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
          <div className="w-14 h-14 bg-cyan-400 rounded-full flex items-center justify-center text-black shadow-2xl transform scale-90 group-hover:scale-100 transition-transform duration-300">
            <FaPlay className="ml-1 text-white text-xl" />
          </div>
        </div>
        <button 
          onClick={handleLike}
          className={`like-btn absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 ${liked ? 'text-red-500 opacity-100' : 'text-white hover:text-red-500'}`}
        >
          {liked ? <FaHeart size={16} /> : <FaRegHeart size={16} />}
        </button>
      </div>
      <div className="space-y-1 px-1">
        <h3 className="font-bold text-white truncate text-base leading-tight">{song.title}</h3>
        <p className="text-xs text-gray-500 truncate uppercase tracking-wider font-medium">{song.artist || 'Unknown Artist'}</p>
      </div>
    </div>
  )
}

export default SongCard
