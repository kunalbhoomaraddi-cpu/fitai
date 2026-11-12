import { ArrowRight, Check, Lock, Mail, User } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Button, Input, Label, Notice } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import AuthShell from '../../layouts/AuthShell'

export default function Register() {
  const { register } = useAuth()
  const nav = useNavigate()
  const [f, setF] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const rules = [[f.password.length >= 8, '8+ characters'], [/[a-zA-Z]/.test(f.password), 'A letter'], [/\d/.test(f.password), 'A number']] as const
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(null)
    if (f.name.trim().length < 2) return setError('Enter your full name')
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return setError('Enter a valid email address')
    if (!rules.every(r => r[0])) return setError('Password needs at least 8 characters, including a letter and a number')
    setBusy(true)
    try { const u = await register(f.name.trim(), f.email.trim(), f.password); nav(u.email_verified ? '/onboarding' : '/verify-email', { replace: true }) }
    catch (err) { setError(err instanceof Error ? err.message : 'Registration failed') } finally { setBusy(false) }
  }
  return (
    <AuthShell>
      <h2 className="font-display text-3xl font-bold tracking-tight">Create your account</h2>
      <p className="mt-2 text-sm text-fg-muted">Two minutes to set up. A lifetime of better training.</p>
      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        <div><Label htmlFor="name">Full name</Label><Input id="name" autoComplete="name" icon={<User className="h-4 w-4" />} placeholder="Your name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
        <div><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" icon={<Mail className="h-4 w-4" />} placeholder="you@example.com" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="new-password" icon={<Lock className="h-4 w-4" />} placeholder="Create a password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} />
          <div className="mt-2 flex gap-3">
            {rules.map(([ok, l]) => <span key={l} className={clsx('flex items-center gap-1 text-xs transition', ok ? 'text-lime' : 'text-fg-dim')}><Check className="h-3 w-3" />{l}</span>)}
          </div>
        </div>
        {error && <Notice tone="warn">{error}</Notice>}
        <Button type="submit" size="lg" full loading={busy} icon={busy ? undefined : <ArrowRight className="h-4 w-4" />}>Create account</Button>
      </form>
      <p className="mt-8 text-center text-sm text-fg-muted">Already have an account? <Link to="/login" className="font-semibold text-lime hover:underline">Log in</Link></p>
    </AuthShell>
  )
}
