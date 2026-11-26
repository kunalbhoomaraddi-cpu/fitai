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
            <h1 className="font-display text-[72px] font-extrabold uppercase leading-[.9] tracking-[.01em] text-fg">Your numbers.<br />Your plan.<br />Your coach.</h1>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-fg-muted">Targets from proven formulas, meals and workouts built around them, and a coach that reads your real progress before it answers.</p>
            <ul className="mt-8 space-y-3 border-t border-white/10 pt-6 text-sm">
              {[[Bot, 'Coach answers use your own logs'], [Salad, 'Meal plans that respect your diet'], [Activity, 'Weekly trends instead of daily noise']].map(([I, t]: any) => (
                <li key={t} className="flex items-center gap-3 text-fg/90"><I className="h-4 w-4 text-lime" />{t}</li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-fg-dim">FitAI provides general fitness guidance, not medical advice. <Link to="/privacy" className="ml-2 underline hover:text-fg">Privacy</Link><Link to="/terms" className="ml-3 underline hover:text-fg">Terms</Link></p>
        </div>
      </div>
      <div className="relative flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="relative w-full max-w-[420px]">
          <Link to="/" className="mb-10 block lg:hidden" aria-label="FitAI home"><Logo /></Link>
          {children}
        </div>
      </div>
    </div>
  )
}
