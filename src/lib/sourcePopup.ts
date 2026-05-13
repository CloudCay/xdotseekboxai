export function openSourcePopup(url: string | null | undefined): boolean {
  const href = normalizeHttpUrl(url)
  if (!href || typeof window === 'undefined') return false

  const screenWidth = window.screen?.availWidth || window.outerWidth || 1280
  const screenHeight = window.screen?.availHeight || window.outerHeight || 900
  const width = Math.min(720, Math.max(440, Math.floor(screenWidth * 0.44)))
  const height = Math.min(880, Math.max(560, Math.floor(screenHeight * 0.86)))
  const left = Math.max(0, (window.screenX || 0) + (window.outerWidth || screenWidth) - width - 24)
  const top = Math.max(0, (window.screenY || 0) + 48)
  const features = [
    'popup=yes',
    'resizable=yes',
    'scrollbars=yes',
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
  ].join(',')

  const popup = window.open(href, 'seekbox-source-popout', features)
  if (popup) {
    popup.opener = null
    popup.focus()
    return true
  }

  return Boolean(window.open(href, '_blank', 'noopener,noreferrer'))
}

function normalizeHttpUrl(url: string | null | undefined): string | null {
  const trimmed = (url ?? '').trim()
  if (!trimmed) return null
  if (!/^https?:\/\//i.test(trimmed)) return null
  return trimmed
}
