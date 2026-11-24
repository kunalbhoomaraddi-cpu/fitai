import { Download, Share, SquarePlus, X } from 'lucide-react'
import { useState } from 'react'
import { useInstall } from '../hooks/useInstall'
import { Button, Modal } from './ui'

const DISMISS_KEY = 'fitai.install.dismissed'
const dismissed = () => { try { return localStorage.getItem(DISMISS_KEY) === '1' } catch { return false } }

/** Steps for iPhone/iPad, where Safari has no install button of its own. */
function IOSSteps({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Add FitAI to your home screen">
      <ol className="space-y-4 text-[15px]">
        <li className="flex gap-3"><span className="score w-6 text-[26px] text-lime">1</span><span>Tap the <Share className="inline h-4 w-4 align-[-2px] text-lime" aria-label="Share" /> <b>Share</b> button at the bottom of Safari.</span></li>
        <li className="flex gap-3"><span className="score w-6 text-[26px] text-lime">2</span><span>Scroll down and tap <SquarePlus className="inline h-4 w-4 align-[-2px] text-lime" aria-hidden /> <b>Add to Home Screen</b>.</span></li>
        <li className="flex gap-3"><span className="score w-6 text-[26px] text-lime">3</span><span>Tap <b>Add</b>. FitAI now opens full screen from its own icon.</span></li>
      </ol>
      <p className="mt-5 text-xs text-fg-dim">This works in Safari. In Chrome on iPhone, use its Share menu the same way.</p>
      <div className="mt-5 flex justify-end"><Button onClick={onClose}>Got it</Button></div>
    </Modal>
  )
}

/** A slim, dismissible strip on phones inviting people to install FitAI. Hidden once installed or dismissed. */
export function InstallBanner() {
  const { mode, install } = useInstall()
  const [hidden, setHidden] = useState(dismissed)
  const [steps, setSteps] = useState(false)
  if (hidden || (mode !== 'prompt' && mode !== 'ios')) return null
  const close = () => { try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* private mode */ } setHidden(true) }
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-ink-850 px-4 py-3 sm:hidden">
      <img src="/icons/icon-192.png" alt="" className="h-10 w-10 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Get the FitAI app</p><p className="text-xs text-fg-muted">Opens full screen from your home screen. Free, no app store.</p></div>
      <Button size="sm" onClick={() => (mode === 'prompt' ? install() : setSteps(true))}>Install</Button>
      <button onClick={close} aria-label="Not now" className="p-1 text-fg-dim hover:text-fg"><X className="h-4 w-4" /></button>
      <IOSSteps open={steps} onClose={() => setSteps(false)} />
    </div>
  )
}

/** Settings row: always available, even after dismissing the banner. */
export function InstallRow() {
  const { mode, install } = useInstall()
  const [steps, setSteps] = useState(false)
  const label = mode === 'installed' ? 'Installed on this device' : mode === 'prompt' ? 'Install' : mode === 'ios' ? 'Show me how' : null
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-sm font-medium">Install as an app</p><p className="text-xs text-fg-muted">{mode === 'unsupported' ? 'Open FitAI in Chrome on Android, or Safari on iPhone, to add it to your home screen.' : 'Adds FitAI to your home screen and opens it full screen.'}</p></div>
      {label && <Button size="sm" variant={mode === 'installed' ? 'secondary' : 'primary'} disabled={mode === 'installed'} icon={<Download className="h-4 w-4" />}
        onClick={() => (mode === 'prompt' ? install() : setSteps(true))}>{label}</Button>}
      <IOSSteps open={steps} onClose={() => setSteps(false)} />
    </div>
  )
}
