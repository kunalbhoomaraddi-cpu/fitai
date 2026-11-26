import { describe, expect, it } from 'vitest'
import { buildIcs, nextOn } from './calendar'
import type { WorkoutPlan } from '../types'

describe('calendar reminders', () => {
  it('finds the next matching weekday, moving on a week once the time has passed', () => {
    const wedMorning = new Date(2026, 10, 25, 9, 0) // Wed 25 Nov 2026
    expect(nextOn('Fri', '18:30', wedMorning).getDate()).toBe(27)
    expect(nextOn('Wed', '18:30', wedMorning).getDate()).toBe(25)
    expect(nextOn('Wed', '08:00', wedMorning).getDate()).toBe(2) // 2 Dec
  })

  it('writes one weekly event per training day plus the Sunday check-in', () => {
    const plan = { id: 7, days: [
      { index: 0, weekday: 'Mon', name: 'Push; chest, shoulders', duration_minutes: 50, exercises: [{}, {}] },
      { index: 1, weekday: 'Thu', name: 'Pull', duration_minutes: 45, exercises: [{}] },
    ] } as unknown as WorkoutPlan
    const ics = buildIcs(plan, '18:30', 30, 'https://fitai.example')
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3)
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO')
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=TH')
    expect(ics).toContain(String.raw`SUMMARY:FitAI: Push\; chest\, shoulders`) // escaped for the calendar format
    expect(ics).toContain('TRIGGER:-PT30M')
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })
})
