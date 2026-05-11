import { useDocumentTheme } from './seekly/useDocumentTheme'

export function LegalFooter() {
  const theme = useDocumentTheme()
  const isDark = theme === 'dark'
  const isPaper = theme === 'newspaper'
  const isSeekBox = theme === 'seekbox'

  const classes = isDark
    ? {
        wrap: 'border-slate-800 bg-slate-950 text-slate-400',
        text: 'text-slate-400',
      }
    : isPaper
      ? {
          wrap: 'border-neutral-800/30 bg-[#e8e6df] font-serif text-neutral-700',
          text: 'text-neutral-700',
        }
      : isSeekBox
        ? {
            wrap: 'border-[#D6E0F0] bg-[#FAFBFF] text-[#7B8BA8]',
            text: 'text-[#7B8BA8]',
          }
        : {
            wrap: 'border-neutral-200 bg-white text-neutral-500',
            text: 'text-neutral-500',
          }

  return (
    <footer className={`border-t px-4 py-5 sm:px-6 lg:px-8 ${classes.wrap}`}>
      <div className="mx-auto flex max-w-7xl flex-col gap-2 text-[11px] font-semibold leading-5 sm:text-xs">
        <p className={classes.text}>
          SeekBoxAI is not affiliated with or endorsed by X Corp. X is a trademark of X Corp.
        </p>
      </div>
    </footer>
  )
}
