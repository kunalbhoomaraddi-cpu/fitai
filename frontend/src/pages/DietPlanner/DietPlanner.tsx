import clsx from 'clsx'
import { BookmarkCheck, Bookmark, Check, ChefHat, ChevronDown, Clock, History, Info, RefreshCw, Repeat2, Sparkles, Trash2, Wand2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { MacroDonut } from '../../components/charts/Charts'
import { Badge, Button, Card, CardHeader, Chip, EmptyState, ErrorState, Input, Label, MacroRow, Modal, Notice, PageHeader, Photo, Segmented, Select, Skeleton } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useAsync } from '../../hooks/useAsync'
import { dietApi, profileApi } from '../../services/fitai'
import type { DietPlan, Meal } from '../../types'
import { DIET_LABEL, shortDate } from '../../utils/format'

const RESTRICTIONS = ['dairy', 'gluten', 'nuts', 'peanuts', 'soy', 'eggs', 'seafood']

function MealCard({ meal, onRegenerate, onSwap, onComplete, busy }: { meal: Meal; onRegenerate: () => void; onSwap: (i: number) => void; onComplete: () => void; busy: string | null }) {
  const [openSteps, setOpenSteps] = useState(false)
  const t = meal.totals
  return (
    <Card hover className={clsx('group overflow-hidden', meal.completed && 'border-lime/40')}>
      <div className="grid sm:grid-cols-[220px_1fr]">
        <div className="relative">
          <Photo name={meal.image} fallback={`${meal.meal_type}-generic`} alt={meal.name} className="h-44 sm:h-full" overlay />
          <div className="absolute left-3 top-3 flex gap-1.5"><Badge tone="neutral" className="!bg-ink-950/70 backdrop-blur">{meal.label}</Badge></div>
          {meal.completed && <div className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-lime text-ink-950"><Check className="h-4 w-4" /></div>}
          <div className="absolute bottom-3 left-3 font-display text-2xl font-bold tabular-nums">{t.calories}<span className="ml-1 text-xs font-medium text-fg-muted">kcal</span></div>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-display text-[17px] font-semibold leading-snug">{meal.name}</h3>
            <Badge tone={meal.nutrition_source === 'ai_estimate' ? 'amber' : 'moss'}>{meal.nutrition_source === 'ai_estimate' ? 'AI-estimated' : 'Reference-calculated'}</Badge>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-md bg-lime/10 px-2 py-0.5 text-lime">P {t.protein_g} g</span>
            <span className="rounded-md bg-sky/10 px-2 py-0.5 text-sky">C {t.carbs_g} g</span>
            <span className="rounded-md bg-amber/10 px-2 py-0.5 text-amber">F {t.fat_g} g</span>
          </div>
          <div className="mt-4 divide-y divide-line-soft rounded-xl border border-line-soft">
            {meal.items.map((it, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                <div className="min-w-0 flex-1"><p className="truncate text-fg">{it.name}</p><p className="text-[11px] text-fg-dim">{it.grams} g · {it.calories} kcal · P {it.protein_g} · C {it.carbs_g} · F {it.fat_g}</p></div>
                {it.food_key && <button onClick={() => onSwap(i)} disabled={!!busy} title="Replace this food" aria-label={`Replace ${it.name}`}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-fg-muted transition hover:bg-white/5 hover:text-lime disabled:opacity-40">
                  {busy === `swap${meal.slot}-${i}` ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Repeat2 className="h-3 w-3" />}Swap</button>}
              </div>
            ))}
          </div>
          <button onClick={() => setOpenSteps(o => !o)} className="mt-3 flex items-center gap-1.5 text-xs font-medium text-fg-muted hover:text-fg">
            <ChefHat className="h-3.5 w-3.5" />Preparation<ChevronDown className={clsx('h-3.5 w-3.5 transition', openSteps && 'rotate-180')} />
          </button>
          {openSteps && <p className="mt-2 animate-fade-in text-[13px] leading-relaxed text-fg-muted">{meal.instructions}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant={meal.completed ? 'secondary' : 'primary'} onClick={onComplete} loading={busy === `done${meal.slot}`} icon={<Check className="h-3.5 w-3.5" />}>{meal.completed ? 'Eaten · undo' : 'Mark as eaten'}</Button>
            <Button size="sm" variant="ghost" onClick={onRegenerate} loading={busy === `regen${meal.slot}`} icon={<RefreshCw className="h-3.5 w-3.5" />}>Regenerate</Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default function DietPlanner() {
  const { profile } = useAuth()
  const toast = useToast()
  const targets = useAsync(() => profileApi.targets(), [])
  const latest = useAsync(() => dietApi.latest(), [])
  const [plan, setPlan] = useState<DietPlan | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [plans, setPlans] = useState<DietPlan[]>([])
  const [form, setForm] = useState({ calories: '', protein: '', carbs: '', fat: '', diet: profile?.diet_preference ?? 'vegetarian', restrictions: profile?.food_restrictions ?? [], meals: 4 as 3 | 4 | 5, budget: 'medium' as 'low' | 'medium' | 'high', prefs: '', useAi: true })

  useEffect(() => { if (latest.data !== undefined) setPlan(latest.data) }, [latest.data])
  useEffect(() => {
    const t = targets.data
    if (t) setForm(f => ({ ...f, calories: String(t.calories.calorie_target), protein: String(t.macros.protein_g), carbs: String(t.macros.carbs_g), fat: String(t.macros.fat_g) }))
  }, [targets.data])

  const generate = async () => {
    setBusy('gen')
    try {
      const p = await dietApi.generate({ calorie_target: +form.calories || null, protein_g: +form.protein || null, carbs_g: +form.carbs || null, fat_g: +form.fat || null,
        diet_preference: form.diet, food_restrictions: form.restrictions, meals_per_day: form.meals, budget: form.budget, food_preferences: form.prefs || null, use_ai: form.useAi })
      setPlan(p); toast('success', 'Meal plan ready', p.notice || undefined)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) { toast('error', 'Generation failed', (e as Error).message) } finally { setBusy(null) }
  }
  const act = async (key: string, fn: () => Promise<DietPlan>, ok?: string) => {
    setBusy(key)
    try { setPlan(await fn()); if (ok) toast('success', ok) } catch (e) { toast('error', 'Action failed', (e as Error).message) } finally { setBusy(null) }
  }
  const openHistory = async () => { setHistoryOpen(true); try { setPlans(await dietApi.plans()) } catch { /* shown empty */ } }

  const tot = plan?.totals, tg = plan?.targets
  const eaten = plan?.meals.filter(m => m.completed) ?? []
  const eatenKcal = eaten.reduce((s, m) => s + m.totals.calories, 0)

  return (
    <div>
      <div className="group relative mb-6 overflow-hidden rounded-3xl border border-line">
        <Photo name="diet-hero" alt="Colourful healthy meals" className="absolute inset-0" overlay="left" />
        <div className="relative p-6 sm:p-8">
          <PageHeader eyebrow="AI Diet Planner" title="Meals built around your macros" subtitle="Personalised to your diet, restrictions and budget. Every value is labelled as reference-calculated or AI-estimated."
            actions={<><Button variant="secondary" onClick={openHistory} icon={<History className="h-4 w-4" />}>Previous plans</Button></>} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <Card className="h-fit xl:sticky xl:top-24">
          <CardHeader title="Plan settings" subtitle="Prefilled from your profile" icon={<Wand2 className="h-4 w-4" />} />
          <div className="space-y-4 p-5">
            {targets.loading ? <Skeleton className="h-24" /> : (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label htmlFor="cal">Daily calories</Label><Input id="cal" type="number" value={form.calories} onChange={e => setForm({ ...form, calories: e.target.value })} suffix="kcal" /></div>
                <div><Label htmlFor="p">Protein</Label><Input id="p" type="number" value={form.protein} onChange={e => setForm({ ...form, protein: e.target.value })} suffix="g" /></div>
                <div><Label htmlFor="c">Carbs</Label><Input id="c" type="number" value={form.carbs} onChange={e => setForm({ ...form, carbs: e.target.value })} suffix="g" /></div>
                <div><Label htmlFor="f">Fat</Label><Input id="f" type="number" value={form.fat} onChange={e => setForm({ ...form, fat: e.target.value })} suffix="g" /></div>
                <div><Label>Meals</Label><Segmented size="sm" options={[[3, '3'], [4, '4'], [5, '5']] as const} value={form.meals} onChange={v => setForm({ ...form, meals: v })} /></div>
              </div>
            )}
            <div><Label htmlFor="diet">Dietary preference</Label>
              <Select id="diet" value={form.diet} onChange={e => setForm({ ...form, diet: e.target.value as any })}>{Object.entries(DIET_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></div>
            <div><Label>Restrictions</Label><div className="flex flex-wrap gap-1.5">{RESTRICTIONS.map(r => <Chip key={r} active={form.restrictions.includes(r)} onClick={() => setForm({ ...form, restrictions: form.restrictions.includes(r) ? form.restrictions.filter(x => x !== r) : [...form.restrictions, r] })}>{r}</Chip>)}</div></div>
            <div><Label>Budget</Label><Segmented size="sm" options={[['low', 'Budget'], ['medium', 'Moderate'], ['high', 'Premium']] as const} value={form.budget} onChange={v => setForm({ ...form, budget: v })} /></div>
            <div><Label htmlFor="pref" hint="Optional">Food preferences</Label><Input id="pref" placeholder="e.g. South Indian, paneer, quick meals" value={form.prefs} onChange={e => setForm({ ...form, prefs: e.target.value })} /></div>
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line bg-ink-900 px-3.5 py-3">
              <span className="flex items-center gap-2 text-sm"><Sparkles className="h-4 w-4 text-lime" />Use AI planner</span>
              <input type="checkbox" checked={form.useAi} onChange={e => setForm({ ...form, useAi: e.target.checked })} className="h-4 w-4 accent-[#C6F36B]" />
            </label>
            <p className="text-[11px] leading-relaxed text-fg-dim">With an LLM configured, meals are AI-generated (values AI-estimated). Otherwise FitAI's reference engine builds the plan from typical nutrition values.</p>
            <Button full size="lg" onClick={generate} loading={busy === 'gen'} icon={<Sparkles className="h-4 w-4" />}>{plan ? 'Generate new plan' : 'Generate diet plan'}</Button>
          </div>
        </Card>

        <div className="min-w-0 space-y-5">
          {latest.loading ? <><Skeleton className="h-48" /><Skeleton className="h-56" /><Skeleton className="h-56" /></> :
            latest.error ? <ErrorState message={latest.error} onRetry={() => latest.reload()} /> :
              !plan ? <EmptyState icon={<ChefHat className="h-5 w-5" />} title="No meal plan yet" art="diet-hero" text="Adjust your settings and generate a plan tailored to your targets." action={<Button onClick={generate} loading={busy === 'gen'} icon={<Sparkles className="h-4 w-4" />}>Generate my first plan</Button>} /> : (<>
                {plan.notice && <Notice tone={plan.notice.startsWith('Demo') ? 'demo' : 'warn'} icon={<Info className="h-4 w-4" />}>{plan.notice}</Notice>}
                <Card className="p-5">
                  <div className="flex flex-col gap-6 md:flex-row md:items-center">
                    <MacroDonut protein={tot!.protein_g} carbs={tot!.carbs_g} fat={tot!.fat_g} calories={tot!.calories} size={150} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-xl font-bold">{plan.title}</h2>
                        {plan.is_saved ? <Badge tone="lime"><BookmarkCheck className="h-3 w-3" />Saved</Badge> : null}
                        <Badge tone={plan.generated_by.startsWith('llm') ? 'amber' : 'moss'}>{plan.generated_by.startsWith('llm') ? `AI · ${plan.generated_by.replace('llm:', '')}` : 'FitAI reference engine'}</Badge>
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-fg-dim"><Clock className="h-3 w-3" />Created {shortDate(plan.created_at.slice(0, 10))} · {eaten.length}/{plan.meals.length} meals eaten ({eatenKcal} kcal)</p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <MacroRow label="Calories" value={tot!.calories} target={tg!.calorie_target} unit=" kcal" color="#C6F36B" />
                        <MacroRow label="Protein" value={tot!.protein_g} target={tg!.protein_g} color="#C6F36B" />
                        <MacroRow label="Carbohydrates" value={tot!.carbs_g} target={tg!.carbs_g} color="#7CC4F2" />
                        <MacroRow label="Fat" value={tot!.fat_g} target={tg!.fat_g} color="#F2B85B" />
                      </div>
                    </div>
                    <div className="flex gap-2 md:flex-col">
                      {!plan.is_saved && <Button onClick={() => act('save', () => dietApi.save(plan.id), 'Plan saved')} loading={busy === 'save'} icon={<Bookmark className="h-4 w-4" />}>Save plan</Button>}
                    </div>
                  </div>
                  {plan.coach_note && <div className="mt-5 flex gap-3 rounded-xl border border-line-soft bg-ink-900/70 p-4"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-lime" /><p className="text-[13.5px] leading-relaxed text-fg-muted">{plan.coach_note}</p></div>}
                  <p className="mt-3 text-[11px] text-fg-dim">{plan.meals[0]?.nutrition_note}. Estimates only — product labels and preparation change real values.</p>
                </Card>
                <div className="stagger space-y-4">
                  {plan.meals.map(m => (
                    <MealCard key={`${plan.id}-${m.slot}-${m.name}`} meal={m} busy={busy}
                      onRegenerate={() => act(`regen${m.slot}`, () => dietApi.regenerateMeal(plan.id, m.slot), 'Meal regenerated')}
                      onSwap={i => act(`swap${m.slot}-${i}`, () => dietApi.replaceItem(plan.id, m.slot, i), 'Food replaced')}
                      onComplete={() => act(`done${m.slot}`, () => dietApi.completeMeal(plan.id, m.slot, !m.completed), m.completed ? undefined : 'Logged to your nutrition tracker')} />
                  ))}
                </div>
              </>)}
        </div>
      </div>

      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title="Previous meal plans" wide>
        {plans.length === 0 ? <p className="text-sm text-fg-muted">No plans yet.</p> : (
          <div className="space-y-2">
            {plans.map(p => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-line bg-ink-900 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.title} {p.is_saved && <Badge tone="lime" className="ml-1">Saved</Badge>}</p>
                  <p className="text-xs text-fg-dim">{shortDate(p.created_at.slice(0, 10))} · {p.totals.calories} kcal · P {p.totals.protein_g} g · {p.meals.length} meals</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => { setPlan(p); setHistoryOpen(false) }}>View</Button>
                <button aria-label="Delete plan" onClick={async () => { await dietApi.remove(p.id); setPlans(s => s.filter(x => x.id !== p.id)); if (plan?.id === p.id) setPlan(null) }} className="rounded-lg p-2 text-fg-dim hover:text-coral"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
