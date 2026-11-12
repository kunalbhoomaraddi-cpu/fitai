import clsx from 'clsx'
import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg'
interface Props extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: Size; loading?: boolean; icon?: ReactNode; full?: boolean }

const V: Record<Variant, string> = {
  primary: 'btn-shine bg-lime text-ink-950 hover:bg-lime-400 shadow-[0_8px_24px_-10px_rgba(198,243,107,.55)] font-semibold',
  secondary: 'bg-ink-700 text-fg hover:bg-ink-750 border border-line hover:border-line-strong',
  outline: 'border border-line text-fg hover:border-lime/50 hover:text-lime bg-transparent',
  ghost: 'text-fg-muted hover:text-fg hover:bg-white/[0.04]',
  danger: 'bg-coral/10 text-coral border border-coral/30 hover:bg-coral/20',
}
const S: Record<Size, string> = { sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg', md: 'h-10 px-4 text-sm gap-2 rounded-xl', lg: 'h-12 px-6 text-[15px] gap-2 rounded-xl' }

export function Button({ variant = 'primary', size = 'md', loading, icon, full, className, children, disabled, ...rest }: Props) {
  return (
    <button {...rest} disabled={disabled || loading}
      className={clsx('inline-flex select-none items-center justify-center whitespace-nowrap transition-all duration-200 active:scale-[.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/60',
        V[variant], S[size], full && 'w-full', className)}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  )
}

export function IconButton({ className, children, label, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button aria-label={label} title={label} {...rest}
      className={clsx('inline-flex h-9 w-9 items-center justify-center rounded-xl text-fg-muted transition hover:bg-white/[0.05] hover:text-fg disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/60', className)}>
      {children}
    </button>
  )
}
