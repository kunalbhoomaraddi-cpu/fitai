import { ArrowLeftRight, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, ErrorState, Modal, Skeleton } from '../ui'
import { useAsync } from '../../hooks/useAsync'
import { workoutApi } from '../../services/fitai'
import { cap } from '../../utils/format'

/** Pick a replacement when the machine is taken or an exercise doesn't feel right today.
 *  Only exercises for the same muscle (or close) that use the person's own equipment are offered. */
export function SwapExercise({ open, sessionId, index, name, onClose, onSwap }: {
  open: boolean; sessionId: number; index: number; name: string; onClose: () => void; onSwap: (exerciseId: string) => Promise<void>
}) {
  const q = useAsync(() => (open ? workoutApi.alternatives(sessionId, index) : Promise.resolve(null)), [open, sessionId, index])
  const [busy, setBusy] = useState<string | null>(null)
  const pick = async (id: string) => { setBusy(id); try { await onSwap(id) } finally { setBusy(null) } }
  return (
    <Modal open={open} onClose={onClose} title={`Swap ${name}`}>
      <p className="mb-4 text-[13px] text-fg-muted">Same number of sets. Today's target updates from the last time you did the new exercise.</p>
      {q.loading ? <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
        : q.error ? <ErrorState message={q.error} onRetry={() => q.reload()} />
          : !q.data?.length ? <EmptyState icon={<ArrowLeftRight className="h-5 w-5" />} title="No other option here" text="Nothing else works this muscle with your equipment. Add equipment in Settings to see more." />
            : (
              <ul className="space-y-2">
                {q.data.map(a => (
                  <li key={a.exercise_id}>
                    <button onClick={() => pick(a.exercise_id)} disabled={!!busy}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-ink-900 px-4 py-3 text-left transition hover:border-lime/40 disabled:opacity-60">
                      <span className="min-w-0">
                        <span className="block text-[15px] font-semibold text-fg">{a.name}</span>
                        <span className="block text-xs text-fg-muted">{a.same_muscle ? `${cap(a.muscle)}` : `Also works this muscle (mainly ${a.muscle})`}, {a.equipment.map(cap).join(', ').toLowerCase()}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-lime">{busy === a.exercise_id && <Loader2 className="h-4 w-4 animate-spin" />}Swap</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
    </Modal>
  )
}
