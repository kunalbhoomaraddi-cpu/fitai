import clsx from 'clsx'
import { Bookmark, BookmarkCheck, CalendarDays, Check, ChevronDown, Clock, Dumbbell, Flag, History, Info, Pause, Play, Plus, RotateCcw, Sparkles, Timer, Trash2, Trophy, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ActivityChart } from '../../components/charts/Charts'
import { Badge, Bar, Button, Card, CardHeader, Celebration, Chip, EmptyState, ErrorState, Label, Modal, Notice, PageHeader, Photo, Ring, Segmented, Select, Skeleton } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useAsync } from '../../hooks/useAsync'
import { ExerciseDemoModal, demoFor, demoImg } from '../../components/workout/ExerciseDemo'
import { workoutApi } from '../../services/fitai'
import type { Exercise, WorkoutPlan, WorkoutSession } from '../../types'
import { cap, EQUIPMENT, GOAL_LABEL, MUSCLES, shortDate } from '../../utils/format'

const SPLITS: [string, string, string][] = [
  ['auto', 'Smart pick', 'FitAI chooses the best split'], ['push_pull_legs', 'Push / Pull / Legs', 'Classic hypertrophy split'],
  ['upper_lower', 'Upper / Lower', 'Balanced strength & volume'], ['full_body', 'Full Body', 'Efficient, high frequency'],
  ['beginner', 'Beginner Routine', 'Foundational movements'], ['muscle_building', 'Muscle Building', 'Volume-focused'],
  ['fat_loss', 'Fat Loss', 'Strength + conditioning'], ['custom', 'Custom Routine', 'Choose target muscles'],
]
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const ACH: Record<string, string> = { first_workout: 'First Rep', five_workouts: 'Momentum', streak_7: 'Seven Strong' }

function ExerciseRow({ e, index, session, onToggle, onSet }: { e: Exercise; index: number; session?: boolean; onToggle?: () => void; onSet?: () => void }) {
  const [open, setOpen] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)
  const hasDemo = !!demoFor(e.exercise_id)
  const done = e.sets_done ?? 0
  return (
    <div className={clsx('group overflow-hidden rounded-2xl border transition', e.completed ? 'border-lime/40 bg-lime/[0.03]' : 'border-line bg-ink-900/60 hover:border-line-strong')}>
      <div className="flex items-center gap-4 p-3 pr-4">
        <button onClick={() => setDemoOpen(true)} aria-label={`Watch ${e.name} demo`} className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xl sm:h-24 sm:w-20">
          {hasDemo ? <img src={demoImg(e.exercise_id, 1)} alt="" loading="lazy" className="absolute inset-0 h-full w-full bg-white object-cover" />
            : <Photo name={e.image} alt={`${e.muscle} illustration`} className="absolute inset-0" overlay={false} />}
          <span className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-90 transition group-hover:bg-black/40">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"><Play className="ml-0.5 h-3.5 w-3.5" /></span>
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><span className="text-[11px] tabular-nums text-fg-dim">{String(index + 1).padStart(2, '0')}</span><p className="truncate font-display text-[15px] font-semibold">{e.name}</p></div>
          <p className="mt-0.5 text-xs capitalize text-fg-muted">{e.muscle}{e.secondary.length ? ` · ${e.secondary.slice(0, 2).join(', ')}` : ''}</p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11.5px]">
            <span className="rounded-md bg-white/[0.05] px-2 py-0.5 tabular-nums">{e.sets} sets</span>
            <span className="rounded-md bg-white/[0.05] px-2 py-0.5 tabular-nums">{e.reps} reps</span>
            <span className="flex items-center gap-1 rounded-md bg-white/[0.05] px-2 py-0.5 tabular-nums"><Timer className="h-3 w-3" />{e.rest_seconds}s</span>
            <button onClick={() => setDemoOpen(true)} className="flex items-center gap-1 rounded-md bg-lime/10 px-2 py-0.5 font-medium text-lime transition hover:bg-lime/20"><Play className="h-3 w-3" />{hasDemo ? 'Demo' : 'How to'}</button>
          </div>
        </div>
        {session ? (
          <div className="flex shrink-0 flex-col items-end gap-2">
            <button onClick={onSet} disabled={e.completed} className="rounded-lg border border-line px-2.5 py-1 text-xs tabular-nums text-fg-muted transition hover:border-lime/50 hover:text-lime disabled:opacity-50" aria-label="Complete a set">Set {Math.min(done + 1, e.sets)}/{e.sets}</button>
            <button onClick={onToggle} aria-label={e.completed ? 'Mark incomplete' : 'Mark complete'} className={clsx('flex h-9 w-9 items-center justify-center rounded-full border-2 transition', e.completed ? 'border-lime bg-lime text-ink-950' : 'border-line-strong text-transparent hover:border-lime hover:text-lime/50')}><Check className="h-4 w-4" /></button>
          </div>
        ) : (
          <button onClick={() => setOpen(o => !o)} aria-label="Instructions" className="shrink-0 rounded-lg p-2 text-fg-dim hover:bg-white/5 hover:text-fg"><ChevronDown className={clsx('h-4 w-4 transition', open && 'rotate-180')} /></button>
        )}
      </div>
      {session && <div className="px-3 pb-3"><Bar value={done} max={e.sets} height="h-1" /></div>}
      {open && !session && (
        <div className="border-t border-line-soft px-4 py-3 text-[13px] leading-relaxed text-fg-muted">
          {e.instructions}
          <p className="mt-1 text-[11px] text-fg-dim">Equipment: {e.equipment.map(cap).join(', ')}</p>
        </div>
      )}
      <ExerciseDemoModal open={demoOpen} onClose={() => setDemoOpen(false)} exerciseId={e.exercise_id} name={e.name} tip={e.instructions} sets={e.sets} reps={e.reps} />
    </div>
  )
}

