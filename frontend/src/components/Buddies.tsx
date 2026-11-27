import clsx from 'clsx'
import { Check, Hand, Users } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, CardHeader } from './ui'
import { useToast } from '../context/ToastContext'
import { useAsync } from '../hooks/useAsync'
import { buddyApi } from '../services/fitai'
import type { Buddy, BuddyActivity, BuddyDay } from '../types'
import { shortDate } from '../utils/format'

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** "3 of 4 workouts this week", or without a plan "3 workouts this week". */
export function weekText(a: BuddyActivity) {
  const n = a.workouts_this_week
  if (a.planned_per_week) return `${n} of ${a.planned_per_week} workouts this week`
  return `${n} workout${n === 1 ? '' : 's'} this week`
}

/** When they last trained, in a few words. */
export function lastText(a: BuddyActivity, today = new Date()) {
  if (a.trained_today) return 'Trained today'
  if (!a.last_workout) return 'No workouts yet'
  const last = new Date(a.last_workout + 'T00:00:00')
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const days = Math.round((start.getTime() - last.getTime()) / 86400000)
  if (days === 1) return 'Last trained yesterday'
  if (days < 7) return `Last trained ${days} days ago`
  return `Last trained ${shortDate(a.last_workout)}`
}

/** Monday to Sunday: filled when they trained, outlined for days still to come. */
export function BuddyWeek({ week, name }: { week: BuddyDay[]; name: string }) {
  const done = week.filter(d => d.trained).map(d => DAY_NAMES[week.indexOf(d)])
  return (
    <div className="flex gap-1" role="img" aria-label={done.length ? `${name} trained on ${done.join(', ')}` : `${name} hasn't trained yet this week`}>
      {week.map((d, i) => (
        <span key={d.date} className={clsx('flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-semibold',
          d.trained ? 'bg-lime text-ink-950' : d.future ? 'border border-dashed border-line text-fg-dim' : 'bg-white/[0.06] text-fg-dim')}>
          {d.trained ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : LETTERS[i]}
        </span>
      ))}
    </div>
  )
}

export function NudgeButton({ buddy, onSent, size = 'sm' }: { buddy: Buddy; onSent: () => void; size?: 'sm' | 'md' }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const a = buddy.activity
  if (a?.trained_today) return <Badge tone="lime"><Check className="h-3 w-3" />Trained today</Badge>
  if (a?.on_break) return <Badge>On a break</Badge>
  const send = async () => {
    setBusy(true)
    try { const r = await buddyApi.nudge(buddy.id); toast('success', r.detail); onSent() }
    catch (e) { toast('error', 'Nudge not sent', (e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Button variant="secondary" size={size} onClick={send} loading={busy} disabled={buddy.nudged_today}
      icon={<Hand className="h-4 w-4" />} aria-label={buddy.nudged_today ? `You nudged ${buddy.name} today` : `Nudge ${buddy.name} to train`}>
      {buddy.nudged_today ? 'Nudged' : 'Nudge'}
    </Button>
  )
}

/** One buddy: name, this week and streak. Shown on the dashboard and the Buddies page. */
export function BuddyRow({ buddy, onChanged, extra }: { buddy: Buddy; onChanged: () => void; extra?: ReactNode }) {
  const a = buddy.activity
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-700 text-sm font-semibold text-fg">{buddy.name.charAt(0).toUpperCase()}</span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-fg">{buddy.name}</p>
          <p className="text-[13px] text-fg-muted">
            {a ? <>{weekText(a)}{a.streak > 0 && <>, <span className="text-fg">{a.streak} in a row</span></>}</> : `${buddy.name} keeps their workouts private`}
          </p>
          {a && !a.trained_today && <p className="text-xs text-fg-dim">{lastText(a)}</p>}
        </div>
      </div>
      {a && <BuddyWeek week={a.week} name={buddy.name} />}
      <div className="flex items-center gap-2 sm:w-[120px] sm:justify-end">
        <NudgeButton buddy={buddy} onSent={onChanged} />
        {extra}
      </div>
    </div>
  )
}

/** Dashboard: buddies at a glance, nudges you've been sent, or an invitation to add one. */
export function BuddiesCard() {
  const q = useAsync(() => buddyApi.overview(), [])
  const o = q.data
  if (!o) return null
  const seen = () => { buddyApi.nudgesSeen().then(() => q.setData({ ...o, nudges: [] })).catch(() => undefined) }
  return (
    <Card>
      <CardHeader title="Workout buddies" icon={<Users className="h-4 w-4" />}
        subtitle={o.buddies.length ? 'Your buddies this week' : 'Train with a friend and keep each other going'}
        action={<Link to="/buddies" className="text-[13px] font-medium text-lime hover:underline">{o.buddies.length ? 'Manage' : 'Add a buddy'}</Link>} />
      <div className="px-5 pb-2">
        {o.nudges.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-3 rounded-xl border border-lime/25 bg-lime/[0.06] px-4 py-3">
            <Hand className="h-4 w-4 shrink-0 text-lime" />
            <p className="min-w-0 flex-1 text-sm text-fg">{nudgeText(o.nudges.map(n => n.from_name))}</p>
            <Link to="/workouts" onClick={seen} className="text-[13px] font-semibold text-lime hover:underline">Start a workout</Link>
            <button onClick={seen} className="text-[13px] text-fg-muted hover:text-fg">Dismiss</button>
          </div>
        )}
        {o.buddies.length === 0
          ? <p className="py-4 text-sm text-fg-muted">Share your invite code with a friend. You'll see each other's workout days and streak, nothing else.</p>
          : <div className="divide-y divide-line-soft">{o.buddies.map(b => <BuddyRow key={b.id} buddy={b} onChanged={() => q.reload(true)} />)}</div>}
      </div>
    </Card>
  )
}

export function nudgeText(names: string[]) {
  const uniq = [...new Set(names)]
  if (uniq.length === 1) return `${uniq[0]} nudged you to train today.`
  return `${uniq.slice(0, -1).join(', ')} and ${uniq[uniq.length - 1]} nudged you to train today.`
}
