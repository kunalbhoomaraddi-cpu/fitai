import { ArrowLeft, ArrowRight, Lock, Mail, PlayCircle, RefreshCw, ShieldCheck, Terminal } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button, CodeInput, Input, Label, Notice } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import AuthShell from '../../layouts/AuthShell'
import { authApi, type OtpChallenge } from '../../services/fitai'
import type { User } from '../../types'

const EMPTY = Array(6).fill('') as string[]

export default function Login() {
  const { login, completeLogin, startDemo } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const loc = useLocation() as { state?: { from?: string } }
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'login' | 'demo' | 'code' | null>(null)
  const [otp, setOtp] = useState<OtpChallenge | null>(null)
  const [digits, setDigits] = useState<string[]>(EMPTY)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const go = (u: User) => nav(!u.email_verified ? '/verify-email' : u.onboarding_complete ? (loc.state?.from || '/dashboard') : '/onboarding', { replace: true })

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setError(null)
    // Read straight from the form too, so browser autofill always counts
    const fd = new FormData(e.currentTarget)
    const em = (email || String(fd.get('email') || '')).trim()
    const pw = password || String(fd.get('password') || '')
    if (!em.includes('@')) return setError('Enter a valid email address')
    if (!pw) return setError('Enter your password')
    setBusy('login')
    try {
      const r = await login(em, pw)
      if (r.otp) { setOtp(r.otp); setDigits(EMPTY); setCooldown(r.otp.resend_in_seconds) }
      else if (r.user) go(r.user)
    } catch (err) { setError(err instanceof Error ? err.message : 'Login failed') } finally { setBusy(null) }
  }

  const verify = async (code: string) => {
    if (!otp || busy) return
    setBusy('code'); setError(null)
    try { go(await completeLogin(otp.otp_token, code)) }
    catch (err) {
      const msg = err instanceof Error ? err.message : 'Verification failed'
      setError(msg); setDigits(EMPTY)
      if (msg.toLowerCase().includes('expired') && msg.toLowerCase().includes('log in again')) setOtp(null)
    } finally { setBusy(null) }
  }

  const resend = async () => {
    if (!otp) return
    setError(null)
    try {
      const r = await authApi.loginResend(otp.otp_token)
      setCooldown(r.resend_in_seconds)
      toast('success', r.delivery === 'console' ? 'New code printed in Terminal' : 'New code sent', r.delivery === 'email' ? `Check ${otp.email_masked}` : undefined)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not resend') }
  }

  const demo = async () => {
    setError(null); setBusy('demo')
    try { await startDemo(); nav('/dashboard', { replace: true }) } catch (err) { setError(err instanceof Error ? err.message : 'Demo unavailable') } finally { setBusy(null) }
  }

  if (otp) {
    return (
      <AuthShell>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime/10 text-lime"><ShieldCheck className="h-6 w-6" /></div>
        <h2 className="mt-5 font-display text-3xl font-bold tracking-tight">Check your email</h2>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">For your security, we sent a 6-digit login code to <b className="text-fg">{otp.email_masked}</b>.</p>
        {otp.delivery === 'console' && (
          <div className="mt-5"><Notice tone="demo" icon={<Terminal className="h-4 w-4" />}>
            <strong>Email sending isn't set up yet.</strong> Your code is printed in the <strong>Terminal window running FitAI</strong> (look for “CODE:”).
          </Notice></div>
        )}
        <div className="mt-7"><CodeInput value={digits} onChange={setDigits} onComplete={verify} disabled={busy === 'code'} invalid={!!error} /></div>
        {error && <div className="mt-4"><Notice tone="warn">{error}</Notice></div>}
        <Button className="mt-6" size="lg" full loading={busy === 'code'} disabled={digits.some(d => !d)} onClick={() => verify(digits.join(''))}
          icon={busy ? undefined : <ArrowRight className="h-4 w-4" />}>Verify & log in</Button>
        <div className="mt-6 flex items-center justify-between text-sm">
          <button onClick={resend} disabled={cooldown > 0} className="flex items-center gap-1.5 font-medium text-lime hover:underline disabled:text-fg-dim disabled:no-underline">
            <RefreshCw className="h-3.5 w-3.5" />{cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </button>
          <button onClick={() => { setOtp(null); setError(null) }} className="flex items-center gap-1.5 text-fg-muted hover:text-fg">
            <ArrowLeft className="h-3.5 w-3.5" />Back
          </button>
        </div>
        <p className="mt-8 text-xs text-fg-dim">Didn't get it? Check your spam folder. Codes expire after {otp.expires_in_minutes} minutes.</p>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <h2 className="font-display text-3xl font-bold tracking-tight">Welcome back</h2>
      <p className="mt-2 text-sm text-fg-muted">Log in to continue with your coach.</p>
      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" autoComplete="email" icon={<Mail className="h-4 w-4" />} placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" autoComplete="current-password" icon={<Lock className="h-4 w-4" />} placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} /></div>
        {error && <Notice tone="warn">{error}</Notice>}
        <Button type="submit" size="lg" full loading={busy === 'login'} icon={busy ? undefined : <ArrowRight className="h-4 w-4" />}>Log in</Button>
      </form>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-fg-dim"><ShieldCheck className="h-3.5 w-3.5" />We'll email you a one-time code to confirm it's you.</p>
      <div className="my-6 flex items-center gap-3 text-xs text-fg-dim"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
      <Button variant="outline" size="lg" full onClick={demo} loading={busy === 'demo'} icon={<PlayCircle className="h-4 w-4" />}>Explore the demo</Button>
      <p className="mt-2 text-center text-xs text-fg-dim">Demo uses clearly labelled sample data — no sign-up needed.</p>
      <p className="mt-8 text-center text-sm text-fg-muted">New to FitAI? <Link to="/register" className="font-semibold text-lime hover:underline">Create an account</Link></p>
    </AuthShell>
  )
}
