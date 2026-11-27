import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WeeklyRecapCard, recapStats, weekLabel } from './WeeklyRecap'
import type { WeeklyRecap } from '../types'

vi.mock('../context/ToastContext', () => ({ useToast: () => vi.fn() }))

const recap: WeeklyRecap = {
  which: 'last', start: '2026-11-16', end: '2026-11-22', days_in: 7, name: 'Asha', empty: false,
  highlight: 'New personal record on Goblet Squat.',
  workouts: { count: 3, minutes: 120, sets: 9, volume_kg: 12500, days: [], planned: 3, prev_count: 2, prev_volume_kg: 10000 },
  prs: [{ name: 'Goblet Squat', label: '20 kg × 10', kg: 20, reps: 10, kind: 'weighted', date: '2026-11-18' }],
  nutrition: { days_logged: 6, calorie_target: 1800, protein_target: 126, avg_calories: 1790, avg_protein: 118, days_on_target: 5, protein_days: 4 },
  weight: { weigh_ins: 3, start_kg: 71, end_kg: 70.4, change_kg: -0.6, goal: 'weight_loss' },
  water: { days_logged: 4, avg_ml: 2300, goal_ml: 2500, days_goal_met: 2 }, streak: 5, best_streak: 9,
}

describe('weekly recap', () => {
  it('labels the week', () => {
    expect(weekLabel(recap)).toMatch(/^16 to (22 Nov|Nov 22)$/)   // the browser's own date style
  })

  it('works out the four headline numbers in kg', () => {
    const s = Object.fromEntries(recapStats(recap, 'metric').map(([k, v, sub]) => [k, [v, sub]]))
    expect(s.Workouts).toEqual(['3 / 3', '120 min, 9 sets'])
    expect(s.Lifted).toEqual(['12.5 t', '+25% vs week before'])
    expect(s.Protein[0]).toBe('118 g')
    expect(s.Weight).toEqual(['−0.6 kg', '3 weigh-ins'])
  })

  it('and in pounds', () => {
    const s = Object.fromEntries(recapStats(recap, 'imperial').map(([k, v]) => [k, v]))
    expect(s.Lifted).toBe('27.6k lb')
    expect(s.Weight).toBe('−1.3 lb')
  })

  it('shows the highlight, records and a share button', () => {
    render(<WeeklyRecapCard recap={recap} units="metric" />)
    expect(screen.getByRole('heading', { name: 'New personal record on Goblet Squat.' })).toBeInTheDocument()
    expect(screen.getByText('20 kg × 10')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument()
    expect(screen.getByText(/Food logged 6 of 7 days/)).toBeInTheDocument()
  })
})
