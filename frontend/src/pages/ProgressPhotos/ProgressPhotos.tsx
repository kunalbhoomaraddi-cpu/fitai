import clsx from 'clsx'
import { ArrowLeftRight, Camera, ChevronLeft, ChevronRight, Columns2, ImagePlus, Lock, MoveHorizontal, Scale, ShieldCheck, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, Input, Label, Modal, Notice, PageHeader, Segmented, Select, Skeleton } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useAsync } from '../../hooks/useAsync'
import { fetchBlobUrl, tokenStore } from '../../services/api'
import { photoApi, type Pose, type ProgressPhoto } from '../../services/fitai'
import { fmtWeight, todayISO } from '../../utils/format'

const POSES: readonly (readonly [Pose, string])[] = [['front', 'Front'], ['side', 'Side'], ['back', 'Back']]
const POSE_LABEL: Record<Pose, string> = { front: 'Front', side: 'Side', back: 'Back' }
const longDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const daysBetween = (a: string, b: string) => Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000)

/* ---------- private image loading (photos need the login token, so <img src> can't fetch them directly) */
const cache = new Map<string, Promise<string>>()
function useAuthedSrc(id: number, size: 'thumb' | 'full') {
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    const key = `${(tokenStore.get() || '').slice(-16)}:${id}:${size}`
    if (!cache.has(key)) cache.set(key, fetchBlobUrl(photoApi.imagePath(id, size)).catch(e => { cache.delete(key); throw e }))
    cache.get(key)!.then(u => alive && setSrc(u)).catch(() => alive && setFailed(true))
    return () => { alive = false }
  }, [id, size])
  return { src, failed }
}

function AuthImg({ id, size, className, alt }: { id: number; size: 'thumb' | 'full'; className?: string; alt: string }) {
  const { src, failed } = useAuthedSrc(id, size)
  if (failed) return <div className={clsx('flex items-center justify-center bg-ink-900 text-xs text-fg-dim', className)}>Couldn't load</div>
  if (!src) return <div className={clsx('animate-pulse bg-white/[0.04]', className)} />
  return <img src={src} alt={alt} draggable={false} className={clsx('select-none object-cover', className)} />
}

/* ---------- shrink big phone photos in the browser before upload (faster on mobile data) */
async function prepare(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    bmp.close()
    const blob = await new Promise<Blob | null>(r => c.toBlob(r, 'image/jpeg', 0.9))
    return blob ?? file
  } catch { return file }  // let the server decide (it gives a clear error if unreadable)
}

