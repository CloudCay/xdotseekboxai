import type { ReactNode } from 'react'
import { AccountStatusBadge } from './AccountStatusBadge'
import { XTopNav, type XTopNavActive } from './IconNav'
import { SeekBoxLogo, type SeekBoxLogoProps } from './SeekBoxLogo'

type XSiteHeaderProps = {
  active?: XTopNavActive
  title?: string
  eyebrow?: string
  href?: string
  logoSize?: SeekBoxLogoProps['size']
  includeXmarks?: boolean
  includeTicker?: boolean
  showAccount?: boolean
  navChildren?: ReactNode
  actions?: ReactNode
  fullWidth?: boolean
  className?: string
}

export function XSiteHeader({
  active = 'none',
  title = 'X.SeekBoxAI Pulse',
  eyebrow = 'live X.SeekBoxAI cache',
  href = '/',
  logoSize = 'md',
  includeXmarks = true,
  includeTicker = true,
  showAccount = true,
  navChildren,
  actions,
  fullWidth = false,
  className = '',
}: XSiteHeaderProps) {
  return (
    <header
      className={`sticky top-0 z-50 border-b border-neutral-300 bg-[#fbfbf7]/95 backdrop-blur supports-[backdrop-filter]:bg-[#fbfbf7]/85 ${className}`}
    >
      <div
        className={
          fullWidth
            ? 'flex h-16 w-full items-center gap-3 px-3 sm:px-4 lg:px-5'
            : 'mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8'
        }
      >
        <a href={href} className="flex min-w-0 flex-[1_1_15rem] items-center gap-2 overflow-hidden sm:gap-3">
          <SeekBoxLogo tone="light" size={logoSize} />
          <div className="min-w-0">
            <div className="truncate text-base font-black tracking-tight sm:text-xl lg:text-2xl">{title}</div>
            <div className="truncate text-[9px] font-black uppercase tracking-[0.18em] text-neutral-500 sm:text-[10px] sm:tracking-[0.22em]">
              {eyebrow}
            </div>
          </div>
        </a>

        <div className="xsite-header-actions flex min-w-0 flex-[0_1_auto] items-center justify-end gap-2 overflow-x-auto whitespace-nowrap pb-1">
          <XTopNav active={active} includeXmarks={includeXmarks} includeTicker={includeTicker}>
            {navChildren}
          </XTopNav>
          {actions}
          {showAccount ? <AccountStatusBadge tone="light" /> : null}
        </div>
      </div>
    </header>
  )
}
