import clsx from 'clsx'
import { Award, Bot, Check, ChevronDown, Dumbbell, LineChart, Lock, Menu, PlayCircle, Salad, ShieldCheck, Target, Timer, UtensilsCrossed, Wrench, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge, Logo, Photo } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useReveal } from '../../hooks/useReveal'

const NAV = [['#features', 'Features'], ['#coach', 'AI Coach'], ['#how', 'How it works'], ['#faq', 'FAQ']] as const

const FEATURES = [
  { icon: Bot, title: 'A coach that checks before it answers', text: 'Ask what to eat tonight or why the scale is stuck. The coach reads your weigh-ins, food log and workouts first, then explains.' },
  { icon: Salad, title: 'Meal plans in your kitchen’s language', text: 'Dal, roti, poha, paneer, eggs or chicken, matched to your calories and protein. Vegetarian, vegan, eggetarian and allergies respected.' },
  { icon: Dumbbell, title: 'Workouts on the days you train', text: 'Pick your days and your equipment, even just bodyweight. Push/pull/legs, upper/lower or full body, with a rest timer for every set.' },
  { icon: UtensilsCrossed, title: 'Log food by name or by photo', text: 'Search a database that knows Indian dishes, or snap your plate and check what it found before anything is saved.' },
  { icon: LineChart, title: 'Progress without the water-weight panic', text: 'Weekly averages and a 4-week trend show whether you are really moving, and flag a plateau when you are not.' },
  { icon: Award, title: 'Reasons to come back tomorrow', text: 'Streaks, weekly challenges, badges and a Sunday check-in that sets next week’s targets.' },
]

const STEPS = [
  { title: 'Tell it about you', text: 'Goal, height and weight, diet, the days you can train and what equipment you have. About two minutes.' },
  { title: 'Get your numbers and plans', text: 'Calories and protein from standard formulas, then a meal plan and a workout plan built around them.' },
  { title: 'Log, check in, adjust', text: 'Log meals, sets and weigh-ins. Each week the coach reads the trend and tells you what to change.' },
]

const FAQ = [
  ['Is FitAI medical advice?', 'No. FitAI is a general fitness assistant. It never diagnoses anything, avoids extreme diets, and tells you to see a professional when something needs one.'],
  ['Where do my calorie and protein targets come from?', 'From standard formulas: Mifflin-St Jeor for your resting burn, activity multipliers for your daily total, and a capped adjustment for your goal. The AI reads these numbers from FitAI’s calculator; it never makes them up.'],
  ['Which diets work?', 'Vegetarian, vegan, eggetarian, non-vegetarian and custom diets, plus no dairy, gluten, nuts, soy, eggs or seafood. Meal plans stick to them.'],
  ['Do I need a gym?', 'No. Tell FitAI what you have, even nothing at all, and it only programs exercises you can do.'],
  ['How is my account protected?', 'Passwords are hashed, every new account confirms its email, and every login asks for a one-time code sent to your inbox.'],
  ['Can I try it without signing up?', 'Yes. The demo opens a private copy filled with sample data. Try everything; it deletes itself after a few hours.'],
]

