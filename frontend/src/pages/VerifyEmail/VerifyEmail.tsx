import clsx from 'clsx'
import { ArrowRight, LogOut, MailCheck, RefreshCw, Terminal } from 'lucide-react'
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Notice } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import AuthShell from '../../layouts/AuthShell'
import { authApi, type Verification } from '../../services/fitai'

const LEN = 6

export default function VerifyEmail() {
  const { user, setUser, logout, lastVerification } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const [digits, setDigits] = useState<string[]>(Array(LEN).fill(''))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [delivery, setDelivery] = useState<Verification | null>(lastVerification)
  const [cooldown, setCooldown] = useState(lastVerification?.delivery === 'failed' ? 0 : 60)
  const refs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => { refs.current[0]?.focus() }, [])
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const submit = async (code: string) => {
    if (code.length !== LEN || busy) return
    setBusy(true); setError(null)
    try {
      const u = await authApi.verifyEmail(code)
      setUser(u)
      toast('success', 'Email verified', 'Welcome to FitAI!')
      nav(u.onboarding_complete ? '/dashboard' : '/onboarding', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed')
      setDigits(Array(LEN).fill('')); refs.current[0]?.focus()
    } finally { setBusy(false) }
  }

  const setAt = (i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(-1)
    const next = [...digits]; next[i] = d; setDigits(next)
    if (d && i < LEN - 1) refs.current[i + 1]?.focus()
    if (next.every(Boolean)) submit(next.join(''))
  }
  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus()
    if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus()
    if (e.key === 'ArrowRight' && i < LEN - 1) refs.current[i + 1]?.focus()
  }
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LEN)
    if (!t) return
    e.preventDefault()
    const next = Array(LEN).fill('').map((_, i) => t[i] ?? '')
    setDigits(next)
    refs.current[Math.min(t.length, LEN - 1)]?.focus()
    if (t.length === LEN) submit(t)
  }
  const resend = async () => {
    setError(null)
    try {
      const r = await authApi.resendCode()
      setDelivery(r); setCooldown(r.resend_in_seconds ?? 60)
      toast('success', r.delivery === 'console' ? 'New code printed in Terminal' : 'New code sent', r.delivery === 'email' ? `Check ${user?.email}` : undefined)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not resend') }
  }

  return (
    <AuthShell>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime/10 text-lime"><MailCheck className="h-6 w-6" /></div>
      <h2 className="mt-5 font-display text-3xl font-bold tracking-tight">Verify your email</h2>
      <p className="mt-2 text-sm leading-relaxed text-fg-muted">We sent a 6-digit code to <b className="text-fg">{user?.email}</b>. Enter it below to activate your account.</p>

      {delivery?.delivery === 'console' && (
        <div className="mt-5"><Notice tone="demo" icon={<Terminal className="h-4 w-4" />}>
          <strong>Email sending isn't set up yet.</strong> For now, your code is printed in the <strong>Terminal window running FitAI</strong> (look for “CODE:”). See LOCAL_SETUP.md to send real emails with free Gmail.
        </Notice></div>
      )}
      {delivery?.delivery === 'failed' && <div className="mt-5"><Notice tone="warn">{delivery.error} Fix the email settings, then press “Resend code”.</Notice></div>}

      <div className="mt-7 flex justify-between gap-2" role="group" aria-label="Verification code">
        {digits.map((d, i) => (
          <input key={i} ref={el => { refs.current[i] = el }} value={d} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={1} aria-label={`Digit ${i + 1}`} disabled={busy}
            onChange={e => setAt(i, e.target.value)} onKeyDown={e => onKey(i, e)} onPaste={onPaste}
            className={clsx('h-14 w-full min-w-0 rounded-xl border bg-ink-900 text-center font-display text-2xl font-bold tabular-nums text-fg transition focus:outline-none focus:ring-2',
              error ? 'border-coral/60 focus:ring-coral/20' : d ? 'border-lime/50 focus:ring-lime/20' : 'border-line focus:border-lime/60 focus:ring-lime/15')} />
        ))}
      </div>
      {error && <div className="mt-4"><Notice tone="warn">{error}</Notice></div>}

      <Button className="mt-6" size="lg" full loading={busy} disabled={digits.some(x => !x)} onClick={() => submit(digits.join(''))} icon={busy ? undefined : <ArrowRight className="h-4 w-4" />}>Verify email</Button>

      <div className="mt-6 flex items-center justify-between text-sm">
        <button onClick={resend} disabled={cooldown > 0} className="flex items-center gap-1.5 font-medium text-lime transition hover:underline disabled:text-fg-dim disabled:no-underline">
          <RefreshCw className="h-3.5 w-3.5" />{cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        </button>
        <button onClick={() => { logout(); nav('/login', { replace: true }) }} className="flex items-center gap-1.5 text-fg-muted hover:text-fg">
          <LogOut className="h-3.5 w-3.5" />Use a different email
        </button>
      </div>
      <p className="mt-8 text-xs text-fg-dim">Didn't get it? Check your spam folder. Codes expire after 15 minutes.</p>
    </AuthShell>
  )
}
