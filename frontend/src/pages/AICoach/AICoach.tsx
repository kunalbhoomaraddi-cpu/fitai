import clsx from 'clsx'
import { ArrowUp, Beef, Bookmark, Bot, CalendarDays, Copy, Dumbbell, Flame, History, Info, LineChart, MessageSquarePlus, Salad, Sparkles, Trash2, Wrench, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CoachCard } from '../../components/coach/CoachCards'
import { Badge, Button, IconButton, Notice, Photo, Skeleton } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { coachApi } from '../../services/fitai'
import type { AIStatus, ChatMessage } from '../../types'

const TOOL_LABEL: Record<string, string> = {
  calculate_bmr: 'BMR', calculate_tdee: 'TDEE', calculate_calorie_target: 'Calorie target', calculate_macros: 'Macros',
  get_user_profile: 'Profile', get_weight_history: 'Weight history', get_daily_nutrition: 'Daily nutrition', get_workout_history: 'Workout history',
  generate_workout: 'Workout generator', search_food: 'Food search', save_fitness_recommendation: 'Saved', analyze_progress: 'Progress analysis',
}
const THINKING = ['Reading your profile…', 'Checking your stored data…', 'Running the numbers…', 'Putting it together…']

function suggestionIcon(s: string) {
  const t = s.toLowerCase()
  if (t.includes('protein')) return Beef
  if (t.includes('calorie') || t.includes('lose')) return Flame
  if (t.includes('eat') || t.includes('diet')) return Salad
  if (t.includes('workout') || t.includes('strength')) return Dumbbell
  if (t.includes('week')) return CalendarDays
  return LineChart
}

function CoachAvatar({ size = 'h-9 w-9' }: { size?: string }) {
  return <div className={clsx('relative flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-lime to-moss text-ink-950 shadow-glow', size)}><Sparkles className="h-[18px] w-[18px]" /></div>
}

function Typing() {
  const [i, setI] = useState(0)
  useEffect(() => { const t = setInterval(() => setI(x => (x + 1) % THINKING.length), 1400); return () => clearInterval(t) }, [])
  return (
    <div className="flex animate-fade-up gap-3">
      <CoachAvatar />
      <div className="rounded-2xl rounded-tl-md border border-line bg-ink-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex gap-1">{[0, 1, 2].map(d => <span key={d} className="h-1.5 w-1.5 animate-bounce-dot rounded-full bg-lime" style={{ animationDelay: `${d * 0.15}s` }} />)}</div>
          <span className="text-xs text-fg-muted">{THINKING[i]}</span>
        </div>
      </div>
    </div>
  )
}

