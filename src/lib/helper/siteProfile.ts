import { SEEKLY_LIMITS, stripDangerousControls, truncateUtf16 } from './sanitize'
import type { HelperIntent } from './types'

export type HelperBaselineFunction = {
  id: string
  label: string
  intent: HelperIntent
  description: string
}

export type HelperRouteSupport = {
  id: string
  label: string
  routes: string[]
  routePrefix?: string
  description: string
  support: string[]
  starters: string[]
}

export const HELPER_BASELINE_FUNCTIONS: HelperBaselineFunction[] = [
  {
    id: 'explain',
    label: 'Explain product behavior',
    intent: 'help',
    description: 'Explain what a page, control, result, or data label means.',
  },
  {
    id: 'triage',
    label: 'Triage support issues',
    intent: 'support',
    description: 'Help users diagnose signin, data loading, billing, search, or route issues.',
  },
  {
    id: 'collect-feedback',
    label: 'Collect feedback',
    intent: 'feedback',
    description: 'Turn user comments into clear product feedback, bugs, ideas, or must-haves.',
  },
  {
    id: 'guide-search',
    label: 'Guide search',
    intent: 'feature',
    description: 'Help users choose cached reading, live search, ticker work, or industry pages.',
  },
  {
    id: 'roadmap',
    label: 'Discuss roadmap',
    intent: 'roadmap',
    description: 'Explain what exists now, what is planned, and what needs backend data next.',
  },
]

export const XDOT_SITE_PROFILE = {
  siteId: 'seekbox-xdot',
  productName: 'SeekBoX Pulse',
  stagingHost: 'x.seekboxai.com',
  localHost: '127.0.0.1:3001',
  positioning: 'LIVE SEEKBOX CACHE for reading X/Grok-oriented industry, ticker, and highlight data before searching live.',
  canonicalSurfaces: ['pulse_reader', 'industry_pages', 'cleanseek_x', 'ticker', 'xmarks', 'account_signin'],
} as const

export const XDOT_ROUTE_SUPPORT: HelperRouteSupport[] = [
  {
    id: 'pulse_reader',
    label: 'Pulse reader',
    routes: ['/', '/pulse'],
    description: 'Cache-first read page with lead brief, highlights, charts, citations, and source trails.',
    support: [
      'Explain LIVE SEEKBOX CACHE status and cache-first reading.',
      'Help interpret lead brief, heat, novelty, dissent, citations, and top voices.',
      'Route users to live search only when cached highlights are not enough.',
    ],
    starters: [
      'What is LIVE SEEKBOX CACHE?',
      'How should I read the lead brief?',
      'When should I use Search live instead?',
    ],
  },
  {
    id: 'industry_pages',
    label: 'Industries',
    routes: ['/industries'],
    routePrefix: '/industries/',
    description: 'Industry-specific cached pulse pages for tech SaaS, finance, sports-entertainment, and more.',
    support: [
      'Explain industry rows, pulse freshness, and what data is currently available.',
      'Suggest what structured data would make a chart or trend stronger.',
      'Help users compare cached industry narratives.',
    ],
    starters: [
      'What is this industry page showing?',
      'What data would make this chart better?',
      'How do I compare industries?',
    ],
  },
  {
    id: 'cleanseek_x',
    label: 'CleanSeek-X',
    routes: ['/cleanseek-x', '/cleanseek-x/desktop'],
    routePrefix: '/cleanseek-x/',
    description: 'Live multi-engine search console with Grok/X-forward prompts, modifiers, personas, and history.',
    support: [
      'Help choose engines, presets, prompt modifiers, and live mode.',
      'Explain personalization seed, persona text, and saved history classes.',
      'Troubleshoot backend URL, Supabase session, and streaming results.',
    ],
    starters: [
      'Which engine preset should I use?',
      'Why did live search not return X signals?',
      'How does personalization affect this search?',
    ],
  },
  {
    id: 'ticker',
    label: 'Ticker',
    routes: ['/ticker'],
    description: 'Stock-focused page for watchlists, ticker pulse prompts, and market narrative work.',
    support: [
      'Help users run ticker pulse prompts and interpret stock narratives.',
      'Explain saved watchlists, sign-in requirements, and market data limits.',
      'Route deeper market questions to live search when needed.',
    ],
    starters: [
      'How do I run a stock pulse?',
      'What is the ticker page best for?',
      'Why is my watchlist not saving?',
    ],
  },
  {
    id: 'xmarks',
    label: 'The Spot by SeekBoxAi',
    routes: ['/xmarks'],
    description: 'Prompt/library surface for saved XMarks prompts and Grok-first customer use cases.',
    support: [
      'Help users understand saved prompt sets and XMarks use cases.',
      'Collect prompt ideas or missing customer workflows.',
      'Explain how XMarks differs from the Pulse reader.',
    ],
    starters: [
      'What is The Spot?',
      'How do I save useful prompts?',
      'What Grok-first workflow should I try?',
    ],
  },
  {
    id: 'account_signin',
    label: 'Account and sign-in',
    routes: ['/account', '/signin', '/pricing', '/checkout', '/success'],
    description: 'Auth, roles, subscriptions, profile badge, personalization seed, and checkout support.',
    support: [
      'Help users understand anon, trial, advisor, admin, and superadmin states.',
      'Troubleshoot magic-link signin, Turnstile, Supabase env, and Stripe checkout states.',
      'Explain the personalization seed and searches-left badge.',
    ],
    starters: [
      'Why am I not signed in?',
      'What does my role mean?',
      'How does personalization seed work?',
    ],
  },
  {
    id: 'seekly',
    label: 'Seekly',
    routes: ['/seekly', '/helper'],
    description: 'Direct helper page and floating Seekly assistant.',
    support: [
      'Explain what Seekly can do on this site.',
      'Collect bugs, ideas, must-haves, and roadmap questions.',
      'Help route the user to the right xdot page.',
    ],
    starters: [
      'What can Seekly help with here?',
      'Where should I go for stock pulse work?',
      'Where should I report a bug?',
    ],
  },
]

