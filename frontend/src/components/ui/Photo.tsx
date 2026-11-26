import clsx from 'clsx'
import { useState } from 'react'

/**
 * Bundled imagery: tries a locally downloaded photograph (/images/photos/<name>.webp — fetched by
 * scripts/fetch_photos.sh from Unsplash), and gracefully falls back to FitAI's original artwork
 * (/images/art/<name>.svg) that ships in the repo.
 */
export function Photo({ name, alt, className, overlay = true, position = 'center', fallback, sizes = '(max-width: 768px) 100vw, 50vw' }: {
  name: string; alt: string; className?: string; overlay?: boolean | 'strong' | 'left'; position?: string; fallback?: string
  /** How wide the photo shows, so the browser picks the 640, 960 or 1280 px copy. */
  sizes?: string
}) {
  const [stage, setStage] = useState(0)
  const base = `/images/photos/${name}`
  const src = stage === 0 ? `${base}.webp` : stage === 1 ? `/images/art/${name}.svg` : `/images/art/${fallback ?? 'onboarding'}.svg`
  const srcSet = stage === 0 ? `${base}-640.webp 640w, ${base}-960.webp 960w, ${base}.webp 1280w` : undefined
  return (
    <div className={clsx(!className?.includes('absolute') && 'relative', 'overflow-hidden bg-ink-900', className)}>
      <img src={src} srcSet={srcSet} sizes={srcSet ? sizes : undefined} alt={alt} loading="lazy" decoding="async" onError={() => setStage(s => Math.min(2, s + 1))}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" style={{ objectPosition: position }} />
      {overlay && <div className={clsx('pointer-events-none absolute inset-0',
        overlay === 'strong' ? 'bg-gradient-to-t from-ink-950 via-ink-950/70 to-ink-950/20'
          : overlay === 'left' ? 'bg-gradient-to-r from-ink-950 via-ink-950/80 to-ink-950/10'
            : 'bg-gradient-to-t from-ink-950/90 via-ink-950/20 to-transparent')} />}
    </div>
  )
}
