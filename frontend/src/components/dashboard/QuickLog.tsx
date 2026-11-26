import clsx from 'clsx'
import { GlassWater, Luggage, PartyPopper, Plus, Scale, Undo2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button, Card, CardHeader, Input, Label, Modal, Notice, Segmented } from '../ui'
import { useToast } from '../../context/ToastContext'
import { useAsync } from '../../hooks/useAsync'
import { nutritionApi, profileApi, progressApi } from '../../services/fitai'
import type { Break, BreakKind, Units, WaterDay } from '../../types'
import { lbToKg, shortDate, todayISO, weightUnit } from '../../utils/format'

const GLASS = 250

/** Water today: one tap per glass, with an undo. The goal comes from body weight (about 35 ml per kg). */
export function WaterCard({ initial }: { initial: WaterDay }) {
  const toast = useToast()
  const [w, setW] = useState(initial)
  const [busy, setBusy] = useState(false)
  const change = async (ml: number) => {
    setBusy(true)
    const before = w
    setW({ ...w, ml: Math.max(0, w.ml + ml), glasses: Math.max(0, (w.ml + ml) / GLASS) })  // feels instant
    try { setW(await nutritionApi.addWater(ml)) } catch (e) { setW(before); toast('error', 'Water not saved', (e as Error).message) } finally { setBusy(false) }
  }
  const litres = (ml: number) => (ml / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })
  const done = w.ml >= w.goal_ml
  return (
    <Card className="flex flex-col">
      <CardHeader title="Water" subtitle={done ? 'Goal reached for today' : `${litres(Math.max(0, w.goal_ml - w.ml))} L to go`} icon={<GlassWater className="h-4 w-4" />} />
      <div className="flex flex-1 flex-col justify-between gap-4 p-5">
        <p className="score text-[44px] text-fg">{litres(w.ml)}<span className="ml-1.5 font-sans text-sm font-normal tracking-normal text-fg-dim">/ {litres(w.goal_ml)} L</span></p>
        <div className="flex gap-1" aria-label={`${Math.floor(w.ml / GLASS)} of ${w.goal_glasses} glasses`} role="img">
          {Array.from({ length: w.goal_glasses }, (_, i) => (
            <span key={i} className={clsx('h-7 flex-1 rounded-[5px] transition-colors', i < Math.floor(w.ml / GLASS) ? 'bg-sky' : 'bg-white/[0.06]')} />
          ))}
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => change(GLASS)} disabled={busy} icon={<Plus className="h-4 w-4" />}>Glass (250 ml)</Button>
          <Button variant="secondary" onClick={() => change(-GLASS)} disabled={busy || w.ml === 0} aria-label="Remove a glass" icon={<Undo2 className="h-4 w-4" />} />
        </div>
      </div>
    </Card>
  )
}

/** Log today's weight without leaving the dashboard. */
export function WeighInCard({ units, lastKg, lastDate, onSaved }: { units: Units; lastKg: number | null; lastDate: string | null; onSaved: () => void }) {
  const toast = useToast()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const today = todayISO()
  const loggedToday = lastDate === today
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const v = parseFloat(text.replace(',', '.'))
    const kg = units === 'imperial' ? lbToKg(v) : v
    if (!Number.isFinite(kg) || kg <= 30 || kg >= 300) return toast('error', 'Check the number', `Enter your weight in ${weightUnit(units)}.`)
    setBusy(true)
    try {
      await progressApi.addWeight({ recorded_on: today, weight_kg: +kg.toFixed(2) })
      setText(''); toast('success', 'Weight saved'); onSaved()
    } catch (err) { toast('error', 'Weight not saved', (err as Error).message) } finally { setBusy(false) }
  }
  const show = (kg: number) => (units === 'imperial' ? kg / 0.45359237 : kg).toFixed(1)
  return (
    <Card className="flex flex-col">
      <CardHeader title="Weigh-in" subtitle={lastKg ? `Last: ${show(lastKg)} ${weightUnit(units)}${lastDate ? `, ${lastDate === today ? 'today' : shortDate(lastDate)}` : ''}` : 'No weigh-ins yet'} icon={<Scale className="h-4 w-4" />} />
      <form onSubmit={submit} className="flex flex-1 flex-col justify-between gap-4 p-5" noValidate>
        <p className="text-[13px] leading-relaxed text-fg-muted">
          {loggedToday ? 'Logged today. Weighing again later? Save it here too.' : 'Same time each morning, after the bathroom and before eating, gives the clearest trend.'}
        </p>
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="quick-weight">Today's weight</Label>
            <Input id="quick-weight" inputMode="decimal" autoComplete="off" placeholder={lastKg ? show(lastKg) : units === 'imperial' ? '165.0' : '72.0'}
              value={text} onChange={e => /^\d*([.,]\d*)?$/.test(e.target.value) && setText(e.target.value)} suffix={weightUnit(units)} />
          </div>
          <Button type="submit" className="self-end" loading={busy} disabled={!text}>Save</Button>
        </div>
      </form>
    </Card>
  )
}

