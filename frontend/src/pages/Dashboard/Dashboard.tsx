import clsx from 'clsx'
import { ArrowRight, ArrowUpRight, Award, Beef, Bot, Calendar, CalendarCheck, CheckCircle2, Dumbbell, Flame, Lock, NotebookPen, Plus, Quote, RefreshCw, Scale, Sparkles, Target, Timer, Trophy, TrendingDown, TrendingUp, UtensilsCrossed, Zap } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ActivityChart, CaloriesChart, ProteinChart, WeightChart } from '../../components/charts/Charts'
import { Badge, Bar, Button, Card, CardHeader, Celebration, EmptyState, ErrorState, MacroRow, PageSkeleton, Photo, Ring } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useAsync } from '../../hooks/useAsync'
import { useCountUp } from '../../hooks/useCountUp'
import { checkinApi, dashboardApi, progressApi } from '../../services/fitai'
import { fmtWeight, weightUnit, weightValue } from '../../utils/format'

const CH_ICON: Record<string, any> = { dumbbell: Dumbbell, notebook: NotebookPen, beef: Beef, scale: Scale }
const ACH_ICON: Record<string, any> = { dumbbell: Dumbbell, flame: Flame, zap: Zap, 'trending-down': TrendingDown, salad: UtensilsCrossed, flag: Target, trophy: Trophy }

