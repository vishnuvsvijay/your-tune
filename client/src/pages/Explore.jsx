import { useEffect, useState } from 'react'
import api from '../services/api'
import SongCard from '../components/SongCard'
import Navbar from '../components/Navbar'

function Explore() {
  const [trending, setTrending] = useState([])
  const [topPlayed, setTopPlayed] = useState([])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const [t, top] = await Promise.all([
        api.get('/search/trending').catch(() => null),
        api.get('/songs/top-liked').catch(() => null),
      ])
      if (!mounted) return
      const tr = (t?.data?.data || []).map((r) => ({
        id: r.id || r.externalId,
        title: r.title,
        artist: r.artist,
        img: r.coverImage || r.img || r.image,
        coverImage: r.coverImage || r.img || r.image,
        fileUrl: r.fileUrl || r.url,
        likes: []
      }))
      const tp = (top?.data?.data || []).map((r) => ({
        id: r._id || r.id,
        title: r.title,
        artist: r.artist,
        img: r.coverImage || r.img || r.image,
        coverImage: r.coverImage || r.img || r.image,
        fileUrl: r.fileUrl || r.url,
        likes: r.likes || []
      }))
      setTrending(tr)
      setTopPlayed(tp)
    }
    load()
    return () => { mounted = false }
  }, [])

  return (
    <div className="min-h-screen bg-neutral-900 text-white pb-32">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 py-6">
        <h1 className="text-2xl font-black italic text-cyan-400 uppercase mb-6">Explore</h1>
        <section className="mb-10">
          <h2 className="text-xl font-black mb-4">Trending</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {trending.length > 0 ? trending.map((song) => (
              <SongCard key={song.id} song={song} queue={trending} />
            )) : (
              <p className="opacity-60 col-span-full">No trending songs available.</p>
            )}
          </div>
        </section>
        <section>
          <h2 className="text-xl font-black mb-4">Top Played</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {topPlayed.length > 0 ? topPlayed.map((song) => (
              <SongCard key={song.id} song={song} queue={topPlayed} />
            )) : (
              <p className="opacity-60 col-span-full">No top played songs yet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

export default Explore
