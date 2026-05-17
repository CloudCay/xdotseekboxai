const AUTH_ERROR_KEYS = ['error', 'error_code', 'error_description', 'authError'] as const

function maybeDecode(value: string): string {
  let current = value.replace(/\+/g, ' ')
  for (let i = 0; i < 2; i += 1) {
    try {
      const next = decodeURIComponent(current)
      if (next === current) break
      current = next
    } catch {
      break
    }
  }
  return current.trim()
}

function readParam(search: URLSearchParams, hash: URLSearchParams, key: string): string | null {
  return search.get(key) || hash.get(key)
}

function authParamsFromLocation(location: Location): { search: URLSearchParams; hash: URLSearchParams } {
  return {
    search: new URLSearchParams(location.search),
    hash: new URLSearchParams(location.hash.startsWith('#') ? location.hash.slice(1) : location.hash),
  }
}

export function getAuthErrorMessageFromLocation(location: Location = window.location): string | null {
  const { search, hash } = authParamsFromLocation(location)
  const rawDescription = readParam(search, hash, 'authError') || readParam(search, hash, 'error_description')
  const rawCode = readParam(search, hash, 'error_code') || readParam(search, hash, 'error')
  const description = rawDescription ? maybeDecode(rawDescription) : ''
  const code = rawCode ? maybeDecode(rawCode) : ''

  if (!description && !code) return null

  if (/unable to exchange external code/i.test(description)) {
    return [
      'Social sign-in reached Supabase, but Supabase could not exchange the provider authorization code.',
      'Check the OAuth client secret saved in Supabase and confirm the provider app uses the Supabase callback URL.',
    ].join('\n\n')
  }

  return [description || 'Sign-in failed.', code ? `Code: ${code}` : null].filter(Boolean).join('\n\n')
}

export function cleanAuthErrorUrl(location: Location = window.location): string {
  const url = new URL(location.href)
  for (const key of AUTH_ERROR_KEYS) url.searchParams.delete(key)
  url.hash = ''
  return `${url.pathname}${url.search}`
}

export function returnToWithoutAuthError(location: Location = window.location): string {
  const url = new URL(location.href)
  for (const key of AUTH_ERROR_KEYS) url.searchParams.delete(key)
  url.hash = ''
  const path = `${url.pathname}${url.search}`
  return path.startsWith('/') && !path.startsWith('//') ? path : '/'
}

export function formatAuthError(err: unknown): string {
  if (!err) return 'Sign-in failed. Please try again.'
  if (typeof err === 'string') return err
  if (typeof err === 'object') {
    const anyErr = err as Record<string, unknown>
    const msg = typeof anyErr.message === 'string' && anyErr.message.trim() ? anyErr.message.trim() : null
    const status = typeof anyErr.status === 'number' ? anyErr.status : null
    const code = typeof anyErr.code === 'string' && anyErr.code.trim() ? anyErr.code.trim() : null
    const name = typeof anyErr.name === 'string' && anyErr.name.trim() ? anyErr.name.trim() : null
    const parts = [
      msg ?? 'Sign-in failed. Please try again.',
      status != null ? `status ${status}` : null,
      code ? `code ${code}` : null,
      name ? `(${name})` : null,
    ].filter(Boolean)
    const joined = parts.join(' · ')

    if (status === 400 && msg && /api key|invalid api key|jwt/i.test(msg)) {
      return `${joined}\n\nHint: this usually means the Supabase public key or URL is wrong/rotated. Update VITE_SUPABASE_PUBLISHABLE_KEY and VITE_SUPABASE_URL, then redeploy.`
    }
    if (status === 400 && msg && /redirect/i.test(msg)) {
      return `${joined}\n\nHint: check Supabase Auth Redirect URLs and Site URL for this deployment origin.`
    }
    if (msg && /captcha/i.test(msg)) {
      return `${joined}\n\nHint: Supabase is requiring captcha. Configure Turnstile for this app or disable captcha enforcement in Supabase Auth settings.`
    }
    return joined
  }
  return 'Sign-in failed. Please try again.'
}
