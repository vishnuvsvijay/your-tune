import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useSearch } from '../store/search'
import { FaSearch, FaTimes } from 'react-icons/fa'

function Navbar() {
  const { user, token, logout } = useAuth()
  const { searchQuery, setSearchQuery, clearSearch } = useSearch()
  const navigate = useNavigate()

  const handleSearchChange = (e) => {
    const val = e.target.value
    setSearchQuery(val)
    if (val.trim() && window.location.pathname !== '/') {
      navigate('/')
    }
  }

  return (
    <header className="w-full bg-[#0a0a0b]/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50 px-4 md:px-8">
      <div className="max-w-7xl mx-auto flex items-center justify-between h-16 gap-4">
        {/* GLOBAL SEARCH */}
        {token && (
          <div className="flex-1 max-w-2xl relative group">
            <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors ${searchQuery ? 'text-cyan-400' : 'text-gray-500 group-focus-within:text-cyan-400'}`}>
              <FaSearch size={14} />
            </div>
            <input 
              type="text" 
              placeholder="Search songs, artists..." 
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full bg-white/5 border border-white/10 rounded-full py-2.5 pl-10 pr-10 text-sm font-bold text-white placeholder-gray-500 focus:outline-none focus:bg-white/10 focus:border-cyan-500/50 transition-all shadow-inner"
            />
            {searchQuery && (
              <button 
                onClick={clearSearch}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-white transition-colors"
              >
                <FaTimes size={14} />
              </button>
            )}
          </div>
        )}

        {/* NAVIGATION */}
        <nav className="flex items-center gap-2 md:gap-4 shrink-0 ml-auto">
          {!token && (
            <>
              <NavLink to="/login" className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-sm font-bold transition">Login</NavLink>
              <NavLink to="/register" className="px-4 py-2 rounded-full bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-black transition shadow-lg shadow-cyan-900/20">Register</NavLink>
            </>
          )}
          {token && (
            <>
              <NavLink to="/" className={({isActive}) => `px-3 py-2 rounded-lg text-sm font-bold transition ${isActive ? 'text-cyan-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>Home</NavLink>
              <NavLink to="/explore" className={({isActive}) => `hidden md:block px-3 py-2 rounded-lg text-sm font-bold transition ${isActive ? 'text-cyan-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>Explore</NavLink>
              <NavLink to="/liked" className={({isActive}) => `px-3 py-2 rounded-lg text-sm font-bold transition ${isActive ? 'text-cyan-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>Liked</NavLink>
              <div className="w-px h-6 bg-white/10 mx-1 hidden sm:block"></div>
              <button onClick={logout} className="px-3 py-2 rounded-lg text-sm font-black text-red-500 hover:bg-red-500/10 transition">Logout</button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}

export default Navbar
