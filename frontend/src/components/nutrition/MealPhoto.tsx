import { Camera, Check, ImageUp, RotateCcw, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button, Modal, Notice } from '../ui'
import { ReviewList, addRows, mealForNow, toRows, totalsOf, type ReviewRow } from './FoodReview'
import { useToast } from '../../context/ToastContext'
import { nutritionApi } from '../../services/fitai'
import type { MealPhotoResult, MealType } from '../../types'
import { MEAL_LABEL } from '../../utils/format'

export { mealForNow }

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

export function MealPhoto({ open, onClose, date, onAdded }: { open: boolean; onClose: () => void; date: string; onAdded: () => void }) {
  const toast = useToast()
  const camRef = useRef<HTMLInputElement>(null)
  const pickRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState<'analyse' | 'add' | null>(null)
  const [result, setResult] = useState<MealPhotoResult | null>(null)
  const [rows, setRows] = useState<ReviewRow[]>([])
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
      setRows(toRows(r.items))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const picked = rows.filter(r => r.picked)
  const total = totalsOf(rows)

  const add = async () => {
    setBusy('add')
    try {
      await addRows(rows, date, meal, 'meal_photo')
      toast('success', `Added ${picked.length} ${picked.length === 1 ? 'item' : 'items'} to ${MEAL_LABEL[meal]}`, `${Math.round(total.calories)} kcal, ${Math.round(total.protein_g)} g protein`)
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
              {hasRows && <p className="score mt-2 text-[40px]">{Math.round(total.calories)} <span className="font-sans text-sm font-normal tracking-normal text-fg-muted">kcal, {Math.round(total.protein_g)} g protein</span></p>}
            </div>
          </div>

          {error && <Notice tone="warn">{error} <button onClick={() => camRef.current?.click()} className="ml-1 font-semibold underline">Try another photo</button></Notice>}
          {result && !rows.length && !error && <Notice tone="info">We couldn't spot any food in that photo. <button onClick={() => camRef.current?.click()} className="ml-1 font-semibold underline">Try another photo</button></Notice>}

          {hasRows && (<>
            <ReviewList rows={rows} setRows={setRows} meal={meal} setMeal={setMeal} />
            <p className="text-[11px] leading-relaxed text-fg-dim">Portions from a photo can be off by 20–30%. Adjust the grams before adding. Calories for foods marked "FitAI database" come from FitAI's food data; "AI estimate" items are the AI's best guess.</p>
          </>)}
        </div>
      )}
    </Modal>
  )
}
