import { Share2, Trophy, X } from 'lucide-react'
import { useState } from 'react'
import { Button, Card, Meta } from './ui'
import { useToast } from '../context/ToastContext'
import type { Units, WeeklyRecap as Recap } from '../types'
import { fmtLiftSet, kgToLb, weightUnit } from '../utils/format'

const day = (iso: string) => new Date(iso + 'T00:00:00')
export const weekLabel = (r: Recap) => {
  const s = day(r.start), e = day(r.end)
  const sameMonth = s.getMonth() === e.getMonth()
  const fmt = (d: Date, month: boolean) => d.toLocaleDateString(undefined, month ? { day: 'numeric', month: 'short' } : { day: 'numeric' })
  return `${fmt(s, !sameMonth)} to ${fmt(e, true)}`
}
const volume = (kg: number, units: Units) => {
  if (!kg) return '—'
  const v = units === 'imperial' ? kgToLb(kg) : kg
  return v >= 10000 ? `${(v / 1000).toFixed(1)} t`.replace(' t', units === 'imperial' ? 'k lb' : ' t') : `${Math.round(v).toLocaleString()} ${weightUnit(units)}`
}
const change = (kg: number | null, units: Units) => {
  if (kg == null) return null
  const v = units === 'imperial' ? kgToLb(kg) : kg
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)} ${weightUnit(units)}`
}

/** The four numbers that tell the story of a week. */
export function recapStats(r: Recap, units: Units): [string, string, string][] {
  const w = r.workouts, n = r.nutrition
  return [
    ['Workouts', `${w.count}${w.planned ? ` / ${w.planned}` : ''}`, w.minutes ? `${w.minutes} min, ${w.sets} sets` : 'none logged'],
    ['Lifted', volume(w.volume_kg, units), w.prev_volume_kg ? `${w.volume_kg >= w.prev_volume_kg ? '+' : '−'}${Math.abs(Math.round((w.volume_kg - w.prev_volume_kg) / Math.max(1, w.prev_volume_kg) * 100))}% vs week before` : 'total volume'],
    ['Protein', n.avg_protein != null ? `${n.avg_protein} g` : '—', n.days_logged ? `a day, target ${n.protein_target} g` : 'no food logged'],
    ['Weight', change(r.weight.change_kg, units) ?? '—', r.weight.weigh_ins ? `${r.weight.weigh_ins} weigh-in${r.weight.weigh_ins === 1 ? '' : 's'}` : 'no weigh-ins'],
  ]
}

// ---------------------------------------------------------------- shareable image
async function drawImage(r: Recap, units: Units): Promise<Blob> {
  const W = 1080, H = 1350
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d')!
  const display = '"Big Shoulders Display Variable", "Big Shoulders Display", sans-serif'
  const sans = '"IBM Plex Sans Variable", "IBM Plex Sans", system-ui, sans-serif'
  try { await Promise.all([document.fonts.load(`800 96px ${display}`), document.fonts.load(`400 32px ${sans}`), document.fonts.load(`600 32px ${sans}`)]) } catch { /* fall back */ }
  g.fillStyle = '#0B0D0C'; g.fillRect(0, 0, W, H)
  g.fillStyle = '#C6F36B'; g.fillRect(0, 0, W, 14)
  const pad = 84
  g.textBaseline = 'alphabetic'
  g.fillStyle = '#C6F36B'; g.font = `800 52px ${display}`; g.fillText('FITAI', pad, 128)
  g.fillStyle = '#9CA69D'; g.font = `400 32px ${sans}`; g.textAlign = 'right'
  g.fillText(r.which === 'this' ? `This week, ${weekLabel(r)}` : `Week of ${weekLabel(r)}`, W - pad, 124); g.textAlign = 'left'

  // headline, wrapped
  g.fillStyle = '#E9EEE6'; g.font = `800 92px ${display}`
  const words = r.highlight.toUpperCase().split(' ')
  let line = '', y = 290
  for (const w of words) {
    const t = line ? `${line} ${w}` : w
    if (g.measureText(t).width > W - pad * 2 && line) { g.fillText(line, pad, y); y += 92; line = w } else line = t
  }
  g.fillText(line, pad, y)

  // stats grid
  const stats = recapStats(r, units)
  const top = Math.max(y + 90, 560), cw = (W - pad * 2 - 40) / 2, ch = 210
  stats.forEach(([label, value, sub], i) => {
    const x = pad + (i % 2) * (cw + 40), yy = top + Math.floor(i / 2) * (ch + 34)
    g.fillStyle = '#171C18'; g.beginPath(); g.roundRect(x, yy, cw, ch, 28); g.fill()
    g.fillStyle = '#9CA69D'; g.font = `600 30px ${sans}`; g.fillText(label, x + 36, yy + 60)
    g.fillStyle = '#E9EEE6'; g.font = `800 92px ${display}`; g.fillText(value, x + 36, yy + 150)
    g.fillStyle = '#9CA69D'; g.font = `400 26px ${sans}`; g.fillText(sub, x + 36, yy + 190)
  })

  // records
  let ry = top + 2 * (ch + 34) + 40
  if (r.prs.length) {
    g.fillStyle = '#C6F36B'; g.font = `600 30px ${sans}`; g.fillText(r.prs.length === 1 ? 'New record' : `${r.prs.length} new records`, pad, ry); ry += 50
    g.font = `400 30px ${sans}`
    for (const p of r.prs.slice(0, 3)) {
      g.fillStyle = '#E9EEE6'; g.fillText(p.name, pad, ry)
      g.fillStyle = '#9CA69D'; g.textAlign = 'right'; g.fillText(fmtLiftSet(p.kg, p.reps, units, p.kind === 'timed'), W - pad, ry); g.textAlign = 'left'
      ry += 46
    }
  }
  g.fillStyle = '#9CA69D'; g.font = `400 28px ${sans}`
  g.fillText(r.streak ? `${r.streak}-workout streak` : 'Every week is a fresh start', pad, H - 80)
  g.textAlign = 'right'; g.fillText('fitai-app-pink.vercel.app', W - pad, H - 80)
  return await new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('Could not create the image'))), 'image/png'))
}

async function share(r: Recap, units: Units): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const blob = await drawImage(r, units)
  const file = new File([blob], `fitai-week-${r.start}.png`, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title: 'My week on FitAI' }); return 'shared' } catch (e) { if ((e as Error).name === 'AbortError') return 'cancelled' }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
  return 'downloaded'
}

// ---------------------------------------------------------------- on screen
export function WeeklyRecapCard({ recap: r, units, onDismiss }: { recap: Recap; units: Units; onDismiss?: () => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const doShare = async () => {
    setBusy(true)
    try {
      const how = await share(r, units)
      if (how === 'downloaded') toast('success', 'Image saved', 'Your weekly recap was downloaded.')
    } catch (e) { toast('error', 'Could not share', (e as Error).message) } finally { setBusy(false) }
  }
  const n = r.nutrition, wa = r.water
  return (
    <Card className="relative overflow-hidden p-0">
      <div className="h-1 bg-lime" aria-hidden />
      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] text-fg-muted">{r.which === 'this' ? `This week so far, ${weekLabel(r)}` : `Your week, ${weekLabel(r)}`}</p>
            <h2 className="mt-1 font-display text-[30px] font-extrabold uppercase leading-[0.95] tracking-[.01em] text-fg sm:text-[36px]">{r.highlight}</h2>
          </div>
          {onDismiss && <button onClick={onDismiss} aria-label="Hide this week's recap" className="shrink-0 rounded-md p-1 text-fg-dim hover:text-fg"><X className="h-4 w-4" /></button>}
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {recapStats(r, units).map(([label, value, sub]) => (
            <div key={label} className="min-w-0 rounded-xl bg-ink-900 p-4">
              <p className="text-xs text-fg-muted">{label}</p>
              <p className="score mt-1 truncate text-[32px] text-fg">{value}</p>
              <p className="truncate text-[11.5px] text-fg-dim">{sub}</p>
            </div>
          ))}
        </div>
        {r.prs.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-lime"><Trophy className="h-3.5 w-3.5" />{r.prs.length === 1 ? 'New record' : `${r.prs.length} new records`}</p>
            <ul className="divide-y divide-line-soft">
              {r.prs.slice(0, 4).map(p => (
                <li key={p.name + p.date} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                  <span className="min-w-0 truncate text-fg">{p.name}</span>
                  <span className="shrink-0 tabular-nums text-fg-muted">{fmtLiftSet(p.kg, p.reps, units, p.kind === 'timed')}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4">
          <p className="text-[12.5px] text-fg-muted">
            <Meta items={[
              n.days_logged ? `Food logged ${n.days_logged} of ${r.days_in} days` : null,
              n.days_logged ? `${n.days_on_target} on calorie target` : null,
              wa.days_logged ? `Water goal met ${wa.days_goal_met} ${wa.days_goal_met === 1 ? 'day' : 'days'}` : null,
              r.streak ? `${r.streak}-workout streak` : null,
            ]} />
          </p>
          <Button size="sm" variant="secondary" icon={<Share2 className="h-4 w-4" />} onClick={doShare} loading={busy}>Share</Button>
        </div>
      </div>
    </Card>
  )
}