function Spark({ data, color = '#C6F36B' }: { data: number[]; color?: string }) {
  const pts = data.filter(v => v > 0)
  if (pts.length < 3) return null
  const lo = Math.min(...pts), hi = Math.max(...pts), w = 84, h = 26
  const d = pts.map((v, i) => `${(i / (pts.length - 1)) * w},${h - 2 - ((v - lo) / (hi - lo || 1)) * (h - 4)}`).join(' ')
  const id = `sp${color.slice(1)}`
  return (
    <svg width={w} height={h} className="absolute right-4 top-[52px] opacity-80" aria-hidden>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".35" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <polygon points={`0,${h} ${d} ${w},${h}`} fill={`url(#${id})`} />
      <polyline points={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function Stat({ label, value, unit, sub, icon, accent, delay = 0, spark, sparkColor }: { label: string; value: number; unit?: string; sub?: React.ReactNode; icon: React.ReactNode; accent?: boolean; delay?: number; spark?: number[]; sparkColor?: string }) {
  const v = useCountUp(value)
  const decimals = Math.abs(value) < 1000 && value % 1 !== 0 ? 1 : 0
  return (
    <Card hover className={clsx('relative overflow-hidden p-5', accent && 'border-lime/30')} style={{ animationDelay: `${delay}ms` }}>
      {accent && <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-lime/10 blur-2xl" />}
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-fg-muted">{label}</p>
        <div className={clsx('flex h-8 w-8 items-center justify-center rounded-lg', accent ? 'bg-lime text-ink-950' : 'bg-white/[0.04] text-fg-muted')}>{icon}</div>
      </div>
      <p className="mt-3 font-display text-[28px] font-bold leading-none tabular-nums text-fg">
        {v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}<span className="ml-1 text-sm font-medium text-fg-dim">{unit}</span>
      </p>
      {spark && <Spark data={spark} color={sparkColor} />}
      {sub && <div className="mt-2 text-xs text-fg-muted">{sub}</div>}
    </Card>
  )
}

function CheckinPrompt() {
  const nav = useNavigate()
  const { data } = useAsync(() => checkinApi.current(), [])
  if (!data) return null
  const c = data.checkin
  return (
    <button onClick={() => nav('/checkins')} className="glow-border group flex w-full items-center gap-4 rounded-2xl border border-line bg-ink-800 px-5 py-4 text-left transition hover:border-line-strong">
      {c ? <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-lime/10 font-display text-base font-bold text-lime">{c.score}</span>
        : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-lime text-ink-950"><CalendarCheck className="h-5 w-5" /></span>}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-lime/80">Weekly check-in</p>
        <p className="truncate text-sm font-medium text-fg">{c ? c.summary.headline : "Your weekly review is due — see how the last 7 days went and get next week's targets."}</p>
      </div>
      <span className="hidden shrink-0 items-center gap-1 text-sm font-medium text-lime sm:flex">{c ? 'View' : 'Run it'}<ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
    </button>
  )
}

export default function Dashboard() {
  const { units } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const { data: d, error, loading, reload, setData } = useAsync(() => dashboardApi.get(), [])
  const [refreshing, setRefreshing] = useState(false)
  const [confetti, setConfetti] = useState(0)
  const celebrated = useRef(false)

  useEffect(() => {
    if (!d || celebrated.current || !d.new_achievements?.length) return
    celebrated.current = true
    progressApi.markSeen().catch(() => undefined)
    if (d.user?.is_demo) return  // every demo copy would celebrate the same sample milestones on every visit
    d.new_achievements.slice(0, 2).forEach((a: any) => toast('achievement', `Achievement unlocked: ${a.title}`, a.description))
    setConfetti(Date.now())
  }, [d, toast])

  if (loading && !d) return <PageSkeleton />
  if (error || !d) return <ErrorState message={error || 'No data'} onRetry={() => reload()} />

  const t = d.today.totals, tg = d.targets, w = d.weight
  const refreshRec = async () => {
    setRefreshing(true)
    try { const nd = await dashboardApi.get(true); setData(nd) } catch (e) { toast('error', 'Could not refresh', (e as Error).message) } finally { setRefreshing(false) }
  }
  const diff = w.difference_kg
  const unlocked = d.achievements.filter((a: any) => a.unlocked).length
  const up = d.upcoming_workout

  return (
    <div className="space-y-6">
      <Celebration fire={confetti} />
      {d.user.is_demo && (
        <div className="hidden items-center gap-3 rounded-xl border border-amber/25 bg-amber/[0.05] px-4 py-2.5 text-[13px] text-fg-muted sm:flex">
          <Badge tone="amber">Demo</Badge><span>You're viewing <b className="text-fg">sample data</b> for a fictional user. Tracking works — try logging food or a weigh-in.</span>
        </div>
      )}

      <CheckinPrompt />

      {/* HERO */}
      <section className="group relative overflow-hidden rounded-3xl border border-line">
        <Photo name="hero-training" alt="Athlete strength training in a premium gym" className="absolute inset-0" overlay="left" position="center 35%" />
        <div className="relative z-10 grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:p-10">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="lime"><Target className="h-3 w-3" />{d.goal.label}</Badge>
              {d.workouts.streak > 0 && <Badge tone="amber"><Flame className="h-3 w-3" />{d.workouts.streak}-workout streak</Badge>}
            </div>
            <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-[40px]">
              {w.goal_progress_pct >= 100 ? 'Goal reached. Time to set the next one.' : <>Every rep moves you closer, <span className="text-lime">{d.user.first_name}</span>.</>}
            </h1>
            <div className="mt-5 flex max-w-xl items-start gap-3 rounded-2xl glass p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-lime text-ink-950"><Sparkles className="h-4 w-4" /></div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-lime/80">Today's recommendation</p>
                <p className="mt-1 text-[14px] leading-relaxed text-fg">{d.recommendation.text}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {up ? <Button size="lg" icon={<Dumbbell className="h-4 w-4" />} onClick={() => nav('/workouts', { state: { start: up } })}>Start {up.when === 'Today' ? "today's" : 'next'} workout</Button>
                : <Button size="lg" icon={<Dumbbell className="h-4 w-4" />} onClick={() => nav('/workouts')}>Create workout plan</Button>}
              <Button size="lg" variant="secondary" icon={<Bot className="h-4 w-4" />} onClick={() => nav('/coach')}>Ask your coach</Button>
            </div>
          </div>
          <div className="flex items-center justify-center lg:pr-4">
            <Ring value={w.goal_progress_pct} max={100} size={190} stroke={14}>
              <p className="font-display text-4xl font-extrabold tabular-nums">{Math.round(w.goal_progress_pct)}<span className="text-lg text-fg-muted">%</span></p>
              <p className="mt-1 text-xs text-fg-muted">to goal</p>
              <p className="mt-2 text-[11px] text-fg-dim">{fmtWeight(w.start_kg, units)} → {fmtWeight(w.target_kg, units)}</p>
            </Ring>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="stagger grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <Stat label="Current weight" value={weightValue(w.current_kg, units)} unit={weightUnit(units)} icon={<Scale className="h-4 w-4" />} spark={w.series.slice(-14).map((r: any) => r.weight_kg)}
          sub={<span className={clsx(w.change_since_start_kg <= 0 ? 'text-moss-400' : 'text-amber')}>{w.change_since_start_kg > 0 ? '+' : ''}{fmtWeight(w.change_since_start_kg, units)} since start</span>} />
        <Stat label="Target weight" value={weightValue(w.target_kg, units)} unit={weightUnit(units)} icon={<Target className="h-4 w-4" />}
          sub={Math.abs(diff) < 0.1 ? 'At target' : `${fmtWeight(Math.abs(diff), units)} ${diff > 0 ? 'to lose' : 'to gain'}`} />
        <Stat label="Calories today" value={t.calories} unit={`/ ${tg.calories}`} icon={<Flame className="h-4 w-4" />} accent
          sub={<Bar value={t.calories} max={tg.calories} className="mt-1" />} />
        <Stat label="Protein today" spark={d.nutrition_history.map((r: any) => r.protein_g)} sparkColor="#7CC4F2" value={t.protein_g} unit={`/ ${tg.protein_g} g`} icon={<Beef className="h-4 w-4" />}
          sub={<Bar value={t.protein_g} max={tg.protein_g} color="bg-sky" className="mt-1" />} />
        <div className="col-span-2 lg:col-span-1"><Stat label="Workouts" value={d.workouts.total_completed} unit="done" icon={<Dumbbell className="h-4 w-4" />}
          sub={`${d.workouts.this_week} this week · streak ${d.workouts.streak}`} /></div>
      </section>

      {/* WEIGHT + NUTRITION */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Weight trend" subtitle={w.trend_kg_per_week != null ? `4-week trend ${w.trend_kg_per_week > 0 ? '+' : ''}${fmtWeight(w.trend_kg_per_week, units, 2)}/week` : 'Log weigh-ins to see your trend'}
            icon={w.trend_kg_per_week != null && w.trend_kg_per_week > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            action={<Button size="sm" variant="ghost" onClick={() => nav('/progress')}>Details <ArrowUpRight className="h-3.5 w-3.5" /></Button>} />
          <div className="px-2 pb-4 pt-2">
            {w.series.length >= 2 ? <WeightChart data={w.series} target={w.target_kg} units={units} height={260} />
              : <EmptyState className="m-3" icon={<Scale className="h-5 w-5" />} title="Your trend starts here" art="progress-hero" text="Log your weight a few times this week and your chart appears." action={<Button size="sm" onClick={() => nav('/progress')} icon={<Plus className="h-4 w-4" />}>Log weight</Button>} />}
          </div>
        </Card>
        <Card className="flex flex-col">
          <CardHeader title="Nutrition today" subtitle={`${Math.max(0, tg.calories - t.calories).toLocaleString()} kcal remaining`} icon={<UtensilsCrossed className="h-4 w-4" />}
            action={<Button size="sm" variant="ghost" onClick={() => nav('/nutrition')}><Plus className="h-3.5 w-3.5" /> Log</Button>} />
          <div className="flex items-center justify-center py-5">
            <Ring value={t.calories} max={tg.calories} size={150} stroke={12}>
              <p className="font-display text-3xl font-bold tabular-nums">{Math.round(t.calories)}</p><p className="text-xs text-fg-dim">of {tg.calories} kcal</p>
            </Ring>
          </div>
          <div className="space-y-3.5 px-5 pb-5">
            <MacroRow label="Protein" value={t.protein_g} target={tg.protein_g} color="#C6F36B" />
            <MacroRow label="Carbohydrates" value={t.carbs_g} target={tg.carbs_g} color="#7CC4F2" />
            <MacroRow label="Fat" value={t.fat_g} target={tg.fat_g} color="#F2B85B" />
          </div>
        </Card>
      </section>

      {/* AI + UPCOMING + QUOTE */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="relative overflow-hidden border-lime/30 bg-gradient-to-br from-lime/[0.08] via-ink-800 to-ink-800">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-lime/10 blur-3xl" />
          <div className="relative p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime text-ink-950"><Bot className="h-5 w-5" /></div>
                <div><p className="font-display text-[15px] font-semibold">AI Coach insight</p><p className="text-[11px] text-fg-dim">{d.recommendation.source === 'rule-based' ? 'Rule-based (no LLM configured)' : `Generated by ${d.recommendation.source}`}</p></div></div>
              <button onClick={refreshRec} disabled={refreshing} aria-label="Refresh recommendation" className="rounded-lg p-2 text-fg-muted hover:bg-white/5 hover:text-fg"><RefreshCw className={clsx('h-4 w-4', refreshing && 'animate-spin')} /></button>
            </div>
            <p className="mt-4 text-[15px] leading-relaxed text-fg">{d.recommendation.text}</p>
            <div className="mt-4 space-y-2">
              {d.insights.slice(0, 2).map((i: any) => (
                <div key={i.title} className="rounded-xl border border-line-soft bg-ink-900/60 px-3 py-2.5"><p className="text-xs font-semibold text-fg">{i.title}</p><p className="mt-0.5 line-clamp-2 text-xs text-fg-muted">{i.text}</p></div>
              ))}
            </div>
            <Button className="mt-4" size="sm" variant="outline" onClick={() => nav('/coach')} icon={<ArrowRight className="h-3.5 w-3.5" />}>Discuss with coach</Button>
          </div>
        </Card>

        <Card hover className="group overflow-hidden">
          <Photo name={up ? `cat-${up.split}` : 'workout-hero'} fallback="workout-hero" alt="Workout" className="h-36" overlay="strong" />
          <div className="-mt-12 relative px-5 pb-5">
            <Badge tone="lime"><Calendar className="h-3 w-3" />{up ? up.when : 'No plan yet'}</Badge>
            <h3 className="mt-2 font-display text-lg font-bold">{up ? up.name : 'Build your training plan'}</h3>
            {up ? (<>
              <p className="mt-1 flex items-center gap-3 text-xs text-fg-muted"><span className="flex items-center gap-1"><Dumbbell className="h-3.5 w-3.5" />{up.exercise_count} exercises</span><span className="flex items-center gap-1"><Timer className="h-3.5 w-3.5" />~{up.duration_minutes} min</span></p>
              <ul className="mt-3 space-y-1.5">{up.exercises.map((e: string) => <li key={e} className="flex items-center gap-2 text-[13px] text-fg-muted"><span className="h-1 w-1 rounded-full bg-lime" />{e}</li>)}</ul>
              <Button className="mt-4" full onClick={() => nav('/workouts', { state: { start: up } })} icon={<Dumbbell className="h-4 w-4" />}>Start workout</Button>
            </>) : (<>
              <p className="mt-1 text-sm text-fg-muted">Generate a plan that fits your goal, schedule and equipment.</p>
              <Button className="mt-4" full onClick={() => nav('/workouts')}>Generate plan</Button>
            </>)}
          </div>
        </Card>

        <Card className="relative flex flex-col justify-between overflow-hidden p-6">
          <Quote className="absolute right-5 top-5 h-16 w-16 text-white/[0.04]" />
          <div>
            <Badge>{d.quote.category}</Badge>
            <p className="mt-4 font-display text-xl font-semibold leading-snug text-fg">“{d.quote.text}”</p>
          </div>
          <p className="mt-6 text-xs text-fg-dim">— {d.quote.author} · Daily motivation</p>
        </Card>
      </section>

      {/* CHARTS */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card><CardHeader title="Daily calories" subtitle="Last 14 days vs target" icon={<Flame className="h-4 w-4" />} />
          <div className="px-2 pb-3 pt-2"><CaloriesChart data={d.nutrition_history} target={tg.calories} /></div></Card>
        <Card><CardHeader title="Protein intake" subtitle={`Target ${tg.protein_g} g/day`} icon={<Beef className="h-4 w-4" />} />
          <div className="px-2 pb-3 pt-2"><ProteinChart data={d.nutrition_history} target={tg.protein_g} height={220} /></div></Card>
        <Card><CardHeader title="Weekly activity" subtitle={`${d.workouts.this_week} ${d.workouts.this_week === 1 ? 'workout' : 'workouts'} this week`} icon={<Dumbbell className="h-4 w-4" />} />
          <div className="px-2 pb-3 pt-2"><ActivityChart data={d.workouts.last_7_days} height={220} /></div></Card>
      </section>

      {/* CHALLENGES + ACHIEVEMENTS + QUICK ACTIONS */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Weekly challenges" subtitle="Resets every Monday" icon={<Zap className="h-4 w-4" />} />
          <div className="space-y-4 p-5">
            {d.challenges.map((c: any) => { const I = CH_ICON[c.icon] ?? Zap; return (
              <div key={c.id} className="flex items-center gap-3">
                <div className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', c.completed ? 'bg-lime text-ink-950' : 'bg-white/[0.04] text-fg-muted')}>{c.completed ? <CheckCircle2 className="h-4 w-4" /> : <I className="h-4 w-4" />}</div>
                <div className="min-w-0 flex-1"><div className="mb-1.5 flex justify-between gap-2 text-[13px]"><span className="truncate text-fg">{c.title}</span><span className="tabular-nums text-fg-dim">{c.progress}/{c.goal}</span></div><Bar value={c.progress} max={c.goal} /></div>
              </div>) })}
          </div>
        </Card>
        <Card>
          <CardHeader title="Achievements" subtitle={`${unlocked} of ${d.achievements.length} unlocked`} icon={<Award className="h-4 w-4" />} />
          <div className="grid grid-cols-4 gap-3 p-5">
            {d.achievements.map((a: any) => { const I = ACH_ICON[a.icon] ?? Trophy; return (
              <div key={a.code} title={`${a.title} — ${a.description}`} className="flex flex-col items-center text-center">
                <div className={clsx('flex h-12 w-12 items-center justify-center rounded-2xl border transition', a.unlocked ? 'border-lime/40 bg-lime/10 text-lime shadow-glow' : 'border-line bg-ink-900 text-fg-dim')}>
                  {a.unlocked ? <I className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
                </div>
                <p className={clsx('mt-1.5 line-clamp-2 text-[10.5px] leading-tight', a.unlocked ? 'text-fg' : 'text-fg-dim')}>{a.title}</p>
              </div>) })}
          </div>
        </Card>
        <Card>
          <CardHeader title="Quick actions" icon={<Sparkles className="h-4 w-4" />} />
          <div className="grid grid-cols-2 gap-2.5 p-5">
            {[['Log food', UtensilsCrossed, '/nutrition'], ['Log weight', Scale, '/progress'], ['Meal plan', NotebookPen, '/diet'], ['Ask coach', Bot, '/coach']].map(([l, I, to]: any) => (
              <button key={l} onClick={() => nav(to)} className="group flex flex-col items-start gap-3 rounded-2xl border border-line bg-ink-900 p-4 text-left transition hover:-translate-y-0.5 hover:border-lime/40">
                <I className="h-5 w-5 text-lime" /><span className="flex w-full items-center justify-between text-sm font-medium">{l}<ArrowRight className="h-3.5 w-3.5 text-fg-dim transition group-hover:translate-x-0.5 group-hover:text-lime" /></span>
              </button>
            ))}
          </div>
          {d.saved_recommendations.length > 0 && (
            <div className="border-t border-line-soft px-5 py-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-dim">Saved from coach</p>
              {d.saved_recommendations.map((s: any) => <p key={s.id} className="truncate text-[13px] text-fg-muted">• {s.title}</p>)}
            </div>
          )}
        </Card>
      </section>
      <p className="pb-2 text-center text-xs text-fg-dim">BMR {d.calc.bmr} kcal · TDEE {d.calc.tdee} kcal · BMI {d.calc.bmi.bmi}. {d.disclaimer}</p>
    </div>
  )
}
