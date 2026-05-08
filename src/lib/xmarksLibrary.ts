export type XmarksKind = 'topic' | 'person' | 'industry'

export type XmarksPreset = {
  id: string
  kind: XmarksKind
  label: string
  query: string
  source: 'default' | 'user'
}

export const DEFAULT_XMARKS_PRESETS: XmarksPreset[] = [
  {
    id: 'topic-ai-agents',
    kind: 'topic',
    label: 'AI agents: what shipped this week',
    query:
      'What shipped this week in AI agents (frameworks, releases, benchmarks)? Summarize what matters and why. Include 5-10 concrete bullets + who/what to watch next.',
    source: 'default',
  },
  {
    id: 'topic-markets-risk',
    kind: 'topic',
    label: 'Markets: today’s narrative + risks',
    query:
      'What is the current market narrative today? List the top drivers, risks, and what could invalidate the consensus.',
    source: 'default',
  },
  {
    id: 'topic-cyber',
    kind: 'topic',
    label: 'Cyber: top incidents + mitigations',
    query:
      'What are the top cyber incidents and vulnerabilities from the last 7 days? Provide brief impact, affected products, and pragmatic mitigations.',
    source: 'default',
  },
  {
    id: 'person-elon',
    kind: 'person',
    label: 'Elon Musk',
    query:
      'What are the most important things Elon Musk said/did in the last 7 days across X? Quote 2-3 notable posts if available; then summarize themes and implications.',
    source: 'default',
  },
  {
    id: 'person-satya',
    kind: 'person',
    label: 'Satya Nadella',
    query:
      'What are the most important public statements or moves by Satya Nadella in the last 7 days? Summarize themes and implications for Microsoft and the market.',
    source: 'default',
  },
  {
    id: 'industry-semiconductors',
    kind: 'industry',
    label: 'Semiconductors',
    query:
      'Semiconductors: what changed in the last 7 days (earnings, guidance, supply chain, geopolitics)? Provide a crisp summary and key watch items.',
    source: 'default',
  },
  {
    id: 'industry-saas',
    kind: 'industry',
    label: 'B2B SaaS',
    query:
      'B2B SaaS: what are the key trends and notable moves in the last 7 days (pricing, churn, AI features, winners/losers)? Provide actionable takeaways.',
    source: 'default',
  },
]

const LS_USER_PICKS_KEY = 'seekbox_xmarks_user_picks_v1'

export function loadXmarksUserPicksFromLocalStorage(): XmarksPreset[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LS_USER_PICKS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const items = parsed
      .map((x): XmarksPreset | null => {
        if (!x || typeof x !== 'object') return null
        const r = x as any
        const kind: XmarksKind | null = r.kind === 'topic' || r.kind === 'person' || r.kind === 'industry' ? r.kind : null
        const label = typeof r.label === 'string' ? r.label : null
        const query = typeof r.query === 'string' ? r.query : null
        const id = typeof r.id === 'string' ? r.id : `user-${Math.random().toString(16).slice(2)}`
        if (!kind || !label || !query) return null
        return { id, kind, label, query, source: 'user' }
      })
      .filter(Boolean) as XmarksPreset[]
    return items
  } catch {
    return []
  }
}

export function saveXmarksUserPicksToLocalStorage(picks: XmarksPreset[]) {
  if (typeof window === 'undefined') return
  try {
    const compact = picks
      .filter((p) => p.source === 'user')
      .map((p) => ({ id: p.id, kind: p.kind, label: p.label, query: p.query }))
    window.localStorage.setItem(LS_USER_PICKS_KEY, JSON.stringify(compact))
  } catch {
    /* noop */
  }
}

