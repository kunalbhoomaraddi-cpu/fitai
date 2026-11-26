import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Button, Notice } from './ui'
import { useAuth } from '../context/AuthContext'
import { authApi } from '../services/fitai'

/** Shown once to accounts created before the Privacy Policy existed (or after it changes).
 *  It can't be dismissed: the only ways out are accepting or signing out. */
export default function ConsentGate() {
  const { user, setUser, logout } = useAuth()
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!user?.needs_consent) return null
  const accept = async () => {
    setBusy(true); setError(null)
    try { setUser(await authApi.consent()) } catch (e) { setError((e as Error).message); setBusy(false) }
  }
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="consent-title">
      <div className="w-full animate-pop rounded-t-3xl border border-line bg-ink-850 p-6 shadow-pop sm:max-w-md sm:rounded-3xl">
        <h2 id="consent-title" className="font-sans text-lg font-semibold text-fg">We've added a privacy policy</h2>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          It explains what FitAI stores, which services help run it, and how to delete your data. Nothing about how the app works has changed.
        </p>
        <label className="mt-5 flex cursor-pointer items-start gap-3 text-[13px] leading-relaxed text-fg-muted">
          <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-lime" />
          <span>I am 18 or older and agree to the <Link to="/terms" target="_blank" className="text-fg underline underline-offset-2 hover:text-lime">Terms</Link> and <Link to="/privacy" target="_blank" className="text-fg underline underline-offset-2 hover:text-lime">Privacy Policy</Link>, including FitAI using my health and fitness details to build my plans.</span>
        </label>
        {error && <div className="mt-4"><Notice tone="warn">{error}</Notice></div>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={logout}>Sign out</Button>
          <Button onClick={accept} disabled={!agree} loading={busy}>Continue</Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
