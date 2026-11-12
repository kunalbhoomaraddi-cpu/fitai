import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, Lock, Mail, RefreshCw, Terminal } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button, CodeInput, Input, Label, Notice } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import AuthShell from '../../layouts/AuthShell'
import { authApi, type ResetChallenge } from '../../services/fitai'

const EMPTY = Array(6).fill('') as string[]

function strength(pw: string) {
  const checks = [pw.length >= 8, /[a-zA-Z]/.test(pw), /\d/.test(pw)]
  return { ok: checks.every(Boolean), checks }
}

export default function ForgotPassword() {
  const loc = useLocation() as { state?: { email?: string } }
  const nav = useNavigate()
  const toast = useToast()
  const [email, setEmail] = useState(loc.state?.email || '')
  const [ch, setCh] = useState<ResetChallenge | null>(null)
  const [digits, setDigits] = useState<string[]>(EMPTY)
  const [pw, setPw] = useState({ next: '', confirm: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const start = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setError(null)
    const em = (email || String(new FormData(e.currentTarget).get('email') || '')).trim()
    if (!em.includes('@')) return setError('Enter a valid email address')
    setBusy(true)
    try { const r = await authApi.forgotPassword(em); setEmail(em); setCh(r); setDigits(EMPTY); setCooldown(r.resend_in_seconds) }
    catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong') } finally { setBusy(false) }
  }

  const s = strength(pw.next)
  const code = digits.join('')
  const canSubmit = code.length === 6 && s.ok && pw.next === pw.confirm

  const reset = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!ch) return
    setError(null)
    if (code.length !== 6) return setError('Enter the 6-digit code from the email')
    if (!s.ok) return setError('Use at least 8 characters with a letter and a number')
    if (pw.next !== pw.confirm) return setError("The two passwords don't match")
    setBusy(true)
    try { await authApi.resetPassword(ch.reset_token, code, pw.next); setDone(true) }
    catch (err) {
      const msg = err instanceof Error ? err.message : 'Reset failed'
      setError(msg); setDigits(EMPTY)
      if (msg.toLowerCase().includes('start again')) setCh(null)
    } finally { setBusy(false) }
  }

  const resend = async () => {
    if (!ch) return
    setError(null)
    try {
      const r = await authApi.forgotResend(ch.reset_token)
      setCooldown(r.resend_in_seconds)
      toast('success', r.delivery === 'console' ? 'New code printed in Terminal' : 'New code sent', r.delivery === 'email' ? `Check ${email}` : undefined)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not resend') }
  }

  if (done) {
    return (
      <AuthShell>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime/10 text-lime"><CheckCircle2 className="h-6 w-6" /></div>
        <h2 className="mt-5 font-display text-3xl font-bold tracking-tight">Password updated</h2>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">You can now log in with your new password. For your security, every device that was logged in has been signed out.</p>
        <Button className="mt-8" size="lg" full onClick={() => nav('/login', { replace: true })} icon={<ArrowRight className="h-4 w-4" />}>Go to log in</Button>
      </AuthShell>
    )
  }

  if (ch) {
    return (
      <AuthShell>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime/10 text-lime"><KeyRound className="h-6 w-6" /></div>
        <h2 className="mt-5 font-display text-3xl font-bold tracking-tight">Choose a new password</h2>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">We've sent a 6-digit code to <b className="text-fg">{email}</b>.</p>
        {ch.delivery === 'console' && (
          <div className="mt-5"><Notice tone="demo" icon={<Terminal className="h-4 w-4" />}>
            <strong>Email sending isn't set up yet.</strong> The code is printed in the <strong>Terminal window running FitAI</strong> (look for “CODE:”).
          </Notice></div>
        )}
        <form onSubmit={reset} className="mt-7 space-y-5" noValidate>
          <div><Label>Reset code</Label><CodeInput value={digits} onChange={setDigits} onComplete={() => document.getElementById('np')?.focus()} disabled={busy} invalid={!!error && code.length < 6} /></div>
          <div><Label htmlFor="np">New password</Label><Input id="np" type="password" autoComplete="new-password" icon={<Lock className="h-4 w-4" />} placeholder="At least 8 characters" value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })} />
            {pw.next && <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {['8+ characters', 'a letter', 'a number'].map((t, i) => <li key={t} className={s.checks[i] ? 'text-lime' : 'text-fg-dim'}>{s.checks[i] ? '✓' : '○'} {t}</li>)}
            </ul>}
          </div>
          <div><Label htmlFor="cp">Confirm new password</Label><Input id="cp" type="password" autoComplete="new-password" icon={<Lock className="h-4 w-4" />} placeholder="Type it again" value={pw.confirm} onChange={e => setPw({ ...pw, confirm: e.target.value })} />
            {pw.confirm && pw.confirm !== pw.next && <p className="mt-1.5 text-xs text-amber-300">Passwords don't match yet</p>}
          </div>
          {error && <Notice tone="warn">{error}</Notice>}
          <Button type="submit" size="lg" full loading={busy} disabled={!canSubmit} icon={busy ? undefined : <ArrowRight className="h-4 w-4" />}>Reset password</Button>
        </form>
        <div className="mt-6 flex items-center justify-between text-sm">
          <button onClick={resend} disabled={cooldown > 0} className="flex items-center gap-1.5 font-medium text-lime hover:underline disabled:text-fg-dim disabled:no-underline">
            <RefreshCw className="h-3.5 w-3.5" />{cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </button>
          <button onClick={() => { setCh(null); setError(null) }} className="flex items-center gap-1.5 text-fg-muted hover:text-fg"><ArrowLeft className="h-3.5 w-3.5" />Different email</button>
        </div>
        <p className="mt-8 text-xs text-fg-dim">Didn't get it? Check your spam folder. Codes expire after {ch.expires_in_minutes} minutes.</p>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime/10 text-lime"><KeyRound className="h-6 w-6" /></div>
      <h2 className="mt-5 font-display text-3xl font-bold tracking-tight">Forgot your password?</h2>
      <p className="mt-2 text-sm text-fg-muted">Enter your account email and we'll send you a code to reset it.</p>
      <form onSubmit={start} className="mt-8 space-y-4" noValidate>
        <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" autoComplete="email" autoFocus icon={<Mail className="h-4 w-4" />} placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} /></div>
        {error && <Notice tone="warn">{error}{error.startsWith('No FitAI account') && <> Or <Link to="/register" className="font-semibold text-lime hover:underline">create an account</Link>.</>}</Notice>}
        <Button type="submit" size="lg" full loading={busy} icon={busy ? undefined : <ArrowRight className="h-4 w-4" />}>Send reset code</Button>
      </form>
      <p className="mt-8 text-center text-sm text-fg-muted"><Link to="/login" className="inline-flex items-center gap-1.5 font-semibold text-lime hover:underline"><ArrowLeft className="h-3.5 w-3.5" />Back to log in</Link></p>
    </AuthShell>
  )
}
