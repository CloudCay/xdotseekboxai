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
    label: 'AI agents: X room read',
    query:
      'Search X for the current AI agents conversation: shipped products, framework releases, benchmarks, strong opinions, repeated voices, dissent, and what to watch next.',
    source: 'default',
  },
  {
    id: 'topic-markets-risk',
    kind: 'topic',
    label: 'Markets: narrative and dissent',
    query:
      'Search X for today’s market narrative: top drivers, crowded consensus, dissent, catalysts, and what could invalidate the current read.',
    source: 'default',
  },
  {
    id: 'topic-cyber',
    kind: 'topic',
    label: 'Cyber: incident chatter',
    query:
      'Search X for cyber incidents and vulnerabilities in the last 7 days: affected products, credible responders, mitigations, uncertainty, and links worth opening.',
    source: 'default',
  },
  {
    id: 'person-elon',
    kind: 'person',
    label: 'Elon Musk',
    query:
      'Search X for the current conversation around @elonmusk: notable posts or references, themes, strongest pushback, and implications.',
    source: 'default',
  },
  {
    id: 'person-satya',
    kind: 'person',
    label: 'Satya Nadella',
    query:
      'Search X for the current conversation around Satya Nadella and Microsoft: recent statements, product moves, recurring voices, dissent, and implications.',
    source: 'default',
  },
  {
    id: 'industry-semiconductors',
    kind: 'industry',
    label: 'Semiconductors',
    query:
      'Search X for the semiconductor industry pulse: earnings, guidance, supply chain, geopolitics, AI accelerator chatter, dissent, and watch items.',
    source: 'default',
  },
  {
    id: 'industry-saas',
    kind: 'industry',
    label: 'B2B SaaS',
    query:
      'Search X for the B2B SaaS pulse: pricing, churn, AI features, winners and losers, founder/operator sentiment, dissent, and actionable takeaways.',
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
