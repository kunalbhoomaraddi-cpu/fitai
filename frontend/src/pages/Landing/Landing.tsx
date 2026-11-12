import clsx from 'clsx'
import { Activity, ArrowRight, Award, Bot, Check, ChevronDown, Dumbbell, Flame, HeartPulse, LineChart, Lock, Menu, PlayCircle, Salad, ShieldCheck, Sparkles, Target, Timer, TrendingDown, UtensilsCrossed, Wrench, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge, Logo, Photo, Ring } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useReveal } from '../../hooks/useReveal'

const NAV = [['#features', 'Features'], ['#coach', 'AI Coach'], ['#how', 'How it works'], ['#faq', 'FAQ']] as const

const FEATURES = [
  { icon: Bot, title: 'AI Fitness Coach', text: 'Ask anything — calories, plateaus, what to train today. Answers are grounded in your own logs, not guesses.' },
  { icon: Salad, title: 'Smart Diet Planner', text: 'Meal plans matched to your calories, protein, diet and allergies — vegetarian, vegan, eggetarian and more.' },
  { icon: Dumbbell, title: 'Workout Generator', text: 'Push/Pull/Legs, Upper/Lower, Full Body and more — built only from the equipment you actually have.' },
  { icon: UtensilsCrossed, title: 'Nutrition Tracker', text: 'Search thousands of foods, log meals in seconds and watch your macros fill up in real time.' },
  { icon: LineChart, title: 'Progress Analysis', text: 'Weekly averages, 4-week trends and plateau detection that separate real progress from water weight.' },
  { icon: Award, title: 'Motivation that lasts', text: 'Healthy streaks, weekly challenges, badges and a fresh motivational note every day.' },
]

const STEPS = [
  { n: '01', title: 'Tell us about you', text: 'Two minutes of onboarding: your goal, body stats, diet, schedule and equipment.' },
  { n: '02', title: 'Get your plan', text: 'FitAI calculates your targets with proven formulas and builds meals and workouts around them.' },
  { n: '03', title: 'Track & adapt', text: 'Log food, workouts and weigh-ins. Your coach reads the trend and tells you what to adjust.' },
]

const FAQ = [
  ['Is FitAI medical advice?', 'No. FitAI is a general fitness and wellness assistant. It never diagnoses conditions, avoids extreme deficits, and suggests seeing a professional when something needs one.'],
  ['How are my calorie and macro targets calculated?', 'With established formulas — Mifflin-St Jeor for BMR, standard activity multipliers for TDEE, and safe, capped adjustments for your goal. The AI never invents these numbers; it reads them from FitAI’s calculators.'],
  ['Which diets are supported?', 'Vegetarian, vegan, eggetarian, non-vegetarian and custom diets, plus restrictions such as dairy, gluten, nuts, soy, eggs and seafood. Meal plans strictly respect them.'],
  ['Do I need a gym?', 'No. Choose your equipment — even bodyweight only — and FitAI programs exercises you can actually do.'],
  ['How is my account protected?', 'Passwords are hashed, every new account verifies its email, and each login is confirmed with a one-time code sent to your inbox.'],
  ['Can I try it without signing up?', 'Yes — open the live demo to explore every feature with clearly labelled sample data.'],
]

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[560px] lg:mx-0">
      <div className="pointer-events-none absolute -inset-10 rounded-full bg-lime/10 blur-3xl" />
      <div className="group relative overflow-hidden rounded-[28px] border border-line shadow-pop">
        <Photo name="hero-training" alt="Athlete strength training" className="aspect-[4/5] sm:aspect-[5/5]" overlay="strong" position="center 35%" />
        <div className="absolute inset-x-5 bottom-5 rounded-2xl glass p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lime text-ink-950"><Sparkles className="h-4 w-4" /></div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-lime/80">FitAI Coach</p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-fg">Your 4-week trend is <b>−0.42 kg/week</b> — right in the healthy range. Keep protein near <b>148 g</b> and you’re on track.</p>
              <div className="mt-2 flex flex-wrap gap-1.5"><Badge><Wrench className="h-3 w-3" />Weight history</Badge><Badge>Macros</Badge></div>
            </div>
          </div>
        </div>
      </div>
      <div className="float absolute -left-4 top-10 hidden w-44 rounded-2xl border border-line bg-ink-850/95 p-4 shadow-pop backdrop-blur sm:block lg:-left-14">
        <div className="flex items-center gap-3">
          <Ring value={68} max={100} size={58} stroke={6}><span className="font-display text-sm font-bold">68%</span></Ring>
          <div><p className="text-xs text-fg-muted">Goal progress</p><p className="flex items-center gap-1 text-xs text-moss-400"><TrendingDown className="h-3 w-3" />−5.4 kg</p></div>
        </div>
      </div>
      <div className="float-delayed absolute -right-3 top-24 hidden w-52 rounded-2xl border border-line bg-ink-850/95 p-4 shadow-pop backdrop-blur sm:block lg:-right-10">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold"><Flame className="h-3.5 w-3.5 text-lime" />Today’s macros</p>
        {[['Protein', 112, 148, '#C6F36B'], ['Carbs', 180, 260, '#7CC4F2'], ['Fat', 41, 68, '#F2B85B']].map(([l, v, t, c]) => (
          <div key={l as string} className="mb-2 last:mb-0">
            <div className="mb-1 flex justify-between text-[11px]"><span className="text-fg-muted">{l}</span><span className="tabular-nums">{v}/{t}g</span></div>
            <div className="h-1.5 rounded-full bg-white/[0.06]"><div className="h-full rounded-full" style={{ width: `${((v as number) / (t as number)) * 100}%`, background: c as string }} /></div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] text-fg-dim lg:text-left">Illustrative preview</p>
    </div>
  )
}

