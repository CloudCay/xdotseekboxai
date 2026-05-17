import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import {
  BookOpen,
  Bookmark,
  Building2,
  ClipboardList,
  FlaskConical,
  Hash,
  LineChart,
  Search,
} from 'lucide-react'

export type IconNavTone = 'light' | 'dark'
export type XTopNavActive = 'reader' | 'industries' | 'topics' | 'intel' | 'search' | 'xmarks' | 'ticker' | 'seeds' | 'roadmap' | 'none'

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
  return (
    <Link
      to={href as never}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={navClass({ active, tone, className })}
    >
      <span aria-hidden="true" className="flex items-center justify-center">
        {icon}
      </span>
      <span className="sr-only">{label}</span>
      <IconNavTooltip label={label} description={description} tone={tone} />
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
  return (
    <button
      {...buttonProps}
      type={type}
      aria-label={label}
      aria-pressed={buttonProps['aria-pressed'] ?? active}
      className={navClass({ active, tone, className, disabled: buttonProps.disabled })}
    >
      <span aria-hidden="true" className="flex items-center justify-center">
        {icon}
      </span>
      <span className="sr-only">{label}</span>
      <IconNavTooltip label={label} description={description} tone={tone} />
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
    'group relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2'
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

function IconNavTooltip({ label, description, tone }: { label: string; description?: string; tone: IconNavTone }) {
  return (
    <span
      role="tooltip"
      className={`pointer-events-none absolute right-0 top-[calc(100%+0.5rem)] z-50 w-max max-w-[220px] rounded-xl border px-3 py-2 text-left opacity-0 shadow-xl transition group-hover:opacity-100 group-focus-visible:opacity-100 ${
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
