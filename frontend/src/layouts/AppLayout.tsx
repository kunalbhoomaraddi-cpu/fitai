import clsx from 'clsx'
import { Bell, Bot, CalendarCheck, ChartLine, Dumbbell, LayoutDashboard, LogOut, Menu, Salad, Settings, Sparkles, Trophy, UtensilsCrossed, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Badge, Logo } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { progressApi } from '../services/fitai'
import type { Achievement } from '../types'
import { greeting, longToday } from '../utils/format'

export const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/coach', label: 'AI Fitness Coach', short: 'Coach', icon: Bot },
  { to: '/diet', label: 'Diet Planner', short: 'Diet', icon: Salad },
  { to: '/workouts', label: 'Workout Planner', short: 'Train', icon: Dumbbell },
  { to: '/nutrition', label: 'Nutrition Tracker', short: 'Food', icon: UtensilsCrossed },
  { to: '/progress', label: 'Progress Tracker', short: 'Progress', icon: ChartLine },
  { to: '/checkins', label: 'Weekly Check-in', short: 'Check-in', icon: CalendarCheck },
  { to: '/settings', label: 'Settings', icon: Settings },
]
const MOBILE = ['/dashboard', '/coach', '/workouts', '/nutrition', '/progress']

function Avatar({ name, size = 'h-9 w-9' }: { name: string; size?: string }) {
  const initials = name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()
  return <div className={clsx('flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-lime to-moss font-display text-sm font-bold text-ink-950', size)}>{initials}</div>
}

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-6 pt-6"><Logo /></div>
      <nav className="flex-1 space-y-1 px-3" aria-label="Main">
        {NAV.map(({ to, label, icon: I }) => (
          <NavLink key={to} to={to} onClick={onNavigate}
            className={({ isActive }) => clsx('group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition',
              isActive ? 'bg-white/[0.06] text-fg' : 'text-fg-muted hover:bg-white/[0.03] hover:text-fg')}>
            {({ isActive }) => (<>
              {isActive && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-lime" />}
              <I className={clsx('h-[18px] w-[18px] transition', isActive ? 'text-lime' : 'text-fg-dim group-hover:text-fg-muted')} />
              {label}
              {to === '/coach' && <Sparkles className="ml-auto h-3.5 w-3.5 text-lime/70" />}
            </>)}
          </NavLink>
        ))}
      </nav>
      <div className="glow-border relative m-3 overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-lime/[0.07] via-ink-850 to-ink-850 p-4">
        <p className="text-xs font-medium text-fg">Ask your coach anything</p>
        <p className="mt-1 text-xs leading-relaxed text-fg-muted">Calories, plateaus, workouts — answers grounded in your data.</p>
        <button onClick={() => { navigate('/coach'); onNavigate?.() }} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-lime hover:underline">
          <Bot className="h-3.5 w-3.5" /> Open AI Coach
        </button>
      </div>
      <div className="flex items-center gap-3 border-t border-line-soft px-4 py-4">
        <Avatar name={user?.full_name || 'F'} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-fg">{user?.full_name}</p>
          <p className="truncate text-xs text-fg-dim">{user?.is_demo ? 'Demo account' : user?.email}</p>
        </div>
        <button onClick={logout} aria-label="Log out" title="Log out" className="rounded-lg p-2 text-fg-dim hover:bg-white/5 hover:text-coral"><LogOut className="h-4 w-4" /></button>
      </div>
    </div>
  )
}