export default function AICoach() {
  const { units } = useAuth()
  const toast = useToast()
  const [status, setStatus] = useState<AIStatus | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [convs, setConvs] = useState<{ id: number; title: string; updated_at: string }[]>([])
  const [convId, setConvId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingConv, setLoadingConv] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const loadConvs = useCallback(() => coachApi.conversations().then(setConvs).catch(() => undefined), [])
  useEffect(() => {
    coachApi.status().then(setStatus).catch(() => undefined)
    coachApi.suggestions().then(setSuggestions).catch(() => undefined)
    loadConvs()
  }, [loadConvs])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages, sending])

  const open = async (id: number) => {
    setHistoryOpen(false); setLoadingConv(true); setNotice(null)
    try { const c = await coachApi.conversation(id); setConvId(c.id); setMessages(c.messages) } catch (e) { toast('error', 'Could not open conversation', (e as Error).message) } finally { setLoadingConv(false) }
  }
  const fresh = () => { setConvId(null); setMessages([]); setNotice(null); setHistoryOpen(false); taRef.current?.focus() }
  const remove = async (id: number) => {
    try { await coachApi.remove(id); if (id === convId) fresh(); loadConvs() } catch (e) { toast('error', 'Delete failed', (e as Error).message) }
  }

  const send = async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || sending) return
    setInput(''); setSending(true); setNotice(null)
    const temp: ChatMessage = { id: -Date.now(), role: 'user', content: msg, cards: [], tools_used: [], provider: null, created_at: new Date().toISOString(), pending: true }
    setMessages(m => [...m, temp])
    try {
      const r = await coachApi.chat(msg, convId)
      setConvId(r.conversation_id)
      setMessages(m => [...m.filter(x => x.id !== temp.id), r.user_message, r.message])
      if (r.notice) setNotice(r.notice)
      loadConvs()
    } catch (e) {
      setMessages(m => m.filter(x => x.id !== temp.id)); setInput(msg)
      toast('error', 'Coach unavailable', (e as Error).message)
    } finally { setSending(false); taRef.current?.focus() }
  }

  const saveMsg = async (m: ChatMessage) => {
    const prev = messages[messages.findIndex(x => x.id === m.id) - 1]
    try { await coachApi.save((prev?.content || 'Coach recommendation').slice(0, 150), m.content.replace(/\n---\n[\s\S]*$/, '').slice(0, 3900)); toast('success', 'Saved to dashboard') }
    catch (e) { toast('error', 'Save failed', (e as Error).message) }
  }

  const providerBadge = status && (status.is_real_llm
    ? <Badge tone="lime"><span className="h-1.5 w-1.5 rounded-full bg-lime" />{status.active_provider === 'gemini' ? 'Gemini' : 'Groq'} · {status.model}</Badge>
    : <Badge tone="amber">Demo mode · rule-based</Badge>)

  const History_ = (
    <div className="flex h-full flex-col">
      <div className="p-3"><Button full variant="secondary" onClick={fresh} icon={<MessageSquarePlus className="h-4 w-4" />}>New conversation</Button></div>
      <p className="px-4 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-fg-dim">History</p>
      <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        {convs.length === 0 && <p className="px-3 py-2 text-xs text-fg-dim">Your conversations will appear here.</p>}
        {convs.map(c => (
          <div key={c.id} className={clsx('group flex items-center gap-1 rounded-xl px-3 py-2 text-[13px] transition', c.id === convId ? 'bg-white/[0.06] text-fg' : 'text-fg-muted hover:bg-white/[0.03] hover:text-fg')}>
            <button className="min-w-0 flex-1 truncate text-left" onClick={() => open(c.id)}>{c.title}</button>
            <button aria-label="Delete conversation" onClick={() => remove(c.id)} className="rounded p-1 text-fg-dim opacity-0 transition hover:text-coral group-hover:opacity-100 focus:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="-mx-4 flex h-[calc(100dvh-4rem-5.5rem)] sm:-mx-6 lg:mx-0 lg:h-[calc(100dvh-4rem-2.5rem)] lg:gap-4">
      <aside className="hidden w-64 shrink-0 overflow-hidden rounded-2xl border border-line bg-ink-900 lg:block">{History_}</aside>
      {historyOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setHistoryOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-[290px] animate-fade-in border-l border-line bg-ink-900">
            <button onClick={() => setHistoryOpen(false)} className="absolute right-3 top-3 z-10 rounded-lg p-1 text-fg-muted" aria-label="Close history"><X className="h-4 w-4" /></button>
            <div className="h-full pt-10">{History_}</div>
          </div>
        </div>
      )}

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden border-line bg-ink-900/40 lg:rounded-2xl lg:border">
        <header className="flex items-center gap-3 border-b border-line-soft px-4 py-3 sm:px-5">
          <CoachAvatar />
          <div className="min-w-0 flex-1">
            <p className="font-display text-[15px] font-semibold">FitAI Coach</p>
            <p className="truncate text-xs text-fg-dim">Answers grounded in your profile, logs and deterministic calculations</p>
          </div>
          <div className="hidden sm:block">{providerBadge}</div>
          <IconButton label="Conversation history" className="lg:hidden" onClick={() => setHistoryOpen(true)}><History className="h-4 w-4" /></IconButton>
          <IconButton label="New conversation" onClick={fresh}><MessageSquarePlus className="h-4 w-4" /></IconButton>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="mx-auto max-w-3xl space-y-5">
            {status && !status.is_real_llm && messages.length === 0 && (
              <Notice tone="demo" icon={<Info className="h-4 w-4" />}><strong>Demo mode.</strong> {status.message}</Notice>
            )}
            {loadingConv && <div className="space-y-4"><Skeleton className="ml-auto h-12 w-2/3" /><Skeleton className="h-40 w-4/5" /></div>}
            {!loadingConv && messages.length === 0 && (
              <div className="animate-fade-up">
                <div className="relative overflow-hidden rounded-3xl border border-line">
                  <Photo name="coach-hero" alt="FitAI coach" className="absolute inset-0" overlay="left" />
                  <div className="relative p-6 sm:p-8">
                    <CoachAvatar size="h-12 w-12" />
                    <h1 className="mt-4 font-display text-2xl font-bold sm:text-3xl">How can I help you train smarter today?</h1>
                    <p className="mt-2 max-w-lg text-sm text-fg-muted">I can calculate your targets, analyse your weight trend, plan today's session and adjust your diet — using your real data, not guesses.</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                  {suggestions.map(s => { const I = suggestionIcon(s); return (
                    <button key={s} onClick={() => send(s)} className="group flex items-center gap-3 rounded-2xl border border-line bg-ink-800 px-4 py-3 text-left text-[13.5px] text-fg-muted transition hover:-translate-y-0.5 hover:border-lime/40 hover:text-fg">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-fg-dim transition group-hover:bg-lime/10 group-hover:text-lime"><I className="h-4 w-4" /></span>
                      <span className="flex-1">{s}</span><ArrowUp className="h-3.5 w-3.5 shrink-0 rotate-45 text-fg-dim transition group-hover:text-lime" />
                    </button>) })}
                </div>
              </div>
            )}
            {messages.map(m => m.role === 'user' ? (
              <div key={m.id} className="flex animate-fade-up justify-end">
                <div className={clsx('max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-md bg-lime/[0.12] px-4 py-2.5 text-[14.5px] text-fg ring-1 ring-lime/20', m.pending && 'opacity-70')}>{m.content}</div>
              </div>
            ) : (
              <div key={m.id} className="flex animate-fade-up gap-3">
                <CoachAvatar />
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="rounded-2xl rounded-tl-md border border-line bg-ink-800 px-4 py-3.5">
                    <div className="prose-chat"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown></div>
                  </div>
                  {m.cards.length > 0 && <div className="grid gap-3">{m.cards.filter(c => c.type !== 'profile').map((c, i) => <CoachCard key={i} card={c} units={units} />)}</div>}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {m.tools_used.length > 0 && <span className="mr-1 flex items-center gap-1 text-[11px] text-fg-dim"><Wrench className="h-3 w-3" />Tools:</span>}
                    {m.tools_used.map(t => <Badge key={t}>{TOOL_LABEL[t] ?? t}</Badge>)}
                    <span className="ml-auto flex items-center gap-1">
                      {m.provider && <span className="mr-1 text-[11px] text-fg-dim">{m.provider.startsWith('mock') ? 'Demo response' : m.provider.replace(':', ' · ')}</span>}
                      <IconButton label="Copy" className="h-7 w-7" onClick={() => { navigator.clipboard?.writeText(m.content); toast('success', 'Copied') }}><Copy className="h-3.5 w-3.5" /></IconButton>
                      <IconButton label="Save to dashboard" className="h-7 w-7" onClick={() => saveMsg(m)}><Bookmark className="h-3.5 w-3.5" /></IconButton>
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {sending && <Typing />}
            {notice && <Notice tone="warn">{notice}</Notice>}
            <div ref={endRef} />
          </div>
        </div>

        <div className="border-t border-line-soft bg-ink-950/60 px-4 py-3 backdrop-blur sm:px-6">
          <div className="mx-auto max-w-3xl">
            {messages.length > 0 && messages.length < 6 && !sending && (
              <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                {suggestions.slice(0, 5).map(s => <button key={s} onClick={() => send(s)} className="shrink-0 rounded-full border border-line px-3 py-1 text-xs text-fg-muted transition hover:border-lime/40 hover:text-fg">{s}</button>)}
              </div>
            )}
            <form onSubmit={e => { e.preventDefault(); send() }} className="flex items-end gap-2 rounded-2xl border border-line bg-ink-850 p-2 transition focus-within:border-lime/50 focus-within:ring-2 focus-within:ring-lime/10">
              <textarea ref={taRef} value={input} rows={1} maxLength={2000} placeholder="Ask about calories, workouts, progress…" aria-label="Message the coach"
                onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(160, e.target.scrollHeight) + 'px' }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-[14.5px] text-fg placeholder:text-fg-dim focus:outline-none" />
              <Button type="submit" size="md" className="h-10 w-10 !px-0" disabled={!input.trim()} loading={sending} aria-label="Send">{!sending && <ArrowUp className="h-4 w-4" />}</Button>
            </form>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-fg-dim"><Bot className="h-3 w-3" />General fitness guidance, not medical advice. Numbers come from FitAI's calculators and your logs.</p>
          </div>
        </div>
      </section>
    </div>
  )
}
