import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'

// Cloudflare Turnstile loads with `?onload=onloadTurnstileCallback`.
// When navigating to `/signin` via client-side routing, the Turnstile script can be requested
// before the sign-in route chunk is evaluated (prefetch/caching). Ensure the callback exists
// in the root bundle so Turnstile never fails early.
if (typeof window !== 'undefined') {
  const w = window as any
  if (typeof w.onloadTurnstileCallback !== 'function') w.onloadTurnstileCallback = () => {}
}

import {
  applySiteFontToDocument,
  applySiteThemeToDocument,
  readSiteFontScale,
  readSiteTheme,
  writeSiteFontScale,
  writeSiteTheme,
  type SiteFontScale,
  type SiteThemeMode,
} from '../lib/siteTheme'
import { SeeklyOverlay } from '../components/seekly/SeeklyOverlay'
import { LegalFooter } from '../components/LegalFooter'
import { getAuthErrorMessageFromLocation, returnToWithoutAuthError } from '../lib/authErrors'

import '../styles.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'X.SeekBoxAI Pulse',
      },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,400..900;1,14..32,400..900&display=swap',
      },
      // Cache-bust so browsers pick up the cube favicon quickly.
      { rel: 'icon', type: 'image/png', href: '/favicon-32x32.png?v=4', sizes: '32x32' },
      { rel: 'icon', type: 'image/png', href: '/favicon-16x16.png?v=4', sizes: '16x16' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png?v=4', sizes: '180x180' },
      { rel: 'manifest', href: '/site.webmanifest?v=4' },
      // Many browsers still prefer .ico; cache-bust it too.
      { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico?v=4' },
      { rel: 'shortcut icon', href: '/favicon.ico?v=4' },
      // Some clients ignore querystrings for favicons; keep plain fallbacks.
      { rel: 'icon', type: 'image/png', href: '/favicon.png', sizes: '512x512' },
      { rel: 'icon', type: 'image/png', href: '/favicon-32x32.png', sizes: '32x32' },
      { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<SiteThemeMode>(() => readSiteTheme())
  const [font, setFont] = useState<SiteFontScale>(() => readSiteFontScale())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const storedTheme = readSiteTheme()
    const storedFont = readSiteFontScale()
    setTheme(storedTheme)
    setFont(storedFont)
    applySiteThemeToDocument(storedTheme)
    applySiteFontToDocument(storedFont)
    setReady(true)
  }, [])

  useEffect(() => {
    const authError = getAuthErrorMessageFromLocation()
    if (!authError || window.location.pathname === '/signin') return
    const target = new URL('/signin', window.location.origin)
    target.searchParams.set('returnTo', returnToWithoutAuthError())
    target.searchParams.set('authError', authError)
    window.location.replace(`${target.pathname}${target.search}`)
  }, [])

  useEffect(() => {
    if (!ready) return
    writeSiteTheme(theme)
    applySiteThemeToDocument(theme)
  }, [ready, theme])

  useEffect(() => {
    if (!ready) return
    writeSiteFontScale(font)
    const apply = () => applySiteFontToDocument(font)
    apply()
    window.addEventListener('resize', apply)
    return () => window.removeEventListener('resize', apply)
  }, [font, ready])

  const chrome = useMemo(() => {
    switch (theme) {
      case 'light':
        return {
          wrap: 'border-slate-300/90 bg-white/95 backdrop-blur-md shadow-lg',
          group: 'border-slate-300 bg-white',
          btnOn: 'bg-black text-white',
          btnOff: 'bg-transparent text-slate-700 hover:bg-slate-100',
          sep: 'bg-slate-200',
          fontBtn:
            'border-slate-200 bg-white hover:bg-slate-50 text-slate-900 disabled:opacity-40',
        }
      case 'dark':
        return {
          wrap: 'border-slate-600 bg-slate-950/90 backdrop-blur-md shadow-lg',
          group: 'border-slate-600 bg-slate-900/80',
          btnOn: 'bg-white text-black',
          btnOff: 'text-slate-300 hover:bg-slate-800/60',
          sep: 'bg-slate-600',
          fontBtn:
            'border-slate-600 bg-slate-900 hover:bg-slate-800 text-slate-100 disabled:opacity-40',
        }
      case 'newspaper':
        return {
          wrap:
            'border-neutral-800 bg-[#f4f1ea]/95 shadow-[4px_4px_0_0_rgba(0,0,0,0.18)] backdrop-blur-sm',
          group: 'border-neutral-800 bg-[#faf8f3]',
          btnOn: 'bg-neutral-900 text-[#f4f1ea]',
          btnOff: 'text-neutral-800 hover:bg-neutral-200/80',
          sep: 'bg-neutral-400',
          fontBtn:
            'border-neutral-700 bg-[#faf8f3] text-neutral-900 hover:bg-neutral-200 disabled:opacity-40',
        }
      case 'seekbox':
        return {
          wrap: 'border-[#D6E0F0] bg-[#FFFFFF]/95 shadow-sm backdrop-blur-md',
          group: 'border-[#D6E0F0] bg-[#FFFFFF]',
          btnOn:
            'bg-[#FFFFFF] text-[#2563EB] shadow-[inset_0_0_0_1px_#BFDBFE] font-extrabold',
          btnOff: 'bg-transparent text-[#7B8BA8] hover:bg-[#EEF2FF] hover:text-[#1B2A4A]',
          sep: 'bg-[#D6E0F0]',
          fontBtn:
            'border-[#D6E0F0] bg-[#FFFFFF] text-[#1B2A4A] hover:bg-[#FAFBFF] disabled:opacity-40',
        }
    }
  }, [theme])

  return (
    <html lang="en" data-theme={theme} data-font-scale={font} className={theme === 'dark' ? 'dark' : ''}>
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        <div
          className={`fixed bottom-3 left-3 z-[100] flex max-w-[calc(100vw-1.5rem)] flex-wrap items-center justify-start gap-2 rounded-2xl border p-2 ${chrome.wrap} ${
            theme === 'newspaper' ? 'font-serif' : theme === 'seekbox' ? 'font-sans' : ''
          }`}
          role="toolbar"
          aria-label="Theme and text size"
        >
          <div className={`inline-flex max-w-full flex-wrap overflow-hidden rounded-xl border ${chrome.group}`}>
            {(
              [
                ['light', 'Light'] as const,
                ['dark', 'Dark'] as const,
                ['newspaper', 'Paper'] as const,
                ['seekbox', 'Brand'] as const,
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTheme(id)}
                className={`px-2.5 py-1.5 text-[10px] font-black transition-colors sm:px-3 sm:text-xs ${
                  theme === id ? chrome.btnOn : chrome.btnOff
                }`}
                aria-pressed={theme === id}
                aria-label={`${label} theme`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className={`hidden h-6 w-px sm:block ${chrome.sep}`} />
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFont((f) => (f > 0 ? ((f - 1) as SiteFontScale) : 0))}
              className={`rounded-xl border px-2.5 py-1.5 text-xs font-semibold ${chrome.fontBtn}`}
              aria-label="Decrease font size"
              disabled={font === 0}
            >
              A-
            </button>
            <button
              type="button"
              onClick={() => setFont(0)}
              className={`rounded-xl border px-2.5 py-1.5 text-xs font-semibold ${chrome.fontBtn}`}
              aria-label="Reset font size"
            >
              A
            </button>
            <button
              type="button"
              onClick={() => setFont((f) => (f < 2 ? ((f + 1) as SiteFontScale) : 2))}
              className={`rounded-xl border px-2.5 py-1.5 text-xs font-semibold ${chrome.fontBtn}`}
              aria-label="Increase font size"
              disabled={font === 2}
            >
              A+
            </button>
          </div>
        </div>
        {children}
        <LegalFooter />
        <SeeklyOverlay />
        <Scripts />
      </body>
    </html>
  )
}
