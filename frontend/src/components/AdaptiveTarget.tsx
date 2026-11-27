import { Gauge, X } from 'lucide-react'
import { useState } from 'react'
import { Bar, Button, Card, Skeleton, Switch } from './ui'
import { useToast } from '../context/ToastContext'
import { useAsync } from '../hooks/useAsync'
import { profileApi } from '../services/fitai'
import type { AdaptiveEstimate } from '../types'

const kcal = (n: number) => `${n.toLocaleString()} kcal`

/** What the estimate is based on, in plain words. */
function Basis({ e }: { e: AdaptiveEstimate }) {
  if (e.status === 'collecting') {
    const rows: [string, number, number][] = [
      ['Fully logged days', e.logged_days, e.needs.logged_days],
      ['Weigh-ins', e.weigh_ins, e.needs.weigh_ins],
      ['Days between first and last weigh-in', e.weigh_span_days, e.needs.weigh_span_days],
    ]
    return (
      <div className="space-y-3">
        <p className="text-[13px] text-fg-muted">It needs a little more data from the last 4 weeks before it can work out your real maintenance. Until then your target comes from the formula.</p>
        {rows.map(([label, have, need]) => (
          <div key={label}>
            <div className="mb-1 flex justify-between text-xs"><span className="text-fg-muted">{label}</span><span className="tabular-nums text-fg">{Math.min(have, need)} of {need}</span></div>
            <Bar value={Math.min(have, need)} max={need} />
          </div>
        ))}
      </div>
    )
  }
  const trend = e.weekly_change_kg ?? 0
  return (
    <ul className="space-y-1.5 text-[13px] text-fg-muted">
      <li>Your logs and weight trend put maintenance at <span className="font-semibold text-fg">{kcal(e.tdee)}</span>. The formula guessed {kcal(e.formula_tdee)}.</li>
      <li>Based on {e.logged_days} fully logged days averaging {kcal(e.avg_intake ?? 0)}, while your weight trend moved {trend > 0 ? '+' : ''}{trend} kg a week.</li>
      {e.confidence < 1 && <li>Still partly the formula ({Math.round(e.confidence * 100)}% your data). It leans on your data fully after 3 weeks of logs.</li>}
      {e.capped && <li>Your logs suggest an unusual number, so it's held within 25% of the formula. Missed snacks or drinks are the usual reason.</li>}
    </ul>
  )
}

/** Settings: turn the adaptive target on or off, and see what it's based on. */
export function AdaptiveSettings() {
  const toast = useToast()
  const q = useAsync(() => profileApi.adaptive(), [])
  const [busy, setBusy] = useState(false)
  if (q.loading) return <Skeleton className="h-24 w-full rounded-xl" />
  if (q.error || !q.data) return <p className="text-sm text-fg-muted">Couldn't load the adaptive target.</p>
  const e = q.data
  const toggle = async (on: boolean) => {
    setBusy(true)
    try {
      const t = await profileApi.setAdaptive(on)
      toast('success', on ? 'Adaptive target on' : 'Adaptive target off', `Daily target: ${kcal(t.calories.calorie_target)}`)
      q.reload(true)
    } catch (err) { toast('error', 'Could not change it', (err as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-fg">Adapt my calorie target to my results</p>
          <p className="mt-0.5 text-[13px] text-fg-muted">Uses what you actually eat and how your weight moves, instead of a formula. Rechecked every day from the last 4 weeks.</p>
        </div>
        <Switch checked={e.enabled} onChange={toggle} disabled={busy} label="Adapt my calorie target to my results" />
      </div>
      <Basis e={e} />
      <p className="text-[11px] text-fg-dim">Only works if you log everything you eat on the days you log. Safety minimums always apply.</p>
    </div>
  )
}

const DISMISS_KEY = 'fitai.adaptive-dismissed'

/** Dashboard: suggests the adaptive target once the logs show the formula is noticeably off. */
export function AdaptiveSuggestion({ onChanged }: { onChanged: () => void }) {
  const toast = useToast()
  const q = useAsync(() => profileApi.adaptive(), [])
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(DISMISS_KEY) === '1' } catch { return false } })
  const [busy, setBusy] = useState(false)
  const e = q.data
  if (hidden || !e || e.enabled || e.status !== 'ready' || Math.abs(e.difference ?? 0) < 100) return null
  const dismiss = () => { try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* private mode */ } setHidden(true) }
  const use = async () => {
    setBusy(true)
    try {
      const t = await profileApi.setAdaptive(true)
      toast('success', 'Adaptive target on', `Daily target: ${kcal(t.calories.calorie_target)}`)
      setHidden(true); onChanged()
    } catch (err) { toast('error', 'Could not change it', (err as Error).message); setBusy(false) }
  }
  const higher = (e.difference ?? 0) > 0
  return (
    <Card className="relative flex flex-col gap-4 border-lime/25 p-5 sm:flex-row sm:items-center sm:pr-14">
      <button onClick={dismiss} aria-label="Not now" className="absolute right-3 top-3 rounded-md p-1 text-fg-dim hover:text-fg"><X className="h-4 w-4" /></button>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime/10 text-lime"><Gauge className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1 pr-6">
        <p className="font-semibold text-fg">Your body burns about {kcal(e.tdee)} a day, not {kcal(e.formula_tdee)}</p>
        <p className="mt-0.5 text-[13px] text-fg-muted">
          Worked out from {e.logged_days} logged days and your weight trend. {higher ? 'You can eat a little more and still reach your goal.' : 'Your target should be a little lower to keep progressing.'}
        </p>
      </div>
      <Button onClick={use} loading={busy} className="shrink-0">Use my real number</Button>
    </Card>
  )
}
