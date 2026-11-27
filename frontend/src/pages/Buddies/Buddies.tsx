import { Copy, EyeOff, RefreshCw, Share2, UserMinus, UserPlus, Users } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BuddyRow, nudgeText } from '../../components/Buddies'
import { Button, Card, CardHeader, EmptyState, ErrorState, IconButton, Input, Label, Modal, Notice, PageHeader, Skeleton, Switch } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { useAsync } from '../../hooks/useAsync'
import { buddyApi } from '../../services/fitai'
import type { Buddy } from '../../types'

export const PENDING_CODE_KEY = 'fitai.buddy-code'

function inviteLink(code: string) {
  return `${window.location.origin}/buddies?code=${code}`
}

export default function Buddies() {
  const toast = useToast()
  const q = useAsync(() => buddyApi.overview(), [])
  const [params, setParams] = useSearchParams()
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [removing, setRemoving] = useState<Buddy | null>(null)
  const o = q.data

  // A link like /buddies?code=K7QM-2XRP fills in the code (also kept through sign-in and sign-up)
  useEffect(() => {
    let pending: string | null = null
    try { pending = params.get('code') || sessionStorage.getItem(PENDING_CODE_KEY) } catch { /* storage blocked */ }
    if (pending) { setCode(pending.toUpperCase()); try { sessionStorage.removeItem(PENDING_CODE_KEY) } catch { /* ignore */ } }
    if (params.get('code')) setParams({}, { replace: true })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Nudges are shown here, so they count as seen
  useEffect(() => { if (o?.nudges.length) buddyApi.nudgesSeen().catch(() => undefined) }, [o?.nudges.length])

  const join = async (e: FormEvent) => {
    e.preventDefault()
    setJoining(true)
    try { const r = await buddyApi.join(code); q.setData(r); setCode(''); toast('success', r.detail) }
    catch (err) { toast('error', 'Couldn\'t add buddy', (err as Error).message) } finally { setJoining(false) }
  }
  const copy = async () => {
    if (!o?.code) return
    try { await navigator.clipboard.writeText(o.code); toast('success', 'Code copied') } catch { toast('info', `Your code is ${o.code}`) }
  }
  const share = async () => {
    if (!o?.code) return
    const text = `Be my workout buddy on FitAI. My invite code is ${o.code}.`
    if (navigator.share) { try { await navigator.share({ title: 'FitAI workout buddy', text, url: inviteLink(o.code) }) } catch { /* closed */ } return }
    try { await navigator.clipboard.writeText(`${text} ${inviteLink(o.code)}`); toast('success', 'Invite copied', 'Paste it into a message to your friend.') }
    catch { toast('info', text) }
  }
  const run = async (key: string, fn: () => Promise<typeof o>, done?: string) => {
    setBusy(key)
    try { const r = await fn(); if (r) q.setData(r); if (done) toast('success', done) }
    catch (err) { toast('error', 'Something didn\'t work', (err as Error).message) } finally { setBusy(null) }
  }
  const remove = async () => {
    if (!removing) return
    setBusy('remove')
    try { await buddyApi.remove(removing.id); toast('success', `${removing.name} removed`); setRemoving(null); q.reload(true) }
    catch (err) { toast('error', 'Couldn\'t remove', (err as Error).message) } finally { setBusy(null) }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Workout buddies" subtitle="Pair up with friends to see each other's workout days and streaks, and nudge each other to train." />
      {q.error && <ErrorState message={q.error} onRetry={() => q.reload()} />}
      {q.loading && !o && <Skeleton className="h-64" />}
      {o && (
        <>
          {o.demo && <Notice tone="demo">This is a sample buddy. Create your own account to pair with a real friend.</Notice>}
          {o.nudges.length > 0 && <Notice tone="demo" icon={<Users className="h-4 w-4" />}>{nudgeText(o.nudges.map(n => n.from_name))}</Notice>}

          <Card>
            <CardHeader title="Your buddies" subtitle={`${o.buddies.length} of ${o.max_buddies}`} icon={<Users className="h-4 w-4" />} />
            <div className="px-5 pb-2">
              {o.buddies.length === 0
                ? <EmptyState className="py-8" title="No buddies yet" text="Send a friend your invite code, or type theirs below." />
                : <div className="divide-y divide-line-soft">
                    {o.buddies.map(b => <BuddyRow key={b.id} buddy={b} onChanged={() => q.reload(true)}
                      extra={!o.demo && <IconButton label={`Remove ${b.name}`} onClick={() => setRemoving(b)}><UserMinus className="h-4 w-4" /></IconButton>} />)}
                  </div>}
            </div>
          </Card>

          {!o.demo && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader title="Your invite code" subtitle="A friend types this to pair with you" icon={<Share2 className="h-4 w-4" />} />
                <div className="space-y-4 p-5 pt-1">
                  <p className="score text-[44px] tracking-[0.08em] text-fg" aria-label={`Your invite code is ${o.code?.split('').join(' ')}`}>{o.code}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={share} icon={<Share2 className="h-4 w-4" />}>Send invite</Button>
                    <Button variant="secondary" onClick={copy} icon={<Copy className="h-4 w-4" />}>Copy code</Button>
                    <Button variant="ghost" onClick={() => run('code', buddyApi.newCode, 'New code made. The old one no longer works.')} loading={busy === 'code'}
                      icon={<RefreshCw className="h-4 w-4" />}>New code</Button>
                  </div>
                  <p className="text-xs text-fg-dim">Made a new code? People already paired with you stay paired.</p>
                </div>
              </Card>
              <Card>
                <CardHeader title="Add a buddy" subtitle="Type the code your friend sent you" icon={<UserPlus className="h-4 w-4" />} />
                <form onSubmit={join} className="space-y-3 p-5 pt-1">
                  <Label htmlFor="buddy-code">Friend's invite code</Label>
                  <Input id="buddy-code" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="K7QM-2XRP" maxLength={12}
                    autoComplete="off" autoCapitalize="characters" spellCheck={false} className="font-semibold tracking-[0.12em]" />
                  <Button type="submit" loading={joining} disabled={code.replace(/[^A-Za-z0-9]/g, '').length !== 8} icon={<UserPlus className="h-4 w-4" />}>Add buddy</Button>
                </form>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader title="What buddies see" icon={<EyeOff className="h-4 w-4" />} />
            <div className="space-y-4 p-5 pt-1 text-sm text-fg-muted">
              <p>Your first name, the days you worked out this week, how many workouts your plan has, and your current streak.
                They never see your food, weight, measurements, photos, email or anything you tell the coach.</p>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-line px-4 py-3">
                <span className="font-medium text-fg">Share my workouts with buddies</span>
                <Switch checked={o.sharing} disabled={o.demo || busy === 'sharing'} label="Share my workouts with buddies"
                  onChange={v => run('sharing', () => buddyApi.setSharing(v), v ? 'Buddies can see your workouts' : 'Your workouts are now hidden from buddies')} />
              </div>
              {!o.sharing && <p className="text-xs text-fg-dim">Buddies see only your first name until you turn this back on.</p>}
            </div>
          </Card>
        </>
      )}
      <Modal open={!!removing} onClose={() => setRemoving(null)} title={`Remove ${removing?.name}?`}
        footer={<><Button variant="ghost" onClick={() => setRemoving(null)}>Cancel</Button><Button variant="danger" loading={busy === 'remove'} onClick={remove}>Remove</Button></>}>
        <p className="text-sm text-fg-muted">You'll stop seeing each other's workouts. To pair again, one of you will need the other's invite code.</p>
      </Modal>
    </div>
  )
}
