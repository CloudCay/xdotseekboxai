import type { AccountProfileSummary } from './accountProfileSummary'

export const PERSONALIZATION_SEED_STORAGE_KEY = 'seekbox_personalization_seed_v1'

export type PersonalizationLevel = 'base' | 'advisor' | 'admin' | 'superadmin'

export type SearchHistoryClass =
  | 'market_watch'
  | 'industry_pulse'
  | 'company_research'
  | 'competitive_intel'
  | 'technical_research'
  | 'customer_support'
  | 'creative_ideation'
  | 'personal_research'
  | 'general_research'

export type PersonalizationSeed = {
  enabled: boolean
  profileNote: string
  preferredLens: string
  historyClassing: boolean
}

export type SearchHistoryClassification = {
  primary: SearchHistoryClass
  label: string
  confidence: 'low' | 'medium' | 'high'
  signals: string[]
}

export type PersonalizationContext = {
  enabled: boolean
  level: PersonalizationLevel
  levelLabel: string
  roleId: string
  roleLabel: string
  profileNote: string
  preferredLens: string
  explicitPersonaText: string
  promptSuffix: string
  historyClass: SearchHistoryClassification
  metadata: {
    version: 1
    enabled: boolean
    level: PersonalizationLevel
    roleId: string
    preferredLens: string | null
    hasProfileNote: boolean
    hasExplicitPersona: boolean
    historyClass: SearchHistoryClassification
  }
}

export const DEFAULT_PERSONALIZATION_SEED: PersonalizationSeed = {
  enabled: true,
  profileNote: '',
  preferredLens: '',
  historyClassing: true,
}

const LEVEL_LABELS: Record<PersonalizationLevel, string> = {
  base: 'Base personalization',
  advisor: 'Advisor personalization',
  admin: 'Admin personalization',
  superadmin: 'Superadmin personalization',
}

const HISTORY_CLASS_LABELS: Record<SearchHistoryClass, string> = {
  market_watch: 'Market watch',
  industry_pulse: 'Industry pulse',
  company_research: 'Company research',
  competitive_intel: 'Competitive intel',
  technical_research: 'Technical research',
  customer_support: 'Customer support',
  creative_ideation: 'Creative ideation',
  personal_research: 'Personal research',
  general_research: 'General research',
}

export function personalizationLevelForRole(roleId: string | null | undefined): PersonalizationLevel {
  const role = normalizeRole(roleId)
  if (role === 'superadmin' || role === 'god') return 'superadmin'
  if (role === 'admin') return 'admin'
  if (role === 'advisor') return 'advisor'
  return 'base'
}

export function personalizationLevelLabel(level: PersonalizationLevel): string {
  return LEVEL_LABELS[level]
}

export function defaultLensForLevel(level: PersonalizationLevel): string {
  switch (level) {
    case 'advisor':
      return 'Frame results for a trusted advisor: implications, decisions, and client-ready next steps.'
    case 'admin':
      return 'Frame results for an operator/admin: settings, risks, ownership, and what to change next.'
    case 'superadmin':
      return 'Frame results for a founder/operator: architecture, data contracts, debugging, economics, and growth experiments.'
    case 'base':
    default:
      return 'Keep results relevant to the stated persona and classify the search for history.'
  }
}

export function loadPersonalizationSeed(): PersonalizationSeed {
  if (typeof window === 'undefined') return { ...DEFAULT_PERSONALIZATION_SEED }
  try {
    const raw = window.localStorage.getItem(PERSONALIZATION_SEED_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PERSONALIZATION_SEED }
    const parsed = JSON.parse(raw) as Partial<PersonalizationSeed>
    return normalizePersonalizationSeed(parsed)
  } catch {
    return { ...DEFAULT_PERSONALIZATION_SEED }
  }
}

export function savePersonalizationSeed(seed: PersonalizationSeed): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      PERSONALIZATION_SEED_STORAGE_KEY,
      JSON.stringify(normalizePersonalizationSeed(seed)),
    )
  } catch {
    // Storage can be unavailable in private windows.
  }
}

export function normalizePersonalizationSeed(seed: Partial<PersonalizationSeed>): PersonalizationSeed {
  return {
    enabled: seed.enabled !== false,
    profileNote: cleanShortText(seed.profileNote, 800),
    preferredLens: cleanShortText(seed.preferredLens, 500),
    historyClassing: seed.historyClassing !== false,
  }
}

