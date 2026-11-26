import type { SetTarget, Units } from '../types'
import { liftShow, weightUnit } from './format'

/** "42,5" or "42." typed by a person, as a number (null while empty or invalid). */
export const parseAmount = (v: string) => { const n = parseFloat(v.replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : null }

/** The first number in a rep range such as "8–12" (an en dash), so it never reads as 812. */
export const firstReps = (r: string) => { const m = r.match(/\d+/); return m ? Number(m[0]) : null }

/** The progression tip shown above the set table, in the user's units. */
export function targetText(t: SetTarget, units: Units) {
  const w = (kg: number | null) => (kg == null ? '' : `${liftShow(kg, units)} ${weightUnit(units)}`)
  switch (t.action) {
    case 'add_weight': return { head: `Try ${w(t.kg)} × ${t.reps}`, why: `You did ${t.last_reps}+ reps on every set at ${w(t.last_kg)} last time.` }
    case 'add_reps': return { head: t.kg != null ? `${w(t.kg)}, aim for ${t.reps} reps` : `Aim for ${t.reps} reps`, why: `One more rep than your weakest set last time (${t.last_reps}).` }
    case 'hold': return { head: `Stay at ${w(t.kg)}`, why: `Build up to ${t.reps} reps on every set before adding weight (last time: ${t.last_reps}).` }
    case 'add_time': return { head: `Hold for ${t.reps} s`, why: `5 seconds longer than your best last time (${t.last_reps} s).` }
    case 'harder': return { head: `Aim for ${t.reps} reps, or a harder version`, why: `You hit the top of the range on every set. Slow the lowering to 3 seconds, or try a harder variation.` }
  }
}
