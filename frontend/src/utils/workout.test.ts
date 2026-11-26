import { describe, expect, it } from 'vitest'
import { firstReps, parseAmount, targetText } from './workout'

describe('typed amounts', () => {
  it('accepts commas and half-typed decimals', () => {
    expect(parseAmount('42,5')).toBe(42.5)
    expect(parseAmount('42.')).toBe(42)
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('-3')).toBeNull()
  })

  it('reads the start of a rep range written with an en dash', () => {
    expect(firstReps('8–12')).toBe(8) // used to read as 812
    expect(firstReps('30 s')).toBe(30)
    expect(firstReps('AMRAP')).toBeNull()
  })
})

describe('progression tips', () => {
  it('suggests more weight in the user units', () => {
    const t = targetText({ action: 'add_weight', kg: 62.5, reps: 8, last_kg: 60, last_reps: 12 }, 'metric')!
    expect(t.head).toBe('Try 62.5 kg × 8')
    expect(t.why).toContain('60 kg')
    expect(targetText({ action: 'add_weight', kg: 62.5, reps: 8, last_kg: 60, last_reps: 12 }, 'imperial')!.head).toBe('Try 137.8 lb × 8')
  })

  it('covers bodyweight and timed moves', () => {
    expect(targetText({ action: 'add_reps', kg: null, reps: 11, last_kg: null, last_reps: 10 }, 'metric')!.head).toBe('Aim for 11 reps')
    expect(targetText({ action: 'add_time', kg: null, reps: 50, last_kg: null, last_reps: 45 }, 'metric')!.head).toBe('Hold for 50 s')
  })
})
