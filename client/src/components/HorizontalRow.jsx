import { useRef } from 'react'

function HorizontalRow({ title, items = [], renderItem, onMore }) {
  const scroller = useRef(null)
  const scrollBy = (dx) => {
    const el = scroller.current
    if (!el) return
    el.scrollBy({ left: dx, behavior: 'smooth' })
  }
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xl font-black">{title}</h3>
        <div className="flex items-center gap-2">
          {onMore ? (
            <button onClick={onMore} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm">
              More
            </button>
          ) : null}
          <div className="hidden md:flex gap-2">
            <button onClick={() => scrollBy(-360)} className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20">‹</button>
            <button onClick={() => scrollBy(360)} className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20">›</button>
          </div>
        </div>
      </div>
      <div ref={scroller} className="overflow-x-auto no-scrollbar">
        <div className="flex gap-4 min-w-max">
          {items.map((it, i) => (
            <div key={it.id || i} className="w-40 shrink-0">
              {renderItem ? renderItem(it, i) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default HorizontalRow
