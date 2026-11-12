import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertTriangle, Info, Trophy, X } from 'lucide-react'
import clsx from 'clsx'

type Kind = 'success' | 'error' | 'info' | 'achievement'
interface Toast { id: number; kind: Kind; title: string; body?: string }
const Ctx = createContext<{ toast: (kind: Kind, title: string, body?: string) => void } | null>(null)

const ICON = { success: CheckCircle2, error: AlertTriangle, info: Info, achievement: Trophy }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const toast = useCallback((kind: Kind, title: string, body?: string) => {
    const id = Date.now() + Math.random()
    setItems(s => (s.some(t => t.title === title) ? s : [...s.slice(-3), { id, kind, title, body }]))
    setTimeout(() => setItems(s => s.filter(t => t.id !== id)), kind === 'achievement' ? 6000 : 4200)
  }, [])
  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[80] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:right-6 lg:left-auto">
        {items.map(t => {
          const I = ICON[t.kind]
          return (
            <div key={t.id} role="status" className={clsx('pointer-events-auto relative flex w-full max-w-sm animate-pop items-start gap-3 overflow-hidden rounded-2xl border bg-ink-800/95 p-4 shadow-pop backdrop-blur',
              t.kind === 'error' ? 'border-coral/40' : t.kind === 'achievement' ? 'border-lime/50 shadow-glow' : 'border-line')}>
              <I className={clsx('mt-0.5 h-5 w-5 shrink-0', t.kind === 'error' ? 'text-coral' : t.kind === 'info' ? 'text-sky' : 'text-lime')} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-fg">{t.title}</p>
                {t.body && <p className="mt-0.5 text-sm text-fg-muted">{t.body}</p>}
              </div>
              <button aria-label="Dismiss" onClick={() => setItems(s => s.filter(x => x.id !== t.id))} className="text-fg-dim hover:text-fg"><X className="h-4 w-4" /></button>
              <span className={clsx('toast-timer absolute bottom-0 left-0 h-[2px]', t.kind === 'error' ? 'bg-coral/70' : 'bg-lime/70')} style={{ animationDuration: t.kind === 'achievement' ? '6s' : '4.2s' }} />
            </div>
          )
        })}
      </div>
    </Ctx.Provider>
  )
}
export const useToast = () => { const c = useContext(Ctx); if (!c) throw new Error('useToast outside provider'); return c.toast }
