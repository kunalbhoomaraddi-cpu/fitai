import { useEffect, useState } from 'react'

/** The browser's "Add to home screen" event (Chrome, Edge, Samsung Internet). Not in TypeScript's DOM types. */
interface InstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let deferred: InstallPromptEvent | null = null
const listeners = new Set<() => void>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as InstallPromptEvent; listeners.forEach(f => f()) })
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach(f => f()) })
}

export const isStandalone = () =>
  typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true)
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/**
 * How FitAI can be installed on this device:
 * - 'prompt': the browser offers a one-tap install (Android/desktop Chrome);
 * - 'ios': iPhone/iPad Safari, where the user adds it from the Share menu;
 * - 'installed' or 'unsupported': nothing to offer.
 */
export function useInstall() {
  const [, rerender] = useState(0)
  useEffect(() => { const f = () => rerender(n => n + 1); listeners.add(f); return () => { listeners.delete(f) } }, [])
  const mode: 'prompt' | 'ios' | 'installed' | 'unsupported' =
    isStandalone() ? 'installed' : deferred ? 'prompt' : isIOS() ? 'ios' : 'unsupported'
  const install = async () => {
    if (!deferred) return false
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    deferred = null; rerender(n => n + 1)
    return outcome === 'accepted'
  }
  return { mode, install }
}
