import { useEffect, useState } from 'react'
import { parseAmount } from '../../utils/workout'

/** A number box for weights and reps that lets people type "42." or "42,5" on the way to 42.5
 *  (a plain number input would turn "42." back into 42 before the next digit arrives). */
export function NumCell({ value, onValue, label, placeholder, decimal }: { value: number | null; onValue: (v: number | null) => void; label: string; placeholder: string; decimal?: boolean }) {
  const [text, setText] = useState(value == null ? '' : String(value))
  const [focused, setFocused] = useState(false)
  useEffect(() => { if (!focused) setText(value == null ? '' : String(value)) }, [value, focused])
  return (
    <input inputMode={decimal ? 'decimal' : 'numeric'} aria-label={label} value={text} placeholder={placeholder}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      onChange={ev => { const t = ev.target.value; if (!/^\d*([.,]\d*)?$/.test(t)) return; setText(t); onValue(parseAmount(t)) }}
      className="h-9 w-full rounded-lg border border-line bg-ink-900 px-2 text-center tabular-nums text-fg placeholder:text-fg-dim focus:border-lime/60 focus:outline-none" />
  )
}
