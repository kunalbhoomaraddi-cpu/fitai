import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const COLORS = ['#C6F36B', '#49B675', '#F5F7F2', '#7CC4F2', '#F2B85B']

/** Lightweight confetti burst for goal/achievement moments. Respects reduced motion. */
export function Celebration({ fire }: { fire: number }) {
  const [pieces, setPieces] = useState<{ id: number; left: number; delay: number; color: string; size: number }[]>([])
  useEffect(() => {
    if (!fire || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    setPieces(Array.from({ length: 60 }, (_, i) => ({ id: fire * 100 + i, left: Math.random() * 100, delay: Math.random() * 0.6, color: COLORS[i % COLORS.length], size: 6 + Math.random() * 6 })))
    const t = setTimeout(() => setPieces([]), 3400)
    return () => clearTimeout(t)
  }, [fire])
  if (!pieces.length) return null
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[90] overflow-hidden" aria-hidden>
      {pieces.map(p => (
        <span key={p.id} className="absolute -top-4 animate-confetti rounded-sm"
          style={{ left: `${p.left}%`, width: p.size, height: p.size * 0.5, background: p.color, animationDelay: `${p.delay}s` }} />
      ))}
    </div>,
    document.body,
  )
}
