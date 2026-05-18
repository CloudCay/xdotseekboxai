export type SeekBoxLogoProps = {
  tone?: 'dark' | 'light'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClass: Record<NonNullable<SeekBoxLogoProps['size']>, string> = {
  sm: 'h-9 w-9',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
}

export function SeekBoxLogo({ tone = 'dark', size = 'md', className = '' }: SeekBoxLogoProps) {
  const isLight = tone === 'light'
  const frame = isLight
    ? 'border-neutral-950/15 bg-white shadow-[0_6px_20px_rgba(15,23,42,0.10)]'
    : 'border-white/15 bg-[#050B14] shadow-[0_0_22px_rgba(34,211,238,0.20)]'
  const imageTone = isLight
    ? 'brightness-[1.03] contrast-[1.02] saturate-[1.02]'
    : 'brightness-[0.88] contrast-[1.1] saturate-[1.12]'
  const edgeBlend = isLight
    ? 'radial-gradient(circle at 50% 48%, transparent 54%, rgba(255,255,255,0.72) 100%)'
    : 'radial-gradient(circle at 50% 45%, transparent 50%, rgba(5,11,20,0.68) 100%)'

  return (
    <span
      className={`relative inline-flex shrink-0 overflow-hidden rounded-xl border ${sizeClass[size]} ${frame} ${className}`}
      aria-hidden="true"
    >
      <img
        src="/seekbox-cube-logo.png"
        alt=""
        className={`h-full w-full object-cover ${imageTone}`}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 shadow-[inset_0_0_18px_rgba(255,255,255,0.12)]"
        style={{ background: edgeBlend }}
      />
    </span>
  )
}