export default function Landing() {
  const { startDemo } = useAuth()
  const nav = useNavigate()
  const [menu, setMenu] = useState(false)
  const [open, setOpen] = useState<number | null>(0)
  const [demoBusy, setDemoBusy] = useState(false)
  useReveal([])
  const demo = async () => { setDemoBusy(true); try { await startDemo(); nav('/dashboard') } finally { setDemoBusy(false) } }

  const Primary = ({ className = '' }: { className?: string }) => (
    <Link to="/register" className={clsx('btn-shine inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-lime px-6 text-[15px] font-semibold text-ink-950 shadow-[0_10px_30px_-10px_rgba(198,243,107,.7)] transition hover:bg-lime-400 active:scale-[.98]', className)}>
      Get started free <ArrowRight className="h-4 w-4" />
    </Link>
  )
  const DemoBtn = ({ className = '' }: { className?: string }) => (
    <button onClick={demo} disabled={demoBusy} className={clsx('inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line bg-white/[0.03] px-6 text-[15px] font-medium text-fg transition hover:border-lime/50 hover:text-lime disabled:opacity-60', className)}>
      <PlayCircle className="h-4 w-4" />{demoBusy ? 'Opening demo…' : 'Explore the live demo'}
    </button>
  )

  return (
    <div className="min-h-screen overflow-x-hidden bg-ink-950">
      {/* NAV */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-ink-950/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
          <Link to="/" aria-label="FitAI home"><Logo /></Link>
          <nav className="ml-6 hidden items-center gap-7 text-sm text-fg-muted md:flex">
            {NAV.map(([h, l]) => <a key={h} href={h} className="transition hover:text-fg">{l}</a>)}
          </nav>
          <div className="ml-auto hidden items-center gap-3 md:flex">
            <Link to="/login" className="px-3 py-2 text-sm font-medium text-fg-muted transition hover:text-fg">Log in</Link>
            <Link to="/register" className="btn-shine inline-flex h-10 items-center gap-1.5 rounded-xl bg-lime px-4 text-sm font-semibold text-ink-950 transition hover:bg-lime-400">Get started <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          <button className="ml-auto rounded-lg p-2 text-fg-muted md:hidden" onClick={() => setMenu(m => !m)} aria-label="Menu">{menu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        </div>
        {menu && (
          <div className="animate-fade-in border-t border-line-soft px-5 py-4 md:hidden">
            {NAV.map(([h, l]) => <a key={h} href={h} onClick={() => setMenu(false)} className="block py-2.5 text-fg-muted">{l}</a>)}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link to="/login" className="flex h-11 items-center justify-center rounded-xl border border-line text-sm">Log in</Link>
              <Link to="/register" className="flex h-11 items-center justify-center rounded-xl bg-lime text-sm font-semibold text-ink-950">Get started</Link>
            </div>
          </div>
        )}
      </header>

      {/* HERO */}
      <section className="relative pt-28 sm:pt-36">
        <div className="grid-bg pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-lime/[0.07] blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 lg:grid-cols-[1.05fr_1fr] lg:pb-28">
          <div className="text-center lg:text-left">
            <div className="reveal inline-flex items-center gap-2 rounded-full border border-lime/25 bg-lime/[0.06] px-3.5 py-1.5 text-xs font-medium text-lime">
              <Sparkles className="h-3.5 w-3.5" />AI-native fitness · powered by Gemini
            </div>
            <h1 className="reveal reveal-d1 mt-6 font-display text-[42px] font-extrabold leading-[1.02] tracking-tight sm:text-6xl lg:text-[68px]">
              Train smarter with a coach that <span className="text-gradient">knows your numbers.</span>
            </h1>
            <p className="reveal reveal-d2 mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-fg-muted lg:mx-0">
              FitAI turns your profile, meals and workouts into personal targets, meal plans and training — with an AI coach that checks your real data before it answers.
            </p>
            <div className="reveal reveal-d3 mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start"><Primary /><DemoBtn /></div>
            <div className="reveal reveal-d3 mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-fg-dim lg:justify-start">
              {['No credit card', 'Email-verified accounts', 'Not medical advice — safety first'].map(t => <span key={t} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-lime" />{t}</span>)}
            </div>
          </div>
          <div className="reveal reveal-d2"><HeroVisual /></div>
        </div>
      </section>

      {/* STAT STRIP */}
      <section className="border-y border-white/[0.06] bg-ink-900/60">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-y-6 px-5 py-8 text-center md:grid-cols-4">
          {[['12', 'AI coach tools'], ['7', 'Workout styles'], ['5', 'Diet types + allergies'], ['100%', 'Formula-based targets']].map(([v, l], i) => (
            <div key={l} className={clsx('reveal', `reveal-d${i % 3}`)}><p className="font-display text-3xl font-extrabold text-fg sm:text-4xl">{v}</p><p className="mt-1 text-sm text-fg-muted">{l}</p></div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="scroll-mt-20 py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="reveal mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[.22em] text-lime/80">Everything in one place</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-[44px] sm:leading-[1.1]">Your whole fitness journey, finally connected.</h2>
            <p className="mt-4 text-fg-muted">Not a chatbot bolted onto a tracker. Every screen shares the same data, so your coach, meals and workouts always agree.</p>
          </div>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: I, title, text }, i) => (
              <div key={title} className={clsx('reveal group rounded-2xl border border-line bg-ink-850 p-6 transition duration-300 hover:-translate-y-1 hover:border-lime/30 hover:shadow-glow', `reveal-d${i % 3}`)}>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-lime/10 text-lime transition group-hover:bg-lime group-hover:text-ink-950"><I className="h-5 w-5" /></div>
                <h3 className="mt-5 font-display text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-fg-muted">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COACH SHOWCASE */}
      <section id="coach" className="scroll-mt-20 border-y border-white/[0.06] bg-ink-900/50 py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-2">
          <div className="reveal">
            <p className="text-xs font-semibold uppercase tracking-[.22em] text-lime/80">AI Fitness Coach</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-[42px] sm:leading-[1.1]">A coach that shows its work.</h2>
            <p className="mt-4 text-fg-muted">When you ask a question, the coach calls FitAI’s tools — your weight history, your food log, the calorie calculator — then explains the result in plain language.</p>
            <ul className="mt-8 space-y-4">
              {[[Wrench, 'Real numbers, never invented', 'Calculations run in code; the AI only explains them.'], [Activity, 'Knows your history', 'Reads your trend, workouts and nutrition before answering.'], [HeartPulse, 'Safety built in', 'No crash diets, no diagnoses, and a nudge to see a professional when needed.']].map(([I, t, d]: any) => (
                <li key={t} className="flex gap-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-ink-850 text-lime"><I className="h-4 w-4" /></div><div><p className="font-semibold">{t}</p><p className="mt-0.5 text-sm text-fg-muted">{d}</p></div></li>
              ))}
            </ul>
          </div>
          <div className="reveal reveal-d1">
            <div className="glow-border rounded-3xl border border-line bg-ink-850 p-5 shadow-pop sm:p-6">
              <div className="flex items-center gap-3 border-b border-line-soft pb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-lime to-moss text-ink-950"><Sparkles className="h-4 w-4" /></div>
                <div><p className="text-sm font-semibold">FitAI Coach</p><p className="text-[11px] text-fg-dim">Grounded in your data</p></div>
              </div>
              <div className="mt-5 flex justify-end"><div className="max-w-[80%] rounded-2xl rounded-tr-md bg-lime/[0.12] px-4 py-2.5 text-sm ring-1 ring-lime/20">Why has my weight stopped going down?</div></div>
              <div className="mt-4 rounded-2xl rounded-tl-md border border-line bg-ink-900 px-4 py-3.5 text-sm leading-relaxed text-fg/90">
                Your weekly averages haven’t moved for <b>3 weeks</b>, but you logged food on only <b>8 of 14 days</b>. Before eating less, tighten logging (oils and drinks add up) and add ~2,000 daily steps.
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[['Trend', '−0.04 kg/wk'], ['Logged', '8 / 14 days'], ['Target', '2,150 kcal']].map(([l, v], i) => (
                  <div key={l} className={clsx('rounded-xl px-3 py-2.5', i === 2 ? 'bg-lime/10 ring-1 ring-lime/30' : 'bg-white/[0.03]')}><p className="text-[10.5px] text-fg-dim">{l}</p><p className={clsx('mt-0.5 text-[13px] font-semibold tabular-nums', i === 2 && 'text-lime')}>{v}</p></div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-fg-dim"><Wrench className="h-3 w-3" />Tools used: <Badge>Weight history</Badge><Badge>Progress analysis</Badge><Badge>Calorie target</Badge></div>
            </div>
            <p className="mt-3 text-center text-[11px] text-fg-dim">Illustrative conversation</p>
          </div>
        </div>
      </section>

      {/* MEALS + WORKOUTS */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="reveal mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[.22em] text-lime/80">Plans that fit your life</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-[44px] sm:leading-[1.1]">Meals you’ll actually eat. Workouts you can actually do.</h2>
          </div>
          <div className="mt-14 grid gap-5 lg:grid-cols-2">
            {[
              { photo: 'lunch-bowl', icon: Salad, title: 'AI meal plans', text: 'Breakfast to dinner, scaled to your calories and protein. Swap any food, regenerate a meal, and log it with one tap.', chips: ['Vegetarian', 'Vegan', 'Eggetarian', 'Non-veg', 'Nut-free', 'Gluten-free'] },
              { photo: 'cat-push_pull_legs', icon: Dumbbell, title: 'Workout plans', text: 'A weekly calendar with sets, reps and rest — then a guided session with a rest timer that tracks every set.', chips: ['Push / Pull / Legs', 'Upper / Lower', 'Full Body', 'Beginner', 'Fat Loss', 'Custom'] },
            ].map(({ photo, icon: I, title, text, chips }, i) => (
              <div key={title} className={clsx('reveal group overflow-hidden rounded-3xl border border-line bg-ink-850 transition duration-300 hover:border-line-strong', `reveal-d${i}`)}>
                <Photo name={photo} alt={title} className="h-64 sm:h-72" overlay />
                <div className="p-6 sm:p-7">
                  <div className="flex items-center gap-2.5"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime/10 text-lime"><I className="h-4 w-4" /></div><h3 className="font-display text-xl font-semibold">{title}</h3></div>
                  <p className="mt-3 text-[15px] leading-relaxed text-fg-muted">{text}</p>
                  <div className="mt-5 flex flex-wrap gap-2">{chips.map(c => <span key={c} className="rounded-full border border-line px-3 py-1 text-xs text-fg-muted">{c}</span>)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="scroll-mt-20 border-y border-white/[0.06] bg-ink-900/50 py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="reveal text-center">
            <p className="text-xs font-semibold uppercase tracking-[.22em] text-lime/80">How it works</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-[44px]">Up and running in two minutes.</h2>
          </div>
          <div className="relative mt-14 grid gap-5 md:grid-cols-3">
            <div className="pointer-events-none absolute left-[16%] right-[16%] top-9 hidden h-px bg-gradient-to-r from-transparent via-lime/40 to-transparent md:block" />
            {STEPS.map((s, i) => (
              <div key={s.n} className={clsx('reveal relative rounded-2xl border border-line bg-ink-850 p-6 text-center', `reveal-d${i}`)}>
                <div className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-lime font-display text-base font-extrabold text-ink-950 shadow-glow">{s.n}</div>
                <h3 className="mt-5 font-display text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section className="py-24">
        <div className="mx-auto grid max-w-6xl gap-5 px-5 md:grid-cols-4">
          {[[Target, 'Proven formulas', 'Mifflin-St Jeor BMR, standard activity multipliers.'], [ShieldCheck, 'Safe by default', 'Deficits capped at 500 kcal with calorie floors.'], [Lock, 'Secure accounts', 'Hashed passwords and a one-time code at every login.'], [Timer, 'Honest progress', 'Weekly trends, not daily water-weight noise.']].map(([I, t, d]: any, i) => (
            <div key={t} className={clsx('reveal rounded-2xl border border-line bg-ink-850 p-5', `reveal-d${i % 3}`)}><I className="h-5 w-5 text-lime" /><p className="mt-4 font-semibold">{t}</p><p className="mt-1 text-sm text-fg-muted">{d}</p></div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 pb-24">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="reveal text-center font-display text-3xl font-bold tracking-tight sm:text-[40px]">Questions, answered.</h2>
          <div className="reveal mt-10 divide-y divide-line-soft overflow-hidden rounded-2xl border border-line bg-ink-850">
            {FAQ.map(([q, a], i) => (
              <div key={q}>
                <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left" aria-expanded={open === i}>
                  <span className="font-medium">{q}</span><ChevronDown className={clsx('h-4 w-4 shrink-0 text-fg-muted transition-transform', open === i && 'rotate-180 text-lime')} />
                </button>
                <div className={clsx('grid transition-all duration-300', open === i ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
                  <p className="overflow-hidden px-6 text-[14.5px] leading-relaxed text-fg-muted"><span className="block pb-5">{a}</span></p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-5 pb-20">
        <div className="reveal group relative mx-auto max-w-6xl overflow-hidden rounded-[32px] border border-line">
          <Photo name="progress-hero" alt="Runner at sunrise" className="absolute inset-0" overlay="left" />
          <div className="relative px-6 py-16 sm:px-14 sm:py-20">
            <h2 className="max-w-xl font-display text-3xl font-extrabold tracking-tight sm:text-5xl">Your next personal best starts today.</h2>
            <p className="mt-4 max-w-lg text-fg-muted">Create your free account and get your personal targets, meal plan and workout plan in minutes.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Primary /><DemoBtn /></div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-fg-dim sm:flex-row">
          <div className="flex items-center gap-3"><Logo /><span className="hidden sm:inline">·</span><span>Your Fitness. Your Goals. Your AI Coach.</span></div>
          <div className="flex gap-6"><Link to="/login" className="hover:text-fg">Log in</Link><Link to="/register" className="hover:text-fg">Sign up</Link><a href="#faq" className="hover:text-fg">FAQ</a></div>
        </div>
        <p className="pb-8 text-center text-xs text-fg-dim">FitAI provides general fitness guidance, not medical advice. © {new Date().getFullYear()} FitAI</p>
      </footer>
    </div>
  )
}
