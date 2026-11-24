import clsx from 'clsx'
import type { HTMLAttributes, ReactNode } from 'react'

export function Card({ className, hover, children, ...rest }: HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div {...rest} className={clsx('rounded-2xl border border-line bg-ink-800 shadow-card', hover && 'transition-colors duration-200 hover:border-line-strong', className)}>
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action, icon }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
      <div className="flex min-w-0 items-center gap-3">
        {icon && <div className="flex shrink-0 items-center text-lime [&>svg]:h-[18px] [&>svg]:w-[18px]" aria-hidden>{icon}</div>}
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold text-fg">{title}</h3>
          {subtitle && <p className="mt-0.5 truncate text-[13px] text-fg-muted">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

// `eyebrow` is accepted for older callers but no longer shown: the page title alone names the page.
export function PageHeader({ eyebrow: _eyebrow, title, subtitle, actions }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-[34px] font-extrabold uppercase leading-[.95] tracking-[.01em] text-fg sm:text-[42px]">{title}</h1>
        {subtitle && <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-fg-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

/** A row of short facts ("120 g", "245 kcal") spaced apart instead of joined with dots. */
export function Meta({ items, className }: { items: ReactNode[]; className?: string }) {
  return (
    <span className={clsx('flex flex-wrap gap-x-3 gap-y-0.5 tabular-nums', className)}>
      {items.filter(i => i !== null && i !== undefined && i !== false && i !== '').map((it, i) => <span key={i}>{it}</span>)}
    </span>
  )
}