function RestTimer({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [left, setLeft] = useState(seconds)
  const [paused, setPaused] = useState(false)
  useEffect(() => { setLeft(seconds) }, [seconds])
  useEffect(() => {
    if (paused) return
    if (left <= 0) { onDone(); return }
    const t = setTimeout(() => setLeft(l => l - 1), 1000); return () => clearTimeout(t)
  }, [left, paused, onDone])
  return (
    <div className="flex animate-pop items-center gap-4 rounded-2xl border border-lime/40 bg-ink-850 p-4 shadow-glow">
      <Ring value={left} max={seconds} size={72} stroke={6}><span className="font-display text-lg font-bold tabular-nums">{left}</span></Ring>
      <div className="flex-1"><p className="font-semibold">Rest</p><p className="text-xs text-fg-muted">Breathe, sip water, set up for the next set.</p></div>
      <button onClick={() => setPaused(p => !p)} className="rounded-lg p-2 text-fg-muted hover:text-fg" aria-label={paused ? 'Resume' : 'Pause'}>{paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}</button>
      <button onClick={() => setLeft(l => l + 15)} className="rounded-lg px-2 py-1 text-xs text-fg-muted hover:text-fg">+15s</button>
      <button onClick={onDone} className="rounded-lg p-2 text-fg-muted hover:text-fg" aria-label="Skip rest"><X className="h-4 w-4" /></button>
    </div>
  )
}

function ActiveSession({ s, onChange, onFinish, onAbandon }: { s: WorkoutSession; onChange: (ex: Exercise[]) => void; onFinish: () => void; onAbandon: () => void }) {
  const [now, setNow] = useState(Date.now())
  const [rest, setRest] = useState<number | null>(null)
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const elapsed = Math.max(0, Math.floor((now - new Date(s.started_at).getTime()) / 1000))
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0'), ss = String(elapsed % 60).padStart(2, '0')
  const done = s.exercises.filter(e => e.completed).length
  const update = (i: number, patch: Partial<Exercise>) => onChange(s.exercises.map((e, j) => (j === i ? { ...e, ...patch } : e)))
  return (
    <Card className="overflow-hidden border-lime/30">
      <div className="flex flex-wrap items-center gap-4 border-b border-line-soft bg-gradient-to-r from-lime/[0.08] to-transparent p-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime text-ink-950"><Dumbbell className="h-6 w-6" /></div>
        <div className="flex-1"><Badge tone="lime">In progress</Badge><h2 className="mt-1 font-display text-xl font-bold">{s.name}</h2></div>
        <div className="text-right"><p className="font-display text-3xl font-bold tabular-nums">{mm}:{ss}</p><p className="text-xs text-fg-dim">{done}/{s.exercises.length} exercises</p></div>
      </div>
      <div className="space-y-3 p-4 sm:p-5">
        <Bar value={done} max={s.exercises.length} height="h-2" />
        {rest !== null && <RestTimer seconds={rest} onDone={() => setRest(null)} />}
        {s.exercises.map((e, i) => (
          <ExerciseRow key={i} e={e} index={i} session
            onToggle={() => update(i, { completed: !e.completed, sets_done: !e.completed ? e.sets : e.sets_done })}
            onSet={() => { const n = Math.min(e.sets, (e.sets_done ?? 0) + 1); update(i, { sets_done: n, completed: n >= e.sets }); if (n < e.sets) setRest(e.rest_seconds) }} />
        ))}
        <div className="flex flex-wrap justify-between gap-2 pt-2">
          <Button variant="ghost" onClick={onAbandon} icon={<X className="h-4 w-4" />}>Discard</Button>
          <Button size="lg" onClick={onFinish} icon={<Flag className="h-4 w-4" />}>Finish workout</Button>
        </div>
        <p className="text-center text-[11px] text-fg-dim">Stop if you feel sharp pain, dizziness or chest discomfort. Quality reps beat more reps.</p>
      </div>
    </Card>
  )
}

export default function WorkoutPlanner() {
  const { profile } = useAuth()
  const toast = useToast()
  const loc = useLocation() as { state?: { start?: { plan_id: number; day_index: number } } }
  const navigate = useNavigate()
  const [tab, setTab] = useState<'plan' | 'generate' | 'history'>('plan')
  const active = useAsync(() => workoutApi.active(), [])
  const sessionQ = useAsync(() => workoutApi.activeSession(), [])
  const [plan, setPlan] = useState<WorkoutPlan | null>(null)
  const [dayIdx, setDayIdx] = useState(0)
  const [session, setSession] = useState<WorkoutSession | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confetti, setConfetti] = useState(0)
  const [summary, setSummary] = useState<WorkoutSession | null>(null)
  const [history, setHistory] = useState<{ sessions: WorkoutSession[]; stats: any; plans: WorkoutPlan[] } | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()
  const [form, setForm] = useState({ split: 'auto', goal: profile?.goal ?? 'general_fitness', experience: profile?.experience ?? 'beginner', days: Math.min(6, profile?.workout_days_per_week ?? 3), duration: profile?.workout_minutes ?? 45, equipment: profile?.equipment ?? ['bodyweight'], muscles: [] as string[], recovery: 'standard', useAi: true })

  useEffect(() => { if (active.data !== undefined) setPlan(active.data); if (active.data === null && !active.loading) setTab('generate') }, [active.data, active.loading])
  useEffect(() => { if (sessionQ.data) setSession(sessionQ.data) }, [sessionQ.data])
  useEffect(() => {
    const st = loc.state?.start
    if (st && !sessionQ.loading && !sessionQ.data) { navigate('.', { replace: true, state: null }); start(st.plan_id, st.day_index) }
  }, [loc.state, sessionQ.loading]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!plan) return
    const today = WEEK[(new Date().getDay() + 6) % 7]
    const i = plan.days.findIndex(d => d.weekday === today)
    setDayIdx(i >= 0 ? i : 0)
  }, [plan?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (tab !== 'history') return
    Promise.all([workoutApi.history(), workoutApi.stats(), workoutApi.plans()]).then(([sessions, stats, plans]) => setHistory({ sessions, stats, plans })).catch(e => toast('error', 'Could not load history', e.message))
  }, [tab, toast])

  const generate = async () => {
    setBusy('gen')
    try {
      const p = await workoutApi.generate({ split: form.split, goal: form.goal, experience: form.experience, days_per_week: form.days, duration_minutes: form.duration, equipment: form.equipment, target_muscles: form.muscles, recovery: form.recovery, use_ai: form.useAi })
      setPlan(p); setTab('plan'); toast('success', 'Workout plan ready', p.notice || undefined)
    } catch (e) { toast('error', 'Generation failed', (e as Error).message) } finally { setBusy(null) }
  }
  const start = async (planId: number | null, day: number) => {
    setBusy('start')
    try { setSession(await workoutApi.start(planId, day)); window.scrollTo({ top: 0, behavior: 'smooth' }) } catch (e) { toast('error', 'Could not start', (e as Error).message) } finally { setBusy(null) }
  }
  const changeSession = (ex: Exercise[]) => {
    if (!session) return
    const next = { ...session, exercises: ex }
    setSession(next)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => workoutApi.updateSession(session.id, { exercises: ex }).catch(() => undefined), 600)
  }
  const finish = async () => {
    if (!session) return
    clearTimeout(saveTimer.current)
    setBusy('finish')
    try {
      const r = await workoutApi.updateSession(session.id, { exercises: session.exercises, status: 'completed' })
      setSession(null); setSummary(r); setConfetti(Date.now())
      ;(r.new_achievements || []).forEach(c => toast('achievement', `Achievement unlocked: ${ACH[c] ?? cap(c)}`))
    } catch (e) { toast('error', 'Could not finish', (e as Error).message) } finally { setBusy(null) }
  }
  const abandon = async () => { if (!session) return; await workoutApi.updateSession(session.id, { status: 'abandoned' }).catch(() => undefined); setSession(null); toast('info', 'Workout discarded') }

  const day = plan?.days[dayIdx]
  const trainingDays = useMemo(() => new Map(plan?.days.map((d, i) => [d.weekday, i]) ?? []), [plan])

  return (
    <div>
      <Celebration fire={confetti} />
      <div className="group relative mb-6 overflow-hidden rounded-3xl border border-line">
        <Photo name="workout-hero" alt="Strength training" className="absolute inset-0" overlay="left" position="center 40%" />
        <div className="relative p-6 sm:p-8">
          <PageHeader eyebrow="AI Workout Planner" title="Train with a plan that fits you" subtitle={`Programmed for ${GOAL_LABEL[profile?.goal ?? 'general_fitness'].toLowerCase()}, your experience and the equipment you actually have.`} />
          <div className="flex flex-wrap gap-2">
            {(['plan', 'generate', 'history'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className={clsx('flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition', tab === t ? 'bg-lime text-ink-950' : 'glass text-fg-muted hover:text-fg')}>
                {t === 'plan' ? <CalendarDays className="h-4 w-4" /> : t === 'generate' ? <Sparkles className="h-4 w-4" /> : <History className="h-4 w-4" />}
                {t === 'plan' ? 'My plan' : t === 'generate' ? 'Generate' : 'History'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {session && <div className="mb-6"><ActiveSession s={session} onChange={changeSession} onFinish={finish} onAbandon={abandon} /></div>}

      {tab === 'plan' && !session && (
        active.loading ? <div className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-96" /></div> :
          active.error ? <ErrorState message={active.error} onRetry={() => active.reload()} /> :
            !plan ? <EmptyState icon={<Dumbbell className="h-5 w-5" />} title="No workout plan yet" art="workout-hero" text="Generate a plan and it will appear here with your weekly schedule." action={<Button onClick={() => setTab('generate')}>Generate a plan</Button>} /> : (
              <div className="space-y-5">
                {plan.notice && <Notice tone={plan.notice.startsWith('Demo') ? 'demo' : 'warn'} icon={<Info className="h-4 w-4" />}>{plan.notice}</Notice>}
                <Card className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-xl font-bold">{plan.title}</h2>{plan.is_saved && <Badge tone="lime"><BookmarkCheck className="h-3 w-3" />Saved</Badge>}
                        <Badge tone={plan.generated_by.includes('llm') ? 'amber' : 'moss'}>{plan.generated_by.includes('llm') ? 'Engine + AI coach note' : 'FitAI programming engine'}</Badge></div>
                      <p className="mt-1 text-xs text-fg-dim">{GOAL_LABEL[plan.inputs.goal]} · {cap(plan.inputs.experience)} · {plan.inputs.duration_minutes} min sessions</p>
                    </div>
                    <div className="flex gap-2">{!plan.is_saved && <Button variant="secondary" size="sm" icon={<Bookmark className="h-3.5 w-3.5" />} loading={busy === 'save'} onClick={async () => { setBusy('save'); try { setPlan(await workoutApi.save(plan.id)); toast('success', 'Plan saved') } finally { setBusy(null) } }}>Save plan</Button>}
                      <Button size="sm" variant="ghost" onClick={() => setTab('generate')}>New plan</Button></div>
                  </div>
                  <div className="mt-5 grid grid-cols-7 gap-1.5 sm:gap-2">
                    {WEEK.map(w => { const i = trainingDays.get(w); const isToday = WEEK[(new Date().getDay() + 6) % 7] === w; return (
                      <button key={w} disabled={i === undefined} onClick={() => i !== undefined && setDayIdx(i)}
                        className={clsx('flex flex-col items-center rounded-xl border px-1 py-2.5 transition sm:py-3', i === undefined ? 'border-line-soft bg-transparent text-fg-dim' : i === dayIdx ? 'border-lime bg-lime/10 text-fg' : 'border-line bg-ink-900 text-fg-muted hover:border-line-strong')}>
                        <span className={clsx('text-[11px] font-semibold', isToday && 'text-lime')}>{w}</span>
                        <span className="mt-1 hidden text-[10px] sm:block">{i === undefined ? 'Rest' : plan.days[i].name.split(' ')[0]}</span>
                        <span className={clsx('mt-1.5 h-1.5 w-1.5 rounded-full', i === undefined ? 'bg-line' : 'bg-lime')} />
                      </button>) })}
                  </div>
                  {plan.coach_note && <div className="mt-5 flex gap-3 rounded-xl border border-line-soft bg-ink-900/70 p-4"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-lime" /><p className="text-[13.5px] leading-relaxed text-fg-muted">{plan.coach_note}</p></div>}
                </Card>
                {day && (
                  <Card>
                    <CardHeader title={`${day.weekday} · ${day.name}`} subtitle={`${day.exercises.length} exercises · ~${day.duration_minutes} min · ${day.focus.map(cap).join(', ')}`} icon={<Dumbbell className="h-4 w-4" />}
                      action={<Button onClick={() => start(plan.id, dayIdx)} loading={busy === 'start'} icon={<Play className="h-4 w-4" />}>Start workout</Button>} />
                    <div className="stagger space-y-3 p-5">
                      <Notice tone="info" icon={<Info className="h-4 w-4" />}>Warm up 5–8 minutes with easy cardio and 1–2 light ramp-up sets before your first exercise.</Notice>
                      {day.exercises.map((e, i) => <ExerciseRow key={e.exercise_id + i} e={e} index={i} />)}
                    </div>
                  </Card>
                )}
                {plan.recovery_note && <p className="text-center text-xs text-fg-dim">Rest days: {plan.rest_days.join(', ') || '—'} · {plan.recovery_note}</p>}
              </div>
            ))}

      {tab === 'generate' && (
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div>
            <p className="mb-3 text-sm font-medium text-fg-muted">Choose a training style</p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {SPLITS.map(([v, t, d]) => (
                <button key={v} onClick={() => setForm({ ...form, split: v })} className={clsx('group relative h-40 overflow-hidden rounded-2xl border text-left transition', form.split === v ? 'border-lime shadow-glow' : 'border-line hover:border-line-strong')}>
                  <Photo name={`cat-${v === 'auto' ? 'full_body' : v}`} alt={t} className="absolute inset-0" overlay="strong" />
                  <div className="absolute inset-x-0 bottom-0 p-3.5"><p className="font-display text-[15px] font-semibold">{t}</p><p className="text-xs text-fg-muted">{d}</p></div>
                  {form.split === v && <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-lime text-ink-950"><Check className="h-3.5 w-3.5" /></div>}
                </button>
              ))}
            </div>
            {form.split === 'custom' && (
              <Card className="mt-4 p-5"><Label>Target muscle groups</Label>
                <div className="flex flex-wrap gap-2">{MUSCLES.map(m => <Chip key={m} active={form.muscles.includes(m)} onClick={() => setForm({ ...form, muscles: form.muscles.includes(m) ? form.muscles.filter(x => x !== m) : [...form.muscles, m] })}>{cap(m)}</Chip>)}</div></Card>
            )}
          </div>
          <Card className="h-fit">
            <CardHeader title="Training inputs" subtitle="Prefilled from your profile" icon={<Sparkles className="h-4 w-4" />} />
            <div className="space-y-4 p-5">
              <div><Label htmlFor="goal">Fitness goal</Label><Select id="goal" value={form.goal} onChange={e => setForm({ ...form, goal: e.target.value as any })}>{Object.entries(GOAL_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></div>
              <div><Label>Experience</Label><Segmented size="sm" options={[['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']] as const} value={form.experience as any} onChange={v => setForm({ ...form, experience: v })} /></div>
              <div><Label>Training days / week</Label><div className="flex flex-wrap gap-1.5">{[1, 2, 3, 4, 5, 6].map(n => <Chip key={n} active={form.days === n} onClick={() => setForm({ ...form, days: n })}>{n}</Chip>)}</div></div>
              <div><Label>Workout duration</Label><div className="flex flex-wrap gap-1.5">{[30, 45, 60, 75, 90].map(n => <Chip key={n} active={form.duration === n} onClick={() => setForm({ ...form, duration: n })}>{n} min</Chip>)}</div></div>
              <div><Label>Equipment</Label><div className="flex flex-wrap gap-1.5">{EQUIPMENT.map(([v, l]) => <Chip key={v} active={form.equipment.includes(v)} onClick={() => setForm({ ...form, equipment: form.equipment.includes(v) ? form.equipment.filter(x => x !== v) : [...form.equipment, v] })}>{l}</Chip>)}</div></div>
              <div><Label>Recovery preference</Label><Segmented size="sm" options={[['standard', 'Standard'], ['extra_rest', 'Extra rest'], ['active_recovery', 'Active']] as const} value={form.recovery as any} onChange={v => setForm({ ...form, recovery: v })} /></div>
              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line bg-ink-900 px-3.5 py-3"><span className="flex items-center gap-2 text-sm"><Sparkles className="h-4 w-4 text-lime" />AI coach notes</span><input type="checkbox" checked={form.useAi} onChange={e => setForm({ ...form, useAi: e.target.checked })} className="h-4 w-4 accent-[#C6F36B]" /></label>
              <Button full size="lg" onClick={generate} loading={busy === 'gen'} icon={<Sparkles className="h-4 w-4" />}>Generate workout plan</Button>
              <p className="text-[11px] text-fg-dim">Sets, reps and exercise selection come from FitAI's deterministic programming engine; the AI adds coaching guidance.</p>
            </div>
          </Card>
        </div>
      )}

      {tab === 'history' && (
        !history ? <div className="space-y-4"><Skeleton className="h-64" /><Skeleton className="h-64" /></div> : (
          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2"><CardHeader title="Workouts per week" subtitle={`${history.stats.total_completed} total · avg ${history.stats.avg_duration_min} min · streak ${history.stats.streak}`} icon={<CalendarDays className="h-4 w-4" />} />
              <div className="px-2 pb-3 pt-2"><ActivityChart data={history.stats.weekly_counts} xKey="week_start" height={240} /></div></Card>
            <Card><CardHeader title="Saved & recent plans" icon={<Bookmark className="h-4 w-4" />} />
              <div className="space-y-2 p-5">
                {history.plans.slice(0, 6).map(p => (
                  <div key={p.id} className="flex items-center gap-2 rounded-xl border border-line bg-ink-900 px-3 py-2.5">
                    <button className="min-w-0 flex-1 text-left" onClick={() => { setPlan(p); setTab('plan') }}><p className="truncate text-sm">{p.title}</p><p className="text-[11px] text-fg-dim">{shortDate(p.created_at.slice(0, 10))}{p.is_saved ? ' · saved' : ''}</p></button>
                    <button aria-label="Delete plan" onClick={async () => { await workoutApi.remove(p.id); setHistory(h => h && { ...h, plans: h.plans.filter(x => x.id !== p.id) }); if (plan?.id === p.id) active.reload() }} className="rounded p-1.5 text-fg-dim hover:text-coral"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div></Card>
            <Card className="lg:col-span-3"><CardHeader title="Completed workouts" icon={<History className="h-4 w-4" />} action={<Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => start(null, 0)}>Quick workout</Button>} />
              <div className="divide-y divide-line-soft p-2">
                {history.sessions.length === 0 && <p className="p-4 text-sm text-fg-muted">No completed workouts yet.</p>}
                {history.sessions.map(s => (
                  <div key={s.id} className="flex items-center gap-4 px-3 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime/10 text-lime"><Check className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{s.name}</p><p className="text-xs text-fg-dim">{new Date(s.started_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · {s.exercises.filter(e => e.completed).length}/{s.exercises.length} exercises</p></div>
                    <span className="flex items-center gap-1 text-sm tabular-nums text-fg-muted"><Clock className="h-3.5 w-3.5" />{s.duration_minutes} min</span>
                  </div>
                ))}
              </div></Card>
          </div>
        ))}

      <Modal open={!!summary} onClose={() => setSummary(null)} title="Workout complete">
        {summary && (
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-lime text-ink-950 shadow-glow"><Trophy className="h-8 w-8" /></div>
            <h3 className="mt-4 font-display text-2xl font-bold">Great work!</h3>
            <p className="mt-1 text-sm text-fg-muted">{summary.name} · {summary.duration_minutes} min · {summary.exercises.filter(e => e.completed).length}/{summary.exercises.length} exercises</p>
            <p className="mt-4 text-xs text-fg-dim">Refuel with protein and carbs within a few hours, and get good sleep tonight.</p>
            <div className="mt-5 flex justify-center gap-2"><Button variant="secondary" icon={<RotateCcw className="h-4 w-4" />} onClick={() => { setSummary(null); setTab('history') }}>View history</Button><Button onClick={() => setSummary(null)}>Done</Button></div>
          </div>
        )}
      </Modal>
    </div>
  )
}