const KIND_ICON = { travel: Luggage, festival: PartyPopper }

/** Travel or festival break: maintenance calories, a paused streak and a coach that knows. */
export function BreakCard({ active, onChanged }: { active: Break | null; onChanged: () => void }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [ending, setEnding] = useState(false)
  const end = async () => {
    if (!active) return
    setEnding(true)
    try { await profileApi.endBreak(active.id); toast('success', 'Break ended', 'Your normal targets are back.'); onChanged() }
    catch (e) { toast('error', 'Could not end the break', (e as Error).message) } finally { setEnding(false) }
  }
  const I = active ? KIND_ICON[active.kind] : Luggage
  return (
    <Card className={clsx('flex flex-col', active && 'border-amber/30')}>
      <CardHeader title={active ? `${active.label} break` : 'Travel or festival'} subtitle={active ? `${active.note ? `${active.note}, ` : ''}until ${shortDate(active.end_on)}` : 'Pause without losing progress'}
        icon={<I className="h-4 w-4" />} />
      <div className="flex flex-1 flex-col justify-between gap-4 p-5">
        {active ? (
          <ul className="space-y-1.5 text-[13px] text-fg-muted">
            <li><span className="text-fg">{active.days_left} {active.days_left === 1 ? 'day' : 'days'} left.</span> Calories are at maintenance.</li>
            <li>Your workout streak is paused, so missed days don't count.</li>
            <li>{active.kind === 'travel' ? 'Use the Hotel-room workout: no equipment, about 25 minutes.' : 'Enjoy it. Your coach knows, and won’t push a deficit.'}</li>
          </ul>
        ) : (
          <p className="text-[13px] leading-relaxed text-fg-muted">Going away or celebrating? Set dates and FitAI moves you to maintenance calories, pauses your streak and suggests no-equipment workouts.</p>
        )}
        {active ? <Button variant="secondary" onClick={end} loading={ending}>End break now</Button>
          : <Button variant="secondary" onClick={() => setOpen(true)}>Plan a break</Button>}
      </div>
      <BreakModal open={open} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); onChanged() }} />
    </Card>
  )
}

function BreakModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const today = todayISO()
  const [kind, setKind] = useState<BreakKind>('festival')
  const [start, setStart] = useState(today)
  const [end, setEnd] = useState(today)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const list = useAsync(() => (open ? profileApi.breaks() : Promise.resolve(null)), [open])
  const days = Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1
  const save = async () => {
    setError(null)
    if (!(days >= 1)) return setError('The last day must be on or after the first day.')
    if (days > 21) return setError('A break can last up to 21 days.')
    setBusy(true)
    try { await profileApi.addBreak(kind, start, end, note.trim()); toast('success', kind === 'travel' ? 'Travel break set' : 'Festival break set'); onSaved() }
    catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const cancel = async (b: Break) => { try { await profileApi.endBreak(b.id); list.reload() } catch (e) { toast('error', 'Could not cancel', (e as Error).message) } }
  return (
    <Modal open={open} onClose={onClose} title="Plan a break"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Start {kind} break</Button></>}>
      <div className="space-y-4">
        <Segmented options={[['festival', 'Festival'], ['travel', 'Travel']] as const} value={kind} onChange={setKind} />
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="b-start">First day</Label><Input id="b-start" type="date" min={today} value={start} onChange={e => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value) }} /></div>
          <div><Label htmlFor="b-end">Last day</Label><Input id="b-end" type="date" min={start} value={end} onChange={e => setEnd(e.target.value)} /></div>
        </div>
        <div><Label htmlFor="b-note" hint="Optional">Name</Label><Input id="b-note" maxLength={80} placeholder={kind === 'travel' ? 'Goa trip' : 'Deepavali'} value={note} onChange={e => setNote(e.target.value)} /></div>
        <ul className="space-y-1.5 text-[13px] text-fg-muted">
          <li>Calories move to maintenance{days >= 1 && days <= 21 ? ` for ${days} ${days === 1 ? 'day' : 'days'}` : ''}, then go back to your plan.</li>
          <li>Your workout streak is paused, so missed days don't break it.</li>
          <li>{kind === 'travel' ? 'The dashboard offers a no-equipment Hotel-room workout.' : 'Your coach helps you enjoy the festival food without guilt.'}</li>
        </ul>
        {error && <Notice tone="warn">{error}</Notice>}
        {list.data?.upcoming.length ? (
          <div className="border-t border-line-soft pt-4">
            <p className="mb-2 text-[13px] font-semibold text-fg-muted">Coming up</p>
            {list.data.upcoming.map(b => (
              <div key={b.id} className="flex items-center justify-between gap-3 py-1 text-[13px]">
                <span className="text-fg">{b.note || b.label}, {shortDate(b.start_on)} to {shortDate(b.end_on)}</span>
                <button onClick={() => cancel(b)} className="text-fg-muted underline underline-offset-2 hover:text-fg">Cancel</button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
