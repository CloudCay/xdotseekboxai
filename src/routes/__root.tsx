import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'

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
        title: 'SeekBoxAi',
      },
    ],
    links: [
      // Cache-bust so browsers pick up changes quickly.
      { rel: 'icon', type: 'image/png', href: '/favicon.png?v=2', sizes: '32x32' },
      { rel: 'apple-touch-icon', href: '/favicon.png?v=2' },
      // Many browsers still prefer .ico; cache-bust it too.
      { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico?v=2' },
      { rel: 'shortcut icon', href: '/favicon.ico?v=2' },
      // Some clients ignore querystrings for favicons; keep plain fallbacks.
      { rel: 'icon', type: 'image/png', href: '/favicon.png', sizes: '32x32' },
      { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
    ],
  }),
  shellComponent: RootDocument,
})

type ThemeMode = 'dark' | 'light'
type FontScale = 0 | 1 | 2

const THEME_KEY = 'sb_theme_mode_v1'
const FONT_KEY = 'sb_font_scale_v1'

function loadTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark'
  try {
    const v = window.localStorage.getItem(THEME_KEY)
    return v === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

function loadFont(): FontScale {
  if (typeof window === 'undefined') return 0
  try {
    const raw = window.localStorage.getItem(FONT_KEY)
    const n = raw ? Number(raw) : 0
    if (n === 1 || n === 2) return n
    return 0
  } catch {
    return 0
  }
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>(() => loadTheme())
  const [font, setFont] = useState<FontScale>(() => loadFont())

  const rootFontPx = useMemo(() => {
    // Keep it subtle; page typography is already dense.
    return font === 2 ? 18 : font === 1 ? 17 : 16
  }, [font])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* noop */
    }
    const el = window.document.documentElement
    if (theme === 'dark') el.classList.add('dark')
    else el.classList.remove('dark')
  }, [theme])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(FONT_KEY, String(font))
    } catch {
      /* noop */
    }
    window.document.documentElement.style.fontSize = `${rootFontPx}px`
  }, [font, rootFontPx])

  return (
    <html lang="en" className={theme === 'dark' ? 'dark' : ''}>
      <head>
        <HeadContent />
      </head>
      <body className="bg-white text-slate-900 antialiased dark:bg-black dark:text-white">
        <div className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800/70 dark:bg-black/40">
          <div className="mx-auto flex max-w-7xl items-center justify-end gap-2 px-3 py-2 sm:px-5">
          <div className="inline-flex overflow-hidden rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950/40">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`px-3 py-1.5 text-xs font-black transition-colors ${
                theme === 'light'
                  ? 'bg-black text-white'
                  : 'bg-transparent text-slate-700 hover:bg-slate-100'
              } dark:${theme === 'light' ? '' : 'text-slate-300 hover:bg-slate-900/40'}`}
              aria-pressed={theme === 'light'}
              aria-label="Light theme"
            >
              Light
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`px-3 py-1.5 text-xs font-black transition-colors ${
                theme === 'dark'
                  ? 'bg-black text-white'
                  : 'bg-transparent text-slate-700 hover:bg-slate-100'
              } dark:${theme === 'dark' ? '' : 'text-slate-300 hover:bg-slate-900/40'}`}
              aria-pressed={theme === 'dark'}
              aria-label="Dark theme"
            >
              Dark
            </button>
          </div>
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
          <button
            type="button"
            onClick={() => setFont((f) => (f > 0 ? ((f - 1) as FontScale) : 0))}
            className="rounded-xl border border-slate-200 bg-white/70 px-2.5 py-1.5 hover:bg-white dark:border-slate-700 dark:bg-slate-900/40 dark:hover:bg-slate-800/60"
            aria-label="Decrease font size"
            disabled={font === 0}
          >
            A-
          </button>
          <button
            type="button"
            onClick={() => setFont(0)}
            className="rounded-xl border border-slate-200 bg-white/70 px-2.5 py-1.5 hover:bg-white dark:border-slate-700 dark:bg-slate-900/40 dark:hover:bg-slate-800/60"
            aria-label="Reset font size"
          >
            A
          </button>
          <button
            type="button"
            onClick={() => setFont((f) => (f < 2 ? ((f + 1) as FontScale) : 2))}
            className="rounded-xl border border-slate-200 bg-white/70 px-2.5 py-1.5 hover:bg-white dark:border-slate-700 dark:bg-slate-900/40 dark:hover:bg-slate-800/60"
            aria-label="Increase font size"
            disabled={font === 2}
          >
            A+
          </button>
          </div>
        </div>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
