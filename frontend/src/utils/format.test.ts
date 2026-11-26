import { describe, expect, it } from 'vitest'
import { fmtLiftSet, liftShow, liftToKg } from './format'

describe('lift weights in kg and lb', () => {
  it('shows stored kg in the chosen unit', () => {
    expect(liftShow(100, 'metric')).toBe(100)
    expect(liftShow(100, 'imperial')).toBe(220.5)
  })

  it('round-trips a typed pound value without drift', () => {
    for (const lb of [45, 135, 137.5, 225, 315]) expect(liftShow(liftToKg(lb, 'imperial'), 'imperial')).toBe(lb)
  })

  it('formats a set, bodyweight and timed holds', () => {
    expect(fmtLiftSet(60, 8, 'metric')).toBe('60 kg × 8')
    expect(fmtLiftSet(null, 12, 'metric')).toBe('BW × 12')
    expect(fmtLiftSet(null, 45, 'metric', true)).toBe('45 s')
  })
})
