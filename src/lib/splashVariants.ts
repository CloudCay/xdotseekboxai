import { supabase } from './supabase'

export interface SplashVariant {
  id: string
  enabled: boolean
  priority: number
  icon: 'zap' | 'gift' | 'star'
  headline: string
  sub: string
  bullets: string[]
  helper_text: string | null
  footer_text: string | null
  mode: 'magic' | 'navigate'
  primary_label: string
  primary_href: string | null
  secondary_label: string
  secondary_href: string | null
  referral_accent: boolean
  match_ref: string[]
  match_utm_source: string[]
  match_referer_hosts: string[]
  match_ua_patterns: string[]
}

export interface VariantSignals {
  ref: string | null
  utm_source: string | null
  ua: string | null
  referer_host: string | null
}

const cacheKey = '__sbx_splash_variants_v1'
const cacheTtlMs = 60 * 60 * 1000

type CachePayload = {
  fetchedAt: number
  variants: SplashVariant[]
}

const fallbackDefault: SplashVariant = {
  id: 'default',
  enabled: true,
  priority: 100,
  icon: 'zap',
  headline: 'Ask once. Get four answers.',
  sub: "SeekBox sends your search to ChatGPT, Claude, Gemini, and Grok in parallel, then shows the answers side-by-side. Compare them, spot disagreements, and catch the one that's making it up.",
  bullets: [
    'ChatGPT, Claude, Gemini, and Grok answer in parallel',
    'Compare side-by-side with built-in fact-check and debate modes',
    'Free anonymous session: 10 searches',
  ],
  helper_text: 'New here or already a member: same sign-in link.',
  footer_text: "We don't share your email.",
  mode: 'magic',
  primary_label: 'Email me a sign-in link',
  primary_href: null,
  secondary_label: 'Or just try one search first',
  secondary_href: null,
  referral_accent: false,
  match_ref: ['default'],
  match_utm_source: [],
  match_referer_hosts: [],
  match_ua_patterns: [],
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function normalizeVariant(raw: Partial<SplashVariant>): SplashVariant {
  const bullets = stringArray(raw.bullets)
  return {
    ...fallbackDefault,
    ...raw,
    id: typeof raw.id === 'string' && raw.id ? raw.id : fallbackDefault.id,
    icon: raw.icon === 'gift' || raw.icon === 'star' || raw.icon === 'zap' ? raw.icon : fallbackDefault.icon,
    mode: raw.mode === 'navigate' || raw.mode === 'magic' ? raw.mode : fallbackDefault.mode,
    bullets,
    match_ref: stringArray(raw.match_ref),
    match_utm_source: stringArray(raw.match_utm_source),
    match_referer_hosts: stringArray(raw.match_referer_hosts),
    match_ua_patterns: stringArray(raw.match_ua_patterns),
  }
}

function readCache(): SplashVariant[] | null {
  try {
    const raw = window.localStorage.getItem(cacheKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CachePayload>
    if (!parsed.fetchedAt || !Array.isArray(parsed.variants)) return null
    if (Date.now() - parsed.fetchedAt > cacheTtlMs) return null
    return parsed.variants.map(normalizeVariant)
  } catch {
    return null
  }
}

function writeCache(variants: SplashVariant[]): void {
  try {
    window.localStorage.setItem(cacheKey, JSON.stringify({ fetchedAt: Date.now(), variants }))
  } catch {
    // localStorage can be unavailable or full; variants can safely fall back.
  }
}

export async function loadSplashVariants(): Promise<SplashVariant[]> {
  const cached = readCache()
  if (cached && cached.length > 0) return cached

  if (!supabase) return [fallbackDefault]

  try {
    const { data, error } = await supabase
      .from('splash_variants')
      .select('*')
      .eq('enabled', true)
      .order('priority', { ascending: true })

    if (error || !data || data.length === 0) return [fallbackDefault]

    const variants = data.map((row) => normalizeVariant(row as Partial<SplashVariant>))
    writeCache(variants)
    return variants
  } catch {
    return [fallbackDefault]
  }
}

export function pickVariant(variants: SplashVariant[], signals: VariantSignals): SplashVariant {
  if (signals.ref) {
    const ref = signals.ref.toLowerCase()
    const match = variants.find((variant) => variant.match_ref.some((item) => item.toLowerCase() === ref))
    if (match) return match
  }

  if (signals.utm_source) {
    const source = signals.utm_source.toLowerCase()
    const match = variants.find((variant) => variant.match_utm_source.some((item) => item.toLowerCase() === source))
    if (match) return match
  }

  if (signals.ua) {
    const match = variants.find((variant) =>
      variant.match_ua_patterns.some((pattern) => signals.ua?.includes(pattern)),
    )
    if (match) return match
  }

  if (signals.referer_host) {
    const host = signals.referer_host.toLowerCase()
    const match = variants.find((variant) =>
      variant.match_referer_hosts.some((item) => item.toLowerCase() === host),
    )
    if (match) return match
  }

  return variants.find((variant) => variant.id === 'default') ?? fallbackDefault
}

export async function getVariantForSignals(signals: VariantSignals): Promise<SplashVariant> {
  return pickVariant(await loadSplashVariants(), signals)
}

export function clearSplashVariantsCache(): void {
  try {
    window.localStorage.removeItem(cacheKey)
  } catch {
    // no-op
  }
}
