import clsx from 'clsx'
import { Check, Mic, MicOff, RotateCcw, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button, Modal, Notice, Segmented } from '../ui'
import { ReviewList, addRows, mealForNow, toRows, totalsOf, type ReviewRow } from './FoodReview'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { nutritionApi } from '../../services/fitai'
import type { CoachLanguage, MealTextResult, MealType } from '../../types'
import { MEAL_LABEL } from '../../utils/format'

// The browser's own speech recognition (Chrome, Edge, Safari, Android). Free. The browser maker's speech service
// hears the audio; FitAI only receives the words, when the person taps "Find foods".
type Recognition = {
  lang: string; interimResults: boolean; continuous: boolean
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null
  start: () => void; stop: () => void
}
type RecognitionCtor = new () => Recognition
const SpeechCtor = (): RecognitionCtor | undefined => {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

const SPEECH_LANG: Record<CoachLanguage, string> = { en: 'en-IN', hi: 'hi-IN', kn: 'kn-IN' }
const LANG_OPTIONS = [['en', 'English'], ['hi', 'हिन्दी'], ['kn', 'ಕನ್ನಡ']] as const
const EXAMPLE: Record<CoachLanguage, string> = {
  en: 'two rotis, a bowl of dal and a glass of milk',
  hi: 'दो रोटी, एक कटोरी दाल और एक गिलास दूध',
  kn: 'ಎರಡು ಚಪಾತಿ, ಒಂದು ಬಟ್ಟಲು ಬೇಳೆ ಸಾರು ಮತ್ತು ಒಂದು ಲೋಟ ಹಾಲು',
}
const MIC_ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone access is blocked. Allow it for this site in your browser settings, or type instead.',
  'service-not-allowed': 'Microphone access is blocked. Allow it for this site in your browser settings, or type instead.',
  'no-speech': "Didn't catch anything. Tap the microphone and speak, or type instead.",
  'audio-capture': 'No microphone found. You can type instead.',
  network: "Speech recognition needs an internet connection. You can type instead.",
}

