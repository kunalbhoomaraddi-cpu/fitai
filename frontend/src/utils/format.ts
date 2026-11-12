import type { Units } from '../types'

export const KG_PER_LB = 0.45359237
export const kgToLb = (kg: number) => kg / KG_PER_LB
export const lbToKg = (lb: number) => lb * KG_PER_LB
export const cmToFtIn = (cm: number) => { const inches = cm / 2.54; let ft = Math.floor(inches / 12); let i = Math.round(inches - ft * 12); if (i === 12) { ft += 1; i = 0 } return { ft, in: i } }
export const ftInToCm = (ft: number, inch: number) => (ft * 12 + inch) * 2.54

export const fmtWeight = (kg: number | null | undefined, units: Units = 'metric', digits = 1) => {
  if (kg === null || kg === undefined || Number.isNaN(kg)) return '—'
  return units === 'imperial' ? `${kgToLb(kg).toFixed(digits)} lb` : `${kg.toFixed(digits)} kg`
}
export const weightValue = (kg: number, units: Units) => units === 'imperial' ? +kgToLb(kg).toFixed(1) : +kg.toFixed(1)
export const weightUnit = (units: Units) => units === 'imperial' ? 'lb' : 'kg'
export const fmtLength = (cm: number | null | undefined, units: Units = 'metric') =>
  cm == null ? '—' : units === 'imperial' ? `${(cm / 2.54).toFixed(1)} in` : `${cm.toFixed(1)} cm`
export const fmtHeight = (cm: number, units: Units) => { if (units === 'metric') return `${Math.round(cm)} cm`; const f = cmToFtIn(cm); return `${f.ft}′${f.in}″` }

export const n0 = (v: number | null | undefined) => (v == null ? '—' : Math.round(v).toLocaleString())
export const pct = (v: number, t: number) => (t > 0 ? Math.max(0, Math.min(100, (v / t) * 100)) : 0)
export const todayISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) }
export const shortDate = (iso: string) => new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
export const longToday = () => new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
export const greeting = () => { const h = new Date().getHours(); return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }

export const GOAL_LABEL: Record<string, string> = {
  weight_loss: 'Weight loss', muscle_gain: 'Muscle building', recomposition: 'Body recomposition',
  general_fitness: 'General fitness', maintenance: 'Weight maintenance',
}
export const ACTIVITY_LABEL: Record<string, string> = {
  sedentary: 'Sedentary', light: 'Lightly active', moderate: 'Moderately active', active: 'Very active', very_active: 'Athlete',
}
export const DIET_LABEL: Record<string, string> = {
  vegetarian: 'Vegetarian', vegan: 'Vegan', eggetarian: 'Eggetarian', non_vegetarian: 'Non-vegetarian', custom: 'Custom',
}
export const MEAL_LABEL: Record<string, string> = { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snacks', dinner: 'Dinner' }
export const EQUIPMENT = [
  ['bodyweight', 'Bodyweight'], ['dumbbells', 'Dumbbells'], ['barbell', 'Barbell'], ['bench', 'Bench'], ['machines', 'Machines'],
  ['cables', 'Cables'], ['kettlebell', 'Kettlebell'], ['bands', 'Resistance bands'], ['pullup_bar', 'Pull-up bar'],
] as const
export const MUSCLES = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'core'] as const
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')
