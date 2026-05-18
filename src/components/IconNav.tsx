import { useCallback, useState, type ButtonHTMLAttributes, type FocusEvent, type MouseEvent, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import {
  BookOpen,
  Bookmark,
  Building2,
  ClipboardList,
  FlaskConical,
  Hash,
  LineChart,
  Radio,
  Search,
} from 'lucide-react'

export type IconNavTone = 'light' | 'dark'
export type XTopNavActive =
  | 'reader'
  | 'industries'
  | 'topics'
  | 'intel'
  | 'search'
  | 'arena'
  | 'xmarks'
  | 'ticker'
  | 'seeds'
  | 'roadmap'
  | 'none'

type IconNavBaseProps = {
  label: string
  description?: string
  icon: ReactNode
  active?: boolean
  tone?: IconNavTone
  className?: string
}

type IconNavLinkProps = IconNavBaseProps & {
  href: string
}

type IconNavButtonProps = IconNavBaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children' | 'aria-label'>

const xTopNavItems: Array<{
  id: Exclude<XTopNavActive, 'none'>
  href: string
  label: string
  description: string
  icon: ReactNode
}> = [
  {
    id: 'reader',
    href: '/pulse',
    label: 'Reader',
    description: 'Open the main Pulse reader.',
    icon: <BookOpen className="h-4 w-4" />,
  },
  {
    id: 'industries',
    href: '/industries',
    label: 'Industries',
    description: 'Browse structured industry pulse pages.',
    icon: <Building2 className="h-4 w-4" />,
  },
  {
    id: 'topics',
    href: '/topics',
    label: 'Topics',
    description: 'Open natural topic tags from the feed.',
    icon: <Hash className="h-4 w-4" />,
  },
  {
    id: 'intel',
    href: '/labs',
    label: 'Intel',
    description: 'Use the X intelligence workbench.',
    icon: <FlaskConical className="h-4 w-4" />,
  },
  {
    id: 'search',
    href: '/cleanseek-x',
    label: 'Search live',
    description: 'Run a fresh live model/search pull.',
    icon: <Search className="h-4 w-4" />,
  },
  {
    id: 'arena',
    href: '/arena',
    label: 'Arena',
    description: 'Compare Grok pulse, grounded read, and trend charts.',
    icon: <Radio className="h-4 w-4" />,
  },
  {
    id: 'xmarks',
    href: '/xmarks',
    label: 'XMarks',
    description: 'Open saved X reading workflows.',
    icon: <Bookmark className="h-4 w-4" />,
  },
  {
    id: 'ticker',
    href: '/ticker',
    label: 'Tickers',
    description: 'Open the market watchlist and pulse view.',
    icon: <LineChart className="h-4 w-4" />,
  },
  {
    id: 'seeds',
    href: '/seeds',
    label: 'Seeds',
    description: 'Browse curated search starts and scenes.',
    icon: <Hash className="h-4 w-4" />,
  },
  {
    id: 'roadmap',
    href: '/roadmap',
    label: 'Roadmap',
    description: 'Vote on feature ideas and product direction.',
    icon: <ClipboardList className="h-4 w-4" />,
  },
]

export function XTopNav({
  active = 'none',
  tone = 'light',
  className = '',
  includeXmarks = true,
  includeTicker = true,
  children,
}: {
  active?: XTopNavActive
  tone?: IconNavTone
  className?: string
  includeXmarks?: boolean
  includeTicker?: boolean
  children?: ReactNode
}) {
  const items = xTopNavItems.filter((item) => {
    if (item.id === 'xmarks') return includeXmarks
    if (item.id === 'ticker') return includeTicker
    return true
  })

  return (
    <nav aria-label="Primary" className={`flex min-w-max flex-nowrap gap-2 ${className}`}>
      {items.map((item) => (
        <IconNavLink
          key={item.id}
          href={item.href}
          label={item.label}
          description={item.description}
          icon={item.icon}
          active={active === item.id}
          tone={tone}
        />
      ))}
      {children}
    </nav>
  )
}

export function IconNavLink({ href, label, description, icon, active = false, tone = 'light', className = '' }: IconNavLinkProps) {
  const { tooltipStyle, showTooltip, hideTooltip } = useIconNavTooltip(label, description)

  return (
    <Link
      to={href as never}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      title={description ? `${label}: ${description}` : label}
      onMouseEnter={(event) => showTooltip(event.currentTarget)}
      onMouseLeave={hideTooltip}
      onFocus={(event) => showTooltip(event.currentTarget)}
      onBlur={hideTooltip}
      className={navClass({ active, tone, className })}
    >
      <span aria-hidden="true" className="flex items-center justify-center">
        {icon}
      </span>
      <IconNavHoverLabel label={label} />
      <span className="sr-only">{label}</span>
      <IconNavTooltip label={label} description={description} tone={tone} style={tooltipStyle} />
    </Link>
  )
}

export function IconNavButton({
  label,
  description,
  icon,
  active = false,
  tone = 'light',
  className = '',
  type = 'button',
  ...buttonProps
}: IconNavButtonProps) {
  const { onBlur, onFocus, onMouseEnter, onMouseLeave, ...restButtonProps } = buttonProps
  const { tooltipStyle, showTooltip, hideTooltip } = useIconNavTooltip(label, description)

  const handleMouseEnter = (event: MouseEvent<HTMLButtonElement>) => {
    onMouseEnter?.(event)
    showTooltip(event.currentTarget)
  }

  const handleMouseLeave = (event: MouseEvent<HTMLButtonElement>) => {
    onMouseLeave?.(event)
    hideTooltip()
  }

  const handleFocus = (event: FocusEvent<HTMLButtonElement>) => {
    onFocus?.(event)
    showTooltip(event.currentTarget)
  }

  const handleBlur = (event: FocusEvent<HTMLButtonElement>) => {
    onBlur?.(event)
    hideTooltip()
  }

  return (
    <button
      {...restButtonProps}
      type={type}
      aria-label={label}
      aria-pressed={restButtonProps['aria-pressed'] ?? active}
      title={description ? `${label}: ${description}` : label}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={navClass({ active, tone, className, disabled: restButtonProps.disabled })}
    >
      <span aria-hidden="true" className="flex items-center justify-center">
        {icon}
      </span>
      <IconNavHoverLabel label={label} />
      <span className="sr-only">{label}</span>
      <IconNavTooltip label={label} description={description} tone={tone} style={tooltipStyle} />
    </button>
  )
}

function navClass({
  active,
  tone,
  className,
  disabled = false,
}: {
  active: boolean
  tone: IconNavTone
  className: string
  disabled?: boolean
}) {
  const base =
    'group relative inline-flex h-11 min-w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border px-0 text-sm transition-all duration-150 hover:px-3 focus:outline-none focus-visible:px-3 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2'
  const disabledClass = disabled ? 'cursor-not-allowed opacity-55' : ''

  if (tone === 'dark') {
    const toneClass = active
      ? 'border-cyan-400/50 bg-cyan-400 text-[#050B14] shadow-[0_0_24px_rgba(34,211,238,0.18)]'
      : 'border-slate-700 bg-slate-900/30 text-slate-200 hover:border-slate-500 hover:bg-slate-800/60'
    return `${base} ${toneClass} focus-visible:ring-offset-[#050B14] ${disabledClass} ${className}`.trim()
  }

  const toneClass = active
    ? 'border-neutral-950 bg-neutral-950 text-white shadow-[3px_3px_0_rgba(0,0,0,0.08)]'
    : 'border-neutral-300 bg-white text-neutral-800 hover:border-neutral-950 hover:bg-neutral-100'
  return `${base} ${toneClass} focus-visible:ring-offset-[#fbfbf7] ${disabledClass} ${className}`.trim()
}

function IconNavHoverLabel({ label }: { label: string }) {
  return (
    <span
      aria-hidden="true"
      className="max-w-0 overflow-hidden whitespace-nowrap text-xs font-black leading-none opacity-0 transition-all duration-150 group-hover:ml-2 group-hover:max-w-[7.5rem] group-hover:opacity-100 group-focus-visible:ml-2 group-focus-visible:max-w-[7.5rem] group-focus-visible:opacity-100"
    >
      {label}
    </span>
  )
}

type IconNavTooltipStyle = {
  left: number
  top: number
  width: number
}

function useIconNavTooltip(label: string, description?: string) {
  const [tooltipStyle, setTooltipStyle] = useState<IconNavTooltipStyle | null>(null)

  const showTooltip = useCallback(
    (target: HTMLElement) => {
      if (typeof window === 'undefined') return
      const rect = target.getBoundingClientRect()
      const width = description ? 220 : Math.min(180, Math.max(92, label.length * 8 + 40))
      const gutter = 12
      const left = Math.min(Math.max(gutter, rect.left + rect.width / 2 - width / 2), Math.max(gutter, window.innerWidth - width - gutter))
      const top = rect.bottom + 8
      setTooltipStyle({ left, top, width })
    },
    [description, label],
  )

  const hideTooltip = useCallback(() => setTooltipStyle(null), [])

  return { tooltipStyle, showTooltip, hideTooltip }
}

function IconNavTooltip({
  label,
  description,
  tone,
  style,
}: {
  label: string
  description?: string
  tone: IconNavTone
  style: IconNavTooltipStyle | null
}) {
  if (!style) return null

  return (
    <span
      role="tooltip"
      style={{ left: style.left, top: style.top, width: style.width }}
      className={`pointer-events-none fixed z-[80] rounded-xl border px-3 py-2 text-left shadow-xl ${
        tone === 'dark'
          ? 'border-slate-700 bg-slate-950 text-slate-100'
          : 'border-neutral-800 bg-neutral-950 text-white'
      }`}
    >
      <span className="block text-xs font-black leading-none">{label}</span>
      {description ? <span className="mt-1 block text-[11px] font-semibold leading-4 opacity-75">{description}</span> : null}
    </span>
  )
}