export function DescribeMeal({ open, onClose, date, onAdded }: { open: boolean; onClose: () => void; date: string; onAdded: () => void }) {
  const toast = useToast()
  const { user } = useAuth()
  const [lang, setLang] = useState<CoachLanguage>(user?.coach_language ?? 'en')
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [busy, setBusy] = useState<'find' | 'add' | null>(null)
  const [result, setResult] = useState<MealTextResult | null>(null)
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [meal, setMeal] = useState<MealType>(mealForNow())
  const rec = useRef<Recognition | null>(null)
  const base = useRef('')
  const canListen = typeof window !== 'undefined' && !!SpeechCtor()

  const stop = () => { rec.current?.stop(); rec.current = null; setListening(false) }
  const reset = () => { stop(); setText(''); setResult(null); setRows([]); setError(null); setBusy(null) }
  useEffect(() => { if (open) { reset(); setMeal(mealForNow()); setLang(user?.coach_language ?? 'en') } else stop() }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stop(), [])

  const listen = () => {
    if (listening) return stop()
    const Ctor = SpeechCtor()
    if (!Ctor) return
    setError(null)
    const r = new Ctor()
    r.lang = SPEECH_LANG[lang]; r.interimResults = true; r.continuous = true
    base.current = text ? text.trim() + ', ' : ''
    r.onresult = e => {
      let heard = ''
      for (let i = 0; i < e.results.length; i++) heard += e.results[i][0].transcript
      setText((base.current + heard).replace(/\s+/g, ' ').trimStart())
    }
    r.onerror = e => { if (e.error !== 'aborted') setError(MIC_ERRORS[e.error] ?? 'Speech recognition stopped. You can type instead.'); setListening(false) }
    r.onend = () => setListening(false)
    rec.current = r
    try { r.start(); setListening(true) } catch { setError('Speech recognition is busy. Try again in a moment.') }
  }

  const find = async () => {
    stop()
    const t = text.trim()
    if (t.length < 2) return setError('Say or type what you ate first.')
    setBusy('find'); setError(null)
    try { const r = await nutritionApi.describe(t); setResult(r); setRows(toRows(r.items)) }
    catch (e) { setError((e as Error).message) } finally { setBusy(null) }
  }

  const picked = rows.filter(r => r.picked)
  const total = totalsOf(rows)
  const add = async () => {
    setBusy('add')
    try {
      await addRows(rows, date, meal, 'voice')
      toast('success', `Added ${picked.length} ${picked.length === 1 ? 'item' : 'items'} to ${MEAL_LABEL[meal]}`, `${Math.round(total.calories)} kcal, ${Math.round(total.protein_g)} g protein`)
      onAdded(); onClose()
    } catch (e) { toast('error', 'Could not add', (e as Error).message); setBusy(null) }
  }
  const reviewing = !!result && rows.length > 0

  return (
    <Modal open={open} onClose={onClose} wide title={<span className="flex items-center gap-2"><Mic className="h-4 w-4 text-lime" />Say what you ate</span>}
      footer={reviewing ? (<>
        <Button variant="ghost" icon={<RotateCcw className="h-4 w-4" />} onClick={() => { setResult(null); setRows([]) }} disabled={busy === 'add'}>Change words</Button>
        <Button icon={<Check className="h-4 w-4" />} onClick={add} loading={busy === 'add'} disabled={picked.length === 0}>
          Add {picked.length} {picked.length === 1 ? 'item' : 'items'} to {MEAL_LABEL[meal]}
        </Button>
      </>) : (<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button icon={<Sparkles className="h-4 w-4" />} onClick={find} loading={busy === 'find'} disabled={text.trim().length < 2}>Find foods</Button>
      </>)}>
      {!reviewing ? (
        <div className="space-y-4">
          <p className="text-sm text-fg-muted">Describe a meal the way you'd tell a friend. FitAI finds each food and portion and works out the calories from its food database. You check it before anything is saved.</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented size="sm" options={LANG_OPTIONS} value={lang} onChange={v => { stop(); setLang(v) }} />
            {canListen && (
              <button onClick={listen} aria-pressed={listening}
                className={clsx('flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition',
                  listening ? 'bg-coral text-ink-950' : 'bg-lime text-ink-950 hover:bg-lime/90')}>
                {listening ? <><MicOff className="h-4 w-4" />Stop</> : <><Mic className="h-4 w-4" />{text ? 'Speak more' : 'Tap and speak'}</>}
              </button>
            )}
          </div>
          <div className="relative">
            <label htmlFor="meal-words" className="sr-only">What you ate</label>
            <textarea id="meal-words" rows={3} maxLength={500} value={text} onChange={e => setText(e.target.value)} lang={SPEECH_LANG[lang]}
              placeholder={`e.g. ${EXAMPLE[lang]}`}
              className={clsx('w-full resize-none rounded-xl border bg-ink-900 px-4 py-3 text-[15px] text-fg placeholder:text-fg-dim focus:outline-none',
                listening ? 'border-coral/60' : 'border-line focus:border-lime/60')} />
            {listening && <span className="pointer-events-none absolute right-3 top-3 flex items-center gap-1.5 text-xs text-coral"><span className="h-2 w-2 animate-pulse rounded-full bg-coral" />Listening</span>}
          </div>
          {!canListen && <p className="text-xs text-fg-dim">This browser can't listen, so type it instead. Chrome, Edge and Safari can.</p>}
          {error && <Notice tone="warn">{error}</Notice>}
          {result && !rows.length && (
            <Notice tone="info">
              {result.notice ?? "We couldn't find foods in that."}
              {result.not_found.length > 0 && <> Not in the food database: {result.not_found.join(', ')}. Add {result.not_found.length === 1 ? 'it' : 'them'} with Add food.</>}
            </Notice>
          )}
          <p className="text-[11px] text-fg-dim">Your browser turns speech into text (Chrome and Android use Google's speech service, Safari uses Apple's). FitAI never gets the audio, only the words, when you tap Find foods.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-sm text-fg-muted">"{result.text}"</p>
            <p className="score mt-2 text-[40px]">{Math.round(total.calories)} <span className="font-sans text-sm font-normal tracking-normal text-fg-muted">kcal, {Math.round(total.protein_g)} g protein</span></p>
          </div>
          {result.notice && <Notice tone="info">{result.notice}</Notice>}
          {result.not_found.length > 0 && <Notice tone="warn">Not in the food database: {result.not_found.join(', ')}. Add {result.not_found.length === 1 ? 'it' : 'them'} with Add food.</Notice>}
          <ReviewList rows={rows} setRows={setRows} meal={meal} setMeal={setMeal} />
          <p className="text-[11px] leading-relaxed text-fg-dim">Check the grams before adding. "FitAI database" items use FitAI's food data; "AI estimate" items are the AI's best guess for foods it doesn't have.</p>
        </div>
      )}
    </Modal>
  )
}
