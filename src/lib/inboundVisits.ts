import { supabase } from './supabase'

const sessionCookie = '__sbx_session_id'
const sessionCookieMaxAge = 60 * 60 * 24 * 30

export interface ClientSignals {
  ref_explicit: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  referer_host: string | null
  referer_full: string | null
  ua_raw: string | null
  ua_in_app: string | null
  device_class: string | null
  os_family: string | null
  language: string | null
  timezone: string | null
  path: string
}

export type SplashAction =
  | 'shown'
  | 'submit_email'
  | 'try_search'
  | 'navigate_secondary'
  | 'navigate_primary'

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^|; )${name}=([^;]+)`))
  return match ? decodeURIComponent(match[2]) : null
}

function writeCookie(name: string, value: string, maxAge: number): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`
}

export function getOrCreateSessionId(): string {
  const existing = readCookie(sessionCookie)
  if (existing) return existing

  const id = crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  writeCookie(sessionCookie, id, sessionCookieMaxAge)
  return id
}

function parseUaInApp(ua: string): string | null {
  if (/Instagram/.test(ua)) return 'instagram'
  if (/FBAN\/|FBAV\//.test(ua)) return 'facebook'
  if (/TwitterAndroid|Twitter for/.test(ua)) return 'twitter'
  if (/LinkedInApp\//.test(ua)) return 'linkedin'
  return null
}

function parseDeviceClass(ua: string): string {
  if (/bot|crawl|slurp|spider/i.test(ua)) return 'bot'
  if (/iPad/.test(ua)) return 'tablet'
  if (/Android/.test(ua) && !/Mobile/.test(ua)) return 'tablet'
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return 'phone'
  return 'desktop'
}

function parseOsFamily(ua: string): string | null {
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  if (/Macintosh|Mac OS X/.test(ua)) return 'macos'
  if (/Windows/.test(ua)) return 'windows'
  if (/Linux/.test(ua)) return 'linux'
  return null
}

function getRefererParts(): { full: string | null; host: string | null } {
  const full = document.referrer || null
  if (!full) return { full: null, host: null }
  try {
    const url = new URL(full)
    return { full, host: url.hostname }
  } catch {
    return { full, host: null }
  }
}

function readBootParams(): {
  ref: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
} {
  const empty = { ref: null, utm_source: null, utm_medium: null, utm_campaign: null }
  try {
    const raw = window.sessionStorage.getItem('_sb_utm')
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      ref: typeof parsed.ref === 'string' ? parsed.ref : typeof parsed.raw_ref === 'string' ? parsed.raw_ref : null,
      utm_source: typeof parsed.utm_source === 'string' ? parsed.utm_source : null,
      utm_medium: typeof parsed.utm_medium === 'string' ? parsed.utm_medium : null,
      utm_campaign: typeof parsed.utm_campaign === 'string' ? parsed.utm_campaign : null,
    }
  } catch {
    return empty
  }
}

function readStoredReferral(): string | null {
  try {
    return (
      window.localStorage.getItem('__sbx_ref_source') ||
      window.localStorage.getItem('sbx_ref') ||
      window.sessionStorage.getItem('__sbx_ref_source')
    )
  } catch {
    return null
  }
}

export function collectClientSignals(): ClientSignals {
  const params = new URLSearchParams(window.location.search)
  const boot = readBootParams()
  const ua = navigator.userAgent || ''
  const { full, host } = getRefererParts()

  let timezone: string | null = null
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null
  } catch {
    timezone = null
  }

  return {
    ref_explicit: params.get('ref') || boot.ref || readStoredReferral(),
    utm_source: params.get('utm_source') || boot.utm_source,
    utm_medium: params.get('utm_medium') || boot.utm_medium,
    utm_campaign: params.get('utm_campaign') || boot.utm_campaign,
    referer_host: host,
    referer_full: full,
    ua_raw: ua || null,
    ua_in_app: ua ? parseUaInApp(ua) : null,
    device_class: ua ? parseDeviceClass(ua) : null,
    os_family: ua ? parseOsFamily(ua) : null,
    language: navigator.language || null,
    timezone,
    path: window.location.pathname || '/',
  }
}

export async function recordVisit(args: {
  signals: ClientSignals
  variantId: string
  action: SplashAction
  email?: string
}): Promise<void> {
  if (!supabase) return
  const sessionId = getOrCreateSessionId()
  if (!sessionId) return

  try {
    const { error } = await supabase.from('inbound_visits').insert({
      session_id: sessionId,
      path: args.signals.path,
      ref_explicit: args.signals.ref_explicit,
      utm_source: args.signals.utm_source,
      utm_medium: args.signals.utm_medium,
      utm_campaign: args.signals.utm_campaign,
      referer_host: args.signals.referer_host,
      referer_full: args.signals.referer_full,
      ua_raw: args.signals.ua_raw,
      ua_in_app: args.signals.ua_in_app,
      device_class: args.signals.device_class,
      os_family: args.signals.os_family,
      language: args.signals.language,
      timezone: args.signals.timezone,
      inferred_channel: args.variantId,
      splash_variant_shown: args.variantId,
      splash_action: args.action,
      email_captured: args.email ?? null,
    })

    if (error) console.warn('[inbound_visits] insert returned error', error)
  } catch (err) {
    console.warn('[inbound_visits] insert threw', err)
  }
}
