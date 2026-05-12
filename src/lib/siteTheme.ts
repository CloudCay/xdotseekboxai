/** Site-wide theme + font scale (floating toolbar + /account settings). Theme id `seekbox` = P_SEEKBOX_BRAND. */

export type SiteThemeMode = 'dark' | 'light' | 'newspaper' | 'seekbox'
export type SiteFontScale = 0 | 1 | 2

export const SITE_THEME_STORAGE_KEY = 'sb_theme_mode_v2'
export const SITE_THEME_LEGACY_KEY = 'sb_theme_mode_v1'
export const SITE_FONT_STORAGE_KEY = 'sb_font_scale_v1'

export const SITE_THEME_OPTIONS: { id: SiteThemeMode; label: string; description: string }[] = [
  { id: 'light', label: 'Light', description: 'White background, high contrast.' },
  { id: 'dark', label: 'Dark', description: 'Black background; enables Tailwind `dark:` on the site.' },
  { id: 'newspaper', label: 'Paper', description: 'Greyscale newsprint style, serif body.' },
  {
    id: 'seekbox',
    label: 'Brand',
    description: 'X.SeekBoxAI brand palette — cool white bg, navy text, cobalt accents.',
  },
]

export function readSiteTheme(): SiteThemeMode {
  if (typeof window === 'undefined') return 'light'
  try {
    const v = window.localStorage.getItem(SITE_THEME_STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'newspaper' || v === 'seekbox') return v
    const legacy = window.localStorage.getItem(SITE_THEME_LEGACY_KEY)
    if (legacy === 'light') return 'light'
    if (legacy === 'dark') return 'dark'
    return 'light'
  } catch {
    return 'light'
  }
}

export function writeSiteTheme(theme: SiteThemeMode): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SITE_THEME_STORAGE_KEY, theme)
  } catch {
    /* noop */
  }
}

export function readSiteFontScale(): SiteFontScale {
  if (typeof window === 'undefined') return 0
  try {
    const raw = window.localStorage.getItem(SITE_FONT_STORAGE_KEY)
    const n = raw ? Number(raw) : 0
    if (n === 1 || n === 2) return n
    return 0
  } catch {
    return 0
  }
}

export function writeSiteFontScale(scale: SiteFontScale): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SITE_FONT_STORAGE_KEY, String(scale))
  } catch {
    /* noop */
  }
}

export function siteFontPx(scale: SiteFontScale): number {
  return scale === 2 ? 18 : scale === 1 ? 17 : 16
}

export function siteFontPxForViewport(scale: SiteFontScale, viewportWidth: number): number {
  const base = siteFontPx(scale)
  if (viewportWidth >= 1920) return base - 1
  if (viewportWidth >= 1536) return base - 0.5
  return base
}

/** Apply theme to `<html>` + `theme-color` (matches `__root` behavior). */
export function applySiteThemeToDocument(theme: SiteThemeMode): void {
  if (typeof document === 'undefined') return
  const el = document.documentElement
  el.dataset.theme = theme
  if (theme === 'dark') el.classList.add('dark')
  else el.classList.remove('dark')

  let meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    document.head.appendChild(meta)
  }
  if (theme === 'seekbox') meta.setAttribute('content', '#1B2A4A')
  else if (theme === 'dark') meta.setAttribute('content', '#000000')
  else if (theme === 'newspaper') meta.setAttribute('content', '#111111')
  else meta.setAttribute('content', '#FFFFFF')
}

export function applySiteFontToDocument(scale: SiteFontScale): void {
  if (typeof document === 'undefined') return
  const viewportWidth = typeof window === 'undefined' ? 0 : window.innerWidth
  document.documentElement.dataset.fontScale = String(scale)
  document.documentElement.style.fontSize = `${siteFontPxForViewport(scale, viewportWidth)}px`
}
