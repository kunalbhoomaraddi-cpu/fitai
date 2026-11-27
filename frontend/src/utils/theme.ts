import { useEffect, useState } from 'react'

/** Appearance: dark is FitAI's default. People can pick light, or follow their device's setting.
 *  The choice is kept on this device only (localStorage), and index.html applies it before the
 *  first paint so the page never flashes the wrong colours. */
export type ThemeChoice = 'system' | 'light' | 'dark'
export type Theme = 'light' | 'dark'

export const THEME_KEY = 'fitai.theme'
const EVENT = 'fitai-theme'
const BAR = { dark: '#0B0D0C', light: '#F2F4EF' }

export function getChoice(): ThemeChoice {
  try { const v = localStorage.getItem(THEME_KEY); if (v === 'light' || v === 'system' || v === 'dark') return v } catch { /* storage blocked */ }
  return 'dark'
}

function prefersLight() {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
}

export function resolveTheme(choice: ThemeChoice): Theme {
  return choice === 'system' ? (prefersLight() ? 'light' : 'dark') : choice
}

export function currentTheme(): Theme {
  return typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

export function applyTheme(choice: ThemeChoice = getChoice()) {
  const t = resolveTheme(choice)
  const root = document.documentElement
  if (t === 'light') root.dataset.theme = 'light'
  else delete root.dataset.theme
  root.classList.toggle('dark', t === 'dark')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR[t])
  window.dispatchEvent(new CustomEvent(EVENT, { detail: t }))
}

export function setThemeChoice(choice: ThemeChoice) {
  try { if (choice === 'dark') localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, choice) } catch { /* storage blocked */ }
  applyTheme(choice)
}

/** Call once at start-up: applies the saved choice and follows the device when set to "system". */
export function initTheme() {
  applyTheme()
  window.matchMedia?.('(prefers-color-scheme: light)').addEventListener?.('change', () => { if (getChoice() === 'system') applyTheme('system') })
}

export function useTheme(): Theme {
  const [t, setT] = useState<Theme>(currentTheme)
  useEffect(() => {
    const h = () => setT(currentTheme())
    window.addEventListener(EVENT, h); return () => window.removeEventListener(EVENT, h)
  }, [])
  return t
}

/** Real colour values for SVG charts and rings (SVG attributes can't use CSS variables everywhere). */
export const PALETTE = {
  dark: {
    lime: '#C6F36B', limeLight: '#D4F78F', limeDeep: '#A9D84F', moss: '#49B675', mossLight: '#64C98C', mossDeep: '#3A9560',
    sky: '#7CC4F2', amber: '#F2B85B', amberLight: '#F5C877', coral: '#F07C6A', fg: '#E9EEE6', muted: '#9CA69D', dim: '#6B756D',
    line: '#29312B', ink: '#0B0D0C', tint: '#FFFFFF', track: 'rgba(255,255,255,0.06)', good: '#9BD77A', bad: '#F2876B', violet: '#C9A7F5',
  },
  light: {
    lime: '#5E9410', limeLight: '#7DB52B', limeDeep: '#4B7A0A', moss: '#23784A', mossLight: '#3D9A66', mossDeep: '#1B603B',
    sky: '#1B6FA8', amber: '#B57A0E', amberLight: '#D29A2E', coral: '#B83A28', fg: '#2B332D', muted: '#4F5A52', dim: '#66706A',
    line: '#D6DBD2', ink: '#FFFFFF', tint: '#131814', track: 'rgba(19,24,20,0.08)', good: '#4F8F2E', bad: '#C2412D', violet: '#7A4FC0',
  },
} as const
export type Palette = { [K in keyof typeof PALETTE.dark]: string }

export function useColors(): Palette {
  return PALETTE[useTheme()]
}
