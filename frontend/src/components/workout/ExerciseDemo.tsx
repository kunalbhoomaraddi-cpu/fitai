import clsx from 'clsx'
import { Info, Pause, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Modal } from '../ui'
import { EXERCISE_DEMOS } from '../../data/exerciseDemos'

export const demoFor = (exerciseId?: string) => (exerciseId ? EXERCISE_DEMOS[exerciseId] : undefined)
export const demoImg = (exerciseId: string, frame: 0 | 1) => `/images/exercises/${exerciseId}/${frame}.webp`

/** Start/end photos that alternate, so the movement reads like a short clip. */
export function DemoFrames({ exerciseId, name, playing = true, className, speed = 1100 }: { exerciseId: string; name: string; playing?: boolean; className?: string; speed?: number }) {
  const demo = demoFor(exerciseId)
  const [frame, setFrame] = useState<0 | 1>(0)
  useEffect(() => {
    if (!playing || !demo || demo.frames < 2) return
    const t = setInterval(() => setFrame(f => (f ? 0 : 1)), speed)
    return () => clearInterval(t)
  }, [playing, demo, speed])
  if (!demo) return null
  return (
    <div className={clsx('relative overflow-hidden bg-white', className)}>
      {([0, 1] as const).slice(0, demo.frames).map(i => (
        <img key={i} src={demoImg(exerciseId, i)} alt={`${name} — ${i ? 'end' : 'start'} position`} draggable={false}
          className={clsx('absolute inset-0 h-full w-full select-none object-cover transition-opacity duration-300', frame === i ? 'opacity-100' : 'opacity-0')} />
      ))}
    </div>
  )
}

export function ExerciseDemoModal({ open, onClose, exerciseId, name, tip, sets, reps }: {
  open: boolean; onClose: () => void; exerciseId: string; name: string; tip?: string; sets?: number; reps?: string
}) {
  const demo = demoFor(exerciseId)
  const [playing, setPlaying] = useState(true)
  useEffect(() => { if (open) setPlaying(true) }, [open])
  return (
    <Modal open={open} onClose={onClose} wide title={name}>
      {demo ? (
        <div className="relative">
          <DemoFrames exerciseId={exerciseId} name={name} playing={playing} className="aspect-[3/2] w-full rounded-2xl" />
          <button onClick={() => setPlaying(p => !p)} aria-label={playing ? 'Pause demo' : 'Play demo'}
            className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur transition hover:bg-black/80">
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white">Start ↔ finish position</span>
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-white/[0.02] p-4 text-sm text-fg-muted">No photo demo for this exercise yet — follow the steps below.</div>
      )}
      {(sets || reps) && <p className="mt-4 text-sm text-fg"><b>Today:</b> {sets} sets × {reps}</p>}
      {demo?.note && <p className="mt-3 flex gap-2 rounded-xl bg-sky-500/10 px-3 py-2 text-[13px] text-sky-200"><Info className="mt-0.5 h-4 w-4 shrink-0" />{demo.note}</p>}
      {tip && <div className="mt-4 rounded-xl border border-lime/25 bg-lime/[0.05] px-4 py-3 text-[13px] leading-relaxed text-fg"><b className="text-lime">Coach tip: </b>{tip}</div>}
      {demo && (
        <ol className="mt-4 space-y-2.5">
          {demo.steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-[13.5px] leading-relaxed text-fg-muted">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-semibold text-fg">{i + 1}</span>{s}
            </li>
          ))}
        </ol>
      )}
      <p className="mt-5 text-[11px] text-fg-dim">Stop if you feel sharp pain. Demo photos: free-exercise-db (public domain).</p>
    </Modal>
  )
}
