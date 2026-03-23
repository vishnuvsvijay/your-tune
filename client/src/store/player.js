import { create } from 'zustand'

export const usePlayer = create((set, get) => ({
  currentSong: null,
  queue: [],
  currentIndex: -1,
  playing: false,
  repeat: false, // false, 'one', 'all' - for now just boolean toggle
  setCurrentSong: (song, queue) => {
    if (queue && Array.isArray(queue)) {
      const index = queue.findIndex((s) => (s._id || s.externalId || s.id) === (song._id || song.externalId || song.id))
      set({ queue, currentIndex: index >= 0 ? index : 0 })
    }
    set({ currentSong: song, playing: true })
  },
  toggleRepeat: () => set((s) => ({ repeat: !s.repeat })),
  setQueue: (queue, startIndex = 0) => {
    const idx = Math.max(0, Math.min(startIndex, queue.length - 1))
    set({ queue, currentIndex: idx, currentSong: queue[idx], playing: true })
  },
  togglePlay: () => set((s) => ({ playing: !s.playing })),
  next: () => {
    const { queue, currentIndex, repeat } = get()
    let nextIdx = currentIndex + 1
    if (nextIdx >= queue.length) {
      if (repeat) nextIdx = 0 // loop back to start
      else return // stop
    }
    set({ currentIndex: nextIdx, currentSong: queue[nextIdx], playing: true })
  },
  prev: () => {
    const { queue, currentIndex, repeat } = get()
    let prevIdx = currentIndex - 1
    if (prevIdx < 0) {
      if (repeat) prevIdx = queue.length - 1
      else return
    }
    set({ currentIndex: prevIdx, currentSong: queue[prevIdx], playing: true })
  },
  clear: () => set({ queue: [], currentIndex: -1, currentSong: null, playing: false }),
}))
