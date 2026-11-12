import clsx from 'clsx'
import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react'

/** Six single-digit boxes with auto-advance, backspace, arrow keys and paste support. */
export function CodeInput({ value, onChange, onComplete, disabled, invalid, length = 6 }: {
  value: string[]; onChange: (v: string[]) => void; onComplete: (code: string) => void; disabled?: boolean; invalid?: boolean; length?: number
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  useEffect(() => { if (value.every(d => !d)) refs.current[0]?.focus() }, [value])
  const setAt = (i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(-1)
    const next = [...value]; next[i] = d; onChange(next)
    if (d && i < length - 1) refs.current[i + 1]?.focus()
    if (next.every(Boolean)) onComplete(next.join(''))
  }
  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) refs.current[i - 1]?.focus()
    if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus()
    if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus()
  }
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!t) return
    e.preventDefault()
    const next = Array(length).fill('').map((_, i) => t[i] ?? '')
    onChange(next)
    refs.current[Math.min(t.length, length - 1)]?.focus()
    if (t.length === length) onComplete(t)
  }
  return (
    <div className="flex justify-between gap-2" role="group" aria-label="Verification code">
      {value.map((d, i) => (
        <input key={i} ref={el => { refs.current[i] = el }} value={d} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1} aria-label={`Digit ${i + 1}`} disabled={disabled}
          onChange={e => setAt(i, e.target.value)} onKeyDown={e => onKey(i, e)} onPaste={onPaste}
          className={clsx('h-14 w-full min-w-0 rounded-xl border bg-ink-900 text-center font-display text-2xl font-bold tabular-nums text-fg transition focus:outline-none focus:ring-2',
            invalid ? 'border-coral/60 focus:ring-coral/20' : d ? 'border-lime/50 focus:ring-lime/20' : 'border-line focus:border-lime/60 focus:ring-lime/15')} />
      ))}
    </div>
  )
}
