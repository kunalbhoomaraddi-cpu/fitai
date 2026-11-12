import clsx from 'clsx'
import { ArrowLeft, ArrowRight, Armchair, Bike, Dumbbell, Flame, Footprints, HeartPulse, Leaf, Scale, Sparkles, Trophy, Zap, Egg, Drumstick, Sprout, PenLine, Check } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Chip, Input, Label, Logo, Notice, OptionCard, Photo, Segmented, Select } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { profileApi } from '../../services/fitai'
import type { Activity, Diet, Experience, Goal, Units } from '../../types'
import { EQUIPMENT, ftInToCm, GOAL_LABEL, lbToKg } from '../../utils/format'

const GOALS: [Goal, string, string, any][] = [
  ['weight_loss', 'Lose weight', 'Sustainable fat loss while keeping muscle', Flame],
  ['muscle_gain', 'Build muscle', 'Lean gains with progressive training', Dumbbell],
  ['recomposition', 'Body recomposition', 'Lose fat and build muscle together', Zap],
  ['general_fitness', 'General fitness', 'Feel stronger, fitter and healthier', HeartPulse],
  ['maintenance', 'Maintain weight', 'Hold steady and perform well', Scale],
]
const ACTIVITY: [Activity, string, string, any][] = [
  ['sedentary', 'Sedentary', 'Desk job, little exercise', Armchair],
  ['light', 'Lightly active', 'Exercise 1–3 days/week', Footprints],
  ['moderate', 'Moderately active', 'Exercise 3–5 days/week', Bike],
  ['active', 'Very active', 'Hard exercise 6–7 days/week', Flame],
  ['very_active', 'Athlete', 'Physical job + hard training', Trophy],
]
const DIETS: [Diet, string, string, any][] = [
  ['vegetarian', 'Vegetarian', 'No meat, fish or eggs', Leaf], ['vegan', 'Vegan', 'Fully plant-based', Sprout],
  ['eggetarian', 'Eggetarian', 'Vegetarian + eggs', Egg], ['non_vegetarian', 'Non-vegetarian', 'Includes meat & fish', Drumstick],
  ['custom', 'Custom', 'Describe your own approach', PenLine],
]
const RESTRICTIONS = ['dairy', 'gluten', 'nuts', 'peanuts', 'soy', 'eggs', 'seafood']
const STEPS = ['About you', 'Your goal', 'Lifestyle', 'Nutrition', 'Training', 'Your plan']