const LOG = [
  ['Deadlift', '3 × 5', '100 kg', true],
  ['Lat pulldown', '3 × 10', '55 kg', true],
  ['Seated cable row', '3 × 10', '50 kg', false],
  ['Hammer curl', '3 × 12', '12 kg', false],
] as const

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[540px] lg:mx-0">
      <div className="overflow-hidden rounded-2xl border border-line">
        <Photo name="hero-training" alt="Dumbbell rack in a gym" className="aspect-[16/10]" overlay="strong" position="center 35%" />
        <div className="border-t border-line bg-ink-900 p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-display text-[28px] font-extrabold uppercase leading-none tracking-wide">Pull day</p>
            <p className="text-sm text-fg-muted">Tuesday, 2 of 4 done</p>
          </div>
          <table className="mt-4 w-full text-[14px]">
            <tbody>
              {LOG.map(([name, sets, kg, done]) => (
                <tr key={name} className="border-t border-line-soft">
                  <td className="py-2.5 pr-3">{name}</td>
                  <td className="py-2.5 pr-3 tabular-nums text-fg-muted">{sets}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{kg}</td>
                  <td className="w-6 py-2.5 text-right">{done ? <Check className="ml-auto h-4 w-4 text-lime" aria-label="done" /> : <span className="ml-auto block h-4 w-4 rounded-full border border-line-strong" aria-label="to do" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 border-l-2 border-lime pl-3 text-[14px] leading-relaxed text-fg/90">
            Protein is at <b className="tabular-nums">92 of 145 g</b>. Have dal or paneer with dinner and you’ll close the gap.
          </p>
        </div>
      </div>
      <p className="mt-3 text-[12px] text-fg-dim">Sample day, not a real user</p>
    </div>
  )
}

export default function Landing() {
  const { user, startDemo } = useAuth()
  // Signed-in visitors still see the landing page, with a way back into the app instead of sign-up buttons.
  const home = user ? (!user.email_verified ? '/verify-email' : user.onboarding_complete ? '/dashboard' : '/onboarding') : null
  const homeLabel = user && !user.onboarding_complete ? 'Continue setup' : 'Open dashboard'
  const nav = useNavigate()
  const [menu, setMenu] = useState(false)
  const [open, setOpen] = useState<number | null>(0)
  const [demoBusy, setDemoBusy] = useState(false)
  useReveal([])
  const demo = async () => { setDemoBusy(true); try { await startDemo(); nav('/dashboard') } finally { setDemoBusy(false) } }

  const Primary = ({ className = '' }: { className?: string }) => (
    <Link to={home ?? '/register'} className={clsx('inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-lime px-6 text-[15px] font-semibold text-ink-950 transition hover:bg-lime-400 active:scale-[.98]', className)}>
      {home ? homeLabel : 'Get started free'}
    </Link>
  )
  const DemoBtn = ({ className = '' }: { className?: string }) => home ? null : (
    <button onClick={demo} disabled={demoBusy} className={clsx('inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line bg-white/[0.03] px-6 text-[15px] font-medium text-fg transition hover:border-lime/50 hover:text-lime disabled:opacity-60', className)}>
      <PlayCircle className="h-4 w-4" />{demoBusy ? 'Opening demo…' : 'Try the demo'}
    </button>
  )

  return (
    <div className="min-h-screen overflow-x-hidden bg-ink-950">
      {/* NAV */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-line-soft bg-ink-950/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
          <Link to="/" aria-label="FitAI home"><Logo /></Link>
          <nav className="ml-6 hidden items-center gap-7 text-sm text-fg-muted md:flex">
            {NAV.map(([h, l]) => <a key={h} href={h} className="transition hover:text-fg">{l}</a>)}
          </nav>
          <div className="ml-auto hidden items-center gap-3 md:flex">
            {!home && <Link to="/login" className="px-3 py-2 text-sm font-medium text-fg-muted transition hover:text-fg">Log in</Link>}
            <Link to={home ?? '/register'} className="inline-flex h-10 items-center rounded-xl bg-lime px-4 text-sm font-semibold text-ink-950 transition hover:bg-lime-400">{home ? homeLabel : 'Get started'}</Link>
          </div>
          <button className="ml-auto rounded-lg p-2 text-fg-muted md:hidden" onClick={() => setMenu(m => !m)} aria-label="Menu">{menu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        </div>
        {menu && (
          <div className="animate-fade-in border-t border-line-soft px-5 py-4 md:hidden">
            {NAV.map(([h, l]) => <a key={h} href={h} onClick={() => setMenu(false)} className="block py-2.5 text-fg-muted">{l}</a>)}
            <div className={clsx('mt-3 grid gap-2', home ? 'grid-cols-1' : 'grid-cols-2')}>
              {!home && <Link to="/login" className="flex h-11 items-center justify-center rounded-xl border border-line text-sm">Log in</Link>}
              <Link to={home ?? '/register'} className="flex h-11 items-center justify-center rounded-xl bg-lime text-sm font-semibold text-ink-950">{home ? homeLabel : 'Get started'}</Link>
            </div>
          </div>
        )}
      </header>

      {/* HERO */}
      <section className="pt-28 sm:pt-32">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 lg:grid-cols-[1.1fr_1fr] lg:pb-24">
          <div>
            <h1 className="reveal font-display text-[52px] font-extrabold uppercase leading-[.9] tracking-[.01em] sm:text-[76px] lg:text-[88px]">
              Train with a coach that knows your numbers
            </h1>
            <p className="reveal reveal-d1 mt-7 max-w-[34rem] text-[17px] leading-relaxed text-fg-muted">
              FitAI works out your calories and protein, plans your meals and workouts, and answers questions after looking at what you actually ate, lifted and weighed.
            </p>
            <div className="reveal reveal-d2 mt-8 flex flex-col gap-3 sm:flex-row"><Primary /><DemoBtn /></div>
            <p className="reveal reveal-d3 mt-5 text-[13px] text-fg-dim">Free. Email-verified accounts. General fitness guidance, not medical advice.</p>
          </div>
          <div className="reveal reveal-d1"><HeroVisual /></div>
        </div>
      </section>

      {/* NUMBERS */}
      <section className="border-y border-line-soft">
        <div className="mx-auto grid max-w-6xl grid-cols-2 px-5 md:grid-cols-4">
          {[['12', 'tools the coach can use'], ['7', 'workout styles'], ['5', 'diet types, plus allergies'], ['0', 'numbers made up by the AI']].map(([v, l], i) => (
            <div key={l} className={clsx('py-7 md:px-6', i % 2 === 1 && 'border-l border-line-soft pl-5', i > 0 && 'md:border-l md:border-line-soft md:pl-6', i > 1 && 'border-t border-line-soft md:border-t-0', i === 0 && 'md:pl-0')}>
              <p className="score text-[56px] text-fg">{v}</p>
              <p className="mt-2 text-sm text-fg-muted">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="scroll-mt-20 py-24">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 lg:grid-cols-[1fr_1.6fr]">
          <div className="reveal lg:sticky lg:top-28 lg:self-start">
            <h2 className="font-display text-[44px] font-extrabold uppercase leading-[.95] sm:text-[56px]">One app, one set of numbers</h2>
            <p className="mt-5 max-w-sm text-fg-muted">Your coach, meals and workouts read the same data, so they never disagree with each other.</p>
          </div>
          <ul className="border-t border-line">
            {FEATURES.map(({ icon: I, title, text }) => (
              <li key={title} className="reveal grid grid-cols-[28px_1fr] gap-4 border-b border-line py-6">
                <I className="mt-1 h-5 w-5 text-lime" aria-hidden />
                <div><h3 className="text-[17px] font-semibold text-fg">{title}</h3><p className="mt-1.5 text-[15px] leading-relaxed text-fg-muted">{text}</p></div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* COACH SHOWCASE */}
      <section id="coach" className="scroll-mt-20 bg-ink-900 py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-2">
          <div className="reveal">
            <h2 className="font-display text-[44px] font-extrabold uppercase leading-[.95] sm:text-[56px]">It shows its working</h2>
            <p className="mt-5 max-w-md text-fg-muted">Before answering, the coach pulls your weight history, food log or calorie target from FitAI. The maths runs in code; the AI explains it in plain words.</p>
            <dl className="mt-8 space-y-5">
              {[['Numbers come from code', 'Targets, trends and totals are calculated, never guessed.'], ['It knows your history', 'Weigh-ins, meals and sessions are read before it replies.'], ['Safety first', 'No crash diets or diagnoses, and a nudge to see a professional when it matters.']].map(([t, d]) => (
                <div key={t} className="border-l-2 border-line-strong pl-4"><dt className="font-semibold">{t}</dt><dd className="mt-0.5 text-sm text-fg-muted">{d}</dd></div>
              ))}
            </dl>
          </div>
          <div className="reveal reveal-d1">
            <div className="rounded-2xl border border-line bg-ink-850 p-5 sm:p-6">
              <div className="flex justify-end"><div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-lime px-4 py-2.5 text-sm font-medium text-ink-950">Why has my weight stopped going down?</div></div>
              <div className="mt-4 max-w-[92%] rounded-2xl rounded-tl-sm bg-ink-750 px-4 py-3.5 text-[14.5px] leading-relaxed text-fg/90">
                Your weekly average hasn’t moved for <b>3 weeks</b>, but you logged food on only <b>8 of 14 days</b>. Before eating less, log everything for a week (oil and chai add up) and walk about 2,000 more steps a day.
              </div>
              <div className="mt-4 grid grid-cols-3 border-y border-line-soft">
                {[['Trend', '−0.04', 'kg/week'], ['Logged', '8/14', 'days'], ['Target', '2,150', 'kcal']].map(([l, v, u], i) => (
                  <div key={l} className={clsx('py-3', i > 0 && 'border-l border-line-soft pl-3')}><p className="text-[12px] text-fg-dim">{l}</p><p className="score mt-1 text-[26px]">{v} <span className="font-sans text-[12px] font-normal tracking-normal text-fg-muted">{u}</span></p></div>
                ))}
              </div>
              <p className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px] text-fg-dim"><Wrench className="h-3 w-3" />Checked: <Badge>Weight history</Badge><Badge>Progress</Badge><Badge>Calorie target</Badge></p>
            </div>
            <p className="mt-3 text-[12px] text-fg-dim">Sample conversation</p>
          </div>
        </div>
      </section>

      {/* MEALS + WORKOUTS */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="reveal max-w-3xl font-display text-[44px] font-extrabold uppercase leading-[.95] sm:text-[56px]">Food you already eat. Training you can actually do.</h2>
          <div className="mt-12 grid gap-5 lg:grid-cols-2">
            {[
              { photo: 'lunch-bowl', title: 'Meal plans', text: 'Breakfast to dinner, scaled to your calories and protein. Swap any food, redo a meal, and log it in one tap.', chips: ['Vegetarian', 'Vegan', 'Eggetarian', 'Non-veg', 'Nut-free', 'Gluten-free'] },
              { photo: 'cat-push_pull_legs', title: 'Workout plans', text: 'A week of sessions on the days you choose, with sets, reps and rest, then a guided session that records every set.', chips: ['Push / Pull / Legs', 'Upper / Lower', 'Full Body', 'Beginner', 'Fat loss', 'Custom'] },
            ].map(({ photo, title, text, chips }, i) => (
              <div key={title} className={clsx('reveal overflow-hidden rounded-2xl border border-line bg-ink-850', `reveal-d${i}`)}>
                <Photo name={photo} alt={title} className="h-64 sm:h-72" overlay />
                <div className="p-6 sm:p-7">
                  <h3 className="font-display text-[30px] font-extrabold uppercase leading-none">{title}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-fg-muted">{text}</p>
                  <div className="mt-5 flex flex-wrap gap-2">{chips.map(c => <span key={c} className="rounded-md border border-line px-2.5 py-1 text-xs text-fg-muted">{c}</span>)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="scroll-mt-20 border-y border-line-soft py-24">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="reveal font-display text-[44px] font-extrabold uppercase leading-[.95] sm:text-[56px]">Set up in two minutes</h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {STEPS.map((s, i) => (
              <li key={s.title} className={clsx('reveal border-t-2 pt-5', i === 0 ? 'border-lime' : 'border-line-strong', `reveal-d${i}`)}>
                <p className="score text-[64px] text-fg-dim">{i + 1}</p>
                <h3 className="mt-3 text-[17px] font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-fg-muted">{s.text}</p>
              </li>
            ))}
          </ol>
          <ul className="reveal mt-16 grid gap-x-8 gap-y-3 text-sm text-fg-muted sm:grid-cols-2 lg:grid-cols-4">
            {[[Target, 'Mifflin-St Jeor formulas'], [ShieldCheck, 'Deficits capped at 500 kcal'], [Lock, 'A code at every login'], [Timer, 'Weekly trends, not daily noise']].map(([I, t]: any) => (
              <li key={t} className="flex items-center gap-2.5"><I className="h-4 w-4 shrink-0 text-fg-dim" />{t}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 py-24">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 lg:grid-cols-[1fr_1.6fr]">
          <h2 className="reveal font-display text-[44px] font-extrabold uppercase leading-[.95] sm:text-[56px]">Questions</h2>
          <div className="reveal border-t border-line">
            {FAQ.map(([q, a], i) => (
              <div key={q} className="border-b border-line">
                <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-4 py-5 text-left" aria-expanded={open === i}>
                  <span className="text-[16px] font-medium">{q}</span><ChevronDown className={clsx('h-4 w-4 shrink-0 text-fg-muted transition-transform', open === i && 'rotate-180 text-lime')} />
                </button>
                <div className={clsx('grid transition-all duration-300', open === i ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
                  <p className="overflow-hidden text-[15px] leading-relaxed text-fg-muted"><span className="block max-w-2xl pb-5">{a}</span></p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-5 pb-20">
        <div className="reveal relative mx-auto max-w-6xl overflow-hidden rounded-2xl border border-line">
          <Photo name="progress-hero" alt="Runner at sunrise" className="absolute inset-0" overlay="left" />
          <div className="relative px-6 py-16 sm:px-14 sm:py-20">
            <h2 className="max-w-xl font-display text-[44px] font-extrabold uppercase leading-[.95] sm:text-[64px]">Start with today’s numbers</h2>
            <p className="mt-4 max-w-lg text-fg-muted">Make a free account and get your targets, meal plan and workout plan in a few minutes.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Primary /><DemoBtn /></div>
          </div>
        </div>
      </section>

      <footer className="border-t border-line-soft">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-fg-dim sm:flex-row">
          <div className="flex items-center gap-3"><Logo /><span>Your numbers, your plan, your coach.</span></div>
          <div className="flex gap-6">{home ? <Link to={home} className="hover:text-fg">{homeLabel}</Link> : <><Link to="/login" className="hover:text-fg">Log in</Link><Link to="/register" className="hover:text-fg">Sign up</Link></>}<a href="#faq" className="hover:text-fg">FAQ</a><Link to="/privacy" className="hover:text-fg">Privacy</Link><Link to="/terms" className="hover:text-fg">Terms</Link></div>
        </div>
        <p className="pb-8 text-center text-xs text-fg-dim">FitAI provides general fitness guidance, not medical advice. © {new Date().getFullYear()} FitAI</p>
      </footer>
    </div>
  )
}
