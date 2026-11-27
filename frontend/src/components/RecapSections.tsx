import { useState } from 'react'
import { Card, ErrorState, Segmented, Skeleton } from './ui'
import { WeeklyRecapCard } from './WeeklyRecap'
import { useAsync } from '../hooks/useAsync'
import { progressApi } from '../services/fitai'
import type { Units } from '../types'

const KEY = 'fitai.recap-hidden'

/** Last week's recap at the top of the week (Monday to Wednesday), until it's hidden. */
export function DashboardRecap({ units }: { units: Units }) {
  const early = new Date().getDay() >= 1 && new Date().getDay() <= 3
  const q = useAsync(() => (early ? progressApi.recap('last') : Promise.resolve(null)), [early])
  const [hiddenFor, setHiddenFor] = useState(() => { try { return localStorage.getItem(KEY) } catch { return null } })
  const r = q.data
  if (!r || r.empty || hiddenFor === r.start) return null
  const hide = () => { try { localStorage.setItem(KEY, r.start) } catch { /* private mode */ } setHiddenFor(r.start) }
  return <WeeklyRecapCard recap={r} units={units} onDismiss={hide} />
}

/** Progress page: last week or this week so far. */
export function ProgressRecap({ units }: { units: Units }) {
  const [which, setWhich] = useState<'last' | 'this'>('last')
  const q = useAsync(() => progressApi.recap(which), [which])
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-sans text-lg font-semibold text-fg">Weekly recap</h2>
        <Segmented size="sm" options={[['last', 'Last week'], ['this', 'This week']] as const} value={which} onChange={setWhich} />
      </div>
      {q.loading ? <Skeleton className="h-64 w-full rounded-2xl" />
        : q.error ? <ErrorState message={q.error} onRetry={() => q.reload()} />
          : q.data && (q.data.empty
            ? <Card className="p-6 text-sm text-fg-muted">{which === 'last' ? 'Nothing logged last week.' : 'Nothing logged this week yet.'} Log workouts, food or your weight and the recap fills in.</Card>
            : <WeeklyRecapCard recap={q.data} units={units} />)}
    </section>
  )
}
