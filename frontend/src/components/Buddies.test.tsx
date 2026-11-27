import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BuddyWeek, lastText, nudgeText, weekText } from './Buddies'
import type { BuddyActivity } from '../types'

const base: BuddyActivity = { week: [], workouts_this_week: 3, planned_per_week: 4, streak: 9, on_break: false, trained_today: false, last_workout: '2026-11-25' }

describe('buddy text', () => {
  it('describes the week against the plan', () => {
    expect(weekText(base)).toBe('3 of 4 workouts this week')
    expect(weekText({ ...base, planned_per_week: null, workouts_this_week: 1 })).toBe('1 workout this week')
  })
  it('says when they last trained', () => {
    const today = new Date(2026, 10, 27)
    expect(lastText({ ...base, trained_today: true }, today)).toBe('Trained today')
    expect(lastText({ ...base, last_workout: '2026-11-26' }, today)).toBe('Last trained yesterday')
    expect(lastText(base, today)).toBe('Last trained 2 days ago')
    expect(lastText({ ...base, last_workout: null }, today)).toBe('No workouts yet')
  })
  it('joins several nudges without repeating names', () => {
    expect(nudgeText(['Priya'])).toBe('Priya nudged you to train today.')
    expect(nudgeText(['Priya', 'Sam', 'Priya', 'Ravi'])).toBe('Priya, Sam and Ravi nudged you to train today.')
  })
})

describe('BuddyWeek', () => {
  it('names the days trained for screen readers', () => {
    const week = Array.from({ length: 7 }, (_, i) => ({ date: `2026-11-${23 + i}`, trained: i === 0 || i === 2, future: i > 3 }))
    render(<BuddyWeek week={week} name="Priya" />)
    expect(screen.getByRole('img', { name: 'Priya trained on Monday, Wednesday' })).toBeInTheDocument()
  })
})
