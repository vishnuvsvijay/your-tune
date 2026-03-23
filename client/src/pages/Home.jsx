import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../store/auth';
import { Link } from 'react-router-dom';
import { FaPlus, FaSearch, FaPlay, FaHeart, FaRegComment, FaSignOutAlt, FaThumbsUp, FaEllipsisV, FaBars, FaTimes, FaChartBar, FaHistory } from 'react-icons/fa';
import { FiHome, FiCompass } from 'react-icons/fi';
import { MdLibraryMusic } from 'react-icons/md';
import { socket } from '../sockets';
import { usePlayer } from '../store/player';
import { useSearch } from '../store/search';
import SongCard from '../components/SongCard';
import Navbar from '../components/Navbar';

const Home = () => {
  const { token, user, logout } = useAuth();
  const { setCurrentSong } = usePlayer();
  const { searchQuery, searchResults, searching, setSearchQuery, clearSearch } = useSearch();
  
  const [likedSongs, setLikedSongs] = useState([]);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [selectedSongs, setSelectedSongs] = useState([]);
  const [availableSongs, setAvailableSongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [publicPlaylists, setPublicPlaylists] = useState([]);
  const [modalSearch, setModalSearch] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [trending, setTrending] = useState([]);
  const [topPlayed, setTopPlayed] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile sidebar state

  // --- CORE LOGIC ---
  const loadHomeData = async () => {
    try {
      const [songsRes, trendingRes, topRes] = await Promise.all([
        api.get('/songs').catch(() => null),
        api.get('/search/trending').catch(() => null),
        api.get('/songs/top-liked').catch(() => null),
      ]);

      const list = songsRes?.data?.data || [];
      setAvailableSongs(list);
      if (user?.id) {
        const liked = list.filter((s) =>
          Array.isArray(s.likes) &&
          s.likes.some((u) => (typeof u === 'string' ? u === user.id : u?._id === user.id))
        );
        setLikedSongs(liked);
      }

      setTrending((trendingRes?.data?.data || []).map(r => ({
        id: r.id || r.externalId,
        title: r.title,
        artist: r.artist,
        img: r.coverImage || r.img || r.image,
        fileUrl: r.fileUrl || r.url,
        likes: []
      })));

      setTopPlayed((topRes?.data?.data || []).map(r => ({
        id: r._id || r.id,
        title: r.title,
        artist: r.artist,
        img: r.coverImage || r.img || r.image,
        fileUrl: r.fileUrl || r.url,
        likes: r.likes || []
      })));
    } catch (err) {
      console.error("Failed to load home data", err);
    }
  };

  const loadPlaylists = async () => {
    try {
      const [mine, pub] = await Promise.all([
        api.get('/playlists/me').catch(() => null),
        api.get('/playlists/public').catch(() => null)
      ]);
      if (mine?.data?.data) setPlaylists(mine.data.data);
      if (pub?.data?.data) setPublicPlaylists(pub.data.data);
    } catch { setPlaylists([]); setPublicPlaylists([]); }
  };

  useEffect(() => {
    loadHomeData();
    loadPlaylists();

    // Real-time listeners
    socket.on('song:liked', ({ songId, likes, userId: likerId }) => {
      loadHomeData();
    });

    socket.on('song:comment', ({ songId, comment }) => {
      // Logic for real-time comment notification or update if needed
    });

    socket.on('playlist:updated', () => {
      loadPlaylists();
    });

    socket.on('song:created', () => {
      loadHomeData();
    });

    return () => {
      socket.off('song:liked');
      socket.off('song:comment');
      socket.off('playlist:updated');
      socket.off('song:created');
    };
  }, [user?.id]);

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    searchQueryRef.current = query;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!query.trim()) { 
      setSearchResults([]); 
      setSearching(false);
      return; 
    }
    
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const queryVal = query.trim();
      try {
        // Combined search (Admin + YouTube) from server
        const res = await api.get(`/songs/search?q=${queryVal}`).catch(err => {
          console.error("[Search] Server error:", err);
          return null;
        });
        
        const results = res?.data?.data || [];
        setSearchResults(results);
      } catch (err) {
        console.error("[Search] Global error:", err);
      } finally {
        setSearching(false);
      }
    }, 400); // Standard debounce
  }, []);

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    try {
      await api.post('/playlists', { 
        name: newPlaylistName,
        songs: selectedSongs 
      });
      setSuccessMessage(`Your playlist "${newPlaylistName}" is ready!`);
      setNewPlaylistName('');
      setSelectedSongs([]);
      setTimeout(() => {
        setSuccessMessage("");
        setShowCreatePlaylist(false);
      }, 3000);
      // Real-time update will be handled by the socket listener
    } catch (err) {
      console.error("Failed to create playlist", err);
    }
  };

  const toggleSongSelection = (songId) => {
    setSelectedSongs(prev => {
      if (prev.includes(songId)) {
        return prev.filter(id => id !== songId);
      }
      if (prev.length >= 20) {
        alert("You can only select up to 20 songs!");
        return prev;
      }
      return [...prev, songId];
    });
  };

  const playSong = (song, queue) => {
    setCurrentSong(song, queue);
  };

  return (
    <div className="flex h-screen bg-[#0a0a0b] text-white font-sans overflow-hidden relative">
      
      {/* SIDEBAR - Desktop & Mobile */}
      <aside className={`fixed inset-y-0 left-0 z-[150] w-72 flex flex-col p-6 bg-black border-r border-white/5 transition-transform duration-300 lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-10 flex items-center justify-between">
          <h1 className="text-2xl font-black italic tracking-tighter flex gap-2">
            <span className="text-cyan-400 uppercase">Your</span>
            <span className="text-yellow-400 uppercase">Tunes</span>
          </h1>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-white">
            <FaTimes size={20} />
          </button>
        </div>

        <nav className="space-y-4 mb-10 overflow-y-auto custom-scrollbar">
          <Link to="/" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 text-white hover:text-cyan-400 transition font-bold text-lg">
            <FiHome className="text-orange-400" /> <span>Home</span>
          </Link>
          <Link to="/explore" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 text-gray-400 hover:text-white transition font-bold text-lg">
            <FiCompass className="text-yellow-600" /> <span>Explore</span>
          </Link>
          <Link to="/library" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 text-gray-400 hover:text-white transition font-bold text-lg">
            <MdLibraryMusic className="text-green-400" /> <span>Library</span>
          </Link>
          <Link to="/liked" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 text-gray-400 hover:text-white transition font-bold text-lg">
            <FaHeart className="text-pink-500" /> <span>Liked music</span>
          </Link>
          <button onClick={() => { setShowCreatePlaylist(true); setIsSidebarOpen(false); }} className="flex items-center gap-4 text-gray-400 hover:text-white transition font-bold text-lg w-full text-left">
            <FaPlus className="text-purple-500" /> <span>New playlist</span>
          </button>
        </nav>

        <div className="mt-2 mb-8 space-y-2 overflow-y-auto max-h-40 custom-scrollbar pr-2">
          {playlists.map((pl) => (
            <Link 
              to={`/playlist/${pl._id}`}
              key={pl._id} 
              onClick={() => setIsSidebarOpen(false)}
              className="block text-sm text-gray-500 hover:text-white transition truncate font-medium"
            >
              {pl.name}
            </Link>
          ))}
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Liked Music</h2>
            <Link to="/liked" onClick={() => setIsSidebarOpen(false)} className="text-xs text-cyan-500 hover:underline">Open</Link>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
            {likedSongs.length > 0 ? (
              likedSongs.map((song) => (
                <div key={song._id} onClick={() => { playSong(song, likedSongs); setIsSidebarOpen(false); }} className="flex items-center gap-3 group cursor-pointer">
                  <img src={song.coverImage} className="w-10 h-10 rounded shadow-lg object-cover" alt="" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate group-hover:text-cyan-400 transition">{song.title}</p>
                    <p className="text-[10px] text-gray-500 truncate">{song.artist || 'Unknown Artist'}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-600 italic">No liked songs yet</p>
            )}
          </div>
        </div>
      </aside>

      {/* MOBILE OVERLAY */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[140] lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-[#111114]">
        <Navbar />
        {/* HEADER (Minimal) */}
        <header className="flex flex-col md:flex-row items-center justify-between px-4 md:px-8 py-4 md:py-6 bg-black/40 backdrop-blur-md gap-4">
          <div className="flex items-center justify-between w-full md:w-auto gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-gray-400 hover:text-white">
              <FaBars size={24} />
            </button>
            <div className="text-xs md:text-sm">
              <span className="text-gray-500 hidden sm:inline">Welcome back, </span>
              <p className="font-bold text-gray-300 truncate max-w-[120px] sm:max-w-none">{user?.name || user?.email || 'Guest'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto justify-end">
            <button 
              onClick={() => setShowCreatePlaylist(true)}
              className="bg-cyan-600/20 hover:bg-cyan-500/30 text-cyan-400 px-4 md:px-6 py-1.5 md:py-2 rounded-full text-[10px] md:text-sm font-bold transition border border-cyan-500/30 whitespace-nowrap"
            >
              + New Playlist
            </button>
          </div>
        </header>

        {/* RESULTS GRID */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-32 md:pb-36 custom-scrollbar">
          {searchQuery.trim() ? (
            <>
              <div className="mb-8">
                <h2 className="text-3xl font-black italic text-cyan-400 flex items-center gap-3">
                  <span className="w-1.5 h-8 bg-cyan-400 rounded-full inline-block"></span>
                  RESULTS
                </h2>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {searching ? (
                  <div className="col-span-full flex flex-col items-center justify-center py-20 text-cyan-500">
                    <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-xl font-bold italic">Searching tunes...</p>
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map(song => (
                    <SongCard key={song.id} song={song} queue={searchResults} />
                  ))
                ) : (
                  <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-600">
                    <FaSearch className="text-6xl mb-4 opacity-20" />
                    <p className="text-xl font-bold">No results found for "{searchQuery}"</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-12">
              {/* FRESH FINDS SECTION */}
              <section>
                <div className="mb-8">
                  <h2 className="text-3xl font-black italic text-white flex items-center gap-3">
                    <span className="w-1.5 h-8 bg-white/20 rounded-full inline-block"></span>
                    Fresh finds, old favourites
                  </h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {/* LIKED MUSIC CARD */}
                  <Link to="/liked" className="group relative bg-gradient-to-br from-[#ff00ff] to-[#7f00ff] rounded-2xl p-6 aspect-square flex flex-col justify-end overflow-hidden shadow-2xl transition-transform hover:scale-[1.02]">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20 group-hover:scale-110 transition-transform">
                      <FaThumbsUp className="text-white text-[120px]" />
                    </div>
                    <div className="absolute top-4 right-4 text-white/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      <FaEllipsisV />
                    </div>
                    <div className="relative z-10">
                      <h3 className="text-2xl font-black italic text-white mb-1">Liked music</h3>
                      <p className="text-sm font-medium text-white/60">Auto playlist</p>
                    </div>
                    <div className="absolute bottom-6 right-6 w-14 h-14 bg-white rounded-full flex items-center justify-center text-black opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all shadow-xl">
                      <FaPlay className="ml-1 text-xl" />
                    </div>
                  </Link>
                  
                  {/* REPLAY MIX CARD */}
                  <Link to="/replay-mix" className="group relative bg-[#1a1a1e] rounded-2xl p-6 aspect-square flex flex-col justify-end overflow-hidden border border-white/5 transition-transform hover:scale-[1.02] cursor-pointer shadow-2xl">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10 group-hover:scale-110 transition-transform">
                      <FaHistory className="text-white text-[120px]" />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent"></div>
                    <div className="absolute top-4 right-4 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity">
                      <FaEllipsisV />
                    </div>
                    <div className="relative z-10">
                      <h3 className="text-2xl font-black italic text-white mb-1">Replay Mix</h3>
                      <p className="text-sm font-medium text-white/40">Your recently played</p>
                    </div>
                    <div className="absolute bottom-6 right-6 w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all shadow-xl">
                      <FaPlay className="ml-1 text-xl" />
                    </div>
                  </Link>
                </div>
              </section>

              {/* PUBLIC PLAYLISTS SECTION */}
              {publicPlaylists.length > 0 && (
                <section>
                  <div className="mb-8">
                    <h2 className="text-3xl font-black italic text-cyan-400 flex items-center gap-3">
                      <span className="w-1.5 h-8 bg-cyan-400 rounded-full inline-block"></span>
                      Community Playlists
                    </h2>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {publicPlaylists.map((pl) => (
                      <Link 
                        to={`/playlist/${pl._id}`}
                        key={pl._id} 
                        className="group bg-[#1a1a1e] rounded-2xl p-4 hover:bg-[#25252b] transition-all border border-white/5 cursor-pointer shadow-xl hover:scale-[1.02]"
                      >
                        <div className="relative aspect-square rounded-xl overflow-hidden mb-4 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
                          {pl.songs[0]?.coverImage ? (
                            <img src={pl.songs[0].coverImage} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <MdLibraryMusic className="text-4xl text-white/20" />
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <div className="w-12 h-12 bg-cyan-500 rounded-full flex items-center justify-center text-black">
                              <FaPlay className="ml-1" />
                            </div>
                          </div>
                        </div>
                        <h3 className="font-bold text-white truncate">{pl.name}</h3>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">
                          {pl.songs.length} tracks • By {pl.userId?.name || 'Community'}
                        </p>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* TRENDING SECTION */}
              <section>
                <div className="mb-8">
                  <h2 className="text-3xl font-black italic text-orange-500 flex items-center gap-3">
                    <span className="w-1.5 h-8 bg-orange-500 rounded-full inline-block"></span>
                    TRENDING NOW
                  </h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {trending.length > 0 ? trending.map((song) => (
                    <SongCard key={song.id} song={song} queue={trending} />
                  )) : (
                    <p className="opacity-40 text-sm font-bold uppercase tracking-widest italic">Loading global hits...</p>
                  )}
                </div>
              </section>

              {/* TOP PLAYED SECTION */}
              <section>
                <div className="mb-8">
                  <h2 className="text-3xl font-black italic text-green-400 flex items-center gap-3">
                    <span className="w-1.5 h-8 bg-green-400 rounded-full inline-block"></span>
                    TOP PLAYED
                  </h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {topPlayed.length > 0 ? topPlayed.map((song) => (
                    <SongCard key={song.id} song={song} queue={topPlayed} />
                  )) : (
                    <p className="opacity-40 text-sm font-bold uppercase tracking-widest italic">Syncing top tracks...</p>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </main>

      {/* Playlist Modal */}
      {showCreatePlaylist && (
         <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#121214] p-8 rounded-2xl border border-white/10 w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]">
               {successMessage ? (
                 <div className="flex flex-col items-center justify-center py-12 text-center">
                   <div className="w-20 h-20 bg-cyan-500/20 rounded-full flex items-center justify-center mb-6 animate-bounce">
                     <span className="text-4xl">🎉</span>
                   </div>
                   <h3 className="text-2xl font-black italic text-white mb-2">{successMessage}</h3>
                   <p className="text-gray-400">It's now published and visible to everyone!</p>
                 </div>
               ) : (
                 <>
                   <h3 className="text-xl font-bold mb-4">New Playlist</h3>
                   <input 
                     autoFocus
                     value={newPlaylistName} 
                     onChange={(e) => setNewPlaylistName(e.target.value)}
                     className="w-full bg-white/5 p-4 rounded-xl border border-white/10 mb-6 outline-none focus:border-cyan-500 transition"
                     placeholder="My Awesome Mix"
                   />

                   <div className="mb-4 space-y-4">
                     <div className="flex items-center justify-between">
                       <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Select Songs ({selectedSongs.length}/20)</h4>
                       {selectedSongs.length >= 20 && <span className="text-[10px] text-orange-500 font-bold">Limit reached</span>}
                     </div>
                     
                     <div className="relative">
                       <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-xs" />
                       <input 
                         type="text"
                         value={modalSearch}
                         onChange={(e) => setModalSearch(e.target.value)}
                         placeholder="Search songs to add..."
                         className="w-full bg-white/5 border border-white/5 rounded-lg py-2 pl-10 pr-4 text-xs outline-none focus:border-cyan-500/50 transition"
                       />
                     </div>
                   </div>

                   <div className="flex-1 overflow-y-auto space-y-2 mb-6 pr-2 custom-scrollbar">
                     {availableSongs
                       .filter(s => 
                         s.title.toLowerCase().includes(modalSearch.toLowerCase()) || 
                         s.artist.toLowerCase().includes(modalSearch.toLowerCase())
                       )
                       .length > 0 ? (
                       availableSongs
                         .filter(s => 
                           s.title.toLowerCase().includes(modalSearch.toLowerCase()) || 
                           s.artist.toLowerCase().includes(modalSearch.toLowerCase())
                         )
                         .map((song) => (
                         <div 
                           key={song._id} 
                           onClick={() => toggleSongSelection(song._id)}
                           className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all border ${selectedSongs.includes(song._id) ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-white/5 border-transparent hover:bg-white/10'}`}
                         >
                           <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${selectedSongs.includes(song._id) ? 'bg-cyan-500 border-cyan-500' : 'border-white/20'}`}>
                             {selectedSongs.includes(song._id) && <span className="text-[10px] text-black font-black">✓</span>}
                           </div>
                           <img src={song.coverImage} className="w-10 h-10 rounded object-cover" alt="" />
                           <div className="flex-1 min-w-0">
                             <p className={`text-sm font-bold truncate ${selectedSongs.includes(song._id) ? 'text-cyan-400' : ''}`}>{song.title}</p>
                             <p className="text-[10px] text-gray-500 truncate">{song.artist}</p>
                           </div>
                         </div>
                       ))
                     ) : (
                       <p className="text-sm text-gray-600 italic text-center py-10">No matching songs found.</p>
                     )}
                   </div>

                   <div className="flex justify-end gap-4 mt-auto pt-4 border-t border-white/5">
                      <button onClick={() => { setShowCreatePlaylist(false); setSelectedSongs([]); setModalSearch(""); }} className="text-gray-400 hover:text-white transition font-bold">Cancel</button>
                      <button 
                        onClick={handleCreatePlaylist}
                        disabled={!newPlaylistName.trim()}
                        className={`px-8 py-3 rounded-full font-black transition ${newPlaylistName.trim() ? 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg shadow-cyan-500/20' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
                      >
                        CREATE PLAYLIST
                      </button>
                   </div>
                 </>
               )}
            </div>
         </div>
      )}
    </div>
  );
};

export default Home;