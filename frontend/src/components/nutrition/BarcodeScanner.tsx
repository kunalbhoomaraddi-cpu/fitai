import { Camera, Keyboard, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button, Input, Modal } from '../ui'

type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> }
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']
const valid = (c: string) => /^\d{8,14}$/.test(c)

/**
 * Reads a food barcode with the phone camera. Uses the browser's own reader where there is one
 * (Chrome on Android) and the open-source ZXing reader elsewhere (iPhone), loaded only when needed.
 * The camera never leaves the phone: only the barcode number is sent to look up the food.
 */
export function BarcodeScanner({ open, onClose, onCode }: { open: boolean; onClose: () => void; onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState<'starting' | 'scanning' | 'denied' | 'nocamera'>('starting')
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (!open) return
    let stream: MediaStream | null = null
    let stopped = false
    let timer = 0
    let zxingStop: (() => void) | null = null
    setState('starting'); setTyped('')
    const done = (code: string) => {
      if (stopped || !valid(code)) return
      stopped = true
      navigator.vibrate?.(60)
      onCode(code)
    }
    ;(async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setState('nocamera'); return }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false })
      } catch (e) {
        setState((e as DOMException).name === 'NotAllowedError' ? 'denied' : 'nocamera'); return
      }
      if (stopped || !video.current) return
      video.current.srcObject = stream
      await video.current.play().catch(() => undefined)
      setState('scanning')
      const Native = (window as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector
      const supported = Native?.getSupportedFormats ? await Native.getSupportedFormats().catch(() => []) : []
      if (Native && FORMATS.some(f => supported.includes(f))) {
        const det = new Native({ formats: FORMATS.filter(f => supported.includes(f)) })
        const tick = async () => {
          if (stopped || !video.current) return
          try { const [hit] = await det.detect(video.current); if (hit) return done(hit.rawValue) } catch { /* frame not ready */ }
          timer = window.setTimeout(tick, 200)
        }
        tick()
      } else {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')])
        const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]]])
        if (stopped || !video.current) return
        const controls = await new BrowserMultiFormatReader(hints).decodeFromVideoElement(video.current, r => { if (r) done(r.getText()) })
        zxingStop = () => controls.stop()
        if (stopped) zxingStop()
      }
    })()
    return () => { stopped = true; clearTimeout(timer); zxingStop?.(); stream?.getTracks().forEach(t => t.stop()) }
  }, [open, onCode])

  return (
    <Modal open={open} onClose={onClose} title="Scan a barcode">
      {state === 'denied' || state === 'nocamera' ? (
        <p className="mb-4 rounded-xl border border-line bg-ink-900 p-4 text-sm text-fg-muted">
          {state === 'denied' ? 'FitAI needs the camera to read barcodes. Allow camera access for this site in your browser settings, or type the number below.'
            : "This device has no camera FitAI can use. Type the number under the barcode instead."}
        </p>
      ) : (
        <div className="relative mb-4 overflow-hidden rounded-2xl bg-black">
          <video ref={video} playsInline muted className="aspect-[4/3] w-full object-cover" />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-xl border-2 border-lime/80" aria-hidden />
          <p className="absolute inset-x-0 bottom-0 bg-ink-950/70 py-2 text-center text-xs text-fg">
            {state === 'starting' ? <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" />Starting camera…</span> : <span className="inline-flex items-center gap-1.5"><Camera className="h-3.5 w-3.5" />Hold the barcode inside the box</span>}
          </p>
        </div>
      )}
      <form onSubmit={e => { e.preventDefault(); if (valid(typed)) onCode(typed) }} className="flex gap-2">
        <Input inputMode="numeric" icon={<Keyboard className="h-4 w-4" />} placeholder="Barcode number" value={typed}
          onChange={e => setTyped(e.target.value.replace(/\D/g, '').slice(0, 14))} aria-label="Barcode number" />
        <Button type="submit" disabled={!valid(typed)}>Look up</Button>
      </form>
    </Modal>
  )
}
