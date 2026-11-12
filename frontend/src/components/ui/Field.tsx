import clsx from 'clsx'
import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

export function Label({ children, hint, htmlFor }: { children: ReactNode; hint?: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-center justify-between text-[13px] font-medium text-fg-muted">
      <span>{children}</span>{hint && <span className="text-xs text-fg-dim">{hint}</span>}
    </label>
  )
}

const base = 'w-full rounded-xl border border-line bg-ink-900 px-3.5 text-sm text-fg placeholder:text-fg-dim transition focus:border-lime/60 focus:outline-none focus:ring-2 focus:ring-lime/15 disabled:opacity-60'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { suffix?: ReactNode; icon?: ReactNode; invalid?: boolean }>(
  function Input({ className, suffix, icon, invalid, ...rest }, ref) {
    return (
      <div className="relative">
        {icon && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-dim">{icon}</span>}
        <input ref={ref} {...rest} className={clsx(base, 'h-11', icon && 'pl-10', suffix && 'pr-12', invalid && 'border-coral/60', className)} />
        {suffix && <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-fg-dim">{suffix}</span>}
      </div>
    )
  })

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={clsx(base, 'h-11 appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 fill=%27none%27 stroke=%27%239CA69D%27 stroke-width=%272%27%3E%3Cpath d=%27M3 4.5l3 3 3-3%27/%3E%3C/svg%3E")] bg-[right_14px_center] bg-no-repeat pr-9', className)}>
      {children}
    </select>
  )
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={clsx(base, 'py-3', className)} />
}

export function Segmented<T extends string | number>({ options, value, onChange, size = 'md' }: { options: readonly (readonly [T, string])[]; value: T; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div role="radiogroup" className="inline-flex rounded-xl border border-line bg-ink-900 p-1">
      {options.map(([v, l]) => (
        <button type="button" role="radio" aria-checked={v === value} key={String(v)} onClick={() => onChange(v)}
          className={clsx('rounded-lg font-medium transition', size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-[13px]',
            v === value ? 'bg-ink-700 text-fg shadow-sm ring-1 ring-line-strong' : 'text-fg-muted hover:text-fg')}>
          {l}
        </button>
      ))}
    </div>
  )
}

export function Chip({ active, onClick, children, icon }: { active?: boolean; onClick?: () => void; children: ReactNode; icon?: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={clsx('inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition',
        active ? 'border-lime/60 bg-lime/10 text-lime' : 'border-line bg-ink-900 text-fg-muted hover:border-line-strong hover:text-fg')}>
      {icon}{children}
    </button>
  )
}

export function OptionCard({ active, onClick, title, desc, icon }: { active: boolean; onClick: () => void; title: string; desc?: string; icon?: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={clsx('group flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition duration-200',
        active ? 'border-lime/60 bg-lime/[0.06] shadow-glow' : 'border-line bg-ink-900 hover:border-line-strong')}>
      {icon && <div className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition', active ? 'bg-lime text-ink-950' : 'bg-white/[0.04] text-fg-muted group-hover:text-fg')}>{icon}</div>}
      <div>
        <p className="font-display text-[15px] font-semibold text-fg">{title}</p>
        {desc && <p className="mt-0.5 text-[13px] leading-snug text-fg-muted">{desc}</p>}
      </div>
    </button>
  )
}