export function classifySearchHistory(query: string): SearchHistoryClassification {
  const q = query.toLowerCase()
  const signals: string[] = []

  const hasAny = (words: string[]) => {
    const hit = words.find((word) => q.includes(word))
    if (hit) signals.push(hit)
    return Boolean(hit)
  }

  const isTicker =
    /\$[a-z]{1,6}\b/i.test(query) ||
    (/^[A-Z]{1,6}$/.test(query.trim()) && query.trim().length <= 6) ||
    hasAny(['stock', 'earnings', 'equity', 'price target', 'market cap', 'valuation', 'trader'])

  if (isTicker) return historyClass('market_watch', signals, signals.length > 1 ? 'high' : 'medium')
  if (hasAny(['industry', 'sector', 'pulse', 'narrative', 'sentiment', 'trend', 'trending'])) {
    return historyClass('industry_pulse', signals, 'medium')
  }
  if (hasAny(['competitor', 'competitive', 'versus', ' vs ', 'battlecard', 'positioning'])) {
    return historyClass('competitive_intel', signals, 'medium')
  }
  if (hasAny(['company', 'customer', 'account', 'prospect', 'sales', 'pipeline'])) {
    return historyClass('company_research', signals, 'medium')
  }
  if (hasAny(['api', 'backend', 'frontend', 'code', 'bug', 'database', 'supabase', 'netlify', 'cloudflare'])) {
    return historyClass('technical_research', signals, 'medium')
  }
  if (hasAny(['support', 'help', 'signin', 'login', 'billing', 'checkout', 'broken'])) {
    return historyClass('customer_support', signals, 'medium')
  }
  if (hasAny(['idea', 'brainstorm', 'creative', 'copy', 'theme', 'design', 'brand'])) {
    return historyClass('creative_ideation', signals, 'medium')
  }
  if (hasAny(['me ', 'my ', 'personal', 'career', 'learn', 'goal'])) {
    return historyClass('personal_research', signals, 'low')
  }
  return historyClass('general_research', [], 'low')
}

export function buildPersonalizationContext(args: {
  profile: Pick<AccountProfileSummary, 'roleId' | 'roleLabel'> | null
  seed?: PersonalizationSeed | null
  query: string
  explicitPersonaText?: string | null
}): PersonalizationContext {
  const roleId = normalizeRole(args.profile?.roleId) || 'anon'
  const roleLabel = args.profile?.roleLabel || humanizeRole(roleId)
  const level = personalizationLevelForRole(roleId)
  const seed = normalizePersonalizationSeed(args.seed ?? DEFAULT_PERSONALIZATION_SEED)
  const explicitPersonaText = cleanShortText(args.explicitPersonaText, 1200)
  const profileNote = cleanShortText(seed.profileNote, 800)
  const customPreferredLens = cleanShortText(seed.preferredLens, 500)
  const preferredLens = customPreferredLens || defaultLensForLevel(level)
  const classification = seed.historyClassing
    ? classifySearchHistory(args.query)
    : historyClass('general_research', [], 'low')
  const enabled = seed.enabled && (Boolean(profileNote) || Boolean(customPreferredLens) || Boolean(explicitPersonaText))
  const promptSuffix = ''

  return {
    enabled,
    level,
    levelLabel: personalizationLevelLabel(level),
    roleId,
    roleLabel,
    profileNote,
    preferredLens,
    explicitPersonaText,
    promptSuffix,
    historyClass: classification,
    metadata: {
      version: 1,
      enabled,
      level,
      roleId,
      preferredLens: enabled ? preferredLens : null,
      hasProfileNote: Boolean(profileNote),
      hasExplicitPersona: Boolean(explicitPersonaText),
      historyClass: classification,
    },
  }
}

export function appendPersonalizationToQuery(query: string, context: PersonalizationContext): string {
  return context.promptSuffix ? `${query}${context.promptSuffix}` : query
}

export function searchHistoryClassLabel(id: SearchHistoryClass): string {
  return HISTORY_CLASS_LABELS[id]
}

function historyClass(
  primary: SearchHistoryClass,
  signals: string[],
  confidence: SearchHistoryClassification['confidence'],
): SearchHistoryClassification {
  return {
    primary,
    label: HISTORY_CLASS_LABELS[primary],
    confidence,
    signals: Array.from(new Set(signals)).slice(0, 5),
  }
}

function cleanShortText(raw: unknown, max: number): string {
  if (typeof raw !== 'string') return ''
  return raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function normalizeRole(raw: string | null | undefined): string {
  return raw?.trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_') ?? ''
}

function humanizeRole(role: string): string {
  return role
    .split(/[_-]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
