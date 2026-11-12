import clsx from 'clsx'
import { useState } from 'react'

/**
 * Bundled imagery: tries a locally downloaded photograph (/images/photos/<name>.jpg — fetched by
 * scripts/fetch_photos.sh from Unsplash), and gracefully falls back to FitAI's original artwork
 * (/images/art/<name>.svg) that ships in the repo.
 */
export function Photo({ name, alt, className, overlay = true, position = 'center', fallback }: {
  name: string; alt: string; className?: string; overlay?: boolean | 'strong' | 'left'; position?: string; fallback?: string
}) {
  const [stage, setStage] = useState(0)
  const src = stage === 0 ? `/images/photos/${name}.jpg` : stage === 1 ? `/images/art/${name}.svg` : `/images/art/${fallback ?? 'onboarding'}.svg`
  return (
    <div className={clsx(!className?.includes('absolute') && 'relative', 'overflow-hidden bg-ink-900', className)}>
      <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setStage(s => Math.min(2, s + 1))}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" style={{ objectPosition: position }} />
      {overlay && <div className={clsx('pointer-events-none absolute inset-0',
        overlay === 'strong' ? 'bg-gradient-to-t from-ink-950 via-ink-950/70 to-ink-950/20'
          : overlay === 'left' ? 'bg-gradient-to-r from-ink-950 via-ink-950/80 to-ink-950/10'
            : 'bg-gradient-to-t from-ink-950/90 via-ink-950/20 to-transparent')} />}
    </div>
  )
}
