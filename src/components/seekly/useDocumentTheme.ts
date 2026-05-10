import { useEffect, useState } from 'react'
import { normalizeSeeklyTheme, type SeeklyThemeName } from './seeklyTheme'

export function useDocumentTheme(): SeeklyThemeName {
  const [theme, setTheme] = useState<SeeklyThemeName>(() => {
    if (typeof document === 'undefined') return 'light'
    return normalizeSeeklyTheme(document.documentElement.dataset.theme)
  })

  useEffect(() => {
    const root = document.documentElement
    const refresh = () => setTheme(normalizeSeeklyTheme(root.dataset.theme))
    refresh()
    const observer = new MutationObserver(refresh)
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  return theme
}