export function getXdotRouteSupport(pathname: string): HelperRouteSupport {
  const path = normalizePath(pathname)
  return (
    XDOT_ROUTE_SUPPORT.find((surface) => surface.routes.includes(path)) ??
    XDOT_ROUTE_SUPPORT.find((surface) => surface.routePrefix && path.startsWith(surface.routePrefix)) ??
    XDOT_ROUTE_SUPPORT[0]
  )
}

export function buildXdotHelperPageContext(args: {
  pathname: string
  search?: Record<string, unknown> | URLSearchParams | null
}): string {
  const pathname = normalizePath(args.pathname)
  const surface = getXdotRouteSupport(pathname)
  const parts = [
    `site=${XDOT_SITE_PROFILE.siteId}`,
    `product=${XDOT_SITE_PROFILE.productName}`,
    `positioning=${XDOT_SITE_PROFILE.positioning}`,
    `surface=${surface.id}:${surface.label}`,
    `route=${pathname}`,
    `surface_description=${surface.description}`,
    `surface_support=${surface.support.join('; ')}`,
    `baseline_functions=${HELPER_BASELINE_FUNCTIONS.map((fn) => `${fn.id}:${fn.intent}`).join(', ')}`,
  ]

  const params = pickSearchParams(args.search, ['q', 'mode', 'id', 'symbol'])
  if (params.length) parts.push(`route_params=${params.join(', ')}`)

  return truncateUtf16(stripDangerousControls(parts.join(' | ')), SEEKLY_LIMITS.pageContextChars)
}

export function starterPromptsForXdotRoute(pathname: string, activePillId: string): string[] {
  const surface = getXdotRouteSupport(pathname)
  if (activePillId === 'features' || activePillId === 'help' || activePillId === 'support') {
    return surface.starters
  }
  return []
}

function normalizePath(pathname: string): string {
  const clean = stripDangerousControls(pathname || '/').trim()
  if (!clean) return '/'
  return clean.startsWith('/') ? clean : `/${clean}`
}

function pickSearchParams(
  raw: Record<string, unknown> | URLSearchParams | null | undefined,
  allowed: string[],
): string[] {
  if (!raw) return []
  const out: string[] = []
  for (const key of allowed) {
    let value: unknown
    if (raw instanceof URLSearchParams) {
      value = raw.get(key)
    } else {
      value = raw[key]
    }
    if (value === undefined || value === null || value === '') continue
    const safe = truncateUtf16(stripDangerousControls(String(value)), key === 'id' ? 128 : 80)
    if (safe) out.push(`${key}=${safe}`)
  }
  return out
}
