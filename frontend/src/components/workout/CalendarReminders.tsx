import { CalendarPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useToast } from '../../context/ToastContext'
import { workoutApi } from '../../services/fitai'
import type { WorkoutPlan } from '../../types'
import { buildIcs, googleCalendarUrl } from '../../utils/calendar'
import { Button, Input, Select } from '../ui'

const TIME_KEY = 'fitai.reminder.time'

/** "Remind me" through the phone's calendar: pick a time, add your training days as repeating events with an alert. */
export function CalendarRow({ plan: given }: { plan?: WorkoutPlan | null }) {
  const toast = useToast()
  const [plan, setPlan] = useState<WorkoutPlan | null | undefined>(given)
  const [time, setTime] = useState(() => { try { return localStorage.getItem(TIME_KEY) || '18:00' } catch { return '18:00' } })
  const [alert, setAlert] = useState('30')
  useEffect(() => { if (given !== undefined) setPlan(given); else workoutApi.active().then(setPlan).catch(() => setPlan(null)) }, [given])

  const remember = (t: string) => { setTime(t); try { localStorage.setItem(TIME_KEY, t) } catch { /* private mode */ } }
  const download = () => {
    if (!plan) return
    const ics = buildIcs(plan, time, Number(alert), window.location.origin)
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = 'fitai-workouts.ics'; document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
    toast('success', 'Calendar file ready', 'Open it and choose "Add all" to get your training days with reminders.')
  }

  return (
    <div>
      <p className="text-sm font-medium">Workout reminders</p>
      <p className="text-xs text-fg-muted">
        {plan === null ? 'Create a workout plan first, then add your training days to your calendar.'
          : plan ? `Adds ${plan.days.map(d => d.weekday).join(', ')} to your phone's calendar, repeating every week, plus a Sunday check-in.` : 'Loading your plan…'}
      </p>
      {plan && (
        <div className="mt-3 flex flex-wrap items-end gap-2.5">
          <label className="text-xs text-fg-muted">Time<Input type="time" value={time} onChange={e => remember(e.target.value)} className="mt-1 !h-9 w-[120px]" /></label>
          <label className="text-xs text-fg-muted">Alert<Select value={alert} onChange={e => setAlert(e.target.value)} className="mt-1 !h-9 w-[150px]">
            <option value="10">10 min before</option><option value="30">30 min before</option><option value="60">1 hour before</option><option value="120">2 hours before</option>
          </Select></label>
          <Button size="sm" icon={<CalendarPlus className="h-4 w-4" />} onClick={download}>Add to my calendar</Button>
          <a href={googleCalendarUrl(plan, time, window.location.origin)} target="_blank" rel="noreferrer" className="pb-2 text-xs text-lime underline-offset-2 hover:underline">Use Google Calendar instead</a>
        </div>
      )}
    </div>
  )
}
