import { Link } from '@tanstack/react-router'
import { SeekBoxLogo } from '@/components/SeekBoxLogo'
import { buildXdotHelperPageContext, getXdotRouteSupport } from '@/lib/helper/siteProfile'
import { helperStore } from '@/lib/helper/store'
import { SeeklyChat } from './SeeklyChat'
import { themeForSeekly } from './seeklyTheme'
import { useDocumentTheme } from './useDocumentTheme'

export function SeeklyPage() {
  const themeName = useDocumentTheme()
  const theme = themeForSeekly(themeName)
  const routeSupport = getXdotRouteSupport('/seekly')

  return (
    <main className={`min-h-screen px-4 py-8 ${theme.panel}`}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <header className="flex flex-wrap items-center gap-3">
          <SeekBoxLogo tone={theme.logoTone} size="lg" />
          <div>
            <p className={`text-xs font-black uppercase tracking-[0.2em] ${theme.muted}`}>
              xdot helper layer
            </p>
            <h1 className={`text-3xl font-black ${theme.text}`}>Seekly</h1>
          </div>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => helperStore.setOpen(true)}
            className={`rounded-xl border px-4 py-2 text-sm font-bold ${theme.button}`}
          >
            Open floating panel
          </button>
          <Link to="/" className={`rounded-xl border px-4 py-2 text-sm font-bold ${theme.button}`}>
            Back to Pulse
          </Link>
        </header>
        <section className={`h-[min(720px,calc(100vh-8rem))] overflow-hidden rounded-2xl border shadow-xl ${theme.border}`}>
          <SeeklyChat
            themeName={themeName}
            pageContext={buildXdotHelperPageContext({ pathname: '/seekly' })}
            surfaceLabel={routeSupport.label}
            surfaceDescription={routeSupport.description}
            surfaceStarters={routeSupport.starters}
          />
        </section>
      </div>
    </main>
  )
}