export default function Onboarding() {
  const { user, setProfile, refresh } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [units, setUnits] = useState<Units>('metric')
  const [f, setF] = useState({
    name: user?.full_name ?? '', age: '', gender: '' as '' | 'male' | 'female' | 'other',
    heightCm: '', heightFt: '', heightIn: '', weight: '', target: '',
    goal: 'weight_loss' as Goal, activity: 'moderate' as Activity, experience: 'beginner' as Experience,
    diet: 'vegetarian' as Diet, customDiet: '', restrictions: [] as string[], otherRestriction: '',
    days: 3, minutes: 45, equipment: ['bodyweight', 'dumbbells'] as string[],
  })
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(s => ({ ...s, [k]: v }))

  const metric = useMemo(() => {
    const h = units === 'metric' ? +f.heightCm : ftInToCm(+f.heightFt || 0, +f.heightIn || 0)
    const w = units === 'metric' ? +f.weight : lbToKg(+f.weight)
    const t = units === 'metric' ? +f.target : lbToKg(+f.target)
    return { height_cm: +h.toFixed(1), weight_kg: +w.toFixed(1), target_kg: +t.toFixed(1) }
  }, [f, units])

  const validate = (): string | null => {
    if (step === 0) {
      if (f.name.trim().length < 2) return 'Please enter your name'
      if (!(+f.age >= 13 && +f.age <= 100)) return 'Age must be between 13 and 100'
      if (!(metric.height_cm > 100 && metric.height_cm < 250)) return 'Please enter a valid height'
      if (!(metric.weight_kg > 30 && metric.weight_kg < 300)) return 'Please enter a valid current weight'
    }
    if (step === 1 && !(metric.target_kg > 30 && metric.target_kg < 300)) return 'Please enter a valid target weight'
    if (step === 1 && f.goal === 'weight_loss' && metric.target_kg >= metric.weight_kg) return 'For weight loss, your target should be below your current weight'
    if (step === 1 && f.goal === 'muscle_gain' && metric.target_kg < metric.weight_kg) return 'For muscle building, your target is usually at or above your current weight'
    if (step === 3 && f.diet === 'custom' && !f.customDiet.trim()) return 'Describe your custom dietary preference'
    return null
  }

  const payload = () => ({
    full_name: f.name.trim(), age: +f.age, gender: f.gender || null, height_cm: metric.height_cm, current_weight_kg: metric.weight_kg,
    target_weight_kg: metric.target_kg, activity_level: f.activity, experience: f.experience, goal: f.goal, diet_preference: f.diet,
    custom_diet: f.diet === 'custom' ? f.customDiet.trim() : null,
    food_restrictions: [...f.restrictions, ...f.otherRestriction.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)],
    workout_days_per_week: f.days, workout_minutes: f.minutes, equipment: f.equipment, unit_system: units,
  })

  useEffect(() => {
    if (step !== 5) return
    profileApi.calculate({ weight_kg: metric.weight_kg, height_cm: metric.height_cm, age: +f.age, gender: f.gender || null, activity_level: f.activity, goal: f.goal })
      .then(setPreview).catch(e => setError(e.message))
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => { const e = validate(); setError(e); if (!e) setStep(s => Math.min(5, s + 1)) }
  const finish = async () => {
    setSaving(true); setError(null)
    try { const p = await profileApi.save(payload()); setProfile(p); await refresh(); toast('success', 'Your plan is ready', 'Welcome to FitAI.'); nav('/dashboard', { replace: true }) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save profile') } finally { setSaving(false) }
  }
  const wUnit = units === 'metric' ? 'kg' : 'lb'

  return (
    <div className="grid min-h-screen lg:grid-cols-[380px_1fr]">
      <aside className="relative hidden overflow-hidden border-r border-line-soft lg:block">
        <Photo name="onboarding" alt="Person preparing for a workout" className="absolute inset-0" overlay="strong" />
        <div className="relative z-10 flex h-full flex-col p-8">
          <Logo />
          <ol className="mt-14 space-y-1">
            {STEPS.map((s, i) => (
              <li key={s} className={clsx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition', i === step ? 'bg-white/[0.06] text-fg' : i < step ? 'text-fg-muted' : 'text-fg-dim')}>
                <span className={clsx('flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-bold', i < step ? 'border-lime bg-lime text-ink-950' : i === step ? 'border-lime text-lime' : 'border-line')}>
                  {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>{s}
              </li>
            ))}
          </ol>
          <p className="mt-auto text-xs leading-relaxed text-fg-dim">Your profile powers every calculation, plan and coaching answer in FitAI. You can change it any time in Settings.</p>
        </div>
      </aside>
      <main className="flex flex-col px-5 py-8 sm:px-10 lg:px-16">
        <div className="mb-8 lg:hidden"><Logo /></div>
        <div className="mb-8 h-1 w-full max-w-2xl overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-lime transition-all duration-500" style={{ width: `${((step + 1) / 6) * 100}%` }} /></div>
        <div key={step} className="w-full max-w-2xl animate-fade-up">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-lime/80">Step {step + 1} of 6</p>
          {step === 0 && (<>
            <h1 className="mt-2 font-display text-3xl font-bold">Let's get to know you</h1>
            <p className="mt-2 text-sm text-fg-muted">We use these to calculate your energy needs with the Mifflin-St Jeor equation.</p>
            <div className="mt-6 mb-6"><Segmented options={[['metric', 'Metric (kg, cm)'], ['imperial', 'Imperial (lb, ft)']] as const} value={units} onChange={setUnits} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label htmlFor="n">Full name</Label><Input id="n" value={f.name} onChange={e => set('name', e.target.value)} /></div>
              <div><Label htmlFor="age">Age</Label><Input id="age" type="number" inputMode="numeric" value={f.age} onChange={e => set('age', e.target.value)} suffix="years" /></div>
              <div><Label htmlFor="g" hint="Optional">Gender</Label>
                <Select id="g" value={f.gender} onChange={e => set('gender', e.target.value as any)}>
                  <option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option>
                </Select></div>
              {units === 'metric'
                ? <div><Label htmlFor="h">Height</Label><Input id="h" type="number" inputMode="decimal" value={f.heightCm} onChange={e => set('heightCm', e.target.value)} suffix="cm" /></div>
                : <div><Label>Height</Label><div className="grid grid-cols-2 gap-2"><Input type="number" aria-label="Feet" value={f.heightFt} onChange={e => set('heightFt', e.target.value)} suffix="ft" /><Input type="number" aria-label="Inches" value={f.heightIn} onChange={e => set('heightIn', e.target.value)} suffix="in" /></div></div>}
              <div><Label htmlFor="w">Current weight</Label><Input id="w" type="number" inputMode="decimal" value={f.weight} onChange={e => set('weight', e.target.value)} suffix={wUnit} /></div>
            </div>
            {!f.gender && <p className="mt-3 text-xs text-fg-dim">Without gender we use the midpoint of the male and female BMR constants.</p>}
          </>)}
          {step === 1 && (<>
            <h1 className="mt-2 font-display text-3xl font-bold">What's your primary goal?</h1>
            <p className="mt-2 text-sm text-fg-muted">This shapes your calorie target, macros and training style.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">{GOALS.map(([v, t, d, I]) => <OptionCard key={v} active={f.goal === v} onClick={() => set('goal', v)} title={t} desc={d} icon={<I className="h-5 w-5" />} />)}</div>
            <div className="mt-6 max-w-xs"><Label htmlFor="t">Target weight</Label><Input id="t" type="number" inputMode="decimal" value={f.target} onChange={e => set('target', e.target.value)} suffix={wUnit} /></div>
          </>)}
          {step === 2 && (<>
            <h1 className="mt-2 font-display text-3xl font-bold">How active are you?</h1>
            <p className="mt-2 text-sm text-fg-muted">Include work and training. When unsure, pick the lower option.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">{ACTIVITY.map(([v, t, d, I]) => <OptionCard key={v} active={f.activity === v} onClick={() => set('activity', v)} title={t} desc={d} icon={<I className="h-5 w-5" />} />)}</div>
            <div className="mt-6"><Label>Training experience</Label><Segmented options={[['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']] as const} value={f.experience} onChange={v => set('experience', v)} /></div>
          </>)}
          {step === 3 && (<>
            <h1 className="mt-2 font-display text-3xl font-bold">How do you eat?</h1>
            <p className="mt-2 text-sm text-fg-muted">Meal plans and coaching will strictly respect these.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">{DIETS.map(([v, t, d, I]) => <OptionCard key={v} active={f.diet === v} onClick={() => set('diet', v)} title={t} desc={d} icon={<I className="h-5 w-5" />} />)}</div>
            {f.diet === 'custom' && <div className="mt-4"><Label htmlFor="cd">Describe your diet</Label><Input id="cd" placeholder="e.g. pescatarian, Jain, keto-leaning" value={f.customDiet} onChange={e => set('customDiet', e.target.value)} /></div>}
            <div className="mt-6"><Label>Food restrictions & allergies</Label>
              <div className="flex flex-wrap gap-2">{RESTRICTIONS.map(r => <Chip key={r} active={f.restrictions.includes(r)} onClick={() => set('restrictions', f.restrictions.includes(r) ? f.restrictions.filter(x => x !== r) : [...f.restrictions, r])}>{r[0].toUpperCase() + r.slice(1)}</Chip>)}</div>
              <Input className="mt-3" placeholder="Other (comma separated)" value={f.otherRestriction} onChange={e => set('otherRestriction', e.target.value)} />
            </div>
          </>)}
          {step === 4 && (<>
            <h1 className="mt-2 font-display text-3xl font-bold">Your training setup</h1>
            <p className="mt-2 text-sm text-fg-muted">We'll only program exercises you can actually do.</p>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div><Label>Days per week</Label><div className="flex flex-wrap gap-2">{[1, 2, 3, 4, 5, 6].map(d => <Chip key={d} active={f.days === d} onClick={() => set('days', d)}>{d}</Chip>)}</div></div>
              <div><Label>Session length</Label><div className="flex flex-wrap gap-2">{[30, 45, 60, 75].map(m => <Chip key={m} active={f.minutes === m} onClick={() => set('minutes', m)}>{m} min</Chip>)}</div></div>
            </div>
            <div className="mt-6"><Label>Available equipment</Label>
              <div className="flex flex-wrap gap-2">{EQUIPMENT.map(([v, l]) => <Chip key={v} active={f.equipment.includes(v)} onClick={() => set('equipment', f.equipment.includes(v) ? f.equipment.filter(x => x !== v) : [...f.equipment, v])}>{l}</Chip>)}</div>
            </div>
          </>)}
          {step === 5 && (<>
            <h1 className="mt-2 font-display text-3xl font-bold">Your starting plan</h1>
            <p className="mt-2 text-sm text-fg-muted">Calculated deterministically from your profile. Goal: <b className="text-fg">{GOAL_LABEL[f.goal]}</b>.</p>
            {!preview ? <div className="mt-6 h-40 animate-pulse rounded-2xl bg-ink-800" /> : (
              <div className="mt-6 grid gap-3 sm:grid-cols-4">
                {[['BMR', preview.bmr.bmr, 'kcal'], ['TDEE', preview.tdee.tdee, 'kcal'], ['Daily target', preview.calories.calorie_target, 'kcal'], ['BMI', preview.bmi.bmi, preview.bmi.category]].map(([l, v, u], i) => (
                  <div key={l as string} className={clsx('rounded-2xl border p-4', i === 2 ? 'border-lime/50 bg-lime/[0.06]' : 'border-line bg-ink-800')}>
                    <p className="text-xs text-fg-muted">{l}</p><p className={clsx('mt-1 font-display text-2xl font-bold tabular-nums', i === 2 && 'text-lime')}>{(v as number).toLocaleString()}</p><p className="text-xs text-fg-dim">{u}</p>
                  </div>
                ))}
                <div className="rounded-2xl border border-line bg-ink-800 p-4 sm:col-span-4">
                  <p className="mb-3 text-xs text-fg-muted">Daily macros</p>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {[['Protein', preview.macros.protein_g, '#C6F36B'], ['Carbs', preview.macros.carbs_g, '#7CC4F2'], ['Fat', preview.macros.fat_g, '#F2B85B']].map(([l, v, c]) => (
                      <div key={l as string}><p className="font-display text-xl font-bold" style={{ color: c as string }}>{v as number} g</p><p className="text-xs text-fg-dim">{l}</p></div>
                    ))}
                  </div>
                </div>
                {preview.calories.warnings.map((w: string) => <div key={w} className="sm:col-span-4"><Notice tone="warn">{w}</Notice></div>)}
                <div className="sm:col-span-4"><Notice tone="info" icon={<Sparkles className="h-4 w-4" />}>{preview.calories.rationale} These are approximate estimates — FitAI will help you adjust based on your real trend.</Notice></div>
              </div>
            )}
          </>)}
          {error && <div className="mt-5"><Notice tone="warn">{error}</Notice></div>}
          <div className="mt-8 flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => { setError(null); setStep(s => Math.max(0, s - 1)) }} disabled={step === 0} icon={<ArrowLeft className="h-4 w-4" />}>Back</Button>
            {step < 5
              ? <Button size="lg" onClick={next} icon={<ArrowRight className="h-4 w-4" />}>Continue</Button>
              : <Button size="lg" onClick={finish} loading={saving} disabled={!preview} icon={<Sparkles className="h-4 w-4" />}>Start my journey</Button>}
          </div>
        </div>
      </main>
    </div>
  )
}