function Notifications() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Achievement[]>([])
  const ref = useRef<HTMLDivElement>(null)
  const loc = useLocation()
  const isDash = loc.pathname === '/dashboard' || loc.pathname === '/progress' || loc.pathname === '/workouts'
  useEffect(() => { if (isDash || items.length === 0) progressApi.achievements().then(setItems).catch(() => undefined) }, [isDash]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])
  const unlocked = items.filter(a => a.unlocked).sort((a, b) => (b.unlocked_at || '').localeCompare(a.unlocked_at || ''))
  const unseen = unlocked.filter(a => !a.seen).length
  return (
    <div className="relative" ref={ref}>
      <button aria-label="Notifications" onClick={() => { setOpen(o => !o); if (unseen) progressApi.markSeen().then(() => setItems(s => s.map(a => ({ ...a, seen: true })))).catch(() => undefined) }}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-ink-850 text-fg-muted transition hover:text-fg">
        <Bell className="h-[18px] w-[18px]" />
        {unseen > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-lime px-1 text-[10px] font-bold text-ink-950">{unseen}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 animate-pop rounded-2xl border border-line bg-ink-850 p-2 shadow-pop">
          <p className="px-3 pb-2 pt-2 text-xs font-semibold uppercase tracking-wider text-fg-dim">Achievements</p>
          {unlocked.length === 0 && <p className="px-3 pb-3 text-sm text-fg-muted">Complete a workout or log a weigh-in to earn your first badge.</p>}
          {unlocked.slice(0, 6).map(a => (
            <div key={a.code} className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.03]">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-lime/10 text-lime"><Trophy className="h-4 w-4" /></div>
              <div className="min-w-0"><p className="text-sm font-medium text-fg">{a.title}</p><p className="text-xs text-fg-muted">{a.description}</p></div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AppLayout() {
  const { user } = useAuth()
  const [drawer, setDrawer] = useState(false)
  const loc = useLocation()
  const navigate = useNavigate()
  useEffect(() => { setDrawer(false); window.scrollTo({ top: 0 }) }, [loc.pathname])
  const first = user?.full_name.split(' ')[0] ?? ''
  const isCoach = loc.pathname === '/coach'
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] border-r border-line-soft bg-ink-900 lg:block"><SideNav /></aside>
      {drawer && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-black/70" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] animate-fade-up border-r border-line bg-ink-900">
            <button onClick={() => setDrawer(false)} aria-label="Close menu" className="absolute right-3 top-6 rounded-lg p-1.5 text-fg-muted hover:text-fg"><X className="h-5 w-5" /></button>
            <SideNav onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}
      <div className="lg:pl-[260px]">
        <header className="sticky top-0 z-30 border-b border-line-soft bg-ink-950/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button className="rounded-lg p-2 text-fg-muted hover:text-fg lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
            <div className="lg:hidden"><Logo compact /></div>
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-[15px] font-semibold text-fg">{greeting()}, {first}</p>
              <p className="text-xs text-fg-dim">{longToday()}</p>
            </div>
            <div className="ml-auto flex items-center gap-2.5">
              {user?.is_demo && <Badge tone="amber" className="hidden sm:inline-flex">Demo mode · sample data</Badge>}
              <Notifications />
              <button onClick={() => navigate('/settings')} aria-label="Profile and settings"><Avatar name={user?.full_name || 'F'} size="h-10 w-10" /></button>
            </div>
          </div>
          {user?.is_demo && <div className="border-t border-amber/20 bg-amber/[0.06] px-4 py-1.5 text-center text-[12px] text-amber sm:hidden">Demo mode — sample data, not a real user</div>}
        </header>
        <main className={clsx('mx-auto max-w-[1400px] px-4 pb-28 sm:px-6 lg:px-8 lg:pb-12', isCoach ? 'pt-4' : 'pt-6 sm:pt-8')}>
          <div key={loc.pathname} className="page-enter"><Outlet /></div>
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line-soft bg-ink-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden" aria-label="Mobile">
        <div className="grid grid-cols-5">
          {NAV.filter(n => MOBILE.includes(n.to)).map(({ to, label, short, icon: I }) => (
            <NavLink key={to} to={to} className={({ isActive }) => clsx('flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium transition', isActive ? 'text-lime' : 'text-fg-dim')}>
              {({ isActive }) => (<><span className={clsx('flex h-7 w-12 items-center justify-center rounded-full transition', isActive && 'bg-lime/10')}><I className="h-[19px] w-[19px]" /></span>{short ?? label}</>)}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
