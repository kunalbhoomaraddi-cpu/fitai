import clsx from 'clsx'
import { AlertTriangle, Award, Camera, Bot, CheckCircle2, Info, Lock, Pencil, Plus, Ruler, Scale, Sparkles, Target, Trash2, TrendingDown, TrendingUp, Trophy } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MeasureChart, WeightChart } from '../../components/charts/Charts'
import { Badge, Button, Card, CardHeader, Celebration, EmptyState, ErrorState, Input, Label, Modal, Notice, PageHeader, Photo, Ring, Segmented, Skeleton } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useAsync } from '../../hooks/useAsync'
import { progressApi } from '../../services/fitai'
import { fmtLength, fmtWeight, kgToLb, lbToKg, shortDate, todayISO, weightUnit } from '../../utils/format'

const MEAS: [string, string, string][] = [['waist_cm', 'Waist', '#C6F36B'], ['chest_cm', 'Chest', '#7CC4F2'], ['hips_cm', 'Hips', '#F2B85B'], ['arm_cm', 'Arm', '#49B675'], ['thigh_cm', 'Thigh', '#C9A7F5']]

export default function ProgressTracker() {
  const nav = useNavigate()
  const { units, refresh } = useAuth()
  const toast = useToast()
  const analysis = useAsync(() => progressApi.analysis(), [])
  const weights = useAsync(() => progressApi.weights(), [])
  const measures = useAsync(() => progressApi.measurements(), [])
  const achievements = useAsync(() => progressApi.achievements(), [])
  const [range, setRange] = useState<30 | 90 | 365>(90)
  const [w, setW] = useState('')
  const [wDate, setWDate] = useState(todayISO())
  const [saving, setSaving] = useState(false)
  const [ai, setAi] = useState<any>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [mOpen, setMOpen] = useState(false)
  const [m, setM] = useState<Record<string, string>>({})
  const [tOpen, setTOpen] = useState(false)
  const [target, setTarget] = useState('')
  const [confetti, setConfetti] = useState(0)
  const u = weightUnit(units)
  const toKg = (v: number) => (units === 'imperial' ? lbToKg(v) : v)
  const toCm = (v: number) => (units === 'imperial' ? v * 2.54 : v)

  const reloadAll = () => { analysis.reload(true); weights.reload(true); achievements.reload(true) }
  const logWeight = async () => {
    const v = parseFloat(w)
    if (!v) return toast('error', 'Enter your weight')
    setSaving(true)
    try {
      const before = achievements.data?.filter(a => a.unlocked).length ?? 0
      await progressApi.addWeight({ weight_kg: +toKg(v).toFixed(2), recorded_on: wDate })
      setW(''); toast('success', 'Weight logged', 'Remember: the weekly average matters more than any single reading.')
      reloadAll(); refresh()
      const after = await progressApi.achievements()
      if (after.filter(a => a.unlocked).length > before) { setConfetti(Date.now()); after.filter(a => a.unlocked && !a.seen).forEach(a => toast('achievement', `Achievement unlocked: ${a.title}`, a.description)) }
    } catch (e) { toast('error', 'Could not log weight', (e as Error).message) } finally { setSaving(false) }
  }
  const runAi = async () => {
    setAiLoading(true)
    try { setAi(await progressApi.aiAnalysis()) } catch (e) { toast('error', 'Analysis failed', (e as Error).message) } finally { setAiLoading(false) }
  }
  const saveMeasure = async () => {
    const body: Record<string, any> = { recorded_on: todayISO() }
    MEAS.forEach(([k]) => { if (m[k]) body[k] = +toCm(+m[k]).toFixed(1) })
    try { await progressApi.addMeasurement(body); setMOpen(false); setM({}); measures.reload(true); toast('success', 'Measurements saved') } catch (e) { toast('error', 'Could not save', (e as Error).message) }
  }
  const saveTarget = async () => {
    const v = parseFloat(target); if (!v) return
    try { await progressApi.setTarget(+toKg(v).toFixed(1)); setTOpen(false); reloadAll(); refresh(); toast('success', 'Target updated') } catch (e) { toast('error', 'Could not update', (e as Error).message) }
  }

  const a = analysis.data
  if (analysis.error) return <ErrorState message={analysis.error} onRetry={() => analysis.reload()} />
  const wa = a?.weight
  const cutoff = new Date(Date.now() - range * 864e5).toISOString().slice(0, 10)
  const series = (weights.data ?? []).filter(r => r.recorded_on >= cutoff).map(r => ({ date: r.recorded_on, weight_kg: r.weight_kg }))
  const wk = wa?.weekly_averages ?? []
  const thisW = wk[wk.length - 1], lastW = wk[wk.length - 2]
  const wkDelta = thisW && lastW ? thisW.avg_weight_kg - lastW.avg_weight_kg : null

  return (
    <div>
      <Celebration fire={confetti} />
      <div className="group relative mb-6 overflow-hidden rounded-3xl border border-line">
        <Photo name="progress-hero" alt="Runner at sunrise" className="absolute inset-0" overlay="left" />
        <div className="relative p-6 sm:p-8"><PageHeader eyebrow="Progress Tracker" title="See the trend, not the noise" subtitle="Weigh-ins, measurements and milestones — analysed from your stored data with weekly averages and plateau detection."
          actions={<Button variant="secondary" onClick={() => nav('/photos')} icon={<Camera className="h-4 w-4" />}>Progress photos</Button>} /></div>
      </div>

      {!a ? <div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-64" /><Skeleton className="h-64 lg:col-span-2" /></div> : (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="p-5">
              <div className="flex items-center justify-between"><p className="font-display font-semibold">Goal progress</p><button onClick={() => { setTarget(String(+(units === 'imperial' ? kgToLb(wa.target_weight_kg) : wa.target_weight_kg).toFixed(1))); setTOpen(true) }} className="flex items-center gap-1 text-xs text-fg-muted hover:text-lime"><Pencil className="h-3 w-3" />Edit target</button></div>
              <div className="mt-4 flex items-center gap-5">
                <Ring value={wa.goal_progress_pct} max={100} size={130} stroke={11}><p className="font-display text-3xl font-bold">{Math.round(wa.goal_progress_pct)}%</p><p className="text-[10px] text-fg-dim">complete</p></Ring>
                <div className="space-y-2.5 text-sm">
                  <div><p className="text-[11px] text-fg-dim">Start</p><p className="font-semibold tabular-nums">{fmtWeight(wa.start_weight_kg, units)}</p></div>
                  <div><p className="text-[11px] text-fg-dim">Current</p><p className="font-semibold tabular-nums text-lime">{fmtWeight(wa.current_weight_kg, units)}</p></div>
                  <div><p className="text-[11px] text-fg-dim">Target</p><p className="font-semibold tabular-nums">{fmtWeight(wa.target_weight_kg, units)}</p></div>
                </div>
              </div>
              {wa.goal_progress_pct >= 100 && <div className="mt-4"><Notice tone="demo" icon={<Trophy className="h-4 w-4" />}><strong>Goal reached!</strong> Consider a maintenance phase before setting a new target.</Notice></div>}
            </Card>
            <Card className="p-5">
              <p className="font-display font-semibold">Log weight</p>
              <p className="mt-1 text-xs text-fg-muted">Weigh in at the same time of day, ideally morning.</p>
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label htmlFor="w">Weight</Label><Input id="w" type="number" inputMode="decimal" step="0.1" value={w} onChange={e => setW(e.target.value)} suffix={u} placeholder={String(+(units === 'imperial' ? kgToLb(wa.current_weight_kg) : wa.current_weight_kg).toFixed(1))} onKeyDown={e => e.key === 'Enter' && logWeight()} /></div>
                  <div><Label htmlFor="wd">Date</Label><Input id="wd" type="date" max={todayISO()} value={wDate} onChange={e => setWDate(e.target.value)} /></div>
                </div>
                <Button full onClick={logWeight} loading={saving} icon={<Plus className="h-4 w-4" />}>Save weigh-in</Button>
                <Button full variant="secondary" onClick={() => setMOpen(true)} icon={<Ruler className="h-4 w-4" />}>Record measurements</Button>
              </div>
            </Card>
            <Card className="grid grid-cols-2 gap-px overflow-hidden bg-line-soft p-0">
              {[
                ['4-week trend', wa.trend_kg_per_week != null ? `${wa.trend_kg_per_week > 0 ? '+' : ''}${fmtWeight(wa.trend_kg_per_week, units, 2)}/wk` : '—', wa.trend_kg_per_week != null && wa.trend_kg_per_week > 0 ? TrendingUp : TrendingDown],
                ['Last 30 days', wa.change_30d_kg != null ? `${wa.change_30d_kg > 0 ? '+' : ''}${fmtWeight(wa.change_30d_kg, units)}` : '—', Scale],
                ['This week avg', thisW ? fmtWeight(thisW.avg_weight_kg, units) : '—', Target],
                ['vs last week', wkDelta != null ? `${wkDelta > 0 ? '+' : ''}${fmtWeight(wkDelta, units, 2)}` : '—', wkDelta != null && wkDelta > 0 ? TrendingUp : TrendingDown],
              ].map(([l, v, I]: any) => (
                <div key={l} className="bg-ink-800 p-5"><I className="h-4 w-4 text-lime" /><p className="mt-3 font-display text-xl font-bold tabular-nums">{v}</p><p className="text-xs text-fg-muted">{l}</p></div>
              ))}
            </Card>
          </div>

          <Card>
            <CardHeader title="Weight progression" subtitle={`${wa.data_points} weigh-ins in the last 90 days${wa.plateau ? ' · possible plateau' : ''}`} icon={<Scale className="h-4 w-4" />}
              action={<Segmented size="sm" options={[[30, '30D'], [90, '90D'], [365, '1Y']] as const} value={range} onChange={setRange} />} />
            <div className="px-2 pb-4 pt-2">{series.length >= 2 ? <WeightChart data={series} target={wa.target_weight_kg} units={units} height={300} /> : <EmptyState className="m-3" icon={<Scale className="h-5 w-5" />} title="Log at least two weigh-ins" art="progress-hero" text="Your chart and weekly averages will appear here." />}</div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
            <Card className="relative overflow-hidden border-lime/25">
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-lime/10 blur-3xl" />
              <CardHeader title="AI progress analysis" subtitle="Grounded in your stored weigh-ins, workouts and food logs" icon={<Bot className="h-4 w-4" />}
                action={<Button size="sm" onClick={runAi} loading={aiLoading} icon={<Sparkles className="h-3.5 w-3.5" />}>{ai ? 'Re-analyse' : 'Analyse'}</Button>} />
              <div className="relative space-y-4 p-5">
                {ai ? (<div className="animate-fade-up space-y-4">
                  {ai.notice && <Notice tone={ai.is_real_llm ? 'info' : 'demo'} icon={<Info className="h-4 w-4" />}>{ai.notice}</Notice>}
                  <p className="text-[15px] leading-relaxed text-fg">{ai.summary}</p>
                  {ai.highlights?.length > 0 && <div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-dim">Highlights</p><ul className="space-y-1.5">{ai.highlights.map((h: string) => <li key={h} className="flex gap-2 text-[13.5px] text-fg-muted"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-moss-400" />{h}</li>)}</ul></div>}
                  {ai.next_steps?.length > 0 && <div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-dim">Next steps</p><ul className="space-y-1.5">{ai.next_steps.map((h: string) => <li key={h} className="flex gap-2 text-[13.5px] text-fg"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-lime" />{h}</li>)}</ul></div>}
                  <p className="text-[11px] text-fg-dim">{ai.is_real_llm ? `Written by ${ai.provider} from computed facts.` : 'Rule-based analysis — no LLM configured.'} Short-term scale changes are not necessarily fat changes. Not medical advice.</p>
                </div>) : (
                  <div className="space-y-2.5">
                    {a.insights.map((i: any) => (
                      <div key={i.title} className={clsx('flex gap-3 rounded-xl border px-4 py-3', i.type === 'safety' || i.type === 'warning' ? 'border-amber/25 bg-amber/[0.05]' : 'border-line-soft bg-ink-900/60')}>
                        {i.type === 'safety' || i.type === 'warning' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber" /> : <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky" />}
                        <div><p className="text-sm font-medium">{i.title}</p><p className="mt-0.5 text-[13px] leading-relaxed text-fg-muted">{i.text}</p></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
            <Card>
              <CardHeader title="Weekly averages" subtitle="Smooths out daily water fluctuations" icon={<Target className="h-4 w-4" />} />
              <div className="p-3">
                {wk.length === 0 ? <p className="p-3 text-sm text-fg-muted">No weigh-ins yet.</p> : (
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-[11px] uppercase tracking-wider text-fg-dim"><th className="px-3 py-2 font-medium">Week of</th><th className="px-3 py-2 font-medium">Average</th><th className="px-3 py-2 font-medium">Change</th><th className="px-3 py-2 text-right font-medium">Entries</th></tr></thead>
                    <tbody>{[...wk].reverse().slice(0, 8).map((r: any, i: number, arr: any[]) => { const prev = arr[i + 1]; const dlt = prev ? r.avg_weight_kg - prev.avg_weight_kg : null; return (
                      <tr key={r.week_start} className="border-t border-line-soft"><td className="px-3 py-2.5 text-fg-muted">{shortDate(r.week_start)}</td><td className="px-3 py-2.5 font-medium tabular-nums">{fmtWeight(r.avg_weight_kg, units, 2)}</td>
                        <td className={clsx('px-3 py-2.5 tabular-nums', dlt == null ? 'text-fg-dim' : dlt <= 0 ? 'text-moss-400' : 'text-amber')}>{dlt == null ? '—' : `${dlt > 0 ? '+' : ''}${fmtWeight(dlt, units, 2)}`}</td><td className="px-3 py-2.5 text-right text-fg-dim">{r.entries}</td></tr>) })}</tbody>
                  </table>
                )}
              </div>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="Body measurements" subtitle={`${measures.data?.length ?? 0} entries`} icon={<Ruler className="h-4 w-4" />} action={<Button size="sm" variant="secondary" onClick={() => setMOpen(true)} icon={<Plus className="h-3.5 w-3.5" />}>Add</Button>} />
              <div className="px-2 pb-3 pt-2">
                {(measures.data?.length ?? 0) >= 2 ? <MeasureChart data={measures.data!} keys={MEAS} height={230} /> : <EmptyState className="m-3" icon={<Ruler className="h-5 w-5" />} title="Track more than the scale" art="recovery" text="Waist and other measurements often change when the scale doesn't." />}
              </div>
              {measures.data && measures.data.length > 0 && (
                <div className="flex flex-wrap gap-2 border-t border-line-soft px-5 py-4">
                  {MEAS.map(([k, l]) => { const rows = measures.data!.filter(r => r[k] != null); if (rows.length === 0) return null; const first = rows[0][k], last = rows[rows.length - 1][k]; return (
                    <div key={k} className="rounded-xl bg-white/[0.03] px-3 py-2 text-xs"><span className="text-fg-dim">{l} </span><b className="tabular-nums">{fmtLength(last, units)}</b>{rows.length > 1 && <span className={clsx('ml-1', last - first <= 0 ? 'text-moss-400' : 'text-amber')}>({last - first > 0 ? '+' : ''}{fmtLength(last - first, units)})</span>}</div>) })}
                </div>
              )}
            </Card>
            <Card>
              <CardHeader title="Milestones" subtitle="Achievements earned from your real data" icon={<Award className="h-4 w-4" />} />
              <div className="space-y-2 p-5">
                {(achievements.data ?? []).map(x => (
                  <div key={x.code} className={clsx('flex items-center gap-3 rounded-xl border px-3 py-2.5', x.unlocked ? 'border-lime/25 bg-lime/[0.04]' : 'border-line-soft')}>
                    <div className={clsx('flex h-9 w-9 items-center justify-center rounded-lg', x.unlocked ? 'bg-lime text-ink-950' : 'bg-white/[0.04] text-fg-dim')}>{x.unlocked ? <Trophy className="h-4 w-4" /> : <Lock className="h-4 w-4" />}</div>
                    <div className="min-w-0 flex-1"><p className={clsx('text-sm font-medium', !x.unlocked && 'text-fg-muted')}>{x.title}</p><p className="truncate text-xs text-fg-dim">{x.description}</p></div>
                    {x.unlocked_at && <Badge tone="lime">{shortDate(x.unlocked_at.slice(0, 10))}</Badge>}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader title="Weight history" subtitle="All weigh-ins" icon={<Scale className="h-4 w-4" />} />
            <div className="max-h-80 overflow-y-auto p-2">
              {[...(weights.data ?? [])].reverse().map(r => (
                <div key={r.id} className="group flex items-center justify-between rounded-xl px-3 py-2 text-sm hover:bg-white/[0.02]">
                  <span className="text-fg-muted">{new Date(r.recorded_on + 'T12:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  <span className="flex items-center gap-3"><b className="tabular-nums">{fmtWeight(r.weight_kg, units)}</b>
                    <button aria-label="Delete weigh-in" onClick={async () => { await progressApi.removeWeight(r.id); reloadAll(); refresh() }} className="rounded p-1 text-fg-dim opacity-0 transition hover:text-coral group-hover:opacity-100 focus:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button></span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <Modal open={mOpen} onClose={() => setMOpen(false)} title="Record measurements" footer={<><Button variant="ghost" onClick={() => setMOpen(false)}>Cancel</Button><Button onClick={saveMeasure}>Save</Button></>}>
        <div className="grid grid-cols-2 gap-3">{MEAS.map(([k, l]) => <div key={k}><Label htmlFor={k}>{l}</Label><Input id={k} type="number" step="0.1" value={m[k] ?? ''} onChange={e => setM({ ...m, [k]: e.target.value })} suffix={units === 'imperial' ? 'in' : 'cm'} /></div>)}</div>
        <p className="mt-3 text-xs text-fg-dim">Measure at the same spot each time, relaxed, tape snug but not tight.</p>
      </Modal>
      <Modal open={tOpen} onClose={() => setTOpen(false)} title="Set target weight" footer={<><Button variant="ghost" onClick={() => setTOpen(false)}>Cancel</Button><Button onClick={saveTarget}>Update</Button></>}>
        <Label htmlFor="tw">Target weight</Label><Input id="tw" type="number" step="0.1" value={target} onChange={e => setTarget(e.target.value)} suffix={u} />
        <p className="mt-3 text-xs text-fg-dim">Choose a target in a healthy range for your height. A healthcare professional can help you set one.</p>
      </Modal>
    </div>
  )
}
