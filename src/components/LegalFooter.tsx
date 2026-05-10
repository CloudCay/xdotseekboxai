import { useDocumentTheme } from './seekly/useDocumentTheme'

const X_SOURCE_LINKS = [
  {
    label: 'X trademark policy',
    href: 'https://help.x.com/en/rules-and-policies/x-trademark-policy',
  },
  {
    label: 'X brand toolkit',
    href: 'https://about.x.com/en/who-we-are/brand-toolkit',
  },
  {
    label: 'X Developer Agreement',
    href: 'https://docs.x.com/developer-terms/agreement',
  },
  {
    label: 'X Developer Policy',
    href: 'https://docs.x.com/developer-terms/policy',
  },
] as const

export function LegalFooter() {
  const theme = useDocumentTheme()
  const isDark = theme === 'dark'
  const isPaper = theme === 'newspaper'
  const isSeekBox = theme === 'seekbox'

  const classes = isDark
    ? {
        wrap: 'border-slate-800 bg-slate-950 text-slate-400',
        text: 'text-slate-400',
        link: 'text-slate-200 hover:text-white',
        divider: 'text-slate-700',
      }
    : isPaper
      ? {
          wrap: 'border-neutral-800/30 bg-[#e8e6df] font-serif text-neutral-700',
          text: 'text-neutral-700',
          link: 'text-neutral-950 underline decoration-neutral-500/50 underline-offset-2 hover:decoration-neutral-950',
          divider: 'text-neutral-400',
        }
      : isSeekBox
        ? {
            wrap: 'border-[#D6E0F0] bg-[#FAFBFF] text-[#7B8BA8]',
            text: 'text-[#7B8BA8]',
            link: 'text-[#2563EB] hover:text-[#1B2A4A]',
            divider: 'text-[#BFDBFE]',
          }
        : {
            wrap: 'border-neutral-200 bg-white text-neutral-500',
            text: 'text-neutral-500',
            link: 'text-neutral-800 hover:text-neutral-950',
            divider: 'text-neutral-300',
          }

  return (
    <footer className={`border-t px-4 py-5 sm:px-6 lg:px-8 ${classes.wrap}`}>
      <div className="mx-auto flex max-w-7xl flex-col gap-2 text-[11px] font-semibold leading-5 sm:text-xs">
        <p className={classes.text}>
          SeekBoxAI is not affiliated with or endorsed by X Corp. X is a trademark of X Corp.
        </p>
        <p className={classes.text}>
          Sources:{' '}
          {X_SOURCE_LINKS.map((source, index) => (
            <span key={source.href}>
              <a href={source.href} target="_blank" rel="noreferrer" className={`font-black ${classes.link}`}>
                {source.label}
              </a>
              {index < X_SOURCE_LINKS.length - 1 ? (
                <span className={classes.divider}> · </span>
              ) : (
                '.'
              )}
            </span>
          ))}
        </p>
      </div>
    </footer>
  )
}
