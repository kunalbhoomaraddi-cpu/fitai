export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 64 64" className="h-8 w-8" aria-hidden>
        <rect width="64" height="64" rx="16" fill="#C6F36B" />
        <path d="M20 46V18h22" stroke="#0B0D0C" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M20 32h14" stroke="#0B0D0C" strokeWidth="7" strokeLinecap="round" />
        <circle cx="45" cy="43" r="5" fill="#0B0D0C" />
      </svg>
      {!compact && <span className="font-display text-[19px] font-extrabold tracking-tight text-fg">Fit<span className="text-lime">AI</span></span>}
    </div>
  )
}
