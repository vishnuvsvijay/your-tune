import { useRef, useEffect, useState, useCallback } from 'react'
import { usePlayer } from '../store/player'
import { 
  FaPlay, FaPause, FaStepForward, FaStepBackward, 
  FaHeart, FaRegHeart, FaRegComment, FaEllipsisV, 
  FaDownload, FaMoon, FaRedo, FaTrash, FaShareAlt
} from 'react-icons/fa'
import { useAuth } from '../store/auth'
import api from '../services/api'
import { socket } from '../sockets'

import { getServerBase } from '../services/api'

function PlayerBar() {
  const audioRef = useRef(null)
  const { currentSong, playing, togglePlay, next, prev, queue, setCurrentSong, repeat, toggleRepeat } = usePlayer()
  const { user } = useAuth()

  const handleShare = async () => {
    if (!currentSong) return
    const url = `${window.location.origin}/?songId=${currentSong._id || currentSong.id}`
    const title = currentSong.title
    const text = `Listening to ${currentSong.title} by ${currentSong.artist}`
    
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url })
      } else {
        await navigator.clipboard.writeText(url)
        alert('Link copied to clipboard!')
      }
    } catch (err) {
      console.error('Error sharing:', err)
    }
  }

  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)

  // Sync state with audio element
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadedMetadata = () => {
      // Priority: 1. Native duration, 2. Song metadata duration
      const d = audio.duration || currentSong?.duration || 0
      setDuration(d)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
    }

    const handleEndedInternal = () => {
      if (repeat) {
        audio.currentTime = 0
        audio.play().catch(() => {})
      } else {
        next()
      }
    }

    const handleError = (e) => {
      console.error("[Player] Audio Error:", e)
      // Auto-skip on error if it's a streaming error
      if (currentSong) {
        console.warn("[Player] Skipping problematic track...")
        setTimeout(next, 1000)
      }
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEndedInternal)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEndedInternal)
      audio.removeEventListener('error', handleError)
    }
  }, [currentSong, next, repeat])
  const [liked, setLiked] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [replyTo, setReplyTo] = useState(null) // Comment ID we are replying to
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')

  // Sleep Timer States
  const [sleepTimer, setSleepTimer] = useState(null) // minutes
  const [timeLeft, setTimeLeft] = useState(0) // seconds
  const timerRef = useRef(null)

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00'
    const mins = Math.floor(time / 60)
    const secs = Math.floor(time % 60)
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  const handleDownload = async () => {
    if (!currentSong) return;
    try {
      const url = currentSong.fileUrl.startsWith('/uploads/') 
        ? `${getServerBase()}${currentSong.fileUrl}`
        : `/api/songs/stream-proxy?url=${encodeURIComponent(currentSong.fileUrl)}`;
      
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${currentSong.title} - ${currentSong.artist}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      setShowOptions(false);
    } catch (err) {
      console.error("Download failed", err);
      alert("Download failed. Please try again.");
    }
  };

  const startSleepTimer = (minutes) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSleepTimer(minutes);
    setTimeLeft(minutes * 60);
    setShowOptions(false);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          if (playing) togglePlay(); // Pause
          setSleepTimer(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopSleepTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSleepTimer(null);
    setTimeLeft(0);
    setShowOptions(false);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (currentSong && user) {
      setLiked(Array.isArray(currentSong.likes) && currentSong.likes.some(id => id === user.id || id?._id === user.id))
      fetchComments()
    }
  }, [currentSong, user])

  useEffect(() => {
    socket.on('song:liked', ({ songId, likes, userId, isLiked }) => {
      if (currentSong?._id === songId) {
        if (userId === user?.id) setLiked(isLiked)
      }
    })

    socket.on('song:comment', ({ songId, comment, isReply }) => {
      if (songId === currentSong?._id) {
        setComments(prev => {
          if (prev.some(c => c._id === comment._id)) return prev
          return [comment, ...prev]
        })
      }
    })

    socket.on('comment:liked', ({ commentId, likes, likedBy, songId }) => {
      if (songId === currentSong?._id) {
        setComments(prev => prev.map(c => 
          c._id === commentId ? { ...c, likes, likedBy } : c
        ))
      }
    })

    return () => {
      socket.off('song:liked')
      socket.off('song:comment')
      socket.off('comment:liked')
    }
  }, [currentSong?._id, user?.id])

  const fetchComments = async () => {
    if (!currentSong?._id) return
    try {
      const res = await api.get(`/songs/${currentSong._id}/comments`)
      setComments(res.data.data || [])
    } catch (err) {
      setComments([])
    }
  }

  const handleLike = async () => {
    if (!currentSong || !user) return
    try {
      if (currentSong._id) {
        const res = await api.post(`/songs/${currentSong._id}/like`)
        if (res.data.data) {
          const isLiked = res.data.data.likes.some(id => id === user.id || id?._id === user.id)
          setLiked(isLiked)
          setCurrentSong({ ...currentSong, likes: res.data.data.likes }, queue)
        }
      } else {
        const payload = {
          title: currentSong.title,
          artist: currentSong.artist,
          fileUrl: currentSong.fileUrl,
          coverImage: currentSong.coverImage || currentSong.img
        }
        const res = await api.post('/songs/like-any', payload)
        if (res.data.data) {
          setLiked(true)
          setCurrentSong({ ...currentSong, _id: res.data.data._id, likes: res.data.data.likes }, queue)
        }
      }
    } catch (err) {
      console.error("Like failed", err)
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim() || !currentSong?._id || !user) return
    try {
      const payload = { 
        text: newComment,
        parentId: replyTo?._id || null 
      }
      await api.post(`/songs/${currentSong._id}/comments`, payload)
      setNewComment('')
      setReplyTo(null)
    } catch (err) {
      console.error("Comment failed", err)
    }
  }

  const handleLikeComment = async (commentId) => {
    if (!user) return
    try {
      await api.post(`/songs/comments/${commentId}/like`)
    } catch (err) {
      console.error("Like comment failed", err)
    }
  }

  useEffect(() => {
    if (!currentSong || !audioRef.current) return
    const audio = audioRef.current
    
    // Construct the stream URL correctly
    let rawUrl = currentSong.fileUrl || currentSong.url || ''
    if (!rawUrl) return

    let streamUrl = rawUrl
    if (!rawUrl.startsWith('/uploads/')) {
      streamUrl = `/api/songs/stream-proxy?url=${encodeURIComponent(rawUrl)}`
    }

    const targetSrc = window.location.origin + streamUrl

    if (audio.src !== targetSrc) {
      console.log("[Player] Source change. New target:", targetSrc)
      audio.pause()
      audio.src = streamUrl
      audio.load()
      
      // Auto-play if we are in playing state
      if (playing) {
        audio.play().catch(err => {
          if (err.name !== 'AbortError') console.error("[Player] Initial play error:", err.message)
        })
      }

      // Record this play event
      const songId = currentSong._id || currentSong.id || 'new'
      api.post(`/songs/${songId}/play`, {
        title: currentSong.title,
        artist: currentSong.artist,
        fileUrl: currentSong.fileUrl,
        coverImage: currentSong.coverImage || currentSong.img
      }).then(res => {
        // If a new song was created, update its _id locally so we can like/comment it
        if (res.data?.songId && !currentSong._id) {
          setCurrentSong({ ...currentSong, _id: res.data.songId }, queue)
        }
      }).catch(err => console.error("Play recording failed", err))
    }
  }, [currentSong])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (playing) {
      audio.play().catch(err => {
        if (err.name !== 'AbortError') console.error("[Player] Play error:", err.message)
      })
    } else {
      audio.pause()
    }
  }, [playing, currentSong])

  if (!currentSong) return null


  return (
    <div className="fixed bottom-0 left-0 right-0 h-20 md:h-24 bg-[#0a0a0b]/95 backdrop-blur-xl border-t border-white/5 flex items-center px-4 md:px-6 z-[200] shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
      <audio
        ref={audioRef}
        onCanPlay={() => {
          if (playing) {
            audioRef.current.play().catch(err => {
              if (err.name !== 'AbortError') console.error("[Player] onCanPlay Error:", err.message)
            })
          }
        }}
        onStalled={() => console.warn("Audio playback stalled...")}
        onWaiting={() => console.log("Audio playback waiting for data...")}
      />

      {/* Progress Bar (Top) */}
      <div 
        className="absolute top-0 left-0 right-0 h-1 bg-white/10 cursor-pointer group"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const percent = (e.clientX - rect.left) / rect.width
          if (audioRef.current) audioRef.current.currentTime = percent * duration
        }}
      >
        <div 
          className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 relative transition-all duration-100"
          style={{ width: `${(currentTime / duration) * 100}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </div>
      </div>

      {/* LEFT: Controls & Time */}
      <div className="flex items-center gap-4 md:gap-8 w-auto md:w-[30%]">
        <div className="flex items-center gap-2 md:gap-6">
          <button 
            onClick={toggleRepeat} 
            className={`transition text-xs md:text-sm ${repeat ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'text-gray-500 hover:text-white'}`}
            title="Repeat Mode"
          >
            <FaRedo />
          </button>
          <button onClick={prev} className="text-white hover:text-cyan-400 transition text-lg md:text-xl">
            <FaStepBackward />
          </button>
          <button 
            onClick={togglePlay} 
            className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 active:scale-95 transition shadow-lg"
          >
            {playing ? <FaPause size={14} /> : <FaPlay size={14} className="ml-1" />}
          </button>
          <button onClick={next} className="text-white hover:text-cyan-400 transition text-lg md:text-xl">
            <FaStepForward />
          </button>
        </div>
        <div className="flex items-center gap-2 tabular-nums hidden sm:flex">
          <span className="text-[10px] md:text-xs text-white/40 min-w-[30px] text-right font-bold tracking-widest">
            {formatTime(currentTime)}
          </span>
          <span className="text-[10px] md:text-xs text-white/20">/</span>
          <span className="text-[10px] md:text-xs text-white/40 min-w-[30px] font-bold tracking-widest">
            {formatTime(duration || currentSong?.duration || 0)}
          </span>
        </div>
      </div>

      {/* CENTER: Song Info */}
      <div className="flex-1 flex items-center justify-center px-4 min-w-0">
        <div className="flex items-center gap-3 md:gap-4 max-w-full">
          <div className="relative group shrink-0">
            <img 
              src={currentSong.coverImage || currentSong.img || `https://api.dicebear.com/7.x/identicon/svg?seed=${currentSong.title}`} 
              className={`w-10 h-10 md:w-14 md:h-14 rounded-lg object-cover shadow-2xl transition-transform duration-500 ${playing ? 'animate-[pulse_4s_infinite]' : ''}`} 
              alt="" 
            />
            <div className={`absolute -inset-1 bg-cyan-500/20 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity ${playing ? 'opacity-100' : ''}`}></div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-black text-xs md:text-base truncate tracking-tight group-hover:text-cyan-400 transition cursor-default">{currentSong.title}</h3>
              <button 
                onClick={handleShare}
                className="text-gray-500 hover:text-cyan-400 transition-colors"
                title="Share"
              >
                <FaShareAlt size={10} />
              </button>
            </div>
            <p className="text-[9px] md:text-xs text-gray-500 font-bold uppercase tracking-widest truncate">{currentSong.artist || 'Unknown Artist'}</p>
          </div>
        </div>
      </div>

      {/* RIGHT: Extra Actions */}
      <div className="w-auto md:w-[30%] flex items-center justify-end gap-3 md:gap-6 relative">
        {sleepTimer && (
          <div className="hidden sm:flex items-center gap-2 text-[10px] md:text-xs font-bold text-cyan-400 animate-pulse bg-white/5 px-2 md:px-3 py-1 md:py-1.5 rounded-full border border-cyan-500/20">
            <FaMoon size={8} />
            <span>{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
          </div>
        )}

        <button 
          onClick={handleLike}
          className={`${liked ? 'text-red-500' : 'text-gray-500'} hover:text-red-500 transition-all active:scale-90`}
          title={liked ? "Remove from Liked" : "Add to Liked"}
        >
          {liked ? <FaHeart size={18} /> : <FaRegHeart size={18} />}
        </button>
        <button 
          onClick={() => setShowComments(!showComments)}
          className={`${showComments ? 'text-cyan-400' : 'text-gray-500'} hover:text-cyan-400 transition-all active:scale-90`}
          title="Comments"
        >
          <FaRegComment size={18} />
        </button>
        <button 
          onClick={() => setShowOptions(!showOptions)}
          className={`${showOptions ? 'text-cyan-400' : 'text-gray-500'} hover:text-cyan-400 transition-all active:scale-90`}
          title="More Options"
        >
          <FaEllipsisV size={18} />
        </button>

        {/* Options Menu */}
        {showOptions && (
          <div className="absolute bottom-[70px] md:bottom-[80px] right-0 w-[200px] md:w-[240px] bg-[#121214] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 duration-300 z-[110]">
            <div className="p-2 space-y-1">
              <button 
                onClick={handleShare}
                className="w-full flex items-center gap-3 md:gap-4 px-3 md:px-4 py-2 md:py-3 hover:bg-white/5 transition text-xs md:text-sm font-bold text-gray-300 rounded-xl"
              >
                <FaShareAlt className="text-gray-500" />
                <span>Share Song</span>
              </button>

              <button 
                onClick={handleDownload}
                className="w-full flex items-center gap-3 md:gap-4 px-3 md:px-4 py-2 md:py-3 hover:bg-white/5 transition text-xs md:text-sm font-bold text-gray-300 rounded-xl"
              >
                <FaDownload className="text-gray-500" />
                <span>Download Song</span>
              </button>

              <button 
                onClick={toggleRepeat}
                className={`w-full flex items-center gap-3 md:gap-4 px-3 md:px-4 py-2 md:py-3 hover:bg-white/5 transition text-xs md:text-sm font-bold rounded-xl ${repeat ? 'text-cyan-400' : 'text-gray-300'}`}
              >
                <FaRedo className={repeat ? 'text-cyan-400' : 'text-gray-500'} />
                <span>Repeat: {repeat ? 'ON' : 'OFF'}</span>
              </button>

              <button 
                onClick={handleLike}
                className={`w-full flex items-center gap-3 md:gap-4 px-3 md:px-4 py-2 md:py-3 hover:bg-white/5 transition text-xs md:text-sm font-bold rounded-xl ${liked ? 'text-red-500' : 'text-gray-300'}`}
              >
                {liked ? <FaTrash className="text-red-500" /> : <FaHeart className="text-gray-500" />}
                <span>{liked ? 'Remove' : 'Add to Liked'}</span>
              </button>

              <div className="h-px bg-white/5 my-1 mx-2" />

              <div className="px-3 md:px-4 py-2">
                <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 md:mb-3 flex items-center gap-2">
                  <FaMoon size={8} /> Sleep Timer
                </p>
                <div className="grid grid-cols-3 gap-1 md:gap-2">
                  {[15, 30, 60].map(mins => (
                    <button 
                      key={mins}
                      onClick={() => startSleepTimer(mins)}
                      className={`py-1.5 md:py-2 rounded-lg text-[8px] md:text-[10px] font-black border transition ${sleepTimer === mins ? 'bg-cyan-500 border-cyan-500 text-black' : 'border-white/10 text-gray-400 hover:border-white/20'}`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
                {sleepTimer && (
                  <button 
                    onClick={stopSleepTimer}
                    className="w-full mt-2 md:mt-3 py-1.5 md:py-2 text-[8px] md:text-[10px] font-black text-red-500 hover:bg-red-500/10 rounded-lg transition"
                  >
                    CANCEL TIMER
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Comments Overlay */}
        {showComments && (
          <div className="absolute bottom-[70px] md:bottom-[80px] right-0 w-[280px] md:w-[350px] max-h-[400px] md:max-h-[500px] bg-[#121214] border border-white/10 rounded-2xl shadow-2xl flex flex-col p-3 md:p-4 overflow-hidden animate-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h4 className="text-[10px] md:text-xs font-black uppercase tracking-widest text-cyan-400">Comments</h4>
              {replyTo && (
                <button 
                  onClick={() => setReplyTo(null)}
                  className="text-[8px] md:text-[10px] text-orange-500 font-bold hover:underline"
                >
                  Cancel Reply
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 md:space-y-4 custom-scrollbar pr-1 md:pr-2 mb-3 md:mb-4">
              {comments.length > 0 ? (
                comments
                  .filter(c => !c.parentId) // Main comments first
                  .map((c) => (
                  <div key={c._id} className="space-y-2 md:space-y-3">
                    <div className="bg-white/5 p-2 md:p-3 rounded-xl border border-white/[0.02] group">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[8px] md:text-[10px] font-black text-white/60 uppercase truncate">{c.name}</span>
                        <div className="flex items-center gap-2 md:gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setReplyTo(c)}
                            className="text-[8px] md:text-[10px] text-cyan-500 font-bold hover:text-white"
                          >
                            REPLY
                          </button>
                          <button 
                            onClick={() => handleLikeComment(c._id)}
                            className={`flex items-center gap-1 text-[8px] md:text-[10px] font-bold ${c.likedBy?.includes(user?.id) ? 'text-red-500' : 'text-gray-500 hover:text-white'}`}
                          >
                            <FaHeart size={7} /> {c.likes || 0}
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] md:text-xs text-white/80 leading-relaxed">{c.text}</p>
                    </div>

                    {/* Replies */}
                    <div className="ml-4 md:ml-6 space-y-1 md:y-2">
                      {comments
                        .filter(r => r.parentId === c._id)
                        .map(reply => (
                          <div key={reply._id} className="bg-white/[0.02] p-1.5 md:p-2 rounded-lg border border-white/[0.01] flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[7px] md:text-[9px] font-black text-white/40 uppercase">{reply.name}</span>
                              <button 
                                onClick={() => handleLikeComment(reply._id)}
                                className={`flex items-center gap-1 text-[7px] md:text-[9px] font-bold ${reply.likedBy?.includes(user?.id) ? 'text-red-500' : 'text-gray-500'}`}
                              >
                                <FaHeart size={6} /> {reply.likes || 0}
                              </button>
                            </div>
                            <p className="text-[9px] md:text-[11px] text-white/60">{reply.text}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[8px] md:text-[10px] text-gray-500 italic text-center py-10">No comments yet.</p>
              )}
            </div>

            <div className="relative">
              {replyTo && (
                <div className="absolute -top-5 md:-top-6 left-0 text-[7px] md:text-[9px] text-cyan-500 font-bold uppercase tracking-widest bg-[#121214] px-1 md:px-2 py-0.5 md:py-1 rounded-t-lg border-x border-t border-white/10">
                  Replying to {replyTo.name}
                </div>
              )}
              <input 
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                placeholder={replyTo ? `Reply...` : "Write a comment..."}
                className={`w-full bg-white/5 border border-white/10 rounded-xl py-2 md:py-3 pl-3 md:pl-4 pr-10 md:pr-12 text-[10px] md:text-xs outline-none focus:border-cyan-500 transition ${replyTo ? 'rounded-tl-none border-t-cyan-500/50' : ''}`}
              />
              <button 
                onClick={handleAddComment}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-cyan-500 hover:text-cyan-400 font-black text-[8px] md:text-[10px] uppercase tracking-widest px-1 md:px-2"
              >
                {replyTo ? 'Reply' : 'Send'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PlayerBar