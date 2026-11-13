import clsx from 'clsx'
import { ChevronLeft, ChevronRight, Coffee, Cookie, Database, Moon, Pencil, Plus, Search, Sun, Trash2, UtensilsCrossed } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CaloriesChart, ProteinChart } from '../../components/charts/Charts'
import { Badge, Button, Card, CardHeader, ErrorState, Input, Label, MacroRow, Modal, Notice, PageHeader, Ring, Segmented, Skeleton } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { useAsync } from '../../hooks/useAsync'
import { nutritionApi } from '../../services/fitai'
import type { FoodEntry, FoodResult, MealType } from '../../types'
import { MEAL_LABEL, todayISO } from '../../utils/format'

const MEALS: [MealType, any][] = [['breakfast', Coffee], ['lunch', Sun], ['snack', Cookie], ['dinner', Moon]]
const shift = (iso: string, d: number) => { const x = new Date(iso + 'T12:00:00'); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10) }

const mainServing = (r: FoodResult) => r.servings?.length ? r.servings[Math.max(0, r.servings.findIndex(x => /medium/i.test(x.label)))] : undefined

function DietDot({ diet }: { diet: string }) {
  const nonveg = diet === 'non_vegetarian' || diet === 'eggetarian'
  return <span title={nonveg ? (diet === 'eggetarian' ? 'Contains egg' : 'Non-vegetarian') : 'Vegetarian'} className={clsx('inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border', nonveg ? 'border-[#c0392b]' : 'border-[#2e8b57]')}><span className={clsx('h-1.5 w-1.5 rounded-full', nonveg ? 'bg-[#c0392b]' : 'bg-[#2e8b57]')} /></span>
}

function AddFood({ open, onClose, meal, date, onAdded, editing }: { open: boolean; onClose: () => void; meal: MealType; date: string; onAdded: () => void; editing: FoodEntry | null }) {
  const toast = useToast()
  const [mode, setMode] = useState<'search' | 'custom'>('search')
  const [q, setQ] = useState('')
  const [results, setResults] = useState<FoodResult[]>([])
  const [warning, setWarning] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [sel, setSel] = useState<FoodResult | null>(null)
  const [grams, setGrams] = useState('100')
  const [unit, setUnit] = useState<number | 'g'>('g')   // index into sel.servings, or grams
  const [count, setCount] = useState(1)
  const [mealSel, setMealSel] = useState<MealType>(meal)
  const [custom, setCustom] = useState({ name: '', quantity_g: '100', calories: '', protein_g: '', carbs_g: '', fat_g: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setMealSel(editing?.meal ?? meal); setSel(null); setQ(''); setResults([]); setWarning(null)
    if (editing) { setMode('custom'); setCustom({ name: editing.name, quantity_g: String(editing.quantity_g), calories: String(editing.calories), protein_g: String(editing.protein_g), carbs_g: String(editing.carbs_g), fat_g: String(editing.fat_g) }) }
    else { setMode('search'); setCustom({ name: '', quantity_g: '100', calories: '', protein_g: '', carbs_g: '', fat_g: '' }) }
  }, [open, meal, editing])

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try { const r = await nutritionApi.search(q.trim()); setResults(r.results); setWarning(r.warning) } catch (e) { setWarning((e as Error).message) } finally { setSearching(false) }
    }, 450)
    return () => clearTimeout(t)
  }, [q])

  const serving = sel?.servings && unit !== 'g' ? sel.servings[unit] : null
  const qty = serving ? serving.grams * count : +grams || 0
  const k = qty / 100
  const calc = sel && { calories: Math.round(sel.calories_100g * k), protein_g: +(sel.protein_100g * k).toFixed(1), carbs_g: +(sel.carbs_100g * k).toFixed(1), fat_g: +(sel.fat_100g * k).toFixed(1) }

  const submit = async () => {
    setSaving(true)
    try {
      if (editing) {
        await nutritionApi.update(editing.id, { meal: mealSel, name: custom.name, quantity_g: +custom.quantity_g, calories: +custom.calories, protein_g: +custom.protein_g || 0, carbs_g: +custom.carbs_g || 0, fat_g: +custom.fat_g || 0 })
      } else if (mode === 'search' && sel && calc) {
        const label = serving ? `${sel.name} · ${count} × ${serving.label.replace(/^1 /, '')}` : sel.brand ? `${sel.name} (${sel.brand})` : sel.name
        await nutritionApi.add({ eaten_on: date, meal: mealSel, name: label.slice(0, 200), quantity_g: Math.round(qty), ...calc, source: sel.source === 'open_food_facts' ? 'open_food_facts' : 'reference', source_id: sel.id.slice(0, 64) })
      } else {
        if (!custom.name.trim() || custom.calories === '') { toast('error', 'Name and calories are required'); setSaving(false); return }
        await nutritionApi.add({ eaten_on: date, meal: mealSel, name: custom.name.trim(), quantity_g: +custom.quantity_g || 1, calories: +custom.calories, protein_g: +custom.protein_g || 0, carbs_g: +custom.carbs_g || 0, fat_g: +custom.fat_g || 0, source: 'custom' })
      }
      toast('success', editing ? 'Entry updated' : 'Food logged'); onAdded(); onClose()
    } catch (e) { toast('error', 'Could not save', (e as Error).message) } finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit food entry' : 'Add food'} wide
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={saving} disabled={!editing && mode === 'search' && !sel}>{editing ? 'Save changes' : 'Add to log'}</Button></>}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {!editing && <Segmented options={[['search', 'Search database'], ['custom', 'Custom food']] as const} value={mode} onChange={setMode} />}
        <Segmented size="sm" options={MEALS.map(([m]) => [m, MEAL_LABEL[m]] as const)} value={mealSel} onChange={setMealSel} />
      </div>
      {mode === 'search' && !editing ? (<>
        <Input autoFocus icon={<Search className="h-4 w-4" />} placeholder="Search foods, e.g. roti, dal, idli, paneer, chai…" value={q} onChange={e => { setQ(e.target.value); setSel(null) }} />
        {warning && <div className="mt-3"><Notice tone="warn">{warning}</Notice></div>}
        {!sel && <div className="mt-3 max-h-72 space-y-1 overflow-y-auto">
          {searching && [0, 1, 2].map(i => <Skeleton key={i} className="h-12" />)}
          {!searching && q.length >= 2 && results.length === 0 && <p className="py-6 text-center text-sm text-fg-muted">No matches. Try another term or add a custom food.</p>}
          {!searching && results.map(r => (
            <button key={r.id} onClick={() => { setSel(r); setUnit(r.servings?.length ? r.servings.indexOf(mainServing(r)!) : 'g'); setCount(1); setGrams('100') }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.04]">
              {r.image_url ? <img src={r.image_url} alt="" className="h-9 w-9 rounded-lg bg-white object-contain" loading="lazy" onError={e => (e.currentTarget.style.display = 'none')} /> : <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04] text-fg-dim"><Database className="h-4 w-4" /></div>}
              <div className="min-w-0 flex-1"><p className="flex items-center gap-1.5 truncate text-sm">{r.diet && <DietDot diet={r.diet} />}{r.name}</p>
                <p className="truncate text-[11px] text-fg-dim">{r.servings?.length ? `${r.category} · ${mainServing(r)!.label} ≈ ${Math.round(r.calories_100g * mainServing(r)!.grams / 100)} kcal` : `${r.brand ? `${r.brand} · ` : ''}${r.source === 'open_food_facts' ? 'Open Food Facts' : 'FitAI reference'} · per 100 g`}</p></div>
              <span className="shrink-0 text-xs tabular-nums text-fg-muted">{r.servings?.length ? `P ${(r.protein_100g * mainServing(r)!.grams / 100).toFixed(1)} g` : `${r.calories_100g} kcal · P ${r.protein_100g}`}</span>
            </button>
          ))}
        </div>}
        {sel && calc && (
          <div className="mt-4 animate-fade-in rounded-2xl border border-line bg-ink-900 p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-1.5 font-medium">{sel.diet && <DietDot diet={sel.diet} />}{sel.name}</p><p className="text-xs text-fg-dim">{sel.source === 'open_food_facts' ? 'Open Food Facts (community data)' : sel.source === 'indian' ? 'FitAI Indian food library · typical home-style recipe' : 'FitAI reference value (typical average)'}</p></div><button onClick={() => setSel(null)} className="text-xs text-lime hover:underline">Change</button></div>
            {sel.servings?.length ? (
              <div className="mt-4">
                <Label>Portion</Label>
                <div className="flex flex-wrap gap-2">
                  {sel.servings.map((sv, i) => (
                    <button key={sv.label} type="button" onClick={() => setUnit(i)} className={clsx('rounded-xl border px-3 py-1.5 text-[13px] transition', unit === i ? 'border-lime/60 bg-lime/10 text-fg' : 'border-line text-fg-muted hover:text-fg')}>
                      {sv.label} <span className="text-fg-dim">· {sv.grams} g</span>
                    </button>
                  ))}
                  <button type="button" onClick={() => { setUnit('g'); setGrams(String(Math.round(qty) || 100)) }} className={clsx('rounded-xl border px-3 py-1.5 text-[13px] transition', unit === 'g' ? 'border-lime/60 bg-lime/10 text-fg' : 'border-line text-fg-muted hover:text-fg')}>Grams</button>
                </div>
              </div>
            ) : null}
            <div className="mt-4 grid gap-4 sm:grid-cols-[160px_1fr] sm:items-end">
              {serving ? (
                <div><Label>How many?</Label>
                  <div className="flex h-11 items-center justify-between rounded-xl border border-line bg-ink-950 px-1.5">
                    <button type="button" aria-label="Less" onClick={() => setCount(c => Math.max(0.5, c - (c > 1 ? 1 : 0.5)))} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-fg-muted hover:bg-white/5 hover:text-fg">−</button>
                    <span className="font-display text-base font-semibold tabular-nums">{count}</span>
                    <button type="button" aria-label="More" onClick={() => setCount(c => Math.min(20, c < 1 ? 1 : c + 1))} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-fg-muted hover:bg-white/5 hover:text-fg">+</button>
                  </div>
                  <p className="mt-1 text-[11px] text-fg-dim">≈ {Math.round(qty)} g total</p></div>
              ) : <div><Label htmlFor="g">Quantity</Label><Input id="g" type="number" min={1} value={grams} onChange={e => setGrams(e.target.value)} suffix="g" /></div>}
              <div className="grid grid-cols-4 gap-2 text-center">
                {[['kcal', calc.calories], ['Protein', calc.protein_g], ['Carbs', calc.carbs_g], ['Fat', calc.fat_g]].map(([l, v]) => <div key={l as string} className="rounded-xl bg-white/[0.03] py-2"><p className="font-display font-bold tabular-nums">{v as number}</p><p className="text-[10px] text-fg-dim">{l}</p></div>)}
              </div>
            </div>
          </div>
        )}
      </>) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-3"><Label htmlFor="cn">Food name</Label><Input id="cn" value={custom.name} onChange={e => setCustom({ ...custom, name: e.target.value })} placeholder="e.g. Homemade dal" /></div>
          {([['quantity_g', 'Quantity', 'g'], ['calories', 'Calories', 'kcal'], ['protein_g', 'Protein', 'g'], ['carbs_g', 'Carbs', 'g'], ['fat_g', 'Fat', 'g']] as const).map(([k2, l, u]) => (
            <div key={k2}><Label htmlFor={k2}>{l}</Label><Input id={k2} type="number" min={0} value={custom[k2]} onChange={e => setCustom({ ...custom, [k2]: e.target.value })} suffix={u} /></div>
          ))}
        </div>
      )}
    </Modal>
  )
}

export default function NutritionTracker() {
  const toast = useToast()
  const [date, setDate] = useState(todayISO())
  const day = useAsync(() => nutritionApi.day(date), [date])
  const hist = useAsync(() => nutritionApi.history(14), [])
  const [adding, setAdding] = useState<MealType | null>(null)
  const [editing, setEditing] = useState<FoodEntry | null>(null)
  const isToday = date === todayISO()

  const refresh = () => { day.reload(true); hist.reload(true) }
  const remove = async (e: FoodEntry) => {
    try { await nutritionApi.remove(e.id); toast('success', 'Entry deleted'); refresh() } catch (err) { toast('error', 'Delete failed', (err as Error).message) }
  }
  const d = day.data
  const label = isToday ? 'Today' : new Date(date + 'T12:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })

  return (
    <div>
      <PageHeader eyebrow="Nutrition Tracker" title="Fuel with intention" subtitle="Search Open Food Facts or FitAI's reference database, log meals and stay on top of your macros."
        actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setAdding('breakfast')}>Add food</Button>} />
      <div className="mb-5 flex items-center gap-2">
        <button onClick={() => setDate(shift(date, -1))} aria-label="Previous day" className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-ink-850 text-fg-muted hover:text-fg"><ChevronLeft className="h-4 w-4" /></button>
        <div className="min-w-[180px] rounded-xl border border-line bg-ink-850 px-4 py-2 text-center text-sm font-medium">{label}</div>
        <button onClick={() => setDate(shift(date, 1))} disabled={isToday} aria-label="Next day" className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-ink-850 text-fg-muted hover:text-fg disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
        {!isToday && <Button size="sm" variant="ghost" onClick={() => setDate(todayISO())}>Today</Button>}
      </div>

      {day.error ? <ErrorState message={day.error} onRetry={() => day.reload()} /> : !d ? <div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-64 lg:col-span-2" /><Skeleton className="h-64" /></div> : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px] [&>*]:min-w-0">
          <div className="space-y-5">
            <Card className="p-5 sm:p-6">
              <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
                <div className="flex justify-center">
                  <Ring value={d.totals.calories} max={d.targets.calories} size={176} stroke={14}>
                    <p className="font-display text-4xl font-bold tabular-nums">{Math.max(0, d.targets.calories - d.totals.calories).toLocaleString()}</p>
                    <p className="text-xs text-fg-muted">kcal remaining</p>
                    <p className="mt-1 text-[11px] text-fg-dim">{Math.round(d.totals.calories)} / {d.targets.calories}</p>
                  </Ring>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {([['Protein', 'protein_g', '#C6F36B'], ['Carbs', 'carbs_g', '#7CC4F2'], ['Fat', 'fat_g', '#F2B85B']] as const).map(([l, k2, c]) => (
                    <div key={k2} className="flex flex-col items-center rounded-2xl border border-line-soft bg-ink-900/60 p-3">
                      <Ring value={d.totals[k2]} max={d.targets[k2]} size={86} stroke={8} color={c}><p className="font-display text-base font-bold tabular-nums">{Math.round(d.totals[k2])}</p><p className="text-[10px] text-fg-dim">/ {d.targets[k2]} g</p></Ring>
                      <p className="mt-2 text-xs font-medium text-fg-muted">{l}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
            <div className="stagger space-y-4">
              {MEALS.map(([m, I]) => {
                const entries: FoodEntry[] = d.entries.filter((e: FoodEntry) => e.meal === m)
                const bm = d.by_meal[m]
                return (
                  <Card key={m}>
                    <div className="flex items-center justify-between gap-3 px-5 py-4">
                      <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-lime"><I className="h-4 w-4" /></div>
                        <div><p className="font-display font-semibold">{MEAL_LABEL[m]}</p><p className="text-xs text-fg-dim">{bm.calories} kcal · P {bm.protein_g} · C {bm.carbs_g} · F {bm.fat_g}</p></div></div>
                      <Button size="sm" variant="secondary" onClick={() => { setEditing(null); setAdding(m) }} icon={<Plus className="h-3.5 w-3.5" />}>Add</Button>
                    </div>
                    {entries.length === 0 && (
                      <button onClick={() => { setEditing(null); setAdding(m) }} className="flex w-full items-center gap-2 border-t border-dashed border-line-soft px-5 py-3 text-left text-[13px] text-fg-dim transition hover:bg-white/[0.02] hover:text-lime">
                        <Plus className="h-3.5 w-3.5" />Nothing logged for {MEAL_LABEL[m].toLowerCase()} yet — add food
                      </button>
                    )}
                    {entries.length > 0 && (
                      <div className="divide-y divide-line-soft border-t border-line-soft">
                        {entries.map(e => (
                          <div key={e.id} className="group flex items-center gap-3 px-5 py-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm">{e.name}</p>
                              <p className="flex items-center gap-2 text-[11px] text-fg-dim">{Math.round(e.quantity_g)} g · P {e.protein_g} · C {e.carbs_g} · F {e.fat_g}
                                <Badge className="!py-0">{e.source === 'open_food_facts' ? 'OFF' : e.source === 'meal_plan' ? 'Meal plan' : e.source === 'reference' ? 'Reference' : 'Custom'}</Badge></p>
                            </div>
                            <span className="text-sm font-semibold tabular-nums">{Math.round(e.calories)}<span className="ml-0.5 text-[11px] font-normal text-fg-dim">kcal</span></span>
                            <div className="flex opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                              <button aria-label="Edit entry" onClick={() => { setEditing(e); setAdding(e.meal) }} className="rounded-lg p-1.5 text-fg-dim hover:text-fg"><Pencil className="h-3.5 w-3.5" /></button>
                              <button aria-label="Delete entry" onClick={() => remove(e)} className="rounded-lg p-1.5 text-fg-dim hover:text-coral"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          </div>
          <div className="space-y-5">
            <Card>
              <CardHeader title="Meal breakdown" subtitle="Share of today's calories" icon={<UtensilsCrossed className="h-4 w-4" />} />
              <div className="space-y-3.5 p-5">
                {MEALS.map(([m]) => <MacroRow key={m} label={MEAL_LABEL[m]} value={d.by_meal[m].calories} target={Math.max(d.totals.calories, 1)} unit=" kcal" color={{ breakfast: '#C6F36B', lunch: '#49B675', snack: '#F2B85B', dinner: '#7CC4F2' }[m]} />)}
              </div>
            </Card>
            <Card>
              <CardHeader title="Calorie history" subtitle="Last 14 days" icon={<UtensilsCrossed className="h-4 w-4" />} />
              <div className="px-2 pb-3 pt-2">{hist.data ? <CaloriesChart data={hist.data} target={d.targets.calories} height={200} /> : <Skeleton className="m-3 h-44" />}</div>
            </Card>
            <Card>
              <CardHeader title="Protein history" subtitle={`Target ${d.targets.protein_g} g`} icon={<UtensilsCrossed className="h-4 w-4" />} />
              <div className="px-2 pb-3 pt-2">{hist.data ? <ProteinChart data={hist.data} target={d.targets.protein_g} height={180} /> : <Skeleton className="m-3 h-40" />}</div>
            </Card>
            <p className={clsx('px-2 text-[11px] leading-relaxed text-fg-dim')}>Food data from Open Food Facts (ODbL, community-contributed) and FitAI reference averages. Values are estimates, not laboratory measurements.</p>
          </div>
        </div>
      )}
      <AddFood open={adding !== null} meal={adding ?? 'breakfast'} date={date} editing={editing} onClose={() => { setAdding(null); setEditing(null) }} onAdded={refresh} />
    </div>
  )
}
