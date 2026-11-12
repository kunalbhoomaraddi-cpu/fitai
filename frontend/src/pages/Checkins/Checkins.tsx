import clsx from 'clsx'
import { AlertTriangle, Beef, Bot, CalendarCheck, CheckCircle2, ChevronDown, Dumbbell, NotebookPen, RefreshCw, Scale, Sparkles, Target, Trash2, Trophy } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Badge, Button, Card, CardHeader, Celebration, EmptyState, ErrorState, Notice, PageHeader, Ring, Skeleton } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useAsync } from '../../hooks/useAsync'
import { checkinApi, type Checkin } from '../../services/fitai'
import { fmtWeight, n0, shortDate, weightUnit } from '../../utils/format'

const scoreTone = (s: number) => (s >= 85 ? '#C6F36B' : s >= 60 ? '#9BD77A' : s >= 30 ? '#F2B85B' : '#F2876B')
const scoreWord = (s: number) => (s >= 85 ? 'Excellent' : s >= 60 ? 'Good' : s >= 30 ? 'Building' : 'Restart')

function Stat({ icon, label, value, sub, ok }: { icon: ReactNode; label: string; value: ReactNode; sub?: ReactNode; ok?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.02] p-4">
      <div className="flex items-center justify-between text-fg-muted">
        <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider">{icon}{label}</span>
        {ok !== undefined && (ok ? <CheckCircle2 className="h-4 w-4 text-lime" /> : <span className="h-2 w-2 rounded-full bg-amber/70" />)}
      </div>
      <p className="mt-2 font-display text-2xl font-bold text-fg">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-fg-dim">{sub}</p>}
    </div>
  )
}

