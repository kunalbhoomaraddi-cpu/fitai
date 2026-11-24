import clsx from 'clsx'
import { TrendingUp, Trophy } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { LiftChart } from '../charts/Charts'
import { Card, CardHeader, EmptyState, Select, Skeleton } from '../ui'
import { workoutApi } from '../../services/fitai'
import type { Lift } from '../../types'
import { useAuth } from '../../context/AuthContext'
import { fmtLiftSet, liftShow, shortDate, weightUnit } from '../../utils/format'


/** How each lift has moved: estimated 1-rep max (or reps / seconds) per session, with personal records marked. */
export function LiftProgress() {
  const { units } = useAuth()
  const [lifts, setLifts] = useState<Lift[] | null>(null)
  const [error, setError] = useState(false)
  const [id, setId] = useState<string>('')
  useEffect(() => { workoutApi.lifts().then(l => { setLifts(l); setId(l[0]?.exercise_id ?? '') }).catch(() => setError(true)) }, [])
  const lift = useMemo(() => lifts?.find(l => l.exercise_id === id), [lifts, id])
  // Stored in kg; weighted lifts are shown in the user's units. Reps and seconds never change.
  const unit = lift?.kind === 'weighted' ? weightUnit(units) : lift?.unit ?? ''
  const conv = (v: number) => (lift?.kind === 'weighted' ? liftShow(v, units) : Math.round(v * 10) / 10)
  const fmtVal = (v: number) => `${conv(v)} ${unit}`
  const setLabel = (p: { kg: number | null; reps: number }) => fmtLiftSet(p.kg, p.reps, units, lift?.kind === 'timed')
  const chartData = useMemo(() => (lift ? lift.points.map(p => ({ ...p, value: conv(p.value), label: fmtLiftSet(p.kg, p.reps, units, lift.kind === 'timed') })) : []), [lift, units]) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return null
  if (!lifts) return <Skeleton className="h-80" />
  if (lifts.length === 0) {
    return <EmptyState icon={<TrendingUp className="h-5 w-5" />} title="Your lifts will show up here"
      text="During a workout, type the weight and reps for each set and tick it. After a couple of sessions you'll see each lift's progress and your personal records." />
  }
  const top = lifts.slice(0, 5)
  return (
    <Card>
      <CardHeader title="Lift progress" subtitle={lift ? `${lift.metric} per session` : undefined} icon={<TrendingUp className="h-4 w-4" />}
        action={<Select aria-label="Choose a lift" value={id} onChange={e => setId(e.target.value)} className="!h-9 max-w-[220px] !text-[13px]">
          {lifts.map(l => <option key={l.exercise_id} value={l.exercise_id}>{l.name} ({l.sessions})</option>)}
        </Select>} />
      <div className="flex gap-2 overflow-x-auto px-5 pt-4 pb-1" role="tablist" aria-label="Most trained lifts">
        {top.map(l => (
          <button key={l.exercise_id} role="tab" aria-selected={l.exercise_id === id} onClick={() => setId(l.exercise_id)}
            className={clsx('shrink-0 rounded-full border px-3 py-1.5 text-[13px] transition-colors', l.exercise_id === id ? 'border-lime bg-lime/10 text-lime' : 'border-line text-fg-muted hover:text-fg')}>{l.name}</button>
        ))}
      </div>
      {lift && (<>
        <div className="mt-3 grid grid-cols-2 border-y border-line-soft sm:grid-cols-4">
          <div className="px-5 py-4"><p className="text-[12px] text-fg-muted">{lift.kind === 'weighted' ? 'Latest est. max' : 'Latest'}</p><p className="score mt-1.5 text-[34px]">{fmtVal(lift.latest.value)}</p><p className="mt-1 text-xs text-fg-dim">{lift.kind === 'weighted' ? `From ${setLabel(lift.latest)}` : shortDate(lift.latest.date)}</p></div>
          <div className="border-l border-line-soft px-5 py-4"><p className="text-[12px] text-fg-muted">{lift.kind === 'weighted' ? 'Best est. max' : 'Best'}</p><p className="score mt-1.5 text-[34px] text-lime">{fmtVal(lift.best.value)}</p><p className="mt-1 text-xs text-fg-dim">{lift.kind === 'weighted' ? `From ${setLabel(lift.best)}, ` : ''}{shortDate(lift.best.date)}</p></div>
          <div className="border-t border-line-soft px-5 py-4 sm:border-l sm:border-t-0"><p className="text-[12px] text-fg-muted">Last 8 weeks</p>
            <p className={clsx('score mt-1.5 text-[34px]', lift.change_8w == null ? 'text-fg-dim' : lift.change_8w > 0 ? 'text-moss-400' : lift.change_8w < 0 ? 'text-amber' : 'text-fg')}>
              {lift.change_8w == null ? '–' : `${lift.change_8w > 0 ? '+' : ''}${fmtVal(lift.change_8w)}`}</p>
            <p className="mt-1 text-xs text-fg-dim">{lift.change_8w == null ? 'Needs 2 sessions in 8 weeks' : 'First to latest session'}</p></div>
          <div className="border-l border-t border-line-soft px-5 py-4 sm:border-t-0"><p className="text-[12px] text-fg-muted">Personal records</p><p className="score mt-1.5 flex items-center gap-2 text-[34px]">{lift.prs}<Trophy className="h-5 w-5 text-lime" aria-hidden /></p><p className="mt-1 text-xs text-fg-dim">in {lift.sessions} sessions</p></div>
        </div>
        <div className="px-2 pb-2 pt-4">
          {lift.points.length >= 2 ? <LiftChart data={chartData} unit={unit} weighted={lift.kind === 'weighted'} /> : <p className="px-3 py-10 text-center text-sm text-fg-muted">Log this lift once more to see a line.</p>}
        </div>
        <p className="px-5 pb-4 text-[11.5px] leading-relaxed text-fg-dim">
          {lift.kind === 'weighted' ? `Estimated 1-rep max uses the Epley formula (weight × (1 + reps ÷ 30)) on your best set, so a heavier set and a longer set can be compared. Shown in ${unit}; change units in Settings. Filled dots are personal records.`
            : lift.kind === 'timed' ? 'Your longest hold each session. Filled dots are personal records.' : 'Most reps in one set each session. Filled dots are personal records.'}
        </p>
      </>)}
    </Card>
  )
}
