import { create } from 'zustand'
import api from '../services/api'

export const useSearch = create((set, get) => ({
  searchQuery: '',
  searchResults: [],
  searching: false,
  searchTimer: null,

  setSearchQuery: (query) => {
    set({ searchQuery: query })
    
    // Handle debounce
    const { searchTimer } = get()
    if (searchTimer) clearTimeout(searchTimer)
    
    if (!query.trim()) {
      set({ searchResults: [], searching: false })
      return
    }

    set({ searching: true })
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/songs/search?q=${query.trim()}`).catch(() => null)
        const results = res?.data?.data || []
        set({ searchResults: results, searching: false })
      } catch (err) {
        console.error("[GlobalSearch] Error:", err)
        set({ searchResults: [], searching: false })
      }
    }, 400)
    
    set({ searchTimer: timer })
  },
  
  clearSearch: () => {
    const { searchTimer } = get()
    if (searchTimer) clearTimeout(searchTimer)
    set({ searchQuery: '', searchResults: [], searching: false })
  }
}))
