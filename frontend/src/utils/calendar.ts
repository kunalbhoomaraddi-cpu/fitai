/**
 * Workout reminders through the phone's own calendar: a calendar file (.ics) with one weekly
 * repeating event per training day, each with an alert before it, plus a Sunday check-in.
 * This needs no server and no push service, and works on iPhone, Android and computers.
 */
import type { WorkoutPlan } from '../types'

const BYDAY: Record<string, string> = { Mon: 'MO', Tue: 'TU', Wed: 'WE', Thu: 'TH', Fri: 'FR', Sat: 'SA', Sun: 'SU' }
const ORDER = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const pad = (n: number) => String(n).padStart(2, '0')
const stamp = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`
/** Local "floating" time, so 6 pm stays 6 pm in whatever time zone the phone is in. */
const local = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/[,;]/g, m => `\\${m}`).replace(/\n/g, '\\n')

/** The next date (today or later) that falls on the given weekday, at hh:mm. */
export function nextOn(weekday: string, time: string, from = new Date()) {
  const [h, m] = time.split(':').map(Number)
  const d = new Date(from); d.setHours(h, m, 0, 0)
  const diff = (ORDER.indexOf(weekday) - d.getDay() + 7) % 7
  d.setDate(d.getDate() + (diff === 0 && d < from ? 7 : diff))
  return d
}

export function buildIcs(plan: WorkoutPlan, time: string, alertMinutes: number, appUrl: string, checkin = true) {
  const now = stamp(new Date())
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FitAI//Workout reminders//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:FitAI workouts']
  const event = (uid: string, start: Date, minutes: number, title: string, rule: string, desc: string) => {
    const end = new Date(start.getTime() + minutes * 60000)
    lines.push('BEGIN:VEVENT', `UID:${uid}@fitai`, `DTSTAMP:${now}`, `DTSTART:${local(start)}`, `DTEND:${local(end)}`, `RRULE:${rule}`,
      `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(desc)}`, `URL:${appUrl}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, `TRIGGER:-PT${alertMinutes}M`, 'END:VALARM', 'END:VEVENT')
  }
  for (const day of plan.days) {
    if (!BYDAY[day.weekday]) continue
    event(`plan-${plan.id}-${day.index}`, nextOn(day.weekday, time), day.duration_minutes || 45, `FitAI: ${day.name}`,
      `FREQ=WEEKLY;BYDAY=${BYDAY[day.weekday]}`, `${day.exercises.length} exercises, about ${day.duration_minutes} min. Open FitAI to start: ${appUrl}/workouts`)
  }
  if (checkin) event(`checkin-${plan.id}`, nextOn('Sun', '10:00'), 10, 'FitAI: weekly check-in', 'FREQ=WEEKLY;BYDAY=SU',
    `See how your week went and get next week's targets: ${appUrl}/checkins`)
  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}

/** Google Calendar can't open a file on Android, so it gets a link that pre-fills one repeating event. */
export function googleCalendarUrl(plan: WorkoutPlan, time: string, appUrl: string) {
  const days = plan.days.map(d => d.weekday).filter(w => BYDAY[w])
  const first = days.map(w => nextOn(w, time)).sort((a, b) => +a - +b)[0] ?? nextOn('Mon', time)
  const minutes = Math.max(...plan.days.map(d => d.duration_minutes || 45), 30)
  const end = new Date(first.getTime() + minutes * 60000)
  const q = new URLSearchParams({
    action: 'TEMPLATE', text: 'FitAI workout', dates: `${local(first)}/${local(end)}`,
    recur: `RRULE:FREQ=WEEKLY;BYDAY=${days.map(w => BYDAY[w]).join(',')}`,
    details: `Training days: ${plan.days.map(d => `${d.weekday} ${d.name}`).join(', ')}. Open FitAI: ${appUrl}/workouts`,
  })
  return `https://calendar.google.com/calendar/render?${q.toString()}`
}
