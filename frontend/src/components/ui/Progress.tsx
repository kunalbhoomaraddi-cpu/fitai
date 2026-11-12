import clsx from 'clsx'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

export function Ring({ value, max, size = 120, stroke = 10, color = '#C6F36B', track = 'rgba(255,255,255,0.06)', children }:
  { value: number; max: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const p = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  const [shown, setShown] = useState(0)
  useEffect(() => { const t = setTimeout(() => setShown(p), 60); return () => clearTimeout(t) }, [p])
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - shown)} style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.2,.7,.2,1)', filter: `drop-shadow(0 0 6px ${color}55)` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}

export function Bar({ value, max, color = 'bg-lime', className, height = 'h-1.5' }: { value: number; max: number; color?: string; className?: string; height?: string }) {
  const p = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  const [w, setW] = useState(0)
  useEffect(() => { const t = setTimeout(() => setW(p), 60); return () => clearTimeout(t) }, [p])
  return (
    <div className={clsx('w-full overflow-hidden rounded-full bg-white/[0.06]', height, className)} role="progressbar" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100}>
      <div className={clsx('h-full rounded-full transition-[width] duration-1000 ease-out', color)} style={{ width: `${w}%` }} />
    </div>
  )
}

export const MACRO_COLORS = { protein: '#C6F36B', carbs: '#7CC4F2', fat: '#F2B85B', calories: '#C6F36B' }

export function MacroRow({ label, value, target, unit = 'g', color }: { label: string; value: number; target: number; unit?: string; color: string }) {
  const over = value > target * 1.1
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
        <span className="flex items-center gap-2 text-fg-muted"><span className="h-2 w-2 rounded-full" style={{ background: color }} />{label}</span>
        <span className="tabular-nums text-fg"><b className="font-semibold">{Math.round(value)}</b><span className="text-fg-dim"> / {Math.round(target)}{unit}</span></span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full transition-[width] duration-1000" style={{ width: `${Math.min(100, (value / Math.max(target, 1)) * 100)}%`, background: over ? '#F07C6A' : color }} />
      </div>
    </div>
  )
}
