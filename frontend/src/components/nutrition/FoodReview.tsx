import clsx from 'clsx'
import { Check, Database, Minus, Plus } from 'lucide-react'
import { Badge, Meta, Segmented } from '../ui'
import { nutritionApi } from '../../services/fitai'
import type { MealPhotoItem, MealType } from '../../types'
import { MEAL_LABEL } from '../../utils/format'

/** The review step shared by "Snap your meal" and "Say what you ate": tick foods, adjust grams, add. */
export type ReviewRow = MealPhotoItem & { picked: boolean }

export const MEAL_OPTIONS = (['breakfast', 'lunch', 'snack', 'dinner'] as const).map(m => [m, MEAL_LABEL[m]] as const)

/** The meal that fits the time of day, so the common case needs no tap. */
export function mealForNow(hour = new Date().getHours()): MealType {
  return hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : hour < 19 ? 'snack' : 'dinner'
}

export const toRows = (items: MealPhotoItem[]): ReviewRow[] => items.map(i => ({ ...i, picked: true }))

const scaled = (it: MealPhotoItem, grams: number) => {
  const k = grams / 100
  return { calories: Math.round(it.per_100g.calories * k), protein_g: +(it.per_100g.protein_g * k).toFixed(1), carbs_g: +(it.per_100g.carbs_g * k).toFixed(1), fat_g: +(it.per_100g.fat_g * k).toFixed(1) }
}

export function totalsOf(rows: ReviewRow[]) {
  return rows.filter(r => r.picked).reduce((a, r) => ({ calories: a.calories + r.calories, protein_g: a.protein_g + r.protein_g }), { calories: 0, protein_g: 0 })
}

/** Saves the ticked foods to the log, one entry each. */
export async function addRows(rows: ReviewRow[], date: string, meal: MealType, source: 'meal_photo' | 'voice') {
  for (const r of rows.filter(x => x.picked)) {
    await nutritionApi.add({ eaten_on: date, meal, name: r.name.slice(0, 200), quantity_g: r.grams, calories: r.calories, protein_g: r.protein_g,
      carbs_g: r.carbs_g, fat_g: r.fat_g, source, source_id: r.source_id?.slice(0, 64) ?? null })
  }
}

export function ReviewList({ rows, setRows, meal, setMeal }: { rows: ReviewRow[]; setRows: (f: (rs: ReviewRow[]) => ReviewRow[]) => void; meal: MealType; setMeal: (m: MealType) => void }) {
  const setGrams = (i: number, grams: number) => {
    const g = Math.max(1, Math.min(2000, grams < 10 ? +grams.toFixed(1) : Math.round(grams)))
    setRows(rs => rs.map((r, j) => j !== i ? r : { ...r, grams: g, ...scaled(r, g) }))
  }
  return (<>
    <div><p className="mb-1.5 text-xs font-medium text-fg-muted">Add to</p><Segmented size="sm" options={MEAL_OPTIONS} value={meal} onChange={setMeal} /></div>
    <ul className="space-y-2">
      {rows.map((r, i) => (
        <li key={i} className={clsx('rounded-xl border p-3 transition', r.picked ? 'border-line bg-ink-900' : 'border-line-soft opacity-50')}>
          <div className="flex flex-wrap items-start gap-x-3 gap-y-2 sm:flex-nowrap">
            <button role="checkbox" aria-checked={r.picked} aria-label={`Include ${r.name}`} onClick={() => setRows(rs => rs.map((x, j) => j === i ? { ...x, picked: !x.picked } : x))}
              className={clsx('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border', r.picked ? 'border-lime bg-lime text-ink-950' : 'border-line-strong')}>{r.picked && <Check className="h-3.5 w-3.5" />}</button>
            <div className="min-w-0 flex-1 basis-[calc(100%-2rem)] sm:basis-auto">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="font-medium">{r.name}</p>
                {r.basis === 'database' ? <Badge tone="moss"><Database className="h-3 w-3" />FitAI database</Badge> : <Badge tone="amber">AI estimate</Badge>}
                {(r.confidence < 0.5 || r.check_amount) && <Badge tone="neutral">Check the amount</Badge>}
              </div>
              <p className="mt-0.5 text-xs text-fg-dim"><Meta items={[r.portion, `${r.calories} kcal`, `P ${r.protein_g}`, `C ${r.carbs_g}`, `F ${r.fat_g}`]} /></p>
            </div>
            <div className="ml-8 flex shrink-0 items-center gap-1 sm:ml-0">
              <button aria-label={`Less ${r.name}`} onClick={() => setGrams(i, r.grams * 0.8)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-fg-muted hover:text-fg"><Minus className="h-3.5 w-3.5" /></button>
              <label className="sr-only" htmlFor={`g${i}`}>Grams of {r.name}</label>
              <input id={`g${i}`} type="number" inputMode="decimal" min={1} max={2000} value={r.grams} onChange={e => setGrams(i, +e.target.value || 1)}
                className="h-8 w-16 rounded-lg border border-line bg-ink-850 text-center text-sm tabular-nums" />
              <span className="text-xs text-fg-dim">g</span>
              <button aria-label={`More ${r.name}`} onClick={() => setGrams(i, r.grams * 1.25)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-fg-muted hover:text-fg"><Plus className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  </>)
}
