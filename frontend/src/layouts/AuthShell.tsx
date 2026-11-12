import { Activity, Bot, Salad } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo, Photo } from '../components/ui'

export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden lg:block">
        <Photo name="auth-side" alt="Athlete training in a modern gym" className="absolute inset-0" overlay="strong" position="center 30%" />
        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <Link to="/" aria-label="FitAI home"><Logo /></Link>
          <div className="max-w-lg">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[.24em] text-lime">AI-native fitness</p>
            <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-fg">Your fitness.<br />Your goals.<br /><span className="text-lime">Your AI coach.</span></h1>
            <p className="mt-5 text-[15px] leading-relaxed text-fg-muted">Personal targets calculated with proven formulas, meal and workout plans built around you, and a coach that reads your real progress — not guesses.</p>
            <div className="mt-8 grid grid-cols-3 gap-3">
              {[[Bot, 'AI coach', 'Tool-grounded answers'], [Salad, 'Meal plans', 'Diet-aware & macro-fit'], [Activity, 'Progress', 'Trends, not noise']].map(([I, t, d]: any) => (
                <div key={t} className="glass rounded-2xl p-3.5">
                  <I className="mb-2 h-4 w-4 text-lime" /><p className="text-sm font-semibold text-fg">{t}</p><p className="text-xs text-fg-muted">{d}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-fg-dim">FitAI provides general fitness guidance, not medical advice.</p>
        </div>
      </div>
      <div className="relative flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(198,243,107,0.06),transparent_60%)]" />
        <div className="relative w-full max-w-[420px]">
          <Link to="/" className="mb-10 block lg:hidden" aria-label="FitAI home"><Logo /></Link>
          {children}
        </div>
      </div>
    </div>
  )
}
