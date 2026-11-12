import { tokenStore } from '../../services/api'
import { Bot, Dumbbell, KeyRound, LogOut, Ruler, Salad, Save, ShieldAlert, User } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, Chip, Input, Label, Modal, Notice, PageHeader, Segmented, Select, Skeleton } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { profileApi, settingsApi } from '../../services/fitai'
import type { Profile, Units } from '../../types'
import { ACTIVITY_LABEL, cmToFtIn, DIET_LABEL, EQUIPMENT, ftInToCm, GOAL_LABEL, kgToLb, lbToKg } from '../../utils/format'

const RESTRICTIONS = ['dairy', 'gluten', 'nuts', 'peanuts', 'soy', 'eggs', 'seafood']

function Section({ icon, title, desc, children, id }: { icon: ReactNode; title: string; desc: string; children: ReactNode; id: string }) {
  return (
    <Card id={id} className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[260px_1fr]">
      <div><div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-lime">{icon}</div><h2 className="font-display text-base font-semibold">{title}</h2><p className="mt-1 text-[13px] text-fg-muted">{desc}</p></div>
      <div>{children}</div>
    </Card>
  )
}

export default function Settings() {
  const { user, profile, setProfile, refresh, logout } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const [p, setP] = useState<Profile | null>(profile)
  const [name, setName] = useState(user?.full_name ?? '')
  const [ai, setAi] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [pw, setPw] = useState({ current: '', next: '' })
  const [pwBusy, setPwBusy] = useState(false)
  const [delOpen, setDelOpen] = useState(false)
  const units: Units = p?.unit_system ?? 'metric'
  const [disp, setDisp] = useState({ h: '', ft: '', inch: '', w: '', t: '' })

  useEffect(() => { settingsApi.get().then(s => setAi(s.ai)).catch(() => undefined) }, [])
  useEffect(() => { if (profile) setP(profile) }, [profile])
  useEffect(() => {
    if (!p) return
    const f = cmToFtIn(p.height_cm)
    setDisp({ h: String(p.height_cm), ft: String(f.ft), inch: String(f.in),
      w: String(+(units === 'imperial' ? kgToLb(p.current_weight_kg) : p.current_weight_kg).toFixed(1)),
      t: String(+(units === 'imperial' ? kgToLb(p.target_weight_kg) : p.target_weight_kg).toFixed(1)) })
  }, [p?.unit_system, p?.height_cm]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!p || !user) return <Skeleton className="h-96" />
  const upd = <K extends keyof Profile>(k: K, v: Profile[K]) => setP({ ...p, [k]: v })

  const saveProfile = async () => {
    setSaving(true)
    try {
      const height = units === 'metric' ? +disp.h : ftInToCm(+disp.ft || 0, +disp.inch || 0)
      const toKg = (v: string) => (units === 'imperial' ? lbToKg(+v) : +v)
      const body = { ...p, full_name: name.trim(), height_cm: +height.toFixed(1), current_weight_kg: +toKg(disp.w).toFixed(1), target_weight_kg: +toKg(disp.t).toFixed(1) }
      delete (body as any).start_weight_kg
      const np = await profileApi.save(body)
      setProfile(np); await refresh(); toast('success', 'Profile updated', 'Your targets and plans now use these settings.')
    } catch (e) { toast('error', 'Could not save', (e as Error).message) } finally { setSaving(false) }
  }
  const setUnits = async (v: Units) => {
    try { await settingsApi.update({ unit_system: v }); setP({ ...p, unit_system: v }); setProfile({ ...p, unit_system: v }); toast('success', `Units set to ${v}`) } catch (e) { toast('error', 'Failed', (e as Error).message) }
  }
  const setProvider = async (v: string) => {
    try { const s = await settingsApi.update({ ai_provider_pref: v }); setAi(s.ai); await refresh(); toast('success', 'AI preference saved') } catch (e) { toast('error', 'Failed', (e as Error).message) }
  }
  const changePw = async () => {
    setPwBusy(true)
    try { const r = await settingsApi.password(pw.current, pw.next); tokenStore.set(r.access_token); setPw({ current: '', next: '' }); toast('success', 'Password changed', 'You stay logged in here. Other devices were signed out.') } catch (e) { toast('error', 'Could not change password', (e as Error).message) } finally { setPwBusy(false) }
  }
  const del = async () => { try { await settingsApi.deleteAccount(); logout(); nav('/login') } catch (e) { toast('error', 'Delete failed', (e as Error).message) } }
  const toggle = (k: 'equipment' | 'food_restrictions', v: string) => upd(k, p[k].includes(v) ? p[k].filter(x => x !== v) : [...p[k], v])

  return (
    <div>
      <PageHeader eyebrow="Settings" title="Your account & preferences" subtitle="Everything here feeds your calculations, plans and coach." actions={<Button onClick={saveProfile} loading={saving} icon={<Save className="h-4 w-4" />}>Save changes</Button>} />
      <div className="space-y-5">
        <Section id="personal" icon={<User className="h-4 w-4" />} title="Personal information" desc="Used for BMR/TDEE calculations.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label htmlFor="nm">Full name</Label><Input id="nm" value={name} onChange={e => setName(e.target.value)} /></div>
            <div><Label htmlFor="age">Age</Label><Input id="age" type="number" value={p.age} onChange={e => upd('age', +e.target.value)} suffix="years" /></div>
            <div><Label htmlFor="g" hint="Optional">Gender</Label><Select id="g" value={p.gender ?? ''} onChange={e => upd('gender', (e.target.value || null) as any)}><option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></Select></div>
            {units === 'metric' ? <div><Label htmlFor="h">Height</Label><Input id="h" type="number" value={disp.h} onChange={e => setDisp({ ...disp, h: e.target.value })} suffix="cm" /></div>
              : <div><Label>Height</Label><div className="grid grid-cols-2 gap-2"><Input type="number" aria-label="Feet" value={disp.ft} onChange={e => setDisp({ ...disp, ft: e.target.value })} suffix="ft" /><Input type="number" aria-label="Inches" value={disp.inch} onChange={e => setDisp({ ...disp, inch: e.target.value })} suffix="in" /></div></div>}
            <div><Label htmlFor="cw">Current weight</Label><Input id="cw" type="number" step="0.1" value={disp.w} onChange={e => setDisp({ ...disp, w: e.target.value })} suffix={units === 'metric' ? 'kg' : 'lb'} /></div>
            <div><Label htmlFor="tw">Target weight</Label><Input id="tw" type="number" step="0.1" value={disp.t} onChange={e => setDisp({ ...disp, t: e.target.value })} suffix={units === 'metric' ? 'kg' : 'lb'} /></div>
          </div>
        </Section>
        <Section id="fitness" icon={<Dumbbell className="h-4 w-4" />} title="Fitness preferences" desc="Shapes your targets and generated workouts.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="goal">Primary goal</Label><Select id="goal" value={p.goal} onChange={e => upd('goal', e.target.value as any)}>{Object.entries(GOAL_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></div>
            <div><Label htmlFor="act">Activity level</Label><Select id="act" value={p.activity_level} onChange={e => upd('activity_level', e.target.value as any)}>{Object.entries(ACTIVITY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></div>
            <div><Label>Experience</Label><Segmented size="sm" options={[['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']] as const} value={p.experience} onChange={v => upd('experience', v)} /></div>
            <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="d">Days/week</Label><Input id="d" type="number" min={1} max={7} value={p.workout_days_per_week} onChange={e => upd('workout_days_per_week', +e.target.value)} /></div><div><Label htmlFor="mn">Minutes</Label><Input id="mn" type="number" min={15} max={180} value={p.workout_minutes} onChange={e => upd('workout_minutes', +e.target.value)} /></div></div>
            <div className="sm:col-span-2"><Label>Available equipment</Label><div className="flex flex-wrap gap-2">{EQUIPMENT.map(([v, l]) => <Chip key={v} active={p.equipment.includes(v)} onClick={() => toggle('equipment', v)}>{l}</Chip>)}</div></div>
          </div>
        </Section>
        <Section id="diet" icon={<Salad className="h-4 w-4" />} title="Dietary preferences" desc="Meal plans and coaching strictly respect these.">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">{Object.entries(DIET_LABEL).map(([v, l]) => <Chip key={v} active={p.diet_preference === v} onClick={() => upd('diet_preference', v as any)}>{l}</Chip>)}</div>
            {p.diet_preference === 'custom' && <div><Label htmlFor="cd">Custom diet</Label><Input id="cd" value={p.custom_diet ?? ''} onChange={e => upd('custom_diet', e.target.value)} /></div>}
            <div><Label>Restrictions & allergies</Label><div className="flex flex-wrap gap-2">{RESTRICTIONS.map(r => <Chip key={r} active={p.food_restrictions.includes(r)} onClick={() => toggle('food_restrictions', r)}>{r}</Chip>)}</div></div>
          </div>
        </Section>
        <Section id="units" icon={<Ruler className="h-4 w-4" />} title="Measurement units" desc="Data is stored in metric; display converts automatically.">
          <Segmented options={[['metric', 'Metric (kg, cm)'], ['imperial', 'Imperial (lb, ft/in)']] as const} value={units} onChange={setUnits} />
        </Section>
        <Section id="ai" icon={<Bot className="h-4 w-4" />} title="AI provider" desc="API keys live only in backend/.env — never in the browser.">
          {!ai ? <Skeleton className="h-24" /> : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-fg-muted">Active:</span>
                {ai.is_real_llm ? <Badge tone="lime">{ai.active_provider} · {ai.model}</Badge> : <Badge tone="amber">Demo mode (rule-based)</Badge>}
                {Object.entries(ai.configured).filter(([k]) => k !== 'mock').map(([k, v]) => <Badge key={k} tone={v ? 'moss' : 'neutral'}>{k}: {v ? 'key configured' : 'no key'}</Badge>)}
              </div>
              <div className="max-w-xs"><Label htmlFor="prov">Preferred provider</Label>
                <Select id="prov" value={user.ai_provider_pref} onChange={e => setProvider(e.target.value)}>
                  <option value="auto">Automatic (Gemini → Groq → demo)</option><option value="gemini">Google Gemini</option><option value="groq">Groq</option><option value="mock">Demo mode (no LLM)</option>
                </Select></div>
              {ai.message && <Notice tone="demo">{ai.message}</Notice>}
              <p className="text-xs text-fg-dim">If a provider is unavailable or rate-limited, FitAI retries, tries the fallback model, then falls back to clearly labelled demo responses.</p>
            </div>
          )}
        </Section>
        <Section id="account" icon={<KeyRound className="h-4 w-4" />} title="Account" desc={user.email}>
          <div className="space-y-5">
            {user.is_demo ? <Notice tone="demo">This is the shared demo account. Create your own account to set a password.</Notice> : (
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <div><Label htmlFor="cp">Current password</Label><Input id="cp" type="password" autoComplete="current-password" value={pw.current} onChange={e => setPw({ ...pw, current: e.target.value })} /></div>
                <div><Label htmlFor="np">New password</Label><Input id="np" type="password" autoComplete="new-password" value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })} /></div>
                <Button variant="secondary" onClick={changePw} loading={pwBusy} disabled={!pw.current || pw.next.length < 8}>Update</Button>
              </div>
            )}
            <div className="flex flex-wrap gap-2 border-t border-line-soft pt-5">
              <Button variant="secondary" onClick={() => { logout(); nav('/login') }} icon={<LogOut className="h-4 w-4" />}>Log out</Button>
              <Button variant="danger" onClick={() => setDelOpen(true)} icon={<ShieldAlert className="h-4 w-4" />}>Delete account</Button>
            </div>
          </div>
        </Section>
      </div>
      <Modal open={delOpen} onClose={() => setDelOpen(false)} title="Delete your account?" footer={<><Button variant="ghost" onClick={() => setDelOpen(false)}>Cancel</Button><Button variant="danger" onClick={del}>Delete permanently</Button></>}>
        <p className="text-sm text-fg-muted">This permanently deletes your profile, logs, plans and conversations. This can't be undone.</p>
      </Modal>
    </div>
  )
}
