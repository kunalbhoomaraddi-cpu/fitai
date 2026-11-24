import clsx from 'clsx'
import { Camera, Check, Database, ImageUp, Minus, Plus, RotateCcw, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Badge, Button, Modal, Notice, Segmented } from '../ui'
import { useToast } from '../../context/ToastContext'
import { nutritionApi } from '../../services/fitai'
import type { MealPhotoItem, MealPhotoResult, MealType } from '../../types'
import { MEAL_LABEL } from '../../utils/format'

const MEAL_OPTIONS = (['breakfast', 'lunch', 'snack', 'dinner'] as const).map(m => [m, MEAL_LABEL[m]] as const)

/** The meal that fits the time of day, so the common case needs no tap. */
export function mealForNow(hour = new Date().getHours()): MealType {
  return hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : hour < 19 ? 'snack' : 'dinner'
}

/** Shrink a phone photo (often 4–8 MB) before upload: faster on mobile data, same result for the AI. */
async function shrink(file: File, max = 1600): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    bmp.close()
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.85))
    return blob ?? file
  } catch {
    return file // the server validates and resizes anyway
  }
}

type Row = MealPhotoItem & { picked: boolean }
const scaled = (it: MealPhotoItem, grams: number) => {
  const k = grams / 100
  return { calories: Math.round(it.per_100g.calories * k), protein_g: +(it.per_100g.protein_g * k).toFixed(1), carbs_g: +(it.per_100g.carbs_g * k).toFixed(1), fat_g: +(it.per_100g.fat_g * k).toFixed(1) }
}