function Report({ c }: { c: Checkin }) {
  const { units } = useAuth()
  const f = c.facts
  const ch = f.weight.change_kg
  const changeTxt = ch == null ? 'Need 2 weeks of weigh-ins'
    : `${ch > 0 ? '+' : ch < 0 ? '−' : '±'}${units === 'imperial' ? (Math.abs(ch) / 0.45359237).toFixed(1) : Math.abs(ch).toFixed(1)} ${weightUnit(units)} vs last week`
  return (
    <div className="space-y-5">
      <Card className="relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-lime/[0.06] blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <Ring value={c.score} max={100} size={132} stroke={11} color={scoreTone(c.score)}>
            <div className="text-center">
              <p className="font-display text-3xl font-bold text-fg">{c.score}</p>
              <p className="text-[11px] uppercase tracking-wider text-fg-muted">{scoreWord(c.score)}</p>
            </div>
          </Ring>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="lime"><CalendarCheck className="h-3 w-3" />{shortDate(c.period_start)} – {shortDate(c.period_end)}</Badge>
              {c.is_ai ? <Badge tone="sky"><Bot className="h-3 w-3" />AI coach</Badge> : <Badge>Rules engine</Badge>}
            </div>
            <h2 className="mt-3 font-display text-xl font-bold leading-snug text-fg sm:text-2xl">{c.summary.headline}</h2>
            <p className="mt-2 text-sm text-fg-muted">Consistency score: 40% training, 30% food logging, 30% protein. Numbers are calculated from your logs — the coach only writes the words.</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Dumbbell className="h-3.5 w-3.5" />} label="Workouts" value={`${f.workouts.done}/${f.workouts.planned}`} sub={`${f.workouts.minutes} min trained`} ok={f.workouts.done >= f.workouts.planned} />
        <Stat icon={<NotebookPen className="h-3.5 w-3.5" />} label="Days logged" value={`${f.nutrition.days_logged}/7`} sub={f.nutrition.avg_calories ? `~${n0(f.nutrition.avg_calories)} kcal/day · target ${n0(f.nutrition.calorie_target)}` : 'No food logged'} ok={f.nutrition.days_logged >= 5} />
        <Stat icon={<Beef className="h-3.5 w-3.5" />} label="Protein days" value={`${f.nutrition.protein_days}/7`} sub={f.nutrition.avg_protein_g != null ? `avg ${f.nutrition.avg_protein_g} g · hit = 90%+ of ${f.nutrition.protein_target_g} g` : `target ${f.nutrition.protein_target_g} g`} ok={f.nutrition.protein_days >= 4} />
        <Stat icon={<Scale className="h-3.5 w-3.5" />} label="Weekly avg" value={f.weight.avg_kg != null ? fmtWeight(f.weight.avg_kg, units) : '—'} sub={changeTxt} ok={f.weight.weigh_ins >= 3} />
      </div>

      {f.weight.losing_too_fast && <Notice tone="warn" icon={<AlertTriangle className="h-4 w-4" />}>Your weight dropped faster than about 1% of body weight this week. That pace often costs muscle and energy — make sure you're eating enough, and talk to a professional if it continues.</Notice>}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="pb-5">
          <CardHeader icon={<Trophy className="h-4 w-4" />} title="Wins this week" />
          <ul className="mt-4 space-y-3 px-5">
            {c.summary.wins.map((w, i) => <li key={i} className="flex gap-3 text-sm leading-relaxed text-fg"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-lime" />{w}</li>)}
          </ul>
        </Card>
        <Card className="pb-5">
          <CardHeader icon={<Sparkles className="h-4 w-4" />} title="Focus areas" />
          {c.summary.focus.length ? (
            <ul className="mt-4 space-y-3 px-5">
              {c.summary.focus.map((w, i) => <li key={i} className="flex gap-3 text-sm leading-relaxed text-fg"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />{w}</li>)}
            </ul>
          ) : <p className="mt-4 px-5 text-sm text-fg-muted">Nothing to fix — keep doing exactly this.</p>}
        </Card>
      </div>

      <Card className="pb-5">
        <CardHeader icon={<Target className="h-4 w-4" />} title="Targets for next week" subtitle="Small, measurable — tick them off on the dashboard challenges" />
        <div className="mt-4 grid gap-2 px-5 sm:grid-cols-2">
          {c.summary.next_week.map((t, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.02] px-4 py-3 text-sm text-fg">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lime/10 text-xs font-bold text-lime">{i + 1}</span>{t}
            </div>
          ))}
        </div>
        {f.achievements.length > 0 && <p className="mt-4 px-5 text-xs text-fg-muted">Unlocked this week: {f.achievements.join(', ')}</p>}
      </Card>
    </div>
  )
}

export default function Checkins() {
  const toast = useToast()
  const { data, error, loading, reload, setData } = useAsync(() => checkinApi.list(), [])
  const [busy, setBusy] = useState(false)
  const [fire, setFire] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [open, setOpen] = useState<number | null>(null)

  const monday = (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
  const latest = data?.[0]
  const thisWeek = latest && latest.week_start === monday ? latest : null
  const history = (data ?? []).filter(c => c !== thisWeek)

  const generate = async () => {
    setBusy(true); setNotice(null)
    try {
      const c = await checkinApi.generate()
      setData(prev => [c, ...(prev ?? []).filter(x => x.id !== c.id)])
      setNotice(c.notice ?? null)
      if (c.score >= 85) setFire(f => f + 1)
      toast('success', thisWeek ? 'Check-in refreshed' : 'Weekly check-in ready')
    } catch (e) { toast('error', 'Check-in failed', (e as Error).message) } finally { setBusy(false) }
  }

  const remove = async (id: number) => {
    try { await checkinApi.remove(id); setData(prev => (prev ?? []).filter(x => x.id !== id)) } catch (e) { toast('error', 'Could not delete', (e as Error).message) }
  }

  return (
    <div>
      <Celebration fire={fire} />
      <PageHeader eyebrow="Weekly review" title="Weekly AI Check-in"
        subtitle="Every week, your coach reviews the last 7 days — training, food logging, protein and weight trend — and sets clear targets for the next one."
        actions={<Button onClick={generate} loading={busy} icon={busy ? undefined : thisWeek ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}>
          {thisWeek ? 'Refresh this week' : 'Run my check-in'}</Button>} />

      {notice && <div className="mb-5"><Notice tone="demo">{notice}</Notice></div>}

      {loading ? (
        <div className="space-y-4"><Skeleton className="h-44" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}</div><Skeleton className="h-56" /></div>
      ) : error ? <ErrorState message={error} onRetry={() => reload()} /> : (
        <>
          {thisWeek ? <Report c={thisWeek} /> : (
            <EmptyState art="hero-training" icon={<CalendarCheck className="h-5 w-5" />} title="This week's check-in is ready to run"
              text="It takes a few seconds. The more you've logged this week — workouts, meals, weigh-ins — the more useful it is."
              action={<Button onClick={generate} loading={busy} icon={busy ? undefined : <Sparkles className="h-4 w-4" />}>Run my check-in</Button>} />
          )}

          {history.length > 0 && (
            <div className="mt-10">
              <h3 className="mb-3 font-display text-lg font-semibold text-fg">Past check-ins</h3>
              <div className="space-y-2">
                {history.map(c => (
                  <Card key={c.id} className="overflow-hidden">
                    <button onClick={() => setOpen(open === c.id ? null : c.id)} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.02]">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-display text-sm font-bold text-ink-900" style={{ background: scoreTone(c.score) }}>{c.score}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-fg-muted">{shortDate(c.period_start)} – {shortDate(c.period_end)}</p>
                        <p className="truncate text-sm font-medium text-fg">{c.summary.headline}</p>
                      </div>
                      <ChevronDown className={clsx('h-4 w-4 shrink-0 text-fg-muted transition', open === c.id && 'rotate-180')} />
                    </button>
                    {open === c.id && (
                      <div className="border-t border-line p-5">
                        <Report c={c} />
                        <div className="mt-4 flex justify-end"><Button variant="ghost" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => remove(c.id)}>Delete</Button></div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