/* ---------- upload */
function UploadModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (p: ProgressPhoto[]) => void }) {
  const toast = useToast()
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [files, setFiles] = useState<Partial<Record<Pose, { file: File; url: string }>>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputs = useRef<Partial<Record<Pose, HTMLInputElement | null>>>({})

  useEffect(() => { if (!open) { Object.values(files).forEach(f => f && URL.revokeObjectURL(f.url)); setFiles({}); setNote(''); setError(null); setDate(todayISO()) } }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (pose: Pose, f?: File) => {
    if (!f) return
    if (!f.type.startsWith('image/') && !/\.(heic|heif)$/i.test(f.name)) return setError('Please choose a photo file.')
    setError(null)
    setFiles(prev => { if (prev[pose]) URL.revokeObjectURL(prev[pose]!.url); return { ...prev, [pose]: { file: f, url: URL.createObjectURL(f) } } })
  }

  const chosen = POSES.filter(([p]) => files[p])
  const save = async () => {
    if (!chosen.length) return setError('Add at least one photo.')
    setError(null)
    const done: ProgressPhoto[] = []
    try {
      for (const [p, label] of chosen) {
        setBusy(`Uploading ${label.toLowerCase()}…`)
        done.push(await photoApi.upload(await prepare(files[p]!.file), p, date, note.trim() || undefined))
      }
      toast('success', done.length === 1 ? 'Photo saved' : `${done.length} photos saved`, 'Visible only to you')
      onDone(done); onClose()
    } catch (e) {
      if (done.length) onDone(done)
      setError((e as Error).message)
    } finally { setBusy(null) }
  }

  return (
    <Modal open={open} onClose={busy ? () => undefined : onClose} wide title="Add progress photos"
      footer={<><Button variant="ghost" onClick={onClose} disabled={!!busy}>Cancel</Button>
        <Button onClick={save} loading={!!busy} disabled={!chosen.length} icon={busy ? undefined : <ImagePlus className="h-4 w-4" />}>{busy ?? `Save ${chosen.length || ''} photo${chosen.length === 1 ? '' : 's'}`}</Button></>}>
      <div className="grid grid-cols-3 gap-3">
        {POSES.map(([p, label]) => (
          <div key={p}>
            <input ref={el => { inputs.current[p] = el }} type="file" accept="image/*" className="hidden" onChange={e => { pick(p, e.target.files?.[0]); e.target.value = '' }} />
            <button type="button" onClick={() => inputs.current[p]?.click()}
              onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); pick(p, e.dataTransfer.files?.[0]) }}
              className={clsx('group relative flex aspect-[3/4] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border text-fg-muted transition',
                files[p] ? 'border-lime/40' : 'border-dashed border-line-strong hover:border-lime/50 hover:text-fg')}>
              {files[p] ? <>
                <img src={files[p]!.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-6 text-xs font-medium text-white">Change</span>
              </> : <><Camera className="h-6 w-6" /><span className="mt-2 text-xs">Tap to add</span></>}
            </button>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-sm font-medium text-fg">{label}</span>
              {files[p] && <button type="button" aria-label={`Remove ${label}`} onClick={() => setFiles(prev => { URL.revokeObjectURL(prev[p]!.url); const n = { ...prev }; delete n[p]; return n })} className="rounded p-0.5 text-fg-dim hover:text-coral"><X className="h-3.5 w-3.5" /></button>}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div><Label htmlFor="pdate">Date taken</Label><Input id="pdate" type="date" max={todayISO()} value={date} onChange={e => setDate(e.target.value)} /></div>
        <div><Label htmlFor="pnote" hint="optional">Note</Label><Input id="pnote" maxLength={200} placeholder="e.g. Morning, before breakfast" value={note} onChange={e => setNote(e.target.value)} /></div>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-fg-dim">Tip: same spot, same light, same time of day (morning works best) — it makes changes much easier to see.</p>
      {error && <div className="mt-4"><Notice tone="warn">{error}</Notice></div>}
    </Modal>
  )
}

/* ---------- compare */
function CompareSlider({ before, after }: { before: ProgressPhoto; after: ProgressPhoto }) {
  const [pos, setPos] = useState(50)
  return (
    <div className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-2xl border border-line bg-ink-900">
      <AuthImg id={after.id} size="full" alt="After" className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <AuthImg id={before.id} size="full" alt="Before" className="absolute inset-0 h-full w-full" />
      </div>
      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-lime shadow-[0_0_12px_rgba(198,243,107,.6)]" style={{ left: `${pos}%` }}>
        <span className="absolute top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-lime text-ink-950 shadow-lg"><MoveHorizontal className="h-4 w-4" /></span>
      </div>
      <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">Before</span>
      <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">After</span>
      <input type="range" min={0} max={100} value={pos} onChange={e => setPos(+e.target.value)} aria-label="Compare slider"
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
    </div>
  )
}

function Compare({ photos }: { photos: ProgressPhoto[] }) {
  const { units } = useAuth()
  const poses = POSES.filter(([p]) => photos.filter(x => x.pose === p).length >= 2)
  const [pose, setPose] = useState<Pose>(poses[0]?.[0] ?? 'front')
  const list = useMemo(() => photos.filter(p => p.pose === pose).sort((a, b) => a.taken_on.localeCompare(b.taken_on) || a.id - b.id), [photos, pose])
  const [ids, setIds] = useState<[number, number] | null>(null)
  const [mode, setMode] = useState<'side' | 'slider'>('side')

  useEffect(() => { if (poses.length && !poses.some(([p]) => p === pose)) setPose(poses[0][0]) }, [poses, pose])
  useEffect(() => { if (list.length >= 2) setIds([list[0].id, list[list.length - 1].id]) }, [list])

  if (!poses.length) {
    return (
      <Card className="p-5">
        <div className="flex items-start gap-3 text-sm text-fg-muted"><ArrowLeftRight className="mt-0.5 h-4 w-4 shrink-0 text-lime" />
          <p><b className="text-fg">Compare unlocks with your second photo of the same pose.</b> Take your next set in 1–2 weeks and you'll be able to see before and after side by side.</p></div>
      </Card>
    )
  }
  const before = list.find(p => p.id === ids?.[0]), after = list.find(p => p.id === ids?.[1])
  const opt = (p: ProgressPhoto) => <option key={p.id} value={p.id}>{longDate(p.taken_on)}</option>
  const wDiff = before?.weight_kg != null && after?.weight_kg != null ? after.weight_kg - before.weight_kg : null

  return (
    <Card className="pb-5">
      <CardHeader icon={<ArrowLeftRight className="h-4 w-4" />} title="Before & after" subtitle="Pick any two dates to compare" />
      <div className="mt-4 space-y-3 px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {poses.length > 1 ? <Segmented size="sm" value={pose} onChange={setPose} options={poses} /> : <span className="text-sm font-medium text-fg">{POSE_LABEL[pose]} pose</span>}
          <Segmented size="sm" value={mode} onChange={setMode} options={[['side', 'Side by side'], ['slider', 'Slider']] as const} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="cb">Before</Label>
            <Select id="cb" value={ids?.[0] ?? ''} onChange={e => setIds([+e.target.value, ids![1]])}>{list.map(opt)}</Select></div>
          <div><Label htmlFor="ca">After</Label>
            <Select id="ca" value={ids?.[1] ?? ''} onChange={e => setIds([ids![0], +e.target.value])}>{list.map(opt)}</Select></div>
        </div>
      </div>
      {before && after && <>
        <div className="mt-4 flex flex-wrap gap-2 px-5">
          <Badge tone="lime">{Math.abs(daysBetween(before.taken_on, after.taken_on))} days apart</Badge>
          {wDiff != null && <Badge tone={Math.abs(wDiff) < 0.1 ? 'neutral' : 'sky'}><Scale className="h-3 w-3" />{wDiff > 0 ? '+' : wDiff < 0 ? '−' : '±'}{fmtWeight(Math.abs(wDiff), units)}</Badge>}
        </div>
        <div className="mt-4 px-5">
          {mode === 'slider' ? <CompareSlider before={before} after={after} /> : (
            <div className="mx-auto grid max-w-2xl grid-cols-2 gap-3">
              {[['Before', before], ['After', after]].map(([l, p]) => { const ph = p as ProgressPhoto; return (
                <figure key={l as string}>
                  <AuthImg id={ph.id} size="full" alt={l as string} className="aspect-[3/4] w-full rounded-2xl border border-line" />
                  <figcaption className="mt-2 text-xs text-fg-muted"><b className="text-fg">{l as string}</b> · {longDate(ph.taken_on)}{ph.weight_kg ? ` · ${fmtWeight(ph.weight_kg, units)}` : ''}</figcaption>
                </figure>) })}
            </div>
          )}
        </div>
      </>}
    </Card>
  )
}

/* ---------- viewer */
function Viewer({ photo, photos, onSelect, onClose, onChange, onDelete }: {
  photo: ProgressPhoto | null; photos: ProgressPhoto[]; onSelect: (p: ProgressPhoto) => void; onClose: () => void
  onChange: (p: ProgressPhoto) => void; onDelete: (id: number) => void
}) {
  const { units } = useAuth()
  const toast = useToast()
  const [confirm, setConfirm] = useState(false)
  useEffect(() => setConfirm(false), [photo?.id])
  if (!photo) return null
  // all photos from the same date, in front → side → back order
  const sameDay = photos.filter(p => p.taken_on === photo.taken_on)
    .sort((a, b) => POSES.findIndex(([x]) => x === a.pose) - POSES.findIndex(([x]) => x === b.pose) || a.id - b.id)
  const idx = sameDay.findIndex(p => p.id === photo.id)
  const relabel = async (pose: Pose) => { try { onChange(await photoApi.update(photo.id, { pose })); toast('success', `Marked as ${POSE_LABEL[pose].toLowerCase()}`) } catch (e) { toast('error', 'Could not update', (e as Error).message) } }
  const del = async () => {
    try {
      await photoApi.remove(photo.id); onDelete(photo.id); toast('success', 'Photo deleted')
      const next = sameDay[idx + 1] ?? sameDay[idx - 1]
      if (next) onSelect(next); else onClose()
    } catch (e) { toast('error', 'Could not delete', (e as Error).message) }
  }
  return (
    <Modal open onClose={onClose} wide title={longDate(photo.taken_on)}
      footer={confirm ? <><span className="mr-auto self-center text-sm text-fg-muted">Delete this photo permanently?</span><Button variant="ghost" onClick={() => setConfirm(false)}>Keep</Button><Button variant="danger" onClick={del} icon={<Trash2 className="h-4 w-4" />}>Delete</Button></>
        : <><Button variant="ghost" className="mr-auto" onClick={() => setConfirm(true)} icon={<Trash2 className="h-4 w-4" />}>Delete</Button><Button onClick={onClose}>Done</Button></>}>
      {/* switch between this date's photos */}
      <div className="mb-4 flex justify-center">
        <div role="tablist" className="inline-flex rounded-xl border border-line bg-ink-900 p-1">
          {sameDay.map(p => (
            <button key={p.id} role="tab" aria-selected={p.id === photo.id} onClick={() => onSelect(p)}
              className={clsx('rounded-lg px-4 py-1.5 text-[13px] font-medium transition', p.id === photo.id ? 'bg-ink-700 text-fg ring-1 ring-line-strong' : 'text-fg-muted hover:text-fg')}>
              {POSE_LABEL[p.pose]}{sameDay.filter(x => x.pose === p.pose).length > 1 ? ` ${sameDay.filter(x => x.pose === p.pose).indexOf(p) + 1}` : ''}
            </button>
          ))}
          {POSES.filter(([pp]) => !sameDay.some(x => x.pose === pp)).map(([pp, l]) => (
            <span key={pp} title="No photo for this pose on this date" className="cursor-not-allowed rounded-lg px-4 py-1.5 text-[13px] font-medium text-fg-dim/50 line-through">{l}</span>
          ))}
        </div>
      </div>
      <div className="relative">
        <AuthImg key={photo.id} id={photo.id} size="full" alt={`${photo.pose} progress photo`} className="mx-auto max-h-[56vh] w-auto rounded-2xl !object-contain" />
        {sameDay.length > 1 && <>
          <button aria-label="Previous photo" disabled={idx <= 0} onClick={() => onSelect(sameDay[idx - 1])} className="absolute left-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80 disabled:opacity-0"><ChevronLeft className="h-5 w-5" /></button>
          <button aria-label="Next photo" disabled={idx >= sameDay.length - 1} onClick={() => onSelect(sameDay[idx + 1])} className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80 disabled:opacity-0"><ChevronRight className="h-5 w-5" /></button>
        </>}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="lime">{POSE_LABEL[photo.pose]}</Badge>
          {photo.weight_kg != null && <Badge tone="sky"><Scale className="h-3 w-3" />{fmtWeight(photo.weight_kg, units)} that week</Badge>}
        </div>
        <label className="flex items-center gap-2 text-xs text-fg-muted">Wrong pose? Mark as
          <select value={photo.pose} onChange={e => relabel(e.target.value as Pose)} className="rounded-lg border border-line bg-ink-900 px-2 py-1 text-xs text-fg">
            {POSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>
      {photo.note && <p className="mt-3 text-sm text-fg-muted">{photo.note}</p>}
    </Modal>
  )
}

/* ---------- page */
export default function ProgressPhotos() {
  const { user, units } = useAuth()
  const { data, setData, error, loading, reload } = useAsync(() => photoApi.list(), [])
  const [upOpen, setUpOpen] = useState(false)
  const [view, setView] = useState<ProgressPhoto | null>(null)
  const photos = useMemo(() => data ?? [], [data])
  const groups = useMemo(() => {
    const m = new Map<string, ProgressPhoto[]>()
    for (const p of photos) m.set(p.taken_on, [...(m.get(p.taken_on) ?? []), p])
    return [...m.entries()].map(([d, ps]) => [d, ps.sort((a, b) => ['front', 'side', 'back'].indexOf(a.pose) - ['front', 'side', 'back'].indexOf(b.pose))] as const)
  }, [photos])
  const demo = user?.is_demo

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Progress Tracker" title="Progress Photos"
        subtitle="The scale doesn't show everything. Weekly photos reveal changes in shape that numbers miss."
        actions={!demo && <Button onClick={() => setUpOpen(true)} icon={<ImagePlus className="h-4 w-4" />}>Add photos</Button>} />

      <div className="flex items-start gap-3 rounded-xl border border-line bg-white/[0.02] px-4 py-3 text-[13px] text-fg-muted">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-lime" />
        <span><b className="text-fg">Private to you.</b> Photos are only viewable when you're logged in, never shared, never sent to the AI, and location data from your camera is removed on upload.</span>
      </div>

      {demo && <Notice tone="demo" icon={<Lock className="h-4 w-4" />}>Photos are turned off on the shared demo account. Create your own account to keep private progress photos.</Notice>}

      {loading ? <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4]" />)}</div>
        : error ? <ErrorState message={error} onRetry={() => reload()} />
        : !photos.length ? (
          <EmptyState art="hero-training" icon={<Camera className="h-5 w-5" />} title="Take your first progress photos"
            text="Front, side and back — in the same spot and light each time. Repeat every 1–2 weeks and compare them here."
            action={!demo && <Button onClick={() => setUpOpen(true)} icon={<ImagePlus className="h-4 w-4" />}>Add photos</Button>} />
        ) : <>
          <Compare photos={photos} />
          <Card className="pb-5">
            <CardHeader icon={<Columns2 className="h-4 w-4" />} title="Timeline" subtitle={`${photos.length} photo${photos.length === 1 ? '' : 's'} across ${groups.length} date${groups.length === 1 ? '' : 's'}`} />
            <div className="mt-2 divide-y divide-line-soft">
              {groups.map(([d, ps]) => {
                const w = ps.find(p => p.weight_kg != null)?.weight_kg
                return (
                  <div key={d} className="px-5 py-4">
                    <div className="mb-3 flex items-center gap-2">
                      <p className="font-display text-sm font-semibold text-fg">{longDate(d)}</p>
                      {w != null && <span className="text-xs text-fg-muted">· {fmtWeight(w, units)}</span>}
                    </div>
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
                      {ps.map(p => (
                        <button key={p.id} onClick={() => setView(p)} className="group relative overflow-hidden rounded-xl border border-line text-left transition hover:border-lime/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime">
                          <AuthImg id={p.id} size="thumb" alt={`${p.pose} photo, ${d}`} className="aspect-[3/4] w-full transition duration-300 group-hover:scale-[1.03]" />
                          <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-medium text-white">{POSE_LABEL[p.pose]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </>}

      <UploadModal open={upOpen} onClose={() => setUpOpen(false)} onDone={ps => setData(prev => [...ps, ...(prev ?? [])].sort((a, b) => b.taken_on.localeCompare(a.taken_on) || b.id - a.id))} />
      <Viewer photo={view} photos={photos} onSelect={setView} onClose={() => setView(null)}
        onChange={p => { setView(p); setData(prev => (prev ?? []).map(x => x.id === p.id ? p : x)) }}
        onDelete={id => setData(prev => (prev ?? []).filter(x => x.id !== id))} />
    </div>
  )
}
