import { lazy, Suspense, type ComponentType } from 'react'
import type * as C from './Charts'

/** The charts library is the biggest download in the app (about 430 KB). Pages import charts from here,
 *  so their text and numbers appear straight away and each chart fills in when the library arrives.
 *  The placeholder has the chart's exact size, so nothing jumps. */
const load = () => import('./Charts')

function deferred<P extends object>(pick: (m: typeof C) => ComponentType<P>, size: (p: P) => { height: number; width?: number }) {
  // React 18's types can't spread a generic P into a lazy component; the outer signature keeps it type-safe.
  const Chart = lazy(() => load().then(m => ({ default: pick(m) }))) as ComponentType<any>
  function Deferred(props: P) {
    const s = size(props)
    return (
      <Suspense fallback={<div aria-hidden style={{ height: s.height, width: s.width ?? '100%' }} className="animate-pulse rounded-xl bg-white/[.03]" />}>
        <Chart {...props} />
      </Suspense>
    )
  }
  return Deferred
}

export const WeightChart = deferred(m => m.WeightChart, p => ({ height: p.height ?? 240 }))
export const CaloriesChart = deferred(m => m.CaloriesChart, p => ({ height: p.height ?? 220 }))
export const ProteinChart = deferred(m => m.ProteinChart, p => ({ height: p.height ?? 200 }))
export const ActivityChart = deferred(m => m.ActivityChart, p => ({ height: p.height ?? 200 }))
export const MeasureChart = deferred(m => m.MeasureChart, p => ({ height: p.height ?? 220 }))
export const LiftChart = deferred(m => m.LiftChart, p => ({ height: p.height ?? 240 }))
export const MacroDonut = deferred(m => m.MacroDonut, p => ({ height: p.size ?? 150, width: p.size ?? 150 }))