export function MealPhoto({ open, onClose, date, onAdded }: { open: boolean; onClose: () => void; date: string; onAdded: () => void }) {
  const toast = useToast()
  const camRef = useRef<HTMLInputElement>(null)
  const pickRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState<'analyse' | 'add' | null>(null)
  const [result, setResult] = useState<MealPhotoResult | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)
  const [meal, setMeal] = useState<MealType>(mealForNow())

  const reset = () => { setResult(null); setRows([]); setError(null); setBusy(null); setPreview(p => { if (p) URL.revokeObjectURL(p); return null }) }
  useEffect(() => { if (open) { reset(); setMeal(mealForNow()) } }, [open])

  const analyse = async (file?: File) => {
    if (!file) return
    reset()
    setPreview(URL.createObjectURL(file))
    setBusy('analyse')
    try {
      const r = await nutritionApi.analyzePhoto(await shrink(file))
      setResult(r)
      setRows(r.items.map(i => ({ ...i, picked: true })))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const setGrams = (i: number, grams: number) => setRows(rs => rs.map((r, j) => j !== i ? r : { ...r, grams: Math.max(5, Math.min(2000, Math.round(grams))), ...scaled(r, Math.max(5, Math.min(2000, grams))) }))
  const picked = rows.filter(r => r.picked)
  const total = picked.reduce((a, r) => ({ calories: a.calories + r.calories, protein_g: a.protein_g + r.protein_g }), { calories: 0, protein_g: 0 })

  const add = async () => {
    setBusy('add')
    try {
      for (const r of picked) {
        await nutritionApi.add({ eaten_on: date, meal, name: r.name.slice(0, 200), quantity_g: r.grams, calories: r.calories, protein_g: r.protein_g, carbs_g: r.carbs_g, fat_g: r.fat_g, source: 'meal_photo', source_id: r.source_id?.slice(0, 64) ?? null })
      }
      toast('success', `Added ${picked.length} ${picked.length === 1 ? 'item' : 'items'} to ${MEAL_LABEL[meal]}`, `${Math.round(total.calories)} kcal · ${Math.round(total.protein_g)} g protein`)
      onAdded(); onClose()
    } catch (e) {
      toast('error', 'Could not add', (e as Error).message); setBusy(null)
    }
  }

  const inputs = (
    <>
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { analyse(e.target.files?.[0]); e.target.value = '' }} />
      <input ref={pickRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { analyse(e.target.files?.[0]); e.target.value = '' }} />
    </>
  )
  const hasRows = !!result && rows.length > 0

  return (
    <Modal open={open} onClose={onClose} wide title={<span className="flex items-center gap-2"><Camera className="h-4 w-4 text-lime" />Snap your meal</span>}
      footer={hasRows ? (<>
        <Button variant="ghost" icon={<RotateCcw className="h-4 w-4" />} onClick={() => camRef.current?.click()} disabled={busy === 'add'}>Retake</Button>
        <Button icon={<Check className="h-4 w-4" />} onClick={add} loading={busy === 'add'} disabled={picked.length === 0}>
          Add {picked.length} {picked.length === 1 ? 'item' : 'items'} to {MEAL_LABEL[meal]}
        </Button>
      </>) : undefined}>
      {inputs}
      {!preview && (
        <div className="space-y-4">
          <p className="text-sm text-fg-muted">Take a photo of your plate. FitAI spots each food, estimates the portion and works out the calories from its food database. You check it before anything is saved.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <button onClick={() => camRef.current?.click()} className="flex flex-col items-center gap-2 rounded-2xl border border-lime/40 bg-lime/[0.06] px-4 py-8 text-center transition hover:bg-lime/10">
              <Camera className="h-7 w-7 text-lime" /><span className="font-semibold">Take a photo</span><span className="text-xs text-fg-dim">Opens the camera on your phone</span>
            </button>
            <button onClick={() => pickRef.current?.click()} className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-ink-900 px-4 py-8 text-center transition hover:border-line-strong">
              <ImageUp className="h-7 w-7 text-fg-muted" /><span className="font-semibold">Choose a photo</span><span className="text-xs text-fg-dim">JPG, PNG or WebP</span>
            </button>
          </div>
          <p className="text-[11px] text-fg-dim">Tip: shoot from above, in good light, with the whole plate in view. Your photo isn't saved.</p>
        </div>
      )}

      {preview && (
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <img src={preview} alt="Your meal" className="h-24 w-24 shrink-0 rounded-xl object-cover sm:h-28 sm:w-28" />
            <div className="min-w-0 flex-1 pt-1">
              {busy === 'analyse' && <><p className="flex items-center gap-2 font-medium"><Sparkles className="h-4 w-4 animate-pulse text-lime" />Identifying your food…</p><p className="mt-1 text-xs text-fg-dim">Usually 5–15 seconds.</p></>}
              {result?.note && <p className="text-sm text-fg-muted">{result.note}</p>}
              {hasRows && <p className="mt-2 font-display text-2xl font-bold tabular-nums">{Math.round(total.calories)} <span className="text-sm font-normal text-fg-muted">kcal · {Math.round(total.protein_g)} g protein</span></p>}
            </div>
          </div>

          {error && <Notice tone="warn">{error} <button onClick={() => camRef.current?.click()} className="ml-1 font-semibold underline">Try another photo</button></Notice>}
          {result && !rows.length && !error && <Notice tone="info">We couldn't spot any food in that photo. <button onClick={() => camRef.current?.click()} className="ml-1 font-semibold underline">Try another photo</button></Notice>}

          {hasRows && (<>
            <div><p className="mb-1.5 text-xs font-medium text-fg-muted">Add to</p><Segmented size="sm" options={MEAL_OPTIONS} value={meal} onChange={setMeal} /></div>
            <ul className="space-y-2">
              {rows.map((r, i) => (
                <li key={i} className={clsx('rounded-xl border p-3 transition', r.picked ? 'border-line bg-ink-900' : 'border-line-soft opacity-50')}>
                  <div className="flex flex-wrap items-start gap-x-3 gap-y-2 sm:flex-nowrap">
                    <button role="checkbox" aria-checked={r.picked} aria-label={`Include ${r.name}`} onClick={() => setRows(rs => rs.map((x, j) => j === i ? { ...x, picked: !x.picked } : x))}
                      className={clsx('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border', r.picked ? 'border-lime bg-lime text-ink-950' : 'border-line-strong')}>{r.picked && <Check className="h-3.5 w-3.5" />}</button>
                    <div className="min-w-0 flex-1 basis-[calc(100%-2rem)] sm:basis-auto">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-medium">{r.name}</p>
                        {r.basis === 'database' ? <Badge tone="moss"><Database className="h-3 w-3" />FitAI database</Badge> : <Badge tone="amber">AI estimate</Badge>}
                        {r.confidence < 0.5 && <Badge tone="neutral">Not sure, please check</Badge>}
                      </div>
                      <p className="mt-0.5 text-xs text-fg-dim">{r.portion ? `${r.portion} · ` : ''}{r.calories} kcal · P {r.protein_g} · C {r.carbs_g} · F {r.fat_g}</p>
                    </div>
                    <div className="ml-8 flex shrink-0 items-center gap-1 sm:ml-0">
                      <button aria-label={`Less ${r.name}`} onClick={() => setGrams(i, r.grams * 0.8)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-fg-muted hover:text-fg"><Minus className="h-3.5 w-3.5" /></button>
                      <label className="sr-only" htmlFor={`g${i}`}>Grams of {r.name}</label>
                      <input id={`g${i}`} type="number" inputMode="numeric" min={5} max={2000} value={r.grams} onChange={e => setGrams(i, +e.target.value || 5)}
                        className="h-8 w-16 rounded-lg border border-line bg-ink-850 text-center text-sm tabular-nums" />
                      <span className="text-xs text-fg-dim">g</span>
                      <button aria-label={`More ${r.name}`} onClick={() => setGrams(i, r.grams * 1.25)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-fg-muted hover:text-fg"><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-[11px] leading-relaxed text-fg-dim">Portions from a photo can be off by 20–30%. Adjust the grams before adding. Calories for foods marked "FitAI database" come from FitAI's food data; "AI estimate" items are the AI's best guess.</p>
          </>)}
        </div>
      )}
    </Modal>
  )
}
