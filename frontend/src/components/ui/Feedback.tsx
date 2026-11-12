import clsx from 'clsx'
import { AlertTriangle, RefreshCw, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './Button'

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-shimmer rounded-xl bg-[linear-gradient(90deg,#171C18_0%,#1F2621_50%,#171C18_100%)] bg-[length:800px_100%]', className)} />
}

export function PageSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-56 w-full rounded-3xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}</div>
      <div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-72 lg:col-span-2" /><Skeleton className="h-72" /></div>
    </div>
  )
}

export function EmptyState({ icon, title, text, action, className, art }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode; className?: string; art?: string }) {
  return (
    <div className={clsx('relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line px-6 py-12 text-center', className)}>
      {art && <img src={`/images/art/${art}.svg`} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />}
      <div className="relative mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-lime/10 text-lime ring-1 ring-lime/20">{icon ?? <Sparkles className="h-5 w-5" />}</div>
      <p className="relative font-display text-base font-semibold text-fg">{title}</p>
      {text && <p className="relative mt-1 max-w-sm text-sm text-fg-muted">{text}</p>}
      {action && <div className="relative mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-coral/25 bg-coral/[0.04] px-6 py-10 text-center">
      <AlertTriangle className="mb-3 h-6 w-6 text-coral" />
      <p className="font-medium text-fg">We couldn't load this</p>
      <p className="mt-1 max-w-md text-sm text-fg-muted">{message}</p>
      {onRetry && <Button className="mt-4" variant="secondary" size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={onRetry}>Try again</Button>}
    </div>
  )
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'lime' | 'moss' | 'amber' | 'coral' | 'sky'; className?: string }) {
  const t = { neutral: 'bg-white/[0.05] text-fg-muted border-line', lime: 'bg-lime/10 text-lime border-lime/25', moss: 'bg-moss/10 text-moss-400 border-moss/25',
    amber: 'bg-amber/10 text-amber border-amber/25', coral: 'bg-coral/10 text-coral border-coral/25', sky: 'bg-sky/10 text-sky border-sky/25' }[tone]
  return <span className={clsx('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium', t, className)}>{children}</span>
}

export function Notice({ tone = 'info', children, icon }: { tone?: 'info' | 'warn' | 'demo'; children: ReactNode; icon?: ReactNode }) {
  const t = { info: 'border-sky/25 bg-sky/[0.05] text-sky', warn: 'border-amber/30 bg-amber/[0.06] text-amber', demo: 'border-lime/25 bg-lime/[0.05] text-lime' }[tone]
  return (
    <div className={clsx('flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13px] leading-relaxed', t)}>
      <span className="mt-0.5 shrink-0">{icon ?? <AlertTriangle className="h-4 w-4" />}</span>
      <div className="text-fg-muted [&_strong]:text-fg">{children}</div>
    </div>
  )
}
