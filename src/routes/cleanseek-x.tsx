import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router'
import { getClientId } from '../lib/clientId'
import { WhalesEditionPanel } from '../components/WhalesEditionPanel'
import {
  composeCleanseekPrompt,
  bestResponseLengthForLimit,
  isResponseLengthAllowed,
  MODIFIER_FLAGS,
  REASONING_STYLES,
  RESPONSE_LENGTH_LEVELS,
  TONE_LEVELS,
  type ModifierFlag,
  type PromptModifierSnapshot,
  type ReasoningStyle,
} from '../lib/cleanseekPromptModifiers'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Code2,
  Copy,
  ExternalLink,
  LogOut,
  MessagesSquare,
  Mic,
  Quote,
  Radio,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Wrench,
} from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { ensureAccount } from '../lib/ensureAccount'
import { optionalEnv } from '../lib/env'
import { IconNavButton } from '../components/IconNav'
import { XSiteHeader } from '../components/XSiteHeader'
import { CLEANSEEK_QUERY_MAX_CHARS, compactCleanseekQuery } from '../lib/cleanseekUrl'
import { bestPostCount, formatCompactNumber, metricBasisLabel, type PulseRunMetrics } from '../lib/pulseMetrics'
import {
  getAccountProfileSummary,
  getLocalAccountProfileSummary,
  incrementSessionSearchCount,
  type AccountProfileSummary,
} from '../lib/accountProfileSummary'
import {
  DEFAULT_XMARKS_PRESETS,
  loadXmarksUserPicksFromLocalStorage,
  saveXmarksUserPicksToLocalStorage,
  type XmarksKind,
  type XmarksPreset,
} from '../lib/xmarksLibrary'
import {
  buildPersonalizationContext,
  loadPersonalizationSeed,
  type PersonalizationContext,
  type PersonalizationSeed,
  type SearchHistoryClassification,
} from '../lib/personalization'

export const Route = createFileRoute('/cleanseek-x')({
  component: CleanSeekXMobileRoute,
})

const RECENCY_INSTRUCTION =
  ' [LIVE MODE: Prioritize information from the past 7 days. If you have live web or X (Twitter) access, format your response with the sections below. If you do not have live X access, write the literal text \"No live X signals available\" at the top, then answer normally.\n\n**Live pulse:** one sentence summarizing the current state.\n\n**Top X posts:** quote 2-3 recent posts in the format `> @handle - timestamp: post text` (only real posts, never fabricate).\n\n**Sentiment:** one word — Positive, Negative, Mixed, or Neutral.\n\n**Trending:** 1-3 hashtags or short phrases dominating the conversation.\n\nAfter those sections, answer the user\'s question normally.]'
const RECENCY_INSTRUCTION_COMPACT =
  ' [LIVE MODE: Prioritize information from the past 7 days. If live web/X access is unavailable, say \"No live X signals available\" and answer normally.]'
const XMARKS_SYNTHESIS_INSTRUCTION =
  ' [XMARKS MODE: Public X conversation read, not stored-post search. Use sections: **Brief:** meaning in 2-4 sentences. **Evidence refs:** 3-6 bullets as `@handle | stance/topic | real X/Twitter URL or no link | short excerpt`; never invent URLs, timestamps, metrics, or post IDs. **Voices:** repeated handles/groups. **Dissent:** strongest pushback. **What to watch:** 2-3 next signals.]'
const RAW_X_PLAYGROUND_INSTRUCTION =
  ' [RAW X PLAYGROUND MODE: Internal diagnostic. Use sections: **Access check:** live X vs web snippets vs model-only. **Raw signals:** handles, real X URLs/post IDs, timestamps, short excerpts only when available. **Unavailable:** what cannot be verified. **Synthesis:** short read. Never fabricate URLs, timestamps, metrics, or post IDs.]'

type PresetId = 'quick' | 'research' | 'web' | 'allin'
type Preset = { id: PresetId; label: string; emoji: string; engineIds: string[] }
type ProviderKind = 'model' | 'search'
type ProviderCatalogEntry = { id: string; label: string; kind: ProviderKind }

const PRESETS: Preset[] = [
  { id: 'quick', label: 'Quick', emoji: '⚡', engineIds: ['chatgpt'] },
  { id: 'research', label: 'Research', emoji: '🔬', engineIds: ['claude', 'chatgpt', 'gemini'] },
  { id: 'web', label: 'Web', emoji: '🌐', engineIds: ['tavily', 'chatgptsearch', 'brave', 'groksearch'] },
  /** Empty list = use every engine that’s checked in “Engines for All In” (same rule as main `/cleanseek`). */
  { id: 'allin', label: 'All In', emoji: '🚀', engineIds: [] },
]

/** Must stay aligned with backend `enabledProviders` ids (see mobile `DEFAULT_ENGINES`; omit `wiki`). */
const ENGINE_CATALOG: ProviderCatalogEntry[] = [
  { id: 'tavily', label: 'Tavily', kind: 'search' },
  { id: 'chatgpt', label: 'ChatGPT', kind: 'model' },
  { id: 'claude', label: 'Claude', kind: 'model' },
  { id: 'gemini', label: 'Gemini', kind: 'model' },
  { id: 'grok', label: 'xAI', kind: 'model' },
  { id: 'grok4', label: 'xAI Reasoning', kind: 'model' },
  { id: 'brave', label: 'Brave', kind: 'search' },
  { id: 'chatgptsearch', label: 'GPT Search', kind: 'search' },
  { id: 'groksearch', label: 'Live Web', kind: 'search' },
  { id: 'grokx', label: 'Live X', kind: 'search' },
]

const ENGINE_LABEL_BY_ID = new Map(ENGINE_CATALOG.map((engine) => [engine.id, engine.label]))
const PROVIDER_KIND_BY_ID = new Map(ENGINE_CATALOG.map((engine) => [engine.id, engine.kind]))
const DEFAULT_SEEKBOX_API_URL = 'https://api.seekbox.ai'
const LEGACY_SEARCH_API_URL = 'https://ruffled-snail.vibecode.run'
const UI_SEARCH_QUERY_MAX_CHARS = 5000
const INTERNET_SEARCH_QUERY_MAX_CHARS = CLEANSEEK_QUERY_MAX_CHARS
const BACKEND_SEARCH_QUERY_MAX_CHARS = 2000
const INTERNET_SEARCH_CAPPED_PROVIDER_IDS = new Set(['tavily', 'brave', 'chatgptsearch', 'groksearch', 'wikimedia', 'wiki'])
const INTERNET_RESULT_PROVIDER_IDS = new Set(['tavily', 'brave', 'wikimedia', 'wiki'])
const LIVE_X_PROVIDER_IDS = new Set(['grokx'])
const CHAT_ROUTE_PROVIDER_CONFIGS: Partial<Record<string, { provider: string; model: string }>> = {
  chatgpt: { provider: 'openai', model: 'gpt-4o' },
  gemini: { provider: 'google-ai-studio', model: 'gemini-2.5-flash' },
  groksearch: { provider: 'xai', model: 'grok-web' },
}
const SEARCH_ROUTE_PROVIDER_CONFIGS: Partial<
  Record<string, { provider: 'tavily' | 'brave'; model: string; extended: Record<string, unknown> }>
> = {
  tavily: {
    provider: 'tavily',
    model: 'tavily-search-basic',
    extended: { max_results: 6, include_answer: true },
  },
  brave: {
    provider: 'brave',
    model: 'brave-web-search',
    extended: { count: 6, safesearch: 'moderate' },
  },
}
const CLASSIC_LEGACY_SEARCH_PROVIDERS = new Set(['chatgptsearch'])

function hasInternetSearchQueryCap(providerId: string): boolean {
  return INTERNET_SEARCH_CAPPED_PROVIDER_IDS.has(providerId)
}

function isLiveXProvider(providerId: string): boolean {
  return LIVE_X_PROVIDER_IDS.has(providerId)
}

function isInternetResultProvider(providerId: string): boolean {
  return INTERNET_RESULT_PROVIDER_IDS.has(providerId)
}

function providerKind(providerId: string): ProviderKind {
  return PROVIDER_KIND_BY_ID.get(providerId) ?? 'model'
}

function providerKindLabel(providerId: string): string {
  return providerKind(providerId) === 'search' ? 'Search' : 'Model'
}

function providerMix(ids: string[]): { models: number; search: number; total: number } {
  return ids.reduce(
    (acc, id) => {
      if (providerKind(id) === 'search') acc.search += 1
      else acc.models += 1
      acc.total += 1
      return acc
    },
    { models: 0, search: 0, total: 0 },
  )
}

function formatProviderMix(ids: string[]): string {
  const mix = providerMix(ids)
  const parts: string[] = []
  if (mix.models) parts.push(`${mix.models} model${mix.models === 1 ? '' : 's'}`)
  if (mix.search) parts.push(`${mix.search} search source${mix.search === 1 ? '' : 's'}`)
  return parts.join(' / ') || '0 selected'
}

function formatProviderMixCompact(ids: string[]): string {
  const mix = providerMix(ids)
  if (!mix.total) return '0'
  if (!mix.search) return `${mix.models}M`
  if (!mix.models) return `${mix.search}S`
  return `${mix.models}M ${mix.search}S`
}

function compactInternetSearchQuery(queryText: string, maxChars = INTERNET_SEARCH_QUERY_MAX_CHARS): string {
  return compactCleanseekQuery(queryText, maxChars)
}

function compactBackendSearchQuery(queryText: string, maxChars = BACKEND_SEARCH_QUERY_MAX_CHARS): string {
  const normalized = queryText.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxChars) return normalized
  const note = ' [Trimmed to fit search request limits.]'
  const budget = Math.max(1, maxChars - note.length)
  return `${compactCleanseekQuery(normalized, budget)}${note}`.slice(0, maxChars)
}

function buildLiveXSearchQuery(rawQuery: string, instructions: string[], maxChars = BACKEND_SEARCH_QUERY_MAX_CHARS): string {
  const raw = rawQuery.replace(/\s+/g, ' ').trim()
  if (!raw) return ''

  let out = raw.length <= maxChars ? raw : compactCleanseekQuery(raw, maxChars)
  for (const instruction of instructions) {
    const normalized = instruction.replace(/\s+/g, ' ').trim()
    if (!normalized) continue
    const suffix = normalized.startsWith('[') ? ` ${normalized}` : ` [${normalized}]`
    const candidate = `${out}${suffix}`
    if (candidate.length <= maxChars) out = candidate
  }
  return out
}

function displayEngineName(providerId: string, rawName?: string | null): string {
  const rawMapped = rawName ? ENGINE_LABEL_BY_ID.get(rawName) : null
  if (rawMapped) return rawMapped
  const mapped = ENGINE_LABEL_BY_ID.get(providerId)
  if (mapped) return mapped
  return (rawName ?? providerId)
    .replace(/\bGrok\s*X\b/gi, 'Live X')
    .replace(/\bGrok\s*Web\b/gi, 'Live Web')
    .replace(/\bGrok\s*4\b/gi, 'xAI Reasoning')
    .replace(/\bGrok\b/gi, 'xAI')
}

const ENABLED_ENGINES_STORAGE_KEY = 'seekbox_cleanseek_x_enabled_engines_v1'
const ENGINE_PICK_MODE_KEY = 'seekbox_cleanseek_x_engine_pick_mode_v1'
const PRESET_ENGINES_STORAGE_KEY = 'seekbox_cleanseek_x_preset_engines_v1'

/** `preset`: Quick/Web/Research use fixed lists; All In uses toggles. `custom`: always use toggles. */
type EnginePickMode = 'preset' | 'custom'

type PresetEngineOverrides = Partial<Record<PresetId, string[]>>

function loadPresetEngineOverrides(): PresetEngineOverrides {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(PRESET_ENGINES_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}

    const allowed = new Set(ENGINE_CATALOG.map((e) => e.id))
    const out: PresetEngineOverrides = {}

    for (const p of PRESETS) {
      if (p.id === 'allin') continue
      const v = (parsed as any)[p.id] as unknown
      if (!Array.isArray(v)) continue
      const ids = v.filter((id): id is string => typeof id === 'string' && allowed.has(id))
      if (ids.length) out[p.id] = ids
    }

    return out
  } catch {
    return {}
  }
}

function savePresetEngineOverrides(next: PresetEngineOverrides) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PRESET_ENGINES_STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* noop */
  }
}

function loadEnginePickModeFromKey(storageKey: string): EnginePickMode {
  // Default **custom** when unset so toggles match what runs (avoids “Web” silently overriding picks).
  if (typeof window === 'undefined') return 'custom'
  try {
    const v = window.localStorage.getItem(storageKey)
    if (v === 'preset') return 'preset'
    if (v === 'custom') return 'custom'
    return 'custom'
  } catch {
    return 'custom'
  }
}

function saveEnginePickModeToKey(storageKey: string, m: EnginePickMode) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey, m)
  } catch {
    /* noop */
  }
}

function defaultEnabledEngineIds(): string[] {
  return ENGINE_CATALOG.map((e) => e.id)
}

function loadEnabledEngines(): string[] {
  if (typeof window === 'undefined') return defaultEnabledEngineIds()
  try {
    const raw = window.localStorage.getItem(ENABLED_ENGINES_STORAGE_KEY)
    if (!raw) return defaultEnabledEngineIds()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultEnabledEngineIds()
    const allowed = new Set(ENGINE_CATALOG.map((e) => e.id))
    const filtered = parsed.filter((id): id is string => typeof id === 'string' && allowed.has(id))
    return filtered.length ? filtered : defaultEnabledEngineIds()
  } catch {
    return defaultEnabledEngineIds()
  }
}

function loadEnabledEnginesFromKey(storageKey: string, fallbackIds = defaultEnabledEngineIds()): string[] {
  if (typeof window === 'undefined') return fallbackIds
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return fallbackIds
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) return fallbackIds
    const allowed = new Set(ENGINE_CATALOG.map((e) => e.id))
    const filtered = parsed.filter((id): id is string => typeof id === 'string' && allowed.has(id))
    return filtered.length ? filtered : fallbackIds
  } catch {
    return fallbackIds
  }
}

function saveEnabledEnginesToKey(storageKey: string, ids: string[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(ids))
  } catch {
    /* noop */
  }
}

function providerIdsForPreset(preset: Preset, pickIds: string[]): string[] {
  return preset.engineIds.length > 0 ? preset.engineIds : pickIds
}

/** Single source of truth: which provider ids we send (before Grok-live append). */
function resolveSearchEngineIds(args: {
  enginePickMode: EnginePickMode
  activePreset: PresetId
  enabledEngineIds: string[]
  forceProvider?: string
  presets?: Preset[]
}): string[] {
  if (args.forceProvider) return [args.forceProvider]
  if (args.enginePickMode === 'custom') return [...args.enabledEngineIds]
  const presets = args.presets ?? PRESETS
  const preset = presets.find((p) => p.id === args.activePreset) ?? presets[0]
  if (preset.engineIds.length > 0) return [...preset.engineIds]
  return [...args.enabledEngineIds]
}

const PROMPT_MODIFIERS_STORAGE_KEY = 'seekbox_cleanseek_x_prompt_modifiers_v1'

const DEFAULT_PROMPT_MODS: PromptModifierSnapshot = {
  // All modifiers default OFF — the prompt should only be modified when the
  // user explicitly toggles or selects a control. Toggling response length on
  // still defaults to ~100 words (level 1).
  responseLengthEnabled: false,
  responseLength: 1,
  toneEnabled: false,
  toneLevel: 2,
  comprehensionEnabled: false,
  comprehensionLevel: 3,
  personaEnabled: false,
  personaText: '',
  reasoningStyle: null,
  modifierFlags: [],
}

type AnalysisModeRow = { id: string; label: string; description?: string | null }

const FALLBACK_ANALYSIS_MODES: AnalysisModeRow[] = [
  { id: 'factcheck', label: 'Fact Check' },
  { id: 'nutshell', label: 'In a Nutshell' },
  { id: 'takeaways', label: 'Key Takeaways' },
  { id: 'craap', label: 'CRAAP Test' },
  { id: 'lateral', label: 'Lateral Reading' },
  { id: 'triangulation', label: 'Triangulation' },
  { id: 'dedupe', label: 'De-duplication' },
  { id: 'sift', label: 'SIFT' },
  { id: 'pestle', label: 'PESTLE' },
  { id: 'logicBias', label: 'Logic & Bias' },
  { id: 'devilsAdvocate', label: "Devil's Advocate" },
  { id: 'trends2026', label: 'Trends 2026' },
  { id: 'steelMan', label: 'Steel Man' },
  { id: 'rhetorical', label: 'Rhetorical' },
]

const COMPREHENSION_LABELS = [
  { label: '5 Year Old', emoji: '👶' },
  { label: 'Middle School', emoji: '📚' },
  { label: 'College', emoji: '🎓' },
  { label: 'Adult', emoji: '🧑' },
  { label: 'Genius', emoji: '🧠' },
] as const

function loadPromptModsFromKey(storageKey: string): PromptModifierSnapshot {
  if (typeof window === 'undefined') return { ...DEFAULT_PROMPT_MODS }
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return { ...DEFAULT_PROMPT_MODS }
    const p = JSON.parse(raw) as Record<string, unknown>
    const flagsRaw = p.modifierFlags
    const flags = Array.isArray(flagsRaw)
      ? flagsRaw.filter((x): x is ModifierFlag =>
          x === 'tldr' || x === 'nextsteps' || x === 'counterargs' || x === 'list',
        )
      : []
    const rs = p.reasoningStyle
    const reasoningStyle: ReasoningStyle | null =
      rs === 'concise' || rs === 'stepbystep' || rs === 'exploratory' || rs === 'skeptical' ? rs : null
    return {
      ...DEFAULT_PROMPT_MODS,
      responseLengthEnabled: Boolean(p.responseLengthEnabled),
      responseLength:
        typeof p.responseLength === 'number'
          ? Math.max(0, Math.min(4, Math.round(p.responseLength)))
          : DEFAULT_PROMPT_MODS.responseLength,
      toneEnabled: Boolean(p.toneEnabled),
      toneLevel:
        typeof p.toneLevel === 'number' ? Math.max(0, Math.min(5, Math.round(p.toneLevel))) : DEFAULT_PROMPT_MODS.toneLevel,
      comprehensionEnabled: Boolean(p.comprehensionEnabled),
      comprehensionLevel:
        typeof p.comprehensionLevel === 'number'
          ? Math.max(0, Math.min(4, Math.round(p.comprehensionLevel)))
          : DEFAULT_PROMPT_MODS.comprehensionLevel,
      personaEnabled: Boolean(p.personaEnabled),
      personaText: typeof p.personaText === 'string' ? p.personaText : '',
      reasoningStyle,
      modifierFlags: flags,
    }
  } catch {
    return { ...DEFAULT_PROMPT_MODS }
  }
}

function savePromptModsToKey(storageKey: string, m: PromptModifierSnapshot) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(m))
  } catch {
    /* noop */
  }
}

function syncCleanseekUrl(q: string, useLatest: boolean, preset: PresetId) {
  if (typeof window === 'undefined') return
  const sp = new URLSearchParams()
  const compacted = compactCleanseekQuery(q)
  if (compacted) sp.set('q', compacted)
  sp.set('latest', useLatest ? '1' : '0')
  sp.set('preset', preset)
  window.history.replaceState({}, '', `${window.location.pathname}?${sp.toString()}`)
}

type EngineResult = {
  provider: string
  providerName?: string
  content: string
  status: 'loading' | 'success' | 'error'
  durationMs?: number | null
}

type RunOptions = {
  forceProvider?: string
  deepDive?: boolean
  queryOverride?: string
  replaceProvider?: boolean
}

type StreamSearchRequest = {
  providers: string[]
  query: string
  compacted: boolean
}

type SearchProviderResult = {
  title?: unknown
  url?: unknown
  snippet?: unknown
  source?: unknown
  published_at?: unknown
}

type SearchProviderResponse = {
  answer?: unknown
  results?: unknown
  latency_ms?: unknown
}

type ChatProviderJsonResponse = {
  choices?: unknown
  output_text?: unknown
  content?: unknown
  message?: unknown
  latency_ms?: unknown
}

type DevApiRequest = {
  id: string
  endpoint: string
  method: 'POST'
  headers: Record<string, string>
  providers: string[]
  compacted: boolean
  queryCharacterCount: number
  body: Record<string, unknown>
}

type PulseSearchBody = {
  scope_type: 'handle' | 'topic' | 'custom'
  scope_value: string
  handles?: string[]
  window_days: number
  max_results: number
  prompt_override?: string
}

type PulseCitation = {
  index?: number | string
  url?: string
}

type PulseSearchResponse = {
  summary?: string
  citations?: PulseCitation[]
  handles_used?: string[] | null
}

type XDiscoverResponse = {
  ok?: boolean
  access?: {
    provider?: string
    tokenConfigured?: boolean
    authorized?: boolean
    query?: string
    resultCount?: number
    matchedPostCount?: number | null
    geo?: { label?: string | null; longitude?: number; latitude?: number; radius?: string } | null
    reason?: string
  }
  signal_metrics?: PulseRunMetrics
  posts?: Array<{
    id?: string
    url?: string
    text_excerpt?: string
    created_at?: string | null
    author?: {
      username?: string
      name?: string | null
      location?: string | null
      followers_count?: number | null
    }
    public_metrics?: {
      reposts?: number
      replies?: number
      likes?: number
      quotes?: number
      impressions?: number | null
    }
    geo?: {
      full_name?: string | null
      basis?: 'geo' | 'profile_location' | 'text_match'
    }
  }>
  authors_ranked?: Array<{
    username?: string
    name?: string | null
    location?: string | null
    post_count?: number
    engagement_score?: number
    followers_count?: number | null
    cited_post_urls?: string[]
    location_basis?: string[]
  }>
  limitations?: string[]
  error?: unknown
  generatedAt?: string
}

type SavedEngineRow = {
  engine: string
  result_text: string
  is_error: boolean
  error_message: string | null
  word_count: number | null
  result_type: 'engine'
}

type LiveXContext = {
  hasNoSignal: boolean
  livePulse: string | null
  topPosts: string[]
  sentiment: string | null
  trending: string | null
}

type XEvidenceRef = {
  raw: string
  handle: string | null
  stance: string | null
  url: string | null
  postId: string | null
  excerpt: string
  linked: boolean
}

type XRunSynthesis = {
  brief: string | null
  voices: string | null
  dissent: string | null
  watch: string | null
  evidenceRefs: XEvidenceRef[]
}

type RawPlaygroundParsedSections = {
  accessCheck: string | null
  synthesis: string | null
  brief: string | null
  rawSignalLines: string[]
  topPosterLines: string[]
  unavailable: string | null
}

type RawPlaygroundSynthesisDebugItem = {
  provider: string
  providerName?: string
  status: EngineResult['status']
  liveXContext: LiveXContext
  sections: RawPlaygroundParsedSections
  synthesis: XRunSynthesis
}

type ParsedInternetResult = {
  title: string
  snippet: string
  url: string | null
  host: string | null
}

type ParsedCitationLink = {
  label: string
  marker: string | null
  url: string
  host: string | null
}

function extractMarkdownSection(raw: string, labels: string | string[]): string | null {
  const labelList = Array.isArray(labels) ? labels : [labels]
  for (const label of labelList) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const m = raw.match(
      new RegExp(`(?:^|\\n)\\s*\\*\\*${escaped}:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\s*\\*\\*[^\\n]+:\\*\\*|$)`, 'i'),
    )
    const section = m?.[1]?.trim()
    if (section) return section
  }
  return null
}

function parseLiveXContext(raw: string): LiveXContext {
  const hasNoSignal = /No live X signals available/i.test(raw)

  const livePulse = extractMarkdownSection(raw, 'Live pulse')
  const topPostsRaw = extractMarkdownSection(raw, 'Top X posts')
  const sentiment = extractMarkdownSection(raw, 'Sentiment')?.split('\n')[0]?.trim() ?? null
  const trending = extractMarkdownSection(raw, 'Trending')?.split('\n')[0]?.trim() ?? null

  const topPosts = (topPostsRaw ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 6)

  return { hasNoSignal, livePulse, topPosts, sentiment, trending }
}

function parseXRunSynthesis(raw: string, context?: LiveXContext | null): XRunSynthesis {
  const evidenceRaw =
    extractMarkdownSection(raw, ['Evidence refs', 'Raw signals', 'Evidence', 'Posts behind this', 'Top X posts']) ??
    (context?.topPosts.length ? context.topPosts.join('\n') : null)
  const evidenceRefs = parseXEvidenceRefs(evidenceRaw ?? raw)

  return {
    brief: cleanSectionText(extractMarkdownSection(raw, ['Synthesis', 'Brief', 'X synthesis', 'Live pulse']) ?? context?.livePulse ?? null),
    voices: cleanSectionText(extractMarkdownSection(raw, ['Voices', 'Key voices', 'People']) ?? null),
    dissent: cleanSectionText(extractMarkdownSection(raw, ['Dissent', 'Pushback', 'Counterpoint']) ?? null),
    watch: cleanSectionText(extractMarkdownSection(raw, ['What to watch', 'Next signals', 'Watch']) ?? null),
    evidenceRefs,
  }
}

function parseRawPlaygroundSections(raw: string): RawPlaygroundParsedSections {
  const rawSignals =
    extractMarkdownSection(raw, ['Raw signals', 'Evidence refs', 'Evidence', 'Posts behind this', 'Top X posts']) ?? ''
  const topPosters = extractMarkdownSection(raw, ['Top posters', 'Top authors', 'Ranked authors']) ?? ''

  return {
    accessCheck: cleanSectionText(extractMarkdownSection(raw, 'Access check')),
    synthesis: cleanSectionText(extractMarkdownSection(raw, ['Synthesis', 'Short synthesis', 'X synthesis'])),
    brief: cleanSectionText(extractMarkdownSection(raw, ['Brief', 'Live pulse'])),
    rawSignalLines: cleanDisplayLines(rawSignals).slice(0, 8),
    topPosterLines: cleanDisplayLines(topPosters).slice(0, 10),
    unavailable: cleanSectionText(extractMarkdownSection(raw, 'Unavailable')),
  }
}

function parseXEvidenceRefs(raw: string): XEvidenceRef[] {
  const lines = splitEvidenceLines(raw)
  const candidates = lines.length ? lines : extractXUrls(raw).map((url) => url)
  const seen = new Set<string>()
  const refs: XEvidenceRef[] = []

  for (const line of candidates) {
    const ref = parseXEvidenceLine(line)
    const key = ref.url ?? ref.raw.toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    refs.push(ref)
    if (refs.length >= 6) break
  }

  return refs
}

function splitEvidenceLines(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) =>
      line
        .trim()
        .replace(/^[-*]\s+/, '')
        .replace(/^\d+\.\s+/, '')
        .replace(/^>\s?/, ''),
    )
    .filter((line) => {
      if (!line) return false
      if (/^no live x signals available/i.test(line)) return false
      return /@\w{1,15}|https?:\/\/|no link|post id|status\/\d+/i.test(line)
    })
}

function parseXEvidenceLine(line: string): XEvidenceRef {
  const url = extractXUrls(line)[0] ?? null
  const handle = extractXHandle(line, url)
  const postId = url ? extractXPostId(url) : extractPostIdFromText(line)
  const cleanLine = cleanSectionText(line.replace(url ?? '', '').replace(/\bno link\b/gi, '')) ?? line.trim()
  const parts = cleanLine
    .split('|')
    .map((part) => cleanSectionText(part) ?? '')
    .filter(Boolean)
  const stance = cleanEvidenceLabel(
    parts.length > 1 ? (parts.find((part) => !/^@/.test(part) && !/^https?:/i.test(part)) ?? null) : null,
  )
  const excerpt = truncateText(
    cleanEvidenceLabel(
      parts
        .slice(stance ? 2 : 1)
        .join(' ')
        .trim() || cleanLine,
    ) ?? cleanLine,
    220,
  )

  return {
    raw: line.trim(),
    handle,
    stance,
    url,
    postId,
    excerpt,
    linked: Boolean(url),
  }
}

function extractXUrls(text: string): string[] {
  const urls = Array.from(text.matchAll(/https?:\/\/[^\s)]+/gi))
    .map((match) => cleanUrl(match[0]))
    .filter((url) => isXUrl(url))
  return Array.from(new Set(urls))
}

function isXUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
    return host === 'x.com' || host === 'twitter.com' || host.endsWith('.x.com') || host.endsWith('.twitter.com')
  } catch {
    return false
  }
}

function extractXHandle(text: string, url?: string | null): string | null {
  const direct = text.match(/@([A-Za-z0-9_]{1,15})/)
  if (direct?.[1]) return `@${direct[1]}`
  if (url) {
    try {
      const [, handle] = new URL(url).pathname.split('/')
      if (handle && !['i', 'intent', 'share'].includes(handle.toLowerCase())) return `@${handle}`
    } catch {
      return null
    }
  }
  return null
}

function extractXPostId(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    const statusIndex = parts.findIndex((part) => part === 'status' || part === 'statuses')
    const id = statusIndex >= 0 ? parts[statusIndex + 1] : null
    return id && /^\d{5,}$/.test(id) ? id : null
  } catch {
    return null
  }
}

function extractPostIdFromText(text: string): string | null {
  const match = text.match(/\b(?:post id|status)[:/\s]+(\d{5,})\b/i)
  return match?.[1] ?? null
}

function cleanSectionText(text: string | null): string | null {
  const cleaned = (text ?? '')
    .replace(/^\s*[-*]\s+/, '')
    .replace(/^\s*\d+\.\s+/, '')
    .replace(/\[\[(\d+)]]\([^)]+\)/g, '[$1]')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || null
}

function cleanDisplayLines(text: string | null): string[] {
  return (text ?? '')
    .split('\n')
    .map((line) =>
      cleanSectionText(
        line
          .trim()
          .replace(/^[-*]\s+/, '')
          .replace(/^\d+\.\s+/, '')
          .replace(/^>\s?/, ''),
      ),
    )
    .filter((line): line is string => Boolean(line))
}

function cleanEvidenceLabel(text: string | null): string | null {
  const cleaned = cleanSectionText(text)
  if (!cleaned) return null
  return cleaned
    .replace(/^stance\s*:\s*/i, '')
    .replace(/^topic\s*:\s*/i, '')
    .replace(/^excerpt\s*:\s*/i, '')
    .trim()
}

function truncateText(text: string, maxLength: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, Math.max(1, maxLength - 1)).trim()}…`
}

function buildPulseSearchBody(rawQuery: string, deepDive: boolean): PulseSearchBody {
  const raw = rawQuery.replace(/\s+/g, ' ').trim()
  const xUrl = extractFirstUrl(raw)
  const handleMatch = raw.match(/^@([A-Za-z0-9_]{1,15})$/)
  const base = {
    window_days: 7,
    max_results: deepDive ? 30 : 20,
  }

  if (handleMatch?.[1]) {
    return {
      ...base,
      scope_type: 'handle',
      scope_value: `@${handleMatch[1]}`,
      handles: [handleMatch[1]],
    }
  }

  if (xUrl && isXUrl(xUrl)) {
    return {
      ...base,
      scope_type: 'custom',
      scope_value: raw.slice(0, 200),
    }
  }

  return {
    ...base,
    scope_type: 'topic',
    scope_value: raw.slice(0, 200),
  }
}

function buildXDiscoverSearchBody(rawQuery: string, deepDive: boolean): Record<string, unknown> {
  return {
    query: rawQuery.replace(/\s+/g, ' ').trim().slice(0, 240),
    window_days: 7,
    max_results: deepDive ? 100 : 30,
    rank_authors: true,
  }
}

function formatXDiscoverRawPlaygroundContent(payload: XDiscoverResponse): string {
  const access = payload.access ?? {}
  const signalMetrics = payload.signal_metrics ?? null
  const posts = Array.isArray(payload.posts) ? payload.posts : []
  const authors = Array.isArray(payload.authors_ranked) ? payload.authors_ranked : []
  const limitations = Array.isArray(payload.limitations) ? payload.limitations.filter(Boolean) : []
  const geoLabel = access.geo?.label ?? (access.geo ? `${access.geo.latitude}, ${access.geo.longitude} / ${access.geo.radius}` : 'none')
  const rawSignals = posts
    .slice(0, 10)
    .map((post, index) => {
      const username = post.author?.username ? `@${post.author.username.replace(/^@/, '')}` : '@unknown'
      const basis = post.geo?.basis ?? 'text_match'
      const place = post.geo?.full_name ? ` ${post.geo.full_name}` : ''
      const metrics = post.public_metrics
        ? `likes ${post.public_metrics.likes ?? 0}, reposts ${post.public_metrics.reposts ?? 0}, replies ${post.public_metrics.replies ?? 0}`
        : 'metrics unavailable'
      const excerpt = post.text_excerpt ? truncateText(post.text_excerpt, 190) : `post ${index + 1}`
      return `- ${username} | ${basis}${place} | ${post.url ?? 'no link'} | ${metrics} | ${excerpt}`
    })
    .join('\n')
  const topPosters = authors
    .slice(0, 10)
    .map((author, index) => {
      const username = author.username ? `@${author.username.replace(/^@/, '')}` : '@unknown'
      const basis = author.location_basis?.length ? author.location_basis.join('+') : 'unknown basis'
      const location = author.location ? ` | ${author.location}` : ''
      const followers = typeof author.followers_count === 'number' ? ` | ${author.followers_count.toLocaleString()} followers` : ''
      return `- ${index + 1}. ${username} | ${author.post_count ?? 0} posts | engagement ${author.engagement_score ?? 0} | ${basis}${location}${followers}`
    })
    .join('\n')
  const topHandleText = authors
    .slice(0, 5)
    .map((author) => (author.username ? `@${author.username.replace(/^@/, '')}` : null))
    .filter(Boolean)
    .join(', ')
  const error = payload.error ? ` Error: ${typeof payload.error === 'string' ? payload.error : JSON.stringify(payload.error).slice(0, 220)}` : ''
  const volume = signalMetrics ? formatSignalMetrics(signalMetrics) : ''

  return [
    `**Access check:** /api/x-discover ${payload.ok ? 'queried X Recent Search' : 'did not return X posts'} using ${access.provider ?? 'x-api-recent-search'}. Token configured: ${access.tokenConfigured ? 'yes' : 'no'}. Authorized: ${access.authorized === false ? 'no' : 'yes'}. Query: ${access.query ?? 'not built'}. Geo: ${geoLabel}. Results: ${access.resultCount ?? posts.length}.${error}`,
    volume ? `**Observed volume:**\n${volume}` : '',
    topPosters ? `**Top posters:**\n${topPosters}` : '**Top posters:**\nNo ranked authors returned.',
    rawSignals ? `**Raw signals:**\n${rawSignals}` : '**Raw signals:**\nNo post-level records returned.',
    topHandleText ? `**Voices:**\n${topHandleText}` : '',
    limitations.length
      ? `**Unavailable:**\n${limitations.join(' ')}`
      : '**Unavailable:**\nThis endpoint exposes recent-search discovery only; it does not prove full local coverage.',
    `**Synthesis:**\n${authors.length ? `Top visible accounts from this pull: ${topHandleText || 'none'}.` : 'No ranked local X posters were available from this pull.'} ${posts.length ? `${posts.length} post records were returned for inspection.` : 'Use the access check and surfaced records to see whether this is a credentials, query, or provider-coverage issue.'}`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

function formatSignalMetrics(metrics: PulseRunMetrics): string {
  const posts = bestPostCount(metrics)
  return [
    `Posts matched: ${formatCompactNumber(posts)}`,
    `Sample inspected: ${formatCompactNumber(metrics.samplePostCount)}`,
    `Replies observed: ${formatCompactNumber(metrics.replyCount)}`,
    `Views observed: ${formatCompactNumber(metrics.viewCount)}`,
    `Basis: ${metricBasisLabel(metrics.basis)}`,
    metrics.notes ? `Note: ${metrics.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function formatPulseRawPlaygroundContent(payload: PulseSearchResponse, body: PulseSearchBody): string {
  const summary = (payload.summary ?? '').trim()
  const citations = Array.isArray(payload.citations) ? payload.citations.filter((citation) => citation.url) : []
  const handles = Array.isArray(payload.handles_used) ? payload.handles_used.filter(Boolean) : []
  const evidenceRefs = citations
    .slice(0, 8)
    .map((citation, index) => formatPulseEvidenceRef(summary, citation, index + 1))
    .join('\n')
  const firstParagraph = summary.split(/\n\n+/).find((part) => part.trim())?.trim() ?? ''
  const voices = handles.length
    ? handles.map((handle) => (handle.startsWith('@') ? handle : `@${handle}`)).join(', ')
    : extractHandlesFromText(summary).join(', ')

  return [
    `**Access check:** /v1/pulse returned ${summary ? 'an X-backed summary' : 'no summary'} for ${body.scope_type} "${body.scope_value}". Citations: ${citations.length}.`,
    summary ? `**Brief:**\n${summary}` : '**Brief:**\nNo summary returned.',
    evidenceRefs ? `**Evidence refs:**\n${evidenceRefs}` : '**Evidence refs:**\nNo linked X citations returned.',
    voices ? `**Voices:**\n${voices}` : '',
    '**Unavailable:**\nThe pulse endpoint returns summarized citations, not the full raw provider trace, provider internals, or complete post payloads.',
    firstParagraph ? `**Synthesis:**\n${firstParagraph}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

function formatPulseEvidenceRef(summary: string, citation: PulseCitation, fallbackIndex: number): string {
  const url = citation.url ? cleanUrl(String(citation.url)) : ''
  const handle = url ? (extractXHandle('', url) ?? '@unknown') : '@unknown'
  const index = citation.index ?? fallbackIndex
  const excerpt = extractPulseCitationExcerpt(summary, index) ?? `citation ${index}`
  return `- ${handle} | citation ${index} | ${url || 'no link'} | ${excerpt}`
}

function extractPulseCitationExcerpt(summary: string, index: number | string): string | null {
  const marker = `[[${index}]]`
  const markerAt = summary.indexOf(marker)
  if (markerAt < 0) return null

  const left = summary.lastIndexOf('\n', markerAt - 1)
  const nextLine = summary.indexOf('\n', markerAt)
  const right = nextLine >= 0 ? nextLine : Math.min(summary.length, markerAt + 320)
  return truncateText(
    summary
      .slice(left + 1, right)
      .replace(/\[\[\d+\]\]\([^)]+\)/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
    220,
  )
}

function extractHandlesFromText(text: string): string[] {
  const handles = Array.from(text.matchAll(/@([A-Za-z0-9_]{1,15})/g)).map((match) => `@${match[1]}`)
  return Array.from(new Set(handles)).slice(0, 8)
}

function parseInternetSearchResults(raw: string): ParsedInternetResult[] {
  const text = raw.trim()
  if (!text) return []

  const blocks = text
    .split(/\n(?=\s*\d+\.\s+)/)
    .map((block) => block.trim())
    .filter(Boolean)

  const parsed = blocks
    .map((block) => {
      const lines = block
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
      if (!lines.length) return null

      const title = lines[0].replace(/^\d+\.\s*/, '').trim()
      const url = extractFirstUrl(block)
      const snippet = lines
        .slice(1)
        .filter((line) => !/^https?:\/\//i.test(line))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()

      if (!title && !snippet && !url) return null
      return {
        title: title || url || 'Source',
        snippet,
        url,
        host: url ? safeHost(url) : null,
      }
    })
    .filter((item): item is ParsedInternetResult => Boolean(item))

  if (parsed.length) return parsed.slice(0, 8)

  const urls = Array.from(text.matchAll(/https?:\/\/[^\s)]+/gi))
    .map((match) => cleanUrl(match[0]))
    .filter(Boolean)
  return Array.from(new Set(urls))
    .slice(0, 8)
    .map((url) => ({ title: safeHost(url) ?? url, snippet: '', url, host: safeHost(url) }))
}

function parseCitationLinks(raw: string): ParsedCitationLink[] {
  const text = raw.trim()
  if (!text) return []

  const out: ParsedCitationLink[] = []
  const seen = new Set<string>()
  const add = (label: string, url: string) => {
    const clean = cleanUrl(url)
    if (!/^https?:\/\//i.test(clean) || seen.has(clean)) return
    seen.add(clean)
    out.push(citationFromHref(label, clean))
  }

  for (const match of text.matchAll(/\[\[([^\]]{1,80})]]\((https?:\/\/[^)\s]+)\)/g)) {
    add(match[1] ?? '', match[2] ?? '')
  }
  for (const match of text.matchAll(/\[([^\]]{1,120})]\((https?:\/\/[^)\s]+)\)/g)) {
    add(match[1] ?? '', match[2] ?? '')
  }
  for (const match of text.matchAll(/https?:\/\/[^\s)]+/gi)) {
    add('', match[0])
  }

  return out.slice(0, 8)
}

function citationFromHref(label: string, href: string): ParsedCitationLink {
  const cleanedLabel = cleanCitationLabel(label)
  return {
    label: cleanedLabel || sourceLabelForUrl(href),
    marker: citationMarker(cleanedLabel),
    url: cleanUrl(href),
    host: safeHost(href),
  }
}

function sourceLabelForUrl(url: string): string {
  return extractXHandle('', url) ?? safeHost(url) ?? 'Source'
}

function cleanCitationLabel(label: string): string {
  return label.replace(/^\[|\]$/g, '').replace(/\s+/g, ' ').trim()
}

function citationMarker(label: string): string | null {
  const clean = cleanCitationLabel(label)
  const numeric = clean.match(/^(?:source|cite|ref|citation)?\s*#?\s*(\d{1,3})$/i)
  return numeric?.[1] ?? null
}

function isCitationMarker(label: string): boolean {
  return Boolean(citationMarker(label))
}

function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s)]+/i)
  return match ? cleanUrl(match[0]) : null
}

function cleanUrl(url: string): string {
  return url.replace(/[.,;:!?]+$/, '')
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

function formatSearchProviderContent(data: SearchProviderResponse | null): string {
  const answer = cleanSearchText(typeof data?.answer === 'string' ? data.answer : '')
  const results = Array.isArray(data?.results) ? (data.results as SearchProviderResult[]) : []
  const formattedResults = results
    .map((result, index) => formatSearchResult(result, index + 1))
    .filter((result) => result.length > 0)

  const sections = [answer, formattedResults.join('\n\n')].filter((section) => section.length > 0)
  return sections.join('\n\n') || 'No matching web results returned.'
}

function formatSearchResult(result: SearchProviderResult, index: number): string {
  const title = cleanSearchText(typeof result.title === 'string' ? result.title : '')
  const snippet = cleanSearchText(typeof result.snippet === 'string' ? result.snippet : '')
  const url = typeof result.url === 'string' ? result.url.trim() : ''
  const source = cleanSearchText(typeof result.source === 'string' ? result.source : '')
  const publishedAt = cleanSearchText(typeof result.published_at === 'string' ? result.published_at : '')
  const meta = [source, publishedAt].filter(Boolean).join(' · ')
  const lines = [`${index}. ${title || url || 'Untitled result'}`]
  if (meta) lines.push(meta)
  if (snippet) lines.push(snippet)
  if (url) lines.push(url)
  return lines.filter(Boolean).join('\n')
}

function cleanSearchText(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(parseInt(code, 16)))
}

function extractChatProviderJsonContent(data: ChatProviderJsonResponse | null): string {
  if (!data) return ''
  if (typeof data.output_text === 'string') return data.output_text.trim()
  if (typeof data.content === 'string') return data.content.trim()
  if (data.message && typeof data.message === 'object' && 'content' in data.message) {
    const content = (data.message as { content?: unknown }).content
    if (typeof content === 'string') return content.trim()
  }
  const choices = Array.isArray(data.choices) ? data.choices : []
  for (const choice of choices) {
    if (!choice || typeof choice !== 'object') continue
    const message = (choice as { message?: unknown }).message
    if (message && typeof message === 'object' && 'content' in message) {
      const content = (message as { content?: unknown }).content
      if (typeof content === 'string' && content.trim()) return content.trim()
    }
  }
  return ''
}

function normalizeBaseUrl(raw: string | undefined, fallback = ''): string {
  const v = (raw ?? fallback).trim().replace(/\/$/, '')
  if (!v) throw new Error('VITE_SEEKBOX_API_URL or VITE_BACKEND_URL environment variable is not set')
  if (!/^https?:\/\//i.test(v)) throw new Error(`Backend URL must include https:// (got: ${v})`)
  return v
}

function readViteEnv(name: string): string | null {
  const value = (import.meta.env[name] as string | undefined)?.trim()
  return value || null
}

function readBackendUrlEnv(): string | undefined {
  return (
    readViteEnv('VITE_SEEKBOX_API_URL') ??
    readViteEnv('EXPO_PUBLIC_SEEKBOX_API_URL') ??
    readViteEnv('VITE_BACKEND_URL') ??
    readViteEnv('EXPO_PUBLIC_BACKEND_URL') ??
    optionalEnv('VITE_SEEKBOX_API_URL') ??
    optionalEnv('EXPO_PUBLIC_SEEKBOX_API_URL') ??
    optionalEnv('VITE_BACKEND_URL') ??
    optionalEnv('EXPO_PUBLIC_BACKEND_URL') ??
    undefined
  )
}

function readLegacyBackendUrlEnv(): string | undefined {
  return (
    readViteEnv('VITE_LEGACY_BACKEND_URL') ??
    readViteEnv('EXPO_PUBLIC_LEGACY_BACKEND_URL') ??
    optionalEnv('VITE_LEGACY_BACKEND_URL') ??
    optionalEnv('EXPO_PUBLIC_LEGACY_BACKEND_URL') ??
    undefined
  )
}

function isSeekBoxApiBase(value: string): boolean {
  return normalizeBaseUrl(value, DEFAULT_SEEKBOX_API_URL) === DEFAULT_SEEKBOX_API_URL
}

function endpointFor(baseUrl: string, path: string): string {
  return isSeekBoxApiBase(baseUrl) ? path : `${baseUrl}${path}`
}

function searchStreamEndpoint(baseUrl: string): string {
  return endpointFor(baseUrl, '/api/search/stream')
}

function chatEndpoint(baseUrl: string): string {
  return endpointFor(baseUrl, '/v1/chat')
}

function searchResultsEndpoint(baseUrl: string): string {
  return endpointFor(baseUrl, '/v1/search')
}

function classicSearchStreamEndpoint(): string {
  const legacyBase = normalizeBaseUrl(readLegacyBackendUrlEnv(), LEGACY_SEARCH_API_URL)
  return legacyBase === LEGACY_SEARCH_API_URL ? '/legacy/search/stream' : `${legacyBase}/api/search/stream`
}

function shouldUseSplitSearchApi(baseUrl: string): boolean {
  return isSeekBoxApiBase(baseUrl)
}

async function getSupabaseAccessToken(): Promise<string | null> {
  const sb = isSupabaseConfigured ? supabase : null
  if (!sb) return null
  try {
    const { data } = await sb.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

/** Backend sometimes emits `groksearch`; CleanSeek-X UI keys engines by preset ids — normalize aliases here only when merging streams. */
function normalizeStreamProviderId(raw: string): string {
  const id = raw.trim()
  if (!id) return 'unknown'
  return id === 'grokx' ? 'groksearch' : id
}

function snapshotResults(init: Record<string, EngineResult>): Record<string, EngineResult> {
  return Object.fromEntries(Object.entries(init).map(([k, v]) => [k, { ...v }]))
}

function isOpsConsoleRole(roleId: string | null | undefined): boolean {
  const role = (roleId ?? '').trim().toLowerCase()
  return role === 'superadmin' || role === 'god' || role === 'admin' || role === 'advisor'
}

function formatDurationMs(durationMs: number | null | undefined): string | null {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs < 0) return null
  if (durationMs < 1000) return `${Math.round(durationMs)}ms`
  return `${(durationMs / 1000).toFixed(2)}s`
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  if (typeof document === 'undefined') return
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', 'true')
  ta.style.position = 'fixed'
  ta.style.left = '-9999px'
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  document.body.removeChild(ta)
}

function buildCleanseekFollowUps(query: string, results: Record<string, EngineResult>): string[] {
  const q = query.replace(/\s+/g, ' ').trim()
  if (!q) return []
  const successful = Object.values(results).filter((r) => r.status === 'success' && r.content.trim())
  if (!successful.length) return []
  const topic = q.length > 80 ? `${q.slice(0, 77).trim()}...` : q
  const hasSourceResults = successful.some((r) => isInternetResultProvider(r.provider))
  const hasModelResults = successful.some((r) => providerKind(r.provider) === 'model')
  const questions = [
    `Where do the sources disagree on ${topic}?`,
    `What claims should I verify before acting on ${topic}?`,
    `Turn this into a tighter executive brief.`,
    hasSourceResults ? `Which links are the strongest evidence for ${topic}?` : null,
    hasModelResults ? `Compare the model answers and identify the best one.` : null,
    `What should I search next about ${topic}?`,
  ].filter((item): item is string => Boolean(item))
  return Array.from(new Set(questions)).slice(0, 6)
}

function reactNodeText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map((child) => reactNodeText(child)).join('')
  if (node && typeof node === 'object' && 'props' in node) {
    const props = (node as { props?: { children?: ReactNode } }).props
    return reactNodeText(props?.children ?? '')
  }
  return ''
}

function ModelCitationInline({ citation }: { citation: ParsedCitationLink }) {
  const marker = citation.marker ?? citation.label
  const sourceLabel = sourceLabelForUrl(citation.url)
  return (
    <a
      href={citation.url}
      target="_blank"
      rel="noreferrer"
      title={citation.url}
      className="not-prose mx-0.5 inline-flex max-w-full translate-y-[-1px] items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-1.5 py-0.5 align-baseline text-[10px] font-black leading-none text-cyan-100 no-underline hover:border-cyan-300/60 hover:bg-cyan-400/15"
    >
      <span className="font-mono">{marker}</span>
      <span className="hidden max-w-[96px] truncate sm:inline">{sourceLabel}</span>
    </a>
  )
}

function ModelSourceRail({ citations }: { citations: ParsedCitationLink[] }) {
  if (!citations.length) return null
  return (
    <div className="not-prose mt-4 rounded-2xl border border-slate-700/70 bg-slate-950/35 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
        <span>Sources</span>
        <span className="rounded-full border border-slate-700 bg-black/25 px-2 py-0.5 text-slate-400">{citations.length}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {citations.map((citation, index) => {
          const sourceLabel = sourceLabelForUrl(citation.url)
          const marker = citation.marker ?? String(index + 1)
          return (
            <a
              key={`${citation.url}-${index}`}
              href={citation.url}
              target="_blank"
              rel="noreferrer"
              title={citation.url}
              className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-700 bg-black/20 px-2.5 py-1 text-[11px] font-black text-slate-200 hover:border-cyan-400/50 hover:text-cyan-100"
            >
              <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-1.5 py-0.5 font-mono text-[9px] text-cyan-100">
                {marker}
              </span>
              <span className="max-w-[150px] truncate">{sourceLabel}</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          )
        })}
      </div>
    </div>
  )
}

function InternetResultList({ items, fallback }: { items: ParsedInternetResult[]; fallback: string }) {
  if (!items.length) {
    return (
      <pre className="whitespace-pre-wrap rounded-2xl border border-slate-800 bg-black/25 p-3 text-xs leading-5 text-slate-300">
        {fallback || '...'}
      </pre>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
        <span>Source results</span>
        <span className="rounded-full border border-slate-700 bg-slate-950/40 px-2 py-0.5 text-slate-400">
          {items.length}
        </span>
      </div>
      {items.map((item, index) => (
        <div key={`${item.url ?? item.title}-${index}`} className="rounded-2xl border border-slate-700/70 bg-black/20 p-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-[10px] font-black text-cyan-100">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              {item.url ? (
                <a href={item.url} target="_blank" rel="noreferrer" className="block text-sm font-black leading-snug text-slate-100 hover:text-cyan-200">
                  {item.title}
                </a>
              ) : (
                <div className="text-sm font-black leading-snug text-slate-100">{item.title}</div>
              )}
              {item.host ? <div className="mt-1 truncate text-[11px] font-bold text-cyan-300/80">{item.host}</div> : null}
              {item.snippet ? <p className="mt-2 text-xs leading-5 text-slate-400">{item.snippet}</p> : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function RawPlaygroundDebugPanel({
  requests,
  results,
  isSearching,
}: {
  requests: DevApiRequest[]
  results: Record<string, EngineResult>
  isSearching: boolean
}) {
  const resultItems = Object.values(results).sort((a, b) => a.provider.localeCompare(b.provider))
  const synthesized = resultItems
    .filter((item) => item.content.trim())
    .map((item): RawPlaygroundSynthesisDebugItem => {
      const context = parseLiveXContext(item.content)
      return {
        provider: item.provider,
        providerName: item.providerName,
        status: item.status,
        liveXContext: context,
        sections: parseRawPlaygroundSections(item.content),
        synthesis: parseXRunSynthesis(item.content, context),
      }
    })

  return (
    <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-950/15 p-4 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-black">Raw dev console</div>
          <div className="mt-1 text-xs leading-5 text-amber-100/80">
            This shows the outbound API request, raw streamed provider output, and parsed synthesis fields.
          </div>
        </div>
        <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-100">
          {isSearching ? 'streaming' : 'idle'}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <details open className="rounded-xl border border-slate-700/70 bg-black/25 p-3">
          <summary className="cursor-pointer text-xs font-black uppercase tracking-widest text-amber-100">
            1. Sent to API
          </summary>
          {requests.length ? (
            <div className="mt-3 space-y-3">
              {requests.map((request, index) => (
                <div key={request.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400">
                    <span>Request {index + 1}</span>
                    <span className="rounded-full border border-slate-700 px-2 py-0.5 text-slate-300">
                      {request.providers.join(', ') || 'default providers'}
                    </span>
                    {request.compacted ? (
                      <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-amber-100">
                        compacted
                      </span>
                    ) : null}
                    <span>{request.queryCharacterCount.toLocaleString()} chars</span>
                  </div>
                  <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-black/40 p-3 text-[11px] leading-5 text-slate-200">
                    {JSON.stringify(
                      {
                        method: request.method,
                        endpoint: request.endpoint,
                        headers: request.headers,
                        body: request.body,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-dashed border-slate-700 p-3 text-xs text-slate-400">
              No API request has been built yet. Run a search and this section should populate before the stream returns.
            </div>
          )}
        </details>

        <details open className="rounded-xl border border-slate-700/70 bg-black/25 p-3">
          <summary className="cursor-pointer text-xs font-black uppercase tracking-widest text-amber-100">
            2. Raw results
          </summary>
          {resultItems.length ? (
            <div className="mt-3 space-y-3">
              {resultItems.map((result) => (
                <div key={result.provider} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-black text-slate-100">
                      {displayEngineName(result.provider, result.providerName)}
                    </div>
                    <span className={`text-[11px] font-bold ${result.status === 'error' ? 'text-red-300' : 'text-slate-400'}`}>
                      {result.status}
                    </span>
                  </div>
                  <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-black/40 p-3 text-[11px] leading-5 text-slate-200">
                    {result.content || (result.status === 'loading' ? 'Waiting for streamed chunks...' : '')}
                  </pre>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-dashed border-slate-700 p-3 text-xs text-slate-400">
              No raw provider result is available yet.
            </div>
          )}
        </details>

        <details open className="rounded-xl border border-slate-700/70 bg-black/25 p-3">
          <summary className="cursor-pointer text-xs font-black uppercase tracking-widest text-amber-100">
            3. Synthesized / parsed
          </summary>
          {synthesized.length ? (
            <RawPlaygroundSynthesisDebugList items={synthesized} />
          ) : (
            <div className="mt-3 rounded-lg border border-dashed border-slate-700 p-3 text-xs text-slate-400">
              Waiting for provider text before parsing synthesis fields.
            </div>
          )}
        </details>
      </div>
    </div>
  )
}

function RawPlaygroundSynthesisDebugList({ items }: { items: RawPlaygroundSynthesisDebugItem[] }) {
  return (
    <div className="mt-3 space-y-3">
      {items.map((item) => {
        const linkedCount = item.synthesis.evidenceRefs.filter((ref) => ref.linked).length
        const primarySynthesis = item.sections.synthesis ?? item.synthesis.brief
        const shouldShowBrief = item.sections.brief && item.sections.brief !== primarySynthesis
        const signalLines =
          item.sections.rawSignalLines.length > 0
            ? item.sections.rawSignalLines
            : item.synthesis.evidenceRefs.map((ref) => ref.raw)

        return (
          <div key={item.provider} className="rounded-xl border border-slate-800 bg-slate-950/65 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black text-slate-100">
                  {displayEngineName(item.provider, item.providerName)}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <span className={item.status === 'error' ? 'text-red-300' : 'text-slate-400'}>{item.status}</span>
                  {item.liveXContext.hasNoSignal ? <span className="text-amber-200">No live X signal</span> : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
                {item.synthesis.evidenceRefs.length ? (
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-emerald-100">
                    {item.synthesis.evidenceRefs.length} refs
                  </span>
                ) : null}
                {linkedCount ? (
                  <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-cyan-100">
                    {linkedCount} linked
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]">
              <div className="space-y-3">
                <RawDiagnosticBlock label="Synthesis" text={primarySynthesis} tone="emerald" />
                {shouldShowBrief ? <RawDiagnosticBlock label="Brief" text={item.sections.brief} /> : null}
                <RawLineList label="Top posters" lines={item.sections.topPosterLines} tone="cyan" />
                <RawEvidenceRefList refs={item.synthesis.evidenceRefs} fallbackLines={signalLines} />
              </div>
              <div className="space-y-3">
                <RawDiagnosticBlock label="Access check" text={item.sections.accessCheck} tone="amber" />
                <RawDiagnosticBlock label="Unavailable" text={item.sections.unavailable} tone="slate" />
              </div>
            </div>

            <details className="mt-3 rounded-lg border border-slate-800 bg-black/25 p-3">
              <summary className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-slate-400">
                Parsed object
              </summary>
              <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-black/35 p-3 text-[11px] leading-5 text-slate-300">
                {JSON.stringify(item, null, 2)}
              </pre>
            </details>
          </div>
        )
      })}
    </div>
  )
}

function RawLineList({ label, lines, tone = 'slate' }: { label: string; lines: string[]; tone?: 'slate' | 'cyan' }) {
  if (!lines.length) return null
  const toneClass = tone === 'cyan' ? 'border-cyan-400/25 bg-cyan-400/10' : 'border-slate-800 bg-black/20'
  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</div>
      <div className="mt-2 space-y-2">
        {lines.map((line, index) => (
          <div key={`${line}-${index}`} className="rounded-lg border border-slate-800 bg-slate-950/50 p-2 text-[11px] leading-5 text-slate-300">
            {line}
          </div>
        ))}
      </div>
    </div>
  )
}

function RawDiagnosticBlock({
  label,
  text,
  tone = 'slate',
  compact = false,
}: {
  label: string
  text: string | null
  tone?: 'slate' | 'amber' | 'emerald'
  compact?: boolean
}) {
  if (!text) return null
  const toneClass =
    tone === 'emerald'
      ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'
      : tone === 'amber'
        ? 'border-amber-400/25 bg-amber-400/10 text-amber-100'
        : 'border-slate-800 bg-black/20 text-slate-300'

  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <div className="text-[10px] font-black uppercase tracking-widest opacity-75">{label}</div>
      <p className={`${compact ? 'mt-1 text-[11px]' : 'mt-2 text-xs'} leading-5 text-slate-100`}>{text}</p>
    </div>
  )
}

function RawEvidenceRefList({ refs, fallbackLines }: { refs: XEvidenceRef[]; fallbackLines: string[] }) {
  if (!refs.length && !fallbackLines.length) return null

  return (
    <div className="rounded-xl border border-slate-800 bg-black/20 p-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
        {refs.length ? 'Parsed source refs' : 'Raw signals'}
      </div>
      <div className="mt-2 space-y-2">
        {refs.length
          ? refs.map((ref, index) => (
              <div key={`${ref.url ?? ref.raw}-${index}`} className="rounded-lg border border-slate-800 bg-slate-950/50 p-2">
                <div className="flex flex-wrap items-center gap-2">
                  {ref.handle ? <span className="text-[11px] font-black text-slate-100">{ref.handle}</span> : null}
                  {ref.stance ? (
                    <span className="rounded-full border border-slate-700 bg-black/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-400">
                      {ref.stance}
                    </span>
                  ) : null}
                  {ref.linked && ref.url ? (
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-cyan-100 hover:bg-cyan-400/15"
                    >
                      Open X
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-100">
                      no link
                    </span>
                  )}
                  {ref.postId ? <span className="font-mono text-[10px] text-slate-500">#{ref.postId}</span> : null}
                </div>
                {ref.excerpt ? <p className="mt-1.5 text-[11px] leading-5 text-slate-300">{ref.excerpt}</p> : null}
              </div>
            ))
          : fallbackLines.map((line, index) => (
              <div key={`${line}-${index}`} className="rounded-lg border border-slate-800 bg-slate-950/50 p-2 text-[11px] leading-5 text-slate-300">
                {line}
              </div>
            ))}
      </div>
    </div>
  )
}

function XEvidenceSynthesisPanel({
  synthesis,
  context,
  isSearching,
  onDeepDive,
  canDeepDive,
}: {
  synthesis: XRunSynthesis
  context: LiveXContext | null
  isSearching: boolean
  onDeepDive: () => void
  canDeepDive: boolean
}) {
  const linkedCount = synthesis.evidenceRefs.filter((ref) => ref.linked).length
  const hasSummary = Boolean(synthesis.brief || synthesis.voices || synthesis.dissent || synthesis.watch)
  const hasEvidence = synthesis.evidenceRefs.length > 0

  if (context?.hasNoSignal) {
    return (
      <div className="mt-5 rounded-2xl border border-slate-700/60 bg-black/20 p-4">
        <div className="text-xs font-black text-slate-200">X synthesis</div>
        <div className="mt-2 text-xs text-slate-400">No live X signals available.</div>
      </div>
    )
  }

  if (!hasSummary && !hasEvidence) return null

  return (
    <div className="mt-5 rounded-2xl border border-emerald-400/25 bg-black/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-xs font-black text-slate-100">
          <ShieldCheck className="h-4 w-4 text-emerald-300" />
          Evidence-led synthesis
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
          {linkedCount ? (
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-emerald-100">
              {linkedCount} linked
            </span>
          ) : null}
          {synthesis.evidenceRefs.length > linkedCount ? (
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-amber-100">
              {synthesis.evidenceRefs.length - linkedCount} excerpt
              {synthesis.evidenceRefs.length - linkedCount === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>
      </div>

      {synthesis.brief ? <p className="mt-3 text-sm leading-6 text-slate-200">{synthesis.brief}</p> : null}

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <MiniSynthesisCard icon={<UsersRound className="h-3.5 w-3.5" />} label="Voices" text={synthesis.voices} />
        <MiniSynthesisCard icon={<MessagesSquare className="h-3.5 w-3.5" />} label="Dissent" text={synthesis.dissent} />
        <MiniSynthesisCard icon={<Sparkles className="h-3.5 w-3.5" />} label="Watch" text={synthesis.watch} />
      </div>

      {hasEvidence ? (
        <div className="mt-4 space-y-2">
          <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
            <Quote className="h-3.5 w-3.5" />
            Source refs
          </div>
          {synthesis.evidenceRefs.map((ref, index) => (
            <div key={`${ref.url ?? ref.raw}-${index}`} className="rounded-xl border border-slate-800 bg-slate-900/30 p-3">
              <div className="flex flex-wrap items-center gap-2">
                {ref.handle ? <span className="text-xs font-black text-slate-100">{ref.handle}</span> : null}
                {ref.stance ? (
                  <span className="rounded-full border border-slate-700 bg-black/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-400">
                    {ref.stance}
                  </span>
                ) : null}
                {ref.linked && ref.url ? (
                  <a
                    href={ref.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-100 hover:bg-emerald-400/15"
                  >
                    Open X
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-100">
                    uncited excerpt
                  </span>
                )}
                {ref.postId ? <span className="font-mono text-[10px] text-slate-500">#{ref.postId}</span> : null}
              </div>
              {ref.excerpt ? <p className="mt-2 text-[11px] leading-5 text-slate-300">{ref.excerpt}</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      {canDeepDive ? (
        <button
          onClick={onDeepDive}
          disabled={isSearching}
          className="mt-4 w-full rounded-2xl bg-emerald-400/15 border border-emerald-400/30 text-emerald-100 font-black px-4 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Deep evidence pass
        </button>
      ) : null}
    </div>
  )
}

function MiniSynthesisCard({ icon, label, text }: { icon: ReactNode; label: string; text: string | null }) {
  if (!text) return null
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
      <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-[11px] leading-5 text-slate-300">{text}</p>
    </div>
  )
}

type CleanSeekVariant = 'mobile' | 'desktop'
type CleanSeekLayout = 'default' | 'xmarks' | 'ticker'

function isProbablyDesktopDevice(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const w = window.innerWidth
    const finePointer = typeof window.matchMedia === 'function' ? window.matchMedia('(pointer:fine)').matches : false
    return w >= 1024 && finePointer
  } catch {
    return false
  }
}

function CleanSeekXMobileRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const [forceDesktopPath, setForceDesktopPath] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (pathname !== '/cleanseek-x') return
    const isDesktopPath = window.location.pathname.endsWith('/desktop')
    setForceDesktopPath(isDesktopPath)
    if (isDesktopPath) return
    if (isProbablyDesktopDevice()) {
      window.location.href = `/cleanseek-x/desktop${window.location.search}`
    }
  }, [pathname])

  if (pathname !== '/cleanseek-x') return <Outlet />

  return <CleanSeekLite variant={forceDesktopPath ? 'desktop' : 'mobile'} disableGrokLive />
}

function XmarksHistoryPanel(props: {
  onSelectQuery: (q: string) => void
  onRunQuery: (q: string) => void
  isSearching: boolean
  returnTo?: string
}) {
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [rows, setRows] = useState<{ id: string; query: string | null; created_at: string }[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('')

  useEffect(() => {
    const sb = isSupabaseConfigured ? supabase : null
    if (!sb) {
      setLoading(false)
      setErr('Supabase is not configured on this site yet.')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await sb.auth.getSession()
        const u = data.session?.user ?? null
        if (cancelled) return
        setUserId(u?.id ?? null)
        setEmail(u?.email ?? null)
        if (u) {
          try {
            await ensureAccount(u as any)
          } catch {
            // non-fatal
          }
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to read session.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const load = useCallback(async () => {
    const sb = isSupabaseConfigured ? supabase : null
    if (!sb) return
    if (!userId) {
      setRows([])
      return
    }
    setErr(null)
    setLoading(true)
    try {
      const { data, error } = await sb
        .from('search_sessions')
        .select('id, query, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      setRows((data as any) ?? [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load history.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase()
    if (!f) return rows
    return rows.filter((r) => (r.query ?? '').toLowerCase().includes(f))
  }, [rows, filter])

  return (
    <div className="rounded-3xl border border-slate-700/60 bg-[#0A1128]/70 backdrop-blur-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">History</div>
          <div className="mt-1 text-[11px] text-slate-400">
            {email ? email : userId ? `User ${userId.slice(0, 8)}…` : '—'}
          </div>
        </div>
        <a
          href="/cleanseek-x/history"
          className="shrink-0 rounded-2xl border border-slate-700 bg-slate-900/30 px-3 py-2 text-[11px] font-black text-slate-200 hover:bg-slate-800/50"
          title="Open full history"
        >
          Open
        </a>
      </div>

      {!isSupabaseConfigured ? (
        <div className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          Supabase is not configured.
        </div>
      ) : null}

      {!userId && isSupabaseConfigured ? (
        <div className="mt-3 rounded-2xl border border-slate-700/60 bg-black/20 px-3 py-2 text-xs text-slate-200">
          Sign in to view saved searches.{' '}
          <a href={`/signin?returnTo=${encodeURIComponent(props.returnTo ?? '/cleanseek-x')}`} className="underline underline-offset-4 text-cyan-300">
            Sign in
          </a>
        </div>
      ) : null}

      <div className="mt-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter…"
          className="w-full rounded-2xl border border-slate-700 bg-slate-900/30 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500/50"
          aria-label="Filter history"
        />
      </div>

      {err ? (
        <div className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{err}</div>
      ) : null}

      {loading ? (
        <div className="mt-4 text-xs text-slate-400">Loading…</div>
      ) : (
        <div className="mt-4 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-xs text-slate-400">No saved searches yet.</div>
          ) : (
            filtered.map((r) => {
              const q = (r.query ?? '').trim()
              return (
                <div key={r.id} className="rounded-2xl border border-slate-700/60 bg-black/20 p-3">
                  <button
                    type="button"
                    onClick={() => props.onSelectQuery(q)}
                    className="w-full text-left text-xs font-semibold text-slate-100 hover:text-cyan-200"
                    title="Load into search box"
                  >
                    {q || '—'}
                  </button>
                  <button
                    type="button"
                    disabled={!q || props.isSearching}
                    onClick={() => props.onRunQuery(q)}
                    className="mt-2 w-full rounded-xl bg-cyan-500 text-[#050B14] px-3 py-1.5 text-[11px] font-black disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Run
                  </button>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

function XmarksLibraryPanel(props: {
  isSearching: boolean
  onFill: (q: string) => void
  onRun: (q: string) => void
}) {
  const [tab, setTab] = useState<XmarksKind>('topic')
  const [filter, setFilter] = useState<string>('')
  const [userId, setUserId] = useState<string | null>(null)
  const [hasSupabase, setHasSupabase] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)
  const [err, setErr] = useState<string | null>(null)

  const [defaultPresets, setDefaultPresets] = useState<XmarksPreset[]>(() => DEFAULT_XMARKS_PRESETS)
  const [userPicks, setUserPicks] = useState<XmarksPreset[]>(() => loadXmarksUserPicksFromLocalStorage())

  useEffect(() => {
    saveXmarksUserPicksToLocalStorage(userPicks)
  }, [userPicks])

  useEffect(() => {
    const sb = isSupabaseConfigured ? supabase : null
    if (!sb) {
      setLoading(false)
      setErr(null)
      setHasSupabase(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        setHasSupabase(true)
        const { data } = await sb.auth.getSession()
        const u = data.session?.user ?? null
        if (cancelled) return
        setUserId(u?.id ?? null)
      } catch {
        // ignore (local fallback still works)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const loadFromSupabase = useCallback(async () => {
    const sb = isSupabaseConfigured ? supabase : null
    if (!sb) return
    setErr(null)
    setLoading(true)
    try {
      // Defaults (admin-editable)
      const { data: defaults, error: defaultsErr } = await sb
        .from('xmarks_presets')
        .select('id, kind, label, query')
        .eq('is_default', true)
        .order('sort_order', { ascending: true })
      if (defaultsErr) throw defaultsErr
      const d = ((defaults as any) ?? []) as Array<{ id: string; kind: XmarksKind; label: string; query: string }>
      if (d.length) {
        setDefaultPresets(d.map((r) => ({ ...r, source: 'default' as const })))
      }

      // User picks
      const { data: sess } = await sb.auth.getSession()
      const uid = sess.session?.user?.id ?? null
      setUserId(uid)
      if (uid) {
        const { data: picks, error: picksErr } = await sb
          .from('xmarks_user_picks')
          .select('id, kind, label, query')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(100)
        if (picksErr) throw picksErr
        const p = ((picks as any) ?? []) as Array<{ id: string; kind: XmarksKind; label: string; query: string }>
        if (p.length) {
          setUserPicks(p.map((r) => ({ ...r, source: 'user' as const })))
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load XMarks presets.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!hasSupabase) return
    void loadFromSupabase()
  }, [hasSupabase, loadFromSupabase])

  const items = useMemo(() => {
    const all = [...defaultPresets, ...userPicks]
    const f = filter.trim().toLowerCase()
    return all.filter((p) => {
      if (p.kind !== tab) return false
      if (!f) return true
      return p.label.toLowerCase().includes(f) || p.query.toLowerCase().includes(f)
    })
  }, [defaultPresets, filter, tab, userPicks])

  const addPick = useCallback(() => {
    const label = window.prompt('Label for this pick?')?.trim() ?? ''
    if (!label) return
    const query = window.prompt('Search prompt / query?')?.trim() ?? ''
    if (!query) return
    const sb = isSupabaseConfigured ? supabase : null
    if (sb && userId) {
      const payload = { user_id: userId, kind: tab, label, query }
      void (async () => {
        try {
          const { data, error } = await sb.from('xmarks_user_picks').insert(payload).select('id, kind, label, query').single()
          if (error) throw error
          const row = data as any
          setUserPicks((prev) => [{ id: row.id, kind: row.kind, label: row.label, query: row.query, source: 'user' }, ...prev])
        } catch (e) {
          // Fall back to local if RLS blocks insert or table missing
          const id = `user-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`
          setUserPicks((prev) => [{ id, kind: tab, label, query, source: 'user' }, ...prev])
          setErr(e instanceof Error ? e.message : 'Failed to save pick to Supabase. Saved locally instead.')
        }
      })()
      return
    }
    const id = `user-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`
    setUserPicks((prev) => [{ id, kind: tab, label, query, source: 'user' }, ...prev])
  }, [tab, userId])

  const removePick = useCallback((id: string) => {
    const sb = isSupabaseConfigured ? supabase : null
    if (sb && userId) {
      void (async () => {
        try {
          const { error } = await sb.from('xmarks_user_picks').delete().eq('id', id).eq('user_id', userId)
          if (error) throw error
          setUserPicks((prev) => prev.filter((p) => p.id !== id))
        } catch (e) {
          setErr(e instanceof Error ? e.message : 'Delete failed.')
        }
      })()
      return
    }
    setUserPicks((prev) => prev.filter((p) => p.id !== id))
  }, [userId])

  return (
    <div className="rounded-3xl border border-slate-700/60 bg-[#0A1128]/70 backdrop-blur-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">The Spot library</div>
          <div className="mt-1 text-[11px] text-slate-400">One-tap searches for consuming info.</div>
        </div>
        <a
          href="/cleanseek-x/history"
          className="shrink-0 rounded-2xl border border-slate-700 bg-slate-900/30 px-3 py-2 text-[11px] font-black text-slate-200 hover:bg-slate-800/50"
          title="Open full search history"
        >
          History
        </a>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 rounded-2xl border border-slate-700/50 bg-black/25 p-1">
        {(['topic', 'person', 'industry'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`flex-1 min-w-[90px] rounded-xl px-3 py-2 text-center text-[11px] font-black transition-colors ${
              tab === k ? 'bg-cyan-500/20 text-cyan-50 ring-1 ring-cyan-500/40' : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
            }`}
            aria-pressed={tab === k}
          >
            {k === 'topic' ? 'Topics' : k === 'person' ? 'People' : 'Industry'}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter…"
          className="w-full rounded-2xl border border-slate-700 bg-slate-900/30 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500/50"
          aria-label="Filter library"
        />
        <button
          type="button"
          onClick={() => {
            if (typeof window === 'undefined') return
            addPick()
          }}
          className="shrink-0 rounded-2xl bg-cyan-500 text-[#050B14] px-3 py-2 text-xs font-black"
          title="Add a saved pick"
        >
          + Add
        </button>
      </div>

      {hasSupabase ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[10px] text-slate-500">Defaults + picks can load from Supabase.</span>
          <button
            type="button"
            onClick={() => void loadFromSupabase()}
            className="rounded-xl border border-slate-700 bg-slate-900/30 px-2.5 py-1 text-[10px] font-black text-slate-200 hover:bg-slate-800/50"
          >
            Refresh
          </button>
        </div>
      ) : null}

      {err ? (
        <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          {err}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4 text-xs text-slate-400">Loading…</div>
      ) : (
        <div className="mt-4 space-y-2">
          {items.length === 0 ? (
            <div className="text-xs text-slate-400">No presets found.</div>
          ) : (
            items.map((p) => (
              <div key={p.id} className="rounded-2xl border border-slate-700/60 bg-black/20 p-3">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => props.onFill(p.query)}
                    className="min-w-0 flex-1 text-left text-xs font-semibold text-slate-100 hover:text-cyan-200"
                    title="Load into search box"
                  >
                    {p.label}
                  </button>
                  {p.source === 'user' ? (
                    <button
                      type="button"
                      onClick={() => removePick(p.id)}
                      className="shrink-0 rounded-xl border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] font-black text-red-100 hover:bg-red-500/15"
                      title="Remove saved pick"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={props.isSearching}
                    onClick={() => props.onRun(p.query)}
                    className="flex-1 rounded-xl bg-cyan-500 text-[#050B14] px-3 py-1.5 text-[11px] font-black disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Run
                  </button>
                  <button
                    type="button"
                    onClick={() => props.onFill(p.query)}
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-900/30 px-3 py-1.5 text-[11px] font-black text-slate-200 hover:bg-slate-800/50"
                  >
                    Fill
                  </button>
                </div>
                <div className="mt-2 text-[10px] text-slate-500">
                  {p.source === 'default' ? 'Default' : hasSupabase && userId ? 'Saved' : 'Saved (local)'}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

type TickerWatchItem = { id: string; symbol: string; label?: string | null }

const DEFAULT_TICKER_SYMBOL = 'NVDA'
const DEFAULT_TICKER_SYMBOLS = ['NVDA', 'TSLA', 'PLTR', 'AMD', 'GOOGL', 'COIN']
const TICKER_SELECTED_SYMBOL_STORAGE_KEY = 'seekbox_ticker_selected_symbol_v1'

function normalizeTickerSymbol(raw: string | null | undefined): string {
  const s = (raw ?? '').trim().toUpperCase().replace(/^\$/, '').replace(/[^A-Z0-9.-]/g, '')
  if (!s || s.length > 10) return DEFAULT_TICKER_SYMBOL
  return s
}

function readTickerSeedSymbol(): string {
  if (typeof window === 'undefined') return DEFAULT_TICKER_SYMBOL
  try {
    return normalizeTickerSymbol(window.localStorage.getItem(TICKER_SELECTED_SYMBOL_STORAGE_KEY))
  } catch {
    return DEFAULT_TICKER_SYMBOL
  }
}

function writeTickerSeedSymbol(symbol: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(TICKER_SELECTED_SYMBOL_STORAGE_KEY, normalizeTickerSymbol(symbol))
  } catch {
    /* noop */
  }
}

function buildTickerPulseQuery(symbol: string): string {
  const s = normalizeTickerSymbol(symbol)
  return `${s} stock pulse: price drivers, notable news, sentiment on X, and key risks. Include any notable posts if available and cite links when possible.`
}

function tickerSeedRead(symbol: string) {
  const s = normalizeTickerSymbol(symbol)
  const reads: Record<string, { thesis: string; drivers: string[]; watch: string[] }> = {
    NVDA: {
      thesis:
        'NVDA is the planted seed because it behaves like the market temperature check for AI infrastructure, hyperscaler capex, chip supply, and speculative risk appetite.',
      drivers: ['AI capex commentary', 'Blackwell supply cadence', 'data-center margins'],
      watch: ['export controls', 'gross margin pressure', 'hyperscaler spending tone'],
    },
    TSLA: {
      thesis:
        'TSLA is a sentiment-heavy tape where price action can swing on delivery expectations, autonomy headlines, margin pressure, and CEO/news-cycle velocity.',
      drivers: ['delivery revisions', 'robotaxi/autonomy claims', 'EV demand and pricing'],
      watch: ['margin compression', 'regulatory headlines', 'China competition'],
    },
    PLTR: {
      thesis:
        'PLTR is a software multiple and government/commercial AI adoption read, useful for separating real enterprise demand from hype-cycle rerating.',
      drivers: ['AIP adoption stories', 'government contract flow', 'commercial expansion'],
      watch: ['valuation debate', 'lumpy contract timing', 'AI monetization proof'],
    },
    AMD: {
      thesis:
        'AMD is the challenger read on AI accelerators and CPUs, with the tape often reacting to share-gain evidence versus NVDA expectations.',
      drivers: ['MI-series demand', 'server CPU share', 'AI accelerator guidance'],
      watch: ['margin mix', 'execution versus NVDA', 'inventory digestion'],
    },
    GOOGL: {
      thesis:
        'GOOGL is the AI platform and ad-market read: search durability, Gemini distribution, cloud growth, and capex discipline all matter at once.',
      drivers: ['search/ad checks', 'cloud AI demand', 'Gemini product traction'],
      watch: ['AI capex intensity', 'regulatory pressure', 'search share anxiety'],
    },
    COIN: {
      thesis:
        'COIN is a crypto risk-on proxy where spot volumes, regulatory tone, stablecoin economics, and BTC/ETH volatility dominate the short-term tape.',
      drivers: ['crypto spot volume', 'BTC/ETH trend', 'regulatory headlines'],
      watch: ['fee compression', 'SEC/policy shifts', 'retail volume durability'],
    },
  }

  return (
    reads[s] ?? {
      thesis: `${s} is loaded as the ticker seed. Use the live pulse to turn this static setup into a current read across price drivers, news, X sentiment, and risk.`,
      drivers: ['recent price action', 'company-specific news', 'sector narrative'],
      watch: ['crowded consensus', 'upcoming catalysts', 'liquidity and sentiment shifts'],
    }
  )
}

const TICKER_PULSE_TEMPLATES = [
  {
    label: 'X sentiment',
    build: (symbol: string) =>
      `${symbol} stock pulse: current trader sentiment on X, strongest bullish and bearish posts, notable news, and key risks. Cite links when possible.`,
  },
  {
    label: 'Price drivers',
    build: (symbol: string) =>
      `${symbol} price drivers today: explain what is moving the stock, which narratives are real versus noisy, and what to watch next.`,
  },
  {
    label: 'Risk check',
    build: (symbol: string) =>
      `${symbol} risk check: summarize the bear case, crowded assumptions, upcoming catalysts, and dissenting market voices from X and the web.`,
  },
  {
    label: 'Compare basket',
    build: (symbol: string) =>
      `${symbol} versus closest public competitors: compare market narrative, recent X sentiment, valuation debate, catalysts, and risks.`,
  },
]

type TickerQuote = {
  symbol: string
  source?: string
  name?: string
  exchange?: string
  micCode?: string
  currency?: string
  datetime?: string
  price?: string
  open?: string
  high?: string
  low?: string
  previousClose?: string
  change?: string
  changePercent?: string
  volume?: string
  isMarketOpen?: boolean
  error?: string
}

function formatTickerPercent(value?: string): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  return trimmed.endsWith('%') ? trimmed : `${trimmed}%`
}

function formatTickerVolume(value?: string): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  const numeric = Number(trimmed)
  if (!Number.isFinite(numeric)) return trimmed
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(numeric)
}

function TickerSidebarPanel(props: {
  isSearching: boolean
  onSelectSymbol: (symbol: string) => void
  onRunPulse: (symbol: string, queryOverride?: string) => void
}) {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [err, setErr] = useState<string | null>(null)
  const [selected, setSelected] = useState<string>(() => readTickerSeedSymbol())
  const [watch, setWatch] = useState<TickerWatchItem[]>([])

  useEffect(() => {
    const s = normalizeTickerSymbol(selected)
    writeTickerSeedSymbol(s)
    props.onSelectSymbol(s)
  }, [selected])

  useEffect(() => {
    const sb = isSupabaseConfigured ? supabase : null
    if (!sb) {
      setLoading(false)
      setErr(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await sb.auth.getSession()
        const u = data.session?.user ?? null
        if (cancelled) return
        setUserId(u?.id ?? null)
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to read session.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const load = useCallback(async () => {
    const sb = isSupabaseConfigured ? supabase : null
    if (!sb) return
    if (!userId) {
      setWatch([])
      return
    }
    setErr(null)
    setLoading(true)
    try {
      const { data: w, error: wErr } = await sb
        .from('ticker_watchlist')
        .select('id, symbol, label')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (wErr) throw wErr
      setWatch(((w as any) ?? []) as TickerWatchItem[])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load your symbols.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const addToWatchlist = useCallback(async () => {
    const sym = window.prompt('Symbol to add (e.g. NVDA)?')?.trim().toUpperCase() ?? ''
    if (!sym) return
    const sb = isSupabaseConfigured ? supabase : null
    if (!sb || !userId) {
      setErr('Sign in to save a watchlist.')
      return
    }
    setErr(null)
    try {
      const { error } = await sb.from('ticker_watchlist').insert({ user_id: userId, symbol: sym, label: null })
      if (error) throw error
      await load()
      setSelected(normalizeTickerSymbol(sym))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to add.')
    }
  }, [load, userId])

  const removeWatch = useCallback(
    async (id: string) => {
      const sb = isSupabaseConfigured ? supabase : null
      if (!sb || !userId) return
      setErr(null)
      try {
        const { error } = await sb.from('ticker_watchlist').delete().eq('id', id).eq('user_id', userId)
        if (error) throw error
        await load()
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Delete failed.')
      }
    },
    [load, userId],
  )

  return (
    <div className="rounded-3xl border border-slate-700/60 bg-[#0A1128]/70 backdrop-blur-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-widest text-emerald-400/90">Market pulse</div>
          <div className="mt-1 text-lg font-black text-slate-100">{selected}</div>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">
            Live X for the tape, web search for receipts, models for the second opinion.
          </p>
        </div>
        <button
          type="button"
          onClick={addToWatchlist}
          className="shrink-0 rounded-2xl bg-cyan-500 text-[#050B14] px-3 py-2 text-[11px] font-black"
        >
          + Watch
        </button>
      </div>

      {err ? (
        <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">{err}</div>
      ) : null}

      <div className="mt-3 flex gap-2">
        <input
          value={selected}
          onChange={(e) => setSelected(e.target.value.toUpperCase().replace(/^\$/, '').replace(/[^A-Z0-9.-]/g, '').slice(0, 10))}
          className="w-full rounded-2xl border border-slate-700 bg-slate-900/30 px-3 py-2 text-sm font-black text-slate-100 outline-none focus:border-cyan-500/50"
          aria-label="Selected symbol"
        />
        <button
          type="button"
          disabled={props.isSearching}
          onClick={() => props.onRunPulse(selected)}
          className="shrink-0 rounded-2xl bg-emerald-500 text-[#050B14] px-3 py-2 text-[11px] font-black disabled:opacity-60"
          title="Run X + web pulse search"
        >
          Pulse
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {DEFAULT_TICKER_SYMBOLS.map((symbol) => (
          <button
            key={symbol}
            type="button"
            onClick={() => setSelected(normalizeTickerSymbol(symbol))}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${
              selected === symbol
                ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-100'
                : 'border-slate-700 bg-slate-900/30 text-slate-300 hover:border-slate-500'
            }`}
          >
            {symbol}
          </button>
        ))}
      </div>

      <div className="mt-5">
        <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">One-click runs</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {TICKER_PULSE_TEMPLATES.map((template) => (
            <button
              key={template.label}
              type="button"
              disabled={props.isSearching}
              onClick={() => props.onRunPulse(selected, template.build(selected))}
              className="rounded-2xl border border-slate-700/70 bg-black/20 px-3 py-2 text-left text-[11px] font-black text-slate-200 hover:border-cyan-500/40 hover:bg-cyan-500/10 disabled:opacity-60"
            >
              {template.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Symbols</div>
        {loading ? (
          <div className="mt-2 text-xs text-slate-400">Loading…</div>
        ) : watch.length ? (
          <div className="mt-2 space-y-2">
            {watch.map((w) => (
              <div key={w.id} className="rounded-2xl border border-slate-700/60 bg-black/20 p-3">
                <button
                  type="button"
                  onClick={() => setSelected(normalizeTickerSymbol(w.symbol))}
                  className="w-full text-left text-xs font-black text-slate-100 hover:text-cyan-200"
                >
                  {w.symbol}
                </button>
                <button
                  type="button"
                  onClick={() => void removeWatch(w.id)}
                  className="mt-2 w-full rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[11px] font-black text-red-100 hover:bg-red-500/15"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-2 text-xs text-slate-400">Add symbols (this is your portfolio/watchlist list for now).</div>
        )}
      </div>
    </div>
  )
}

function TickerContextPanel(props: {
  symbol: string
  prominent?: boolean
  isSearching?: boolean
  onRunPulse?: (symbol: string, queryOverride?: string) => void
  onFillPrompt?: (prompt: string) => void
}) {
  const [loading, setLoading] = useState<boolean>(false)
  const [err, setErr] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [payload, setPayload] = useState<{
    prefix?: string
    wikipedia?: { title: string; extract: string; url?: string } | null
    rss?: Array<{ feed: string; items: { title: string; link?: string }[] }>
    quotes?: TickerQuote[]
    meta?: { ms: number; errors: string[] }
  } | null>(null)

  useEffect(() => {
    const s = props.symbol.trim().toUpperCase()
    if (!s) return
    const sb = isSupabaseConfigured ? supabase : null
    if (!sb) {
      setCompanyName(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { data, error } = await sb.from('public_stocks').select('name').eq('symbol', s).maybeSingle()
        if (cancelled) return
        if (error) {
          setCompanyName(null)
          return
        }
        const nm = (data as any)?.name
        setCompanyName(typeof nm === 'string' && nm.trim() ? nm.trim() : null)
      } catch {
        if (!cancelled) setCompanyName(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [props.symbol])

  const load = useCallback(async () => {
    const s = props.symbol.trim().toUpperCase()
    if (!s) return
    setErr(null)
    setLoading(true)
    try {
      const query = companyName ? `${companyName} (${s}) stock` : `${s} stock`
      const res = await fetch('/api/supplementary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, symbols: [s] }),
      })
      const j = (await res.json()) as any
      if (!res.ok) throw new Error(typeof j?.error === 'string' ? j.error : `HTTP ${res.status}`)
      setPayload(j)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load supplementary context.')
    } finally {
      setLoading(false)
    }
  }, [companyName, props.symbol])

  useEffect(() => {
    void load()
  }, [load])

  const quote = payload?.quotes?.[0]
  const quoteName = quote && !quote.error ? quote.name : null
  const quoteChangeLabel = quote && !quote.error ? formatTickerPercent(quote.changePercent) : undefined
  const quoteVolumeLabel = quote && !quote.error ? formatTickerVolume(quote.volume) : undefined
  const displayCompanyName = companyName ?? quoteName
  const symbol = normalizeTickerSymbol(props.symbol)
  const seed = tickerSeedRead(symbol)
  const relevantNews = useMemo(() => {
    const s = normalizeTickerSymbol(props.symbol)
    const nm = (displayCompanyName ?? '').trim()
    const keys = [s, `$${s}`]
    if (nm) keys.push(nm)
    const re = new RegExp(keys.filter(Boolean).map((k) => k.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')).join('|'), 'i')
    const secs = payload?.rss ?? []
    const out: Array<{ feed: string; title: string; link?: string }> = []
    for (const sec of secs) {
      for (const it of sec.items ?? []) {
        if (re.test(it.title)) out.push({ feed: sec.feed, title: it.title, link: it.link })
      }
    }
    return out.slice(0, 12)
  }, [displayCompanyName, payload?.rss, props.symbol])

  if (props.prominent) {
    const seedTrail = seed.drivers.map((item) => `${symbol}: ${item}`)
    const trailHasLiveMatches = relevantNews.length > 0

    return (
      <section className="rounded-3xl border border-slate-700/60 bg-[#0A1128]/70 p-5 backdrop-blur-2xl sm:p-6" aria-label="Ticker market pulse">
        <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-start 2xl:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-black uppercase tracking-widest text-emerald-400/90">Ticker output</div>
            <h1 className="mt-2 text-3xl font-black leading-none tracking-tight text-slate-100 sm:text-4xl">
              {symbol} market pulse
            </h1>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-300">{seed.thesis}</p>
          </div>
          <div className="grid w-full max-w-xl grid-cols-3 gap-2 2xl:min-w-[420px]">
            <div className="rounded-2xl border border-slate-700/60 bg-black/20 p-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Symbol</div>
              <div className="mt-1 text-xl font-black text-slate-100">{symbol}</div>
            </div>
            <div className="rounded-2xl border border-slate-700/60 bg-black/20 p-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Twelve quote</div>
              <div className="mt-1 truncate text-xl font-black text-slate-100">
                {quote && !quote.error ? (quote.price ?? '—') : loading ? '…' : '—'}
              </div>
              {quote && !quote.error && (quote.currency || quote.exchange) ? (
                <div className="mt-1 truncate text-[10px] font-black uppercase tracking-wider text-slate-500">
                  {[quote.currency, quote.exchange].filter(Boolean).join(' · ')}
                </div>
              ) : null}
            </div>
            <div className="rounded-2xl border border-slate-700/60 bg-black/20 p-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Move</div>
              <div className="mt-1 truncate text-xl font-black text-slate-100">
                {quoteChangeLabel ?? (loading ? '…' : '—')}
              </div>
              {quote && !quote.error && quote.change ? (
                <div className="mt-1 truncate text-[10px] font-black uppercase tracking-wider text-slate-500">
                  {quote.change}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {err ? (
          <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs font-semibold text-amber-100">{err}</div>
        ) : null}
        <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr_1.15fr]">
          <div className="rounded-2xl border border-slate-700/60 bg-black/20 p-4">
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Drivers</div>
            <div className="mt-3 space-y-2">
              {seed.drivers.map((item) => (
                <div key={item} className="border-l-2 border-emerald-400/50 pl-3 text-sm font-bold leading-5 text-slate-200">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700/60 bg-black/20 p-4">
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Watch</div>
            <div className="mt-3 space-y-2">
              {seed.watch.map((item) => (
                <div key={item} className="border-l-2 border-cyan-400/50 pl-3 text-sm font-bold leading-5 text-slate-200">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700/60 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                  {trailHasLiveMatches ? 'Recent trail' : 'Seed trail'}
                </div>
                {displayCompanyName ? <div className="mt-1 text-xs font-black text-slate-200">{displayCompanyName}</div> : null}
              </div>
              {loading ? <div className="text-[11px] font-black text-slate-500">Loading…</div> : null}
            </div>
            <div className="mt-3 space-y-2">
              {trailHasLiveMatches
                ? relevantNews.slice(0, 4).map((it) => (
                    <a
                      key={`${it.feed}:${it.title}`}
                      href={it.link}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-xs font-semibold leading-5 text-slate-300 hover:text-cyan-200"
                      title={`${it.feed} · ${it.title}`}
                    >
                      {it.title}
                      <span className="text-slate-500"> · {it.feed}</span>
                    </a>
                  ))
                : seedTrail.slice(0, 4).map((item) => (
                    <div key={item} className="text-xs font-semibold leading-5 text-slate-300">
                      {item}
                    </div>
                  ))}
              {!loading && !trailHasLiveMatches && !seedTrail.length ? (
                <div className="text-xs font-semibold text-slate-400">No fresh headline trail loaded for {symbol}.</div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={props.isSearching}
            onClick={() => props.onRunPulse?.(symbol, buildTickerPulseQuery(symbol))}
            className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-[#050B14] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Live pulse
          </button>
          {TICKER_PULSE_TEMPLATES.slice(1, 3).map((template) => (
            <button
              key={template.label}
              type="button"
              disabled={props.isSearching}
              onClick={() => props.onRunPulse?.(symbol, template.build(symbol))}
              className="rounded-2xl border border-slate-700 bg-slate-900/30 px-4 py-3 text-sm font-black text-slate-200 hover:border-slate-500 hover:bg-slate-800/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {template.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => props.onFillPrompt?.(buildTickerPulseQuery(symbol))}
            className="rounded-2xl border border-slate-700 bg-slate-900/30 px-4 py-3 text-sm font-black text-slate-200 hover:border-slate-500 hover:bg-slate-800/50"
          >
            Fill prompt
          </button>
        </div>
      </section>
    )
  }

  return (
    <div className="rounded-3xl border border-slate-700/60 bg-[#0A1128]/70 backdrop-blur-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Context</div>
          <div className="mt-1 text-xs text-slate-400">Twelve Data + RSS + Wikipedia</div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="shrink-0 rounded-xl border border-slate-700 bg-slate-900/30 px-2.5 py-1 text-[10px] font-black text-slate-200 hover:bg-slate-800/50"
        >
          Refresh
        </button>
      </div>

      {loading ? <div className="mt-3 text-xs text-slate-400">Loading…</div> : null}
      {err ? (
        <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">{err}</div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-slate-700/60 bg-black/20 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Twelve Data quote</div>
          {quote && !quote.error && quote.isMarketOpen != null ? (
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              {quote.isMarketOpen ? 'Open' : 'Closed'}
            </div>
          ) : null}
        </div>
        {quote ? (
          quote.error ? (
            <div className="mt-2 text-xs text-slate-400">Quote unavailable.</div>
          ) : (
            <div className="mt-2">
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-black text-slate-100">{quote.symbol}</div>
                  {quote.name ? <div className="mt-0.5 truncate text-[10px] font-bold text-slate-500">{quote.name}</div> : null}
                </div>
                <div className="text-sm font-black text-slate-100">{quote.price ?? '—'}</div>
                <div className="text-xs font-black text-slate-400">{quoteChangeLabel ?? '—'}</div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-400">
                {quote.exchange || quote.currency ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/30 px-2 py-1.5">
                    <span className="text-slate-600">Venue</span> {[quote.exchange, quote.currency].filter(Boolean).join(' · ')}
                  </div>
                ) : null}
                {quote.high || quote.low ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/30 px-2 py-1.5">
                    <span className="text-slate-600">Range</span> {quote.low ?? '—'} / {quote.high ?? '—'}
                  </div>
                ) : null}
                {quote.open || quote.previousClose ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/30 px-2 py-1.5">
                    <span className="text-slate-600">Open/prev</span> {quote.open ?? '—'} / {quote.previousClose ?? '—'}
                  </div>
                ) : null}
                {quoteVolumeLabel ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/30 px-2 py-1.5">
                    <span className="text-slate-600">Volume</span> {quoteVolumeLabel}
                  </div>
                ) : null}
                {quote.datetime ? (
                  <div className="col-span-2 rounded-xl border border-slate-800 bg-slate-950/30 px-2 py-1.5">
                    <span className="text-slate-600">Updated</span> {quote.datetime}
                  </div>
                ) : null}
              </div>
            </div>
          )
        ) : (
          <div className="mt-2 text-xs text-slate-400">Quote unavailable.</div>
        )}
      </div>

      {payload?.wikipedia ? (
        <div className="mt-4 rounded-2xl border border-slate-700/60 bg-black/20 p-3">
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Wikipedia</div>
          <div className="mt-2 text-xs font-black text-slate-100">{payload.wikipedia.title}</div>
          <div className="mt-2 text-[11px] leading-snug text-slate-300 line-clamp-6">{payload.wikipedia.extract}</div>
          {payload.wikipedia.url ? (
            <a className="mt-2 inline-block text-[11px] font-black text-cyan-300 underline underline-offset-4" href={payload.wikipedia.url} target="_blank" rel="noreferrer">
              Open
            </a>
          ) : null}
        </div>
      ) : null}

      {payload?.rss?.length ? (
        <div className="mt-4 rounded-2xl border border-slate-700/60 bg-black/20 p-3">
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">News (RSS)</div>
          <div className="mt-2 space-y-3">
            {relevantNews.length ? (
              <div>
                <div className="text-[11px] font-black text-slate-200">
                  Relevant to {props.symbol.toUpperCase()}
                  {companyName ? <span className="text-slate-500"> · {companyName}</span> : null}
                </div>
                <div className="mt-1 space-y-1">
                  {relevantNews.map((it) => (
                    <a
                      key={`${it.feed}:${it.title}`}
                      href={it.link}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-[11px] text-slate-300 hover:text-cyan-200"
                      title={`${it.feed} · ${it.title}`}
                    >
                      • {it.title}
                      <span className="text-slate-500"> ({it.feed})</span>
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-slate-400">No symbol-matched headlines found (showing top feeds).</div>
            )}

            {/* Fallback: top headlines by feed */}
            {payload.rss.slice(0, 4).map((sec) => (
              <div key={sec.feed} className="pt-2 border-t border-slate-800/80">
                <div className="text-[11px] font-black text-slate-200">{sec.feed}</div>
                <div className="mt-1 space-y-1">
                  {sec.items.slice(0, 2).map((it) => (
                    <a
                      key={it.title}
                      href={it.link}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-[11px] text-slate-400 hover:text-cyan-200"
                      title={it.title}
                    >
                      • {it.title}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {payload.meta?.errors?.length ? (
            <div className="mt-3 text-[10px] text-slate-500">Some feeds errored: {payload.meta.errors.slice(0, 3).join(' · ')}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function CleanSeekLite({
  variant = 'desktop',
  layout = 'default',
  rawPlayground = false,
  defaultPreset,
  defaultUseLatest,
  defaultEnabledEngineIds,
  defaultEnginePickMode,
  storageKeys,
  disableGrokLive = false,
}: {
  variant?: CleanSeekVariant
  layout?: CleanSeekLayout
  rawPlayground?: boolean
  defaultPreset?: PresetId
  defaultUseLatest?: boolean
  defaultEnabledEngineIds?: string[]
  defaultEnginePickMode?: EnginePickMode
  storageKeys?: { enabledEnginesKey: string; enginePickModeKey: string; promptModsKey: string }
  /** When true, hides the Grok Live toggle, recency instruction, auto-append of groksearch, deep-live-dive, and showcase panel. */
  disableGrokLive?: boolean
}) {
  const backendUrlOrError = useMemo(() => {
    try {
      return { url: normalizeBaseUrl(readBackendUrlEnv()), error: null as string | null }
    } catch (e) {
      return { url: null as string | null, error: e instanceof Error ? e.message : 'Backend URL not configured' }
    }
  }, [])
  const BACKEND_URL = backendUrlOrError.url
  const keys = useMemo(() => {
    return (
      storageKeys ?? {
        enabledEnginesKey: ENABLED_ENGINES_STORAGE_KEY,
        enginePickModeKey: ENGINE_PICK_MODE_KEY,
        promptModsKey: PROMPT_MODIFIERS_STORAGE_KEY,
      }
    )
  }, [storageKeys])
  const [query, setQuery] = useState<string>('')
  const [useLatest, setUseLatest] = useState<boolean>(disableGrokLive ? false : (defaultUseLatest ?? true))
  const [activePreset, setActivePreset] = useState<PresetId>(defaultPreset ?? 'web')
  const initialEngineIds = useMemo(
    () => (defaultEnabledEngineIds && defaultEnabledEngineIds.length ? defaultEnabledEngineIds : ENGINE_CATALOG.map((e) => e.id)),
    [defaultEnabledEngineIds],
  )
  /** Engines included when preset is All In — persisted like main CleanSeek’s settings engines. */
  const [enabledEngineIds, setEnabledEngineIds] = useState<string[]>(() => initialEngineIds)
  const [presetEngineOverrides, setPresetEngineOverrides] = useState<PresetEngineOverrides>(() => loadPresetEngineOverrides())
  const presets = useMemo(() => {
    return PRESETS.map((p) => {
      if (p.id === 'allin') return p
      const o = presetEngineOverrides[p.id]
      return o && o.length ? { ...p, engineIds: [...o] } : p
    })
  }, [presetEngineOverrides])
  /** When `custom`, every search uses `enabledEngineIds`; when `preset`, only All In does. */
  const [enginePickMode, setEnginePickMode] = useState<EnginePickMode>(() => defaultEnginePickMode ?? 'custom')
  /** Response length, tone, persona, comprehension, reasoning — persisted; appended to query like `/cleanseek`. */
  const [promptMods, setPromptMods] = useState<PromptModifierSnapshot>(() => ({ ...DEFAULT_PROMPT_MODS }))
  /** Analysis modes: fetched from Supabase `analysis_modes` with a fallback. */
  const [analysisModes, setAnalysisModes] = useState<AnalysisModeRow[]>(() => FALLBACK_ANALYSIS_MODES)
  const [analysisMode, setAnalysisMode] = useState<string>('none')
  const [analysisJudge, setAnalysisJudge] = useState<string>('chatgpt')
  const analysisSelectableEngineIds = useMemo(() => new Set(['chatgpt', 'gemini']), [])
  const analysisEngineCatalog = useMemo(() => {
    if (analysisMode === 'none') return ENGINE_CATALOG
    return ENGINE_CATALOG.filter((e) => analysisSelectableEngineIds.has(e.id))
  }, [analysisMode, analysisSelectableEngineIds])
  /** Order providers for the results grid (matches last request). */
  const resultOrderRef = useRef<string[]>([])
  const [isSearching, setIsSearching] = useState<boolean>(false)
  const [results, setResults] = useState<Record<string, EngineResult>>({})
  const [rawDebugRequests, setRawDebugRequests] = useState<DevApiRequest[]>([])
  const [tickerSymbol, setTickerSymbol] = useState<string>(() => readTickerSeedSymbol())
  const [isDeepDive, setIsDeepDive] = useState<boolean>(false)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [streamNotice, setStreamNotice] = useState<string | null>(null)
  const [lastSentPrompt, setLastSentPrompt] = useState<string>('')
  const [showSentPrompt, setShowSentPrompt] = useState<boolean>(false)
  const [resultActionNotice, setResultActionNotice] = useState<string | null>(null)
  const [authUserId, setAuthUserId] = useState<string | null>(null)
  const [profileSummary, setProfileSummary] = useState<AccountProfileSummary>(() => getLocalAccountProfileSummary())
  const [personalizationSeed, setPersonalizationSeed] = useState<PersonalizationSeed>(() => loadPersonalizationSeed())
  const abortRef = useRef<AbortController | null>(null)
  const queryInputRef = useRef<HTMLInputElement | null>(null)
  const resultStartTimesRef = useRef<Record<string, number>>({})
  const resultEndTimesRef = useRef<Record<string, number>>({})
  const [, setLatencyTick] = useState(0)
  const hydratedFromUrlRef = useRef<boolean>(false)
  const autorunRef = useRef<boolean>(false)
  const [settingsHydrated, setSettingsHydrated] = useState<boolean>(false)
  /** Accumulate streamed deltas without triggering a React render per token (aligned with mobile `useStreamingSearch`). */
  const streamAccRef = useRef<Record<string, EngineResult>>({})
  const streamRafRef = useRef<number | null>(null)
  const searchInputMaxCharacters = profileSummary.searchInputMax ?? UI_SEARCH_QUERY_MAX_CHARS
  const responseLengthMaxWords = profileSummary.responseLengthMax
  const maxAllowedResponseLengthLevel = bestResponseLengthForLimit(responseLengthMaxWords) ?? RESPONSE_LENGTH_LEVELS.length - 1

  const flushStreamFrame = useCallback(() => {
    streamRafRef.current = null
    setResults(snapshotResults(streamAccRef.current))
  }, [])

  const scheduleStreamFlush = useCallback(() => {
    if (typeof requestAnimationFrame === 'undefined') {
      flushStreamFrame()
      return
    }
    if (streamRafRef.current === null) {
      streamRafRef.current = requestAnimationFrame(flushStreamFrame)
    }
  }, [flushStreamFrame])

  useEffect(() => {
    return () => {
      if (streamRafRef.current !== null) cancelAnimationFrame(streamRafRef.current)
      streamRafRef.current = null
    }
  }, [])

  useEffect(() => {
    if (query.length > searchInputMaxCharacters) {
      setQuery((current) => current.slice(0, searchInputMaxCharacters))
    }
  }, [query.length, searchInputMaxCharacters])

  useEffect(() => {
    if (!promptMods.responseLengthEnabled) return
    if (isResponseLengthAllowed(promptMods.responseLength, responseLengthMaxWords)) return
    const nextLevel = bestResponseLengthForLimit(responseLengthMaxWords) ?? DEFAULT_PROMPT_MODS.responseLength
    setPromptMods((current) => ({ ...current, responseLength: nextLevel }))
  }, [promptMods.responseLength, promptMods.responseLengthEnabled, responseLengthMaxWords])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (hydratedFromUrlRef.current) return
    hydratedFromUrlRef.current = true
    try {
      const sp = new URLSearchParams(window.location.search)
      const q = sp.get('q')
      const latest = sp.get('latest')
      autorunRef.current = sp.get('autorun') === '1'
      const presetParam = sp.get('preset') as PresetId | null
      const initialPreset: PresetId =
        presetParam && PRESETS.some((p) => p.id === presetParam) ? presetParam : (defaultPreset ?? 'web')

      if (q != null && q.trim()) setQuery(compactCleanseekQuery(q))
      if (latest != null && !disableGrokLive) setUseLatest(latest !== '0' && latest.toLowerCase() !== 'false')

      setActivePreset(initialPreset)

      const pm = loadEnginePickModeFromKey(keys.enginePickModeKey)
      setEnginePickMode(pm)
      const enabledFallback =
        defaultEnabledEngineIds && defaultEnabledEngineIds.length ? defaultEnabledEngineIds : ENGINE_CATALOG.map((e) => e.id)
      if (pm === 'preset') {
        const pr = presets.find((x) => x.id === initialPreset)
        if (pr && pr.engineIds.length > 0) setEnabledEngineIds([...pr.engineIds])
        else setEnabledEngineIds(loadEnabledEnginesFromKey(keys.enabledEnginesKey, enabledFallback))
      } else {
        const loaded = loadEnabledEnginesFromKey(keys.enabledEnginesKey, enabledFallback)
        if (loaded.length) setEnabledEngineIds(loaded)
        else if (defaultEnabledEngineIds && defaultEnabledEngineIds.length) setEnabledEngineIds(defaultEnabledEngineIds)
        else setEnabledEngineIds(loadEnabledEngines())
      }

      setPromptMods(loadPromptModsFromKey(keys.promptModsKey))
    } catch {
      // ignore
    } finally {
      setSettingsHydrated(true)
    }
  }, [defaultEnabledEngineIds, defaultPreset, keys.enabledEnginesKey, keys.enginePickModeKey, keys.promptModsKey, presets])

  useEffect(() => {
    if (!settingsHydrated) return
    savePromptModsToKey(keys.promptModsKey, promptMods)
  }, [keys.promptModsKey, promptMods, settingsHydrated])

  useEffect(() => {
    if (!settingsHydrated) return
    saveEnabledEnginesToKey(keys.enabledEnginesKey, enabledEngineIds)
  }, [enabledEngineIds, keys.enabledEnginesKey, settingsHydrated])

  useEffect(() => {
    if (!settingsHydrated) return
    saveEnginePickModeToKey(keys.enginePickModeKey, enginePickMode)
  }, [enginePickMode, keys.enginePickModeKey, settingsHydrated])

  // Preset pill long-press editor
  const [editingPresetId, setEditingPresetId] = useState<PresetId | null>(null)
  const [editingEngineIds, setEditingEngineIds] = useState<string[]>([])
  const longPressTimerRef = useRef<number | null>(null)
  const didLongPressRef = useRef<boolean>(false)

  const stopPresetLongPress = useCallback(() => {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const closePresetEditor = useCallback(() => {
    setEditingPresetId(null)
    setEditingEngineIds([])
    setTimeout(() => {
      didLongPressRef.current = false
    }, 0)
  }, [])

  const openPresetEditor = useCallback(
    (pid: PresetId) => {
      didLongPressRef.current = true
      setEditingPresetId(pid)
      if (pid === 'allin') {
        setEditingEngineIds([...enabledEngineIds])
        return
      }
      const pr = presets.find((x) => x.id === pid) ?? PRESETS[0]
      setEditingEngineIds(pr.engineIds.length ? [...pr.engineIds] : [...enabledEngineIds])
    },
    [enabledEngineIds, presets],
  )

  const startPresetLongPress = useCallback(
    (pid: PresetId) => {
      stopPresetLongPress()
      longPressTimerRef.current = window.setTimeout(() => openPresetEditor(pid), 550) as unknown as number
    },
    [openPresetEditor, stopPresetLongPress],
  )

  const applyPresetEngineSelection = useCallback(
    (nextIds: string[]) => {
      if (!editingPresetId) return
      const allowed = new Set(ENGINE_CATALOG.map((e) => e.id))
      const filtered = nextIds.filter((id) => allowed.has(id))
      setEditingEngineIds(filtered)

      if (editingPresetId === 'allin') {
        setEnabledEngineIds(filtered)
        saveEnabledEnginesToKey(keys.enabledEnginesKey, filtered)
        return
      }

      const nextOverrides: PresetEngineOverrides = { ...presetEngineOverrides }
      if (filtered.length) nextOverrides[editingPresetId] = filtered
      else delete nextOverrides[editingPresetId]
      setPresetEngineOverrides(nextOverrides)
      savePresetEngineOverrides(nextOverrides)

      // Keep the toggles aligned to what will run for this preset.
      if (activePreset === editingPresetId) {
        setEnabledEngineIds([...filtered])
        saveEnabledEnginesToKey(keys.enabledEnginesKey, filtered)
      }
    },
    [activePreset, editingPresetId, keys.enabledEnginesKey, presetEngineOverrides],
  )

  const toggleEditingEngine = useCallback(
    (id: string) => {
      if (!editingPresetId) return
      applyPresetEngineSelection(
        editingEngineIds.includes(id) ? editingEngineIds.filter((x) => x !== id) : [...editingEngineIds, id],
      )
    },
    [applyPresetEngineSelection, editingEngineIds, editingPresetId],
  )

  const promptModifierActiveCount = useMemo(() => {
    let n = 0
    if (promptMods.responseLengthEnabled) n++
    if (promptMods.toneEnabled) n++
    if (promptMods.comprehensionEnabled) n++
    if (promptMods.personaEnabled && promptMods.personaText.trim()) n++
    if (promptMods.reasoningStyle) n++
    n += promptMods.modifierFlags.length
    return n
  }, [promptMods])

  useEffect(() => {
    const refresh = () => setPersonalizationSeed(loadPersonalizationSeed())
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  const personalizationPreview = useMemo(
    () =>
      buildPersonalizationContext({
        profile: profileSummary,
        seed: personalizationSeed,
        query,
        explicitPersonaText: promptMods.personaEnabled ? promptMods.personaText : '',
      }),
    [personalizationSeed, profileSummary, promptMods.personaEnabled, promptMods.personaText, query],
  )

  const idsActuallySent = useMemo(
    () =>
      resolveSearchEngineIds({
        enginePickMode,
        activePreset,
        enabledEngineIds,
        presets,
      }),
    [enginePickMode, activePreset, enabledEngineIds, presets],
  )

  const inputHasCappedInternetProvider = idsActuallySent.some(hasInternetSearchQueryCap)
  const internetSearchInputOverCap = inputHasCappedInternetProvider && query.trim().length > INTERNET_SEARCH_QUERY_MAX_CHARS
  const suggestedFollowUps = useMemo(() => buildCleanseekFollowUps(query, results), [query, results])
  const canOpenOpsConsole = isOpsConsoleRole(profileSummary.roleId)

  const presetLocksEngines =
    enginePickMode === 'preset' &&
    (presets.find((p) => p.id === activePreset)?.engineIds.length ?? 0) > 0

  const activePresetLabel = presets.find((p) => p.id === activePreset)?.label ?? activePreset

  const toggleEngineEnabled = useCallback(
    (id: string) => {
      if (analysisMode !== 'none' && !analysisSelectableEngineIds.has(id)) return
      // Changing toggles while Quick/Research/Web locks engines would lie about what runs — switch to custom.
      if (enginePickMode === 'preset') {
        const pr = PRESETS.find((p) => p.id === activePreset)
        if (pr && pr.engineIds.length > 0) setEnginePickMode('custom')
      }
      setEnabledEngineIds((prev) => {
        const has = prev.includes(id)
        let next = has ? prev.filter((x) => x !== id) : [...prev, id]
        if (next.length === 0) next = [id]
        if (analysisMode !== 'none') {
          next = next.filter((x) => analysisSelectableEngineIds.has(x))
          if (next.length === 0) next = ['chatgpt', 'gemini']
        }
        return next
      })
    },
    [enginePickMode, activePreset, analysisMode, analysisSelectableEngineIds],
  )

  useEffect(() => {
    if (analysisMode === 'none') return
    setEnabledEngineIds((prev) => {
      const next = prev.filter((id) => analysisSelectableEngineIds.has(id))
      return next.length ? next : ['chatgpt', 'gemini']
    })
    if (!analysisSelectableEngineIds.has(analysisJudge)) setAnalysisJudge('chatgpt')
  }, [analysisMode, analysisJudge, analysisSelectableEngineIds])

  useEffect(() => {
    const sb = isSupabaseConfigured ? supabase : null
    if (!sb || typeof window === 'undefined') return

    let cancelled = false

    const refresh = async () => {
      const { data } = await sb.auth.getSession()
      const u = data.session?.user ?? null
      if (cancelled) return
      const uid = u?.id ?? null
      setAuthUserId(uid)
      if (uid) {
        try {
          await ensureAccount(u as any)
        } catch {
          // non-fatal
        }
      }
      const summary = await getAccountProfileSummary({ supabase: sb, user: u as any })
      if (!cancelled) {
        setProfileSummary(summary)
      }
    }

    void refresh()

    const { data: sub } = sb.auth.onAuthStateChange(() => {
      void refresh()
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const sb = isSupabaseConfigured ? supabase : null
    if (!sb) return
    let cancelled = false
    ;(async () => {
      try {
        // Table-backed modes. We accept different column names defensively.
        // NOTE: PostgREST will error if we select a column that doesn't exist,
        // so we retry without `name` when older schemas don't have it.
        const fetchModes = async (withName: boolean) =>
          sb
            .from('analysis_modes')
            .select(
              withName
                ? 'id, label, name, mode, slug, description, enabled, sort_order'
                : 'id, label, mode, slug, description, enabled, sort_order',
            )
            .order('sort_order', { ascending: true })
            .limit(100)

        let { data, error } = await fetchModes(true)
        if (error && (error as any)?.code === '42703') {
          ;({ data, error } = await fetchModes(false))
        }
        if (cancelled) return
        if (error) throw error
        const rows = ((data as any) ?? []) as Array<Record<string, unknown>>
        const normalized: AnalysisModeRow[] = rows
          .filter((r) => (r.enabled == null ? true : Boolean(r.enabled)))
          .map((r) => ({
            id: String(r.slug ?? r.mode ?? r.id ?? ''),
            label: String(r.label ?? r.name ?? r.slug ?? r.mode ?? r.id ?? '').trim(),
            description: typeof r.description === 'string' ? r.description : null,
          }))
          .filter((r) => r.id && r.label)
        if (normalized.length) setAnalysisModes(normalized)
      } catch {
        // fallback is fine
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const saveHistory = useCallback(
    async (
      queryText: string,
      enabledProviders: string[],
      finalResults: Record<string, EngineResult>,
      historyClass?: SearchHistoryClassification,
    ) => {
      const sb = isSupabaseConfigured ? supabase : null
      if (!sb) return
      try {
        const { data } = await sb.auth.getUser()
        const u = data.user
        if (!u) return

        const clientId = getClientId()
        const classSuffix = historyClass?.primary ? `_class_${historyClass.primary}` : ''
    const surface = rawPlayground ? 'xraw' : layout === 'xmarks' ? 'xmarks' : 'cleanseekx'
    const searchMode = `${surface}_${activePreset}_${enginePickMode}_${useLatest ? 'latest1' : 'latest0'}_${enabledProviders.length}${classSuffix}`

        const { data: sess, error: sessErr } = await sb
          .from('search_sessions')
          .insert({
            client_id: clientId,
            session_id: clientId,
            query: queryText,
            search_mode: searchMode,
            fun_mode: false,
            search_source: rawPlayground ? 'xraw' : layout === 'xmarks' ? 'xmarks' : 'web',
            user_id: u.id,
          } as any)
          .select('id')
          .single()

        if (sessErr || !sess?.id) return

        const sessionId = String(sess.id)
        const rows: SavedEngineRow[] = []
        for (const prov of enabledProviders) {
          const normalizedProv = normalizeStreamProviderId(prov)
          const r = finalResults[prov] ?? finalResults[normalizedProv]
          const txt = (r?.content ?? '').toString()
          if (!txt.trim() && r?.status !== 'error') continue
          const words = txt.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean)
          rows.push({
            engine: normalizedProv,
            result_text: txt,
            is_error: r?.status === 'error',
            error_message: r?.status === 'error' ? (txt || 'error') : null,
            word_count: words.length || null,
            result_type: 'engine',
          })
        }

        if (rows.length) {
          await sb.from('engine_results').insert(
            rows.map((r) => ({
              search_session_id: sessionId,
              ...r,
            })) as any,
          )
        }
      } catch {
        // history is best-effort
      }
    },
    [activePreset, enginePickMode, layout, rawPlayground, useLatest],
  )

  const signOut = async () => {
    const sb = isSupabaseConfigured ? supabase : null
    if (!sb) return
    await sb.auth.signOut()
    setAuthUserId(null)
    setProfileSummary(getLocalAccountProfileSummary())
    if (typeof window !== 'undefined') window.location.href = '/cleanseek-x'
  }

  const flashResultAction = useCallback((message: string) => {
    setResultActionNotice(message)
    if (typeof window === 'undefined') return
    window.setTimeout(() => {
      setResultActionNotice((current) => (current === message ? null : current))
    }, 1800)
  }, [])

  const copyResultText = useCallback(
    async (provider: string, content: string) => {
      const text = content.trim()
      if (!text) return
      try {
        await copyTextToClipboard(text)
        flashResultAction(`${displayEngineName(provider)} copied`)
      } catch {
        flashResultAction('Copy failed')
      }
    },
    [flashResultAction],
  )

  const copySentPrompt = useCallback(async () => {
    const text = lastSentPrompt.trim()
    if (!text) return
    try {
      await copyTextToClipboard(text)
      flashResultAction('Prompt copied')
    } catch {
      flashResultAction('Copy failed')
    }
  }, [flashResultAction, lastSentPrompt])

  const run = async (opts?: RunOptions) => {
    if (!BACKEND_URL) return
    const raw = (opts?.queryOverride ?? query).trim()
    if (!raw || isSearching) return
    if (raw.length > searchInputMaxCharacters) {
      setStreamError(
        `This prompt is ${raw.length.toLocaleString()} characters. ${profileSummary.roleLabel} allows ${searchInputMaxCharacters.toLocaleString()} search characters.`,
      )
      return
    }
    const xmarksMode = layout === 'xmarks' || rawPlayground
    const replaceOnlyProvider = Boolean(opts?.replaceProvider && opts.forceProvider)
    const normalizedForcedProvider = opts?.forceProvider ? normalizeStreamProviderId(opts.forceProvider) : null

    if (opts?.queryOverride != null) setQuery(raw)
    syncCleanseekUrl(raw, useLatest, activePreset)

    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    let enabledProvidersPreview = resolveSearchEngineIds({
      enginePickMode,
      activePreset,
      enabledEngineIds,
      forceProvider: opts?.forceProvider,
      presets,
    })
    if (useLatest && enabledProvidersPreview.length && !enabledProvidersPreview.includes('groksearch')) {
      enabledProvidersPreview = [...enabledProvidersPreview, 'groksearch']
    }
    const includesWebEngine = enabledProvidersPreview.some((id) => id === 'tavily' || id === 'brave' || id === 'chatgptsearch' || id === 'groksearch')
    const liveInstr = [
      useLatest ? (includesWebEngine ? RECENCY_INSTRUCTION_COMPACT : RECENCY_INSTRUCTION) : '',
      xmarksMode ? XMARKS_SYNTHESIS_INSTRUCTION : '',
      rawPlayground ? RAW_X_PLAYGROUND_INSTRUCTION : '',
    ]
      .filter(Boolean)
      .join(' ')
    // Live mode should never be constrained by the response-length cap.
    const modsForThisRun = useLatest ? { ...promptMods, responseLengthEnabled: false } : promptMods
    const personalizationContext: PersonalizationContext = buildPersonalizationContext({
      profile: profileSummary,
      seed: personalizationSeed,
      query: raw,
      explicitPersonaText: modsForThisRun.personaEnabled ? modsForThisRun.personaText : '',
    })
    const composedPrompt = composeCleanseekPrompt(raw, modsForThisRun, liveInstr)
    const qBuilt = composedPrompt

    setStreamError(null)
    setIsSearching(true)
    if (replaceOnlyProvider && normalizedForcedProvider) {
      const preserved = Object.keys(streamAccRef.current).length ? streamAccRef.current : results
      streamAccRef.current = snapshotResults(preserved)
      const prior = streamAccRef.current[normalizedForcedProvider] ?? {
        provider: normalizedForcedProvider,
        providerName: opts?.forceProvider ?? normalizedForcedProvider,
        content: '',
        status: 'loading' as const,
      }
      streamAccRef.current[normalizedForcedProvider] = {
        ...prior,
        content: '',
        status: 'loading',
        durationMs: null,
      }
      setResults(snapshotResults(streamAccRef.current))
    } else {
      streamAccRef.current = {}
      setResults({})
      resultStartTimesRef.current = {}
      resultEndTimesRef.current = {}
    }
    if (rawPlayground) setRawDebugRequests([])
    setIsDeepDive(Boolean(opts?.deepDive))

    let enabledProviders = resolveSearchEngineIds({
      enginePickMode,
      activePreset,
      enabledEngineIds,
      forceProvider: opts?.forceProvider,
      presets,
    })

    if (useLatest && enabledProviders.length && !enabledProviders.includes('groksearch')) {
      enabledProviders = [...enabledProviders, 'groksearch']
    }

    if (!opts?.forceProvider && enabledProviders.length === 0) {
      setIsSearching(false)
      setStreamError(
        enginePickMode === 'custom'
          ? 'Pick at least one model or search source below (My picks only), then Search.'
          : 'Turn on at least one model or search source for All In, switch to My picks only, or select Quick / Research / Web.',
      )
      return
    }

    const finalQuery =
      opts?.deepDive && (useLatest || xmarksMode)
        ? `${qBuilt}\n\n[DEEP EVIDENCE PASS: Expand Evidence refs to 6-10 items. Keep the Brief concise, identify repeated voices, strongest dissent, and why this matters. Only treat an item as cited if it has a real X/Twitter URL or post ID. Never fabricate URLs or quote full posts at length. If no X access, write \"No live X signals available\".]\n`
        : qBuilt
    const liveXProviders = xmarksMode ? enabledProviders.filter(isLiveXProvider) : []
    const nonLiveXProviders = liveXProviders.length ? enabledProviders.filter((provider) => !isLiveXProvider(provider)) : enabledProviders
    const rawSearchProviders = nonLiveXProviders.filter(
      (provider) => provider in SEARCH_ROUTE_PROVIDER_CONFIGS || CLASSIC_LEGACY_SEARCH_PROVIDERS.has(provider),
    )
    const rawSearchProviderSet = new Set(rawSearchProviders)
    const promptProviders = nonLiveXProviders.filter((provider) => !rawSearchProviderSet.has(provider))
    const liveXDeepDiveInstruction =
      opts?.deepDive && xmarksMode
        ? '[DEEP EVIDENCE PASS: Expand Evidence refs to 6-10 items. Keep the Brief concise, identify repeated voices, strongest dissent, and why this matters. Only treat an item as cited if it has a real X/Twitter URL or post ID. Never fabricate URLs or quote full posts at length. If no X access, write "No live X signals available".]'
        : ''
    const liveXQuery = liveXProviders.length
      ? buildLiveXSearchQuery(
          raw,
          [
            xmarksMode ? XMARKS_SYNTHESIS_INSTRUCTION : '',
            rawPlayground ? RAW_X_PLAYGROUND_INSTRUCTION : '',
            liveXDeepDiveInstruction,
          ],
        )
      : ''
    const liveXQueryCompacted = liveXProviders.length > 0 && liveXQuery.length < raw.replace(/\s+/g, ' ').trim().length
    const userQueryLength = raw.replace(/\s+/g, ' ').trim().length
    const cappedInternetProviders = promptProviders.filter(hasInternetSearchQueryCap)
    const cappedProviderSet = new Set(cappedInternetProviders)
    const needsCappedInternetSplit = cappedInternetProviders.length > 0 && finalQuery.length > INTERNET_SEARCH_QUERY_MAX_CHARS
    const fullPromptProviders = needsCappedInternetSplit
      ? promptProviders.filter((provider) => !cappedProviderSet.has(provider))
      : promptProviders
    const compactWebQuery = compactInternetSearchQuery(raw)
    const fullPromptQuery = compactBackendSearchQuery(finalQuery)
    const fullPromptQueryCompacted = fullPromptProviders.length > 0 && fullPromptQuery.length < finalQuery.length
    const rawSearchQueryCompacted = rawSearchProviders.length > 0 && compactWebQuery.length < userQueryLength
    const streamRequests: StreamSearchRequest[] = [
      ...(liveXProviders.length ? [{ providers: liveXProviders, query: liveXQuery, compacted: liveXQueryCompacted }] : []),
      ...(rawSearchProviders.length ? [{ providers: rawSearchProviders, query: compactWebQuery, compacted: rawSearchQueryCompacted }] : []),
      ...(fullPromptProviders.length ? [{ providers: fullPromptProviders, query: fullPromptQuery, compacted: fullPromptQueryCompacted }] : []),
      ...(needsCappedInternetSplit
        ? [{ providers: cappedInternetProviders, query: compactWebQuery, compacted: true }]
        : []),
    ]
    setLastSentPrompt(
      [
        `Raw user query:\n${raw}`,
        `Model prompt:\n${finalQuery}`,
        rawSearchProviders.length || cappedInternetProviders.length ? `Search-source query:\n${compactWebQuery}` : '',
        liveXProviders.length ? `Live X query:\n${liveXQuery}` : '',
      ]
        .filter(Boolean)
        .join('\n\n---\n\n'),
    )
    setShowSentPrompt(false)

    const notices: string[] = []
    if ((rawSearchProviders.length || cappedInternetProviders.length) && userQueryLength > INTERNET_SEARCH_QUERY_MAX_CHARS) {
      notices.push('Your search text was shortened for web search sources.')
    }
    if ((fullPromptQueryCompacted || liveXQueryCompacted) && userQueryLength > BACKEND_SEARCH_QUERY_MAX_CHARS) {
      notices.push('Your search text was shortened to fit request limits.')
    }
    setStreamNotice(notices.length ? notices.join(' ') : null)

    if (!replaceOnlyProvider) {
      resultOrderRef.current = enabledProviders.map(normalizeStreamProviderId)
    }

    const startedAt = Date.now()
    for (const provider of enabledProviders) {
      const normalizedProvider = normalizeStreamProviderId(provider)
      resultStartTimesRef.current[normalizedProvider] = startedAt
      delete resultEndTimesRef.current[normalizedProvider]
    }
    setLatencyTick((tick) => tick + 1)

    // Pre-create loading cards — mirror into stream accumulator for RAF-batched streaming updates.
    if (enabledProviders.length) {
      const init: Record<string, EngineResult> = replaceOnlyProvider ? snapshotResults(streamAccRef.current) : {}
      for (const p of enabledProviders) {
        const normalizedProvider = normalizeStreamProviderId(p)
        init[normalizedProvider] = {
          provider: normalizedProvider,
          providerName: p,
          content: '',
          status: 'loading',
          durationMs: null,
        }
      }
      const snap = snapshotResults(init)
      streamAccRef.current = snap
      setResults(snap)
    }

    const clientId = getClientId()
    const streamUserId = authUserId ?? clientId

    if (!authUserId) {
      const sessionSearchCount = incrementSessionSearchCount()
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('sb-session-searches-changed'))
      setProfileSummary((prev) =>
        prev.signedIn ? prev : getLocalAccountProfileSummary({ sessionSearchCount }),
      )
    }

    const mergeProvider = (pid: string, patch: Partial<EngineResult>) => {
      const cur =
        streamAccRef.current[pid] ??
        ({ provider: pid, providerName: pid, content: '', status: 'loading' as const })
      streamAccRef.current = { ...streamAccRef.current, [pid]: { ...cur, ...patch } }
      scheduleStreamFlush()
    }

    const noteProviderFinished = (provider: string, serverDurationMs?: unknown): number | null => {
      const pid = normalizeStreamProviderId(provider)
      const now = Date.now()
      resultEndTimesRef.current[pid] = now
      const measured = resultStartTimesRef.current[pid] ? now - resultStartTimesRef.current[pid] : null
      const serverMs = typeof serverDurationMs === 'number' && Number.isFinite(serverDurationMs) ? serverDurationMs : null
      setLatencyTick((tick) => tick + 1)
      return serverMs ?? measured
    }

    const dispatchPayload = (eventName: string, rawPayload: string) => {
      const trimmed = rawPayload.trim()
      if (!trimmed) return
      let d: Record<string, unknown>
      try {
        d = JSON.parse(trimmed)
      } catch {
        return
      }

      let kind = eventName.trim()
      if (!kind && typeof d.event === 'string') kind = String(d.event).trim()
      if (!kind && typeof d.type === 'string') kind = String(d.type).trim()

      const pid = normalizeStreamProviderId(String(d.provider ?? d.engine ?? d.providerId ?? 'unknown'))

      if (kind === 'result-chunk') {
        const prev = streamAccRef.current[pid]?.content ?? ''
        mergeProvider(pid, {
          content: prev + String(d.delta ?? d.content ?? ''),
          status: 'loading',
        })
        return
      }
      if (kind === 'result-done') {
        const cur = streamAccRef.current[pid]
        const doneContent = d.content !== undefined ? String(d.content) : undefined
        const finalContent = doneContent !== undefined ? doneContent : cur?.content ?? ''
        const durationMs = noteProviderFinished(pid, d.durationMs ?? d.latency_ms)
        mergeProvider(pid, {
          content: finalContent.trim() ? finalContent : 'Provider returned no content.',
          status: finalContent.trim() ? 'success' : 'error',
          durationMs,
        })
        return
      }
      if (kind === 'result-error') {
        const durationMs = noteProviderFinished(pid, d.durationMs ?? d.latency_ms)
        mergeProvider(pid, {
          content: `Error: ${String(d.error ?? 'failed')}`,
          status: 'error',
          durationMs,
        })
      }
    }

    const markProvidersErrored = (providersForRequest: string[], message: string) => {
      for (const provider of providersForRequest) {
        const normalizedProvider = normalizeStreamProviderId(provider)
        const current = streamAccRef.current[normalizedProvider]
        if (current?.status === 'success') continue
        const durationMs = noteProviderFinished(normalizedProvider)
        mergeProvider(normalizedProvider, {
          content: current?.content?.trim() ? `${current.content}\n\n${message}` : message,
          status: 'error',
          durationMs,
        })
      }
    }

    const readErrorDetail = async (res: Response): Promise<string> => {
      try {
        const t = await res.text()
        if (!t) return ''
        try {
          const j = JSON.parse(t) as Record<string, unknown>
          return (
            (typeof j.error === 'string' && j.error) ||
            (typeof j.message === 'string' && j.message) ||
            t.slice(0, 400)
          )
        } catch {
          return t.slice(0, 400)
        }
      } catch {
        return ''
      }
    }

    const searchEndpoint = searchStreamEndpoint(BACKEND_URL)
    const classicSearchEndpoint = classicSearchStreamEndpoint()
    const chatApiEndpoint = chatEndpoint(BACKEND_URL)
    const searchApiEndpoint = searchResultsEndpoint(BACKEND_URL)
    const pulseEndpoint = `${BACKEND_URL}/v1/pulse`
    const discoverEndpoint = '/api/x-discover'
    const useSplitApi = shouldUseSplitSearchApi(BACKEND_URL)
    const searchRequestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    }
    const pulseRequestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-App': 'XRaw-Playground',
    }
    const discoverRequestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-App': 'XRaw-Playground',
    }
    const isRawXRequest = (request: StreamSearchRequest): boolean =>
      rawPlayground && request.providers.length > 0 && request.providers.every(isLiveXProvider)
    const buildSearchRequestBody = (request: StreamSearchRequest): Record<string, unknown> => ({
      query: request.query,
      useLocation: false,
      enabledProviders: request.providers.length ? request.providers : undefined,
      sessionId: clientId,
      clientId,
      userId: streamUserId,
      searchSource: rawPlayground ? 'xraw' : xmarksMode ? 'xmarks' : 'cleanseek',
      platform: 'web',
      promptCharacterCount: request.query.length,
      enabledEngineCount: request.providers.length || undefined,
      liveDataMode: useLatest,
      grokLive: useLatest,
      // Only send modifier metadata when the corresponding toggle is on.
      // Mirrors `modsForThisRun` so live-mode overrides apply (e.g. the
      // response-length cap is intentionally suppressed in live mode).
      ...(modsForThisRun.responseLengthEnabled
        ? { responseLengthSetting: modsForThisRun.responseLength }
        : {}),
      ...(promptMods.personaEnabled && promptMods.personaText.trim()
        ? { persona: promptMods.personaText.trim() }
        : {}),
      personalization: personalizationContext.metadata,
      historyClass: personalizationContext.historyClass.primary,
      historyClassConfidence: personalizationContext.historyClass.confidence,
      ...(promptMods.comprehensionEnabled
        ? {
            comprehensionEnabled: true,
            comprehensionLevel: promptMods.comprehensionLevel,
          }
        : {}),
      ...(analysisMode !== 'none' && analysisJudge
        ? {
            analysisMode,
            analysisJudge,
            // Legacy backend compatibility: many deployments read `<mode>Judge`.
            [`${analysisMode}Judge`]: analysisJudge,
          }
        : {}),
    })
    const buildRawPulseRequestBody = (): Record<string, unknown> => buildPulseSearchBody(raw, Boolean(opts?.deepDive))
    const buildRawDiscoverRequestBody = (): Record<string, unknown> => buildXDiscoverSearchBody(raw, Boolean(opts?.deepDive))

    if (rawPlayground) {
      const debugStamp = Date.now()
      setRawDebugRequests(
        streamRequests.map((request, index) => {
          const useDiscover = isRawXRequest(request)
          return {
            id: `${debugStamp}-${index}`,
            endpoint: useDiscover ? discoverEndpoint : searchEndpoint,
            method: 'POST',
            headers: useDiscover ? discoverRequestHeaders : searchRequestHeaders,
            providers: [...request.providers],
            compacted: request.compacted,
            queryCharacterCount: request.query.length,
            body: useDiscover ? buildRawDiscoverRequestBody() : buildSearchRequestBody(request),
          }
        }),
      )
    }

    const discoverSearchRequest = async (request: StreamSearchRequest) => {
      const body = buildRawDiscoverRequestBody()
      const token = await getSupabaseAccessToken()
      const headers = token ? { ...discoverRequestHeaders, Authorization: `Bearer ${token}` } : discoverRequestHeaders
      let res: Response
      try {
        res = await fetch(discoverEndpoint, {
          method: 'POST',
          headers,
          signal: ac.signal,
          body: JSON.stringify(body),
        })
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return
        await pulseSearchRequest(request)
        return
      }

      if (!res.ok && res.status === 404) {
        await pulseSearchRequest(request)
        return
      }

      let payload: XDiscoverResponse | null = null
      try {
        payload = (await res.json()) as XDiscoverResponse
      } catch {
        payload = null
      }

      if (!payload) {
        const message = `X discovery returned malformed JSON (HTTP ${res.status}).`
        markProvidersErrored(request.providers, message)
        setStreamError(message)
        return
      }

      const content = formatXDiscoverRawPlaygroundContent(payload)
      for (const provider of request.providers) {
        const durationMs = noteProviderFinished(provider)
        mergeProvider(normalizeStreamProviderId(provider), {
          content,
          status: payload.ok ? 'success' : 'error',
          durationMs,
        })
      }
      if (!payload.ok) {
        const reason =
          typeof payload.error === 'string'
            ? payload.error
            : payload.access?.reason ?? 'X discovery did not return post-level data.'
        setStreamError(reason)
      }
    }

    const pulseSearchRequest = async (request: StreamSearchRequest) => {
      const body = buildRawPulseRequestBody()
      let res: Response
      try {
        res = await fetch(pulseEndpoint, {
          method: 'POST',
          headers: pulseRequestHeaders,
          signal: ac.signal,
          body: JSON.stringify(body),
        })
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return
        const message = e instanceof Error ? e.message : 'X pulse search failed.'
        markProvidersErrored(request.providers, `Error: ${message}`)
        setStreamError(message)
        return
      }

      if (!res.ok) {
        const detail = await readErrorDetail(res)
        const message = detail ? `X pulse search failed (HTTP ${res.status}): ${detail}` : `X pulse search failed (HTTP ${res.status}).`
        markProvidersErrored(request.providers, message)
        setStreamError(message)
        return
      }

      let payload: PulseSearchResponse | null = null
      try {
        payload = (await res.json()) as PulseSearchResponse
      } catch {
        payload = null
      }

      if (!payload?.summary?.trim()) {
        const message = 'X pulse search returned no summary.'
        markProvidersErrored(request.providers, message)
        setStreamError(message)
        return
      }

      const content = formatPulseRawPlaygroundContent(payload, body as PulseSearchBody)
      for (const provider of request.providers) {
        const durationMs = noteProviderFinished(provider)
        mergeProvider(normalizeStreamProviderId(provider), {
          content,
          status: 'success',
          durationMs,
        })
      }
    }

    const streamLegacySearchRequest = async (request: StreamSearchRequest, endpoint = searchEndpoint) => {
      const body = buildSearchRequestBody(request)
      let res: Response
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: searchRequestHeaders,
          signal: ac.signal,
          body: JSON.stringify(body),
        })
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return
        const message = e instanceof Error ? e.message : 'Search failed.'
        markProvidersErrored(request.providers, `Error: ${message}`)
        setStreamError(message)
        return
      }

      if (!res.ok) {
        const detail = await readErrorDetail(res)
        const message = detail ? `Search failed (HTTP ${res.status}): ${detail}` : `Search failed (HTTP ${res.status}).`
        markProvidersErrored(request.providers, message)
        setStreamError(message)
        return
      }

      if (!res.body) {
        const message = 'Search failed: empty response body.'
        markProvidersErrored(request.providers, message)
        setStreamError(message)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let evt = ''

      try {
        while (true) {
          const { done: isDone, value } = await reader.read()
          if (isDone) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() ?? ''
          for (let line of lines) {
            line = line.replace(/\r$/, '')
            if (!line) continue
            if (line.startsWith(':')) continue
            if (line.startsWith('event:')) {
              evt = line.slice(6).trim()
              continue
            }
            if (!line.startsWith('data:')) continue
            const payload = line.slice(5).trimStart()
            dispatchPayload(evt, payload)
          }
        }
        if (buf.trim()) {
          for (let line of buf.split('\n')) {
            line = line.replace(/\r$/, '')
            if (!line.startsWith('data:')) continue
            dispatchPayload(evt, line.slice(5).trimStart())
          }
        }
      } catch (e) {
        if (!ac.signal.aborted) {
          const message = e instanceof Error ? e.message : 'Stream interrupted.'
          markProvidersErrored(request.providers, message)
          setStreamError(message)
        }
      }
    }

    const streamChatProviderRequest = async (queryText: string, provider: string) => {
      const config = CHAT_ROUTE_PROVIDER_CONFIGS[provider]
      if (!config) return

      const fail = (message: string) => {
        markProvidersErrored([provider], message)
        setStreamError(message)
      }

      try {
        const res = await fetch(chatApiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-App': 'XSeekBoxAI',
            'X-Feature': `cleanseek-x-desktop-${provider}`,
          },
          signal: ac.signal,
          body: JSON.stringify({
            prompt: queryText,
            provider: config.provider,
            model: config.model,
            stream: true,
          }),
        })

        if (!res.ok) {
          const detail = await readErrorDetail(res)
          fail(detail ? `${displayEngineName(provider)} chat failed (HTTP ${res.status}): ${detail}` : `${displayEngineName(provider)} chat failed (HTTP ${res.status}).`)
          return
        }

        if (!res.body) {
          fail(`${displayEngineName(provider)} chat returned no response body.`)
          return
        }

        const contentType = res.headers.get('content-type') ?? ''
        if (contentType.includes('application/json')) {
          const data = (await res.json().catch(() => null)) as ChatProviderJsonResponse | null
          const content = extractChatProviderJsonContent(data)
          if (!content) {
            fail(`${displayEngineName(provider)} chat returned no readable content.`)
            return
          }
          const durationMs = noteProviderFinished(provider, data?.latency_ms)
          mergeProvider(normalizeStreamProviderId(provider), { content, status: 'success', durationMs })
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        let evt = ''

        while (true) {
          const { done: isDone, value } = await reader.read()
          if (isDone) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() ?? ''
          for (let line of lines) {
            line = line.replace(/\r$/, '')
            if (!line || line.startsWith(':')) continue
            if (line.startsWith('event:')) {
              evt = line.slice(6).trim()
              continue
            }
            if (!line.startsWith('data:')) continue
            const payload = line.slice(5).trimStart()
            if (!payload) continue
            let data: Record<string, unknown>
            try {
              data = JSON.parse(payload) as Record<string, unknown>
            } catch {
              continue
            }

            if (evt === 'chunk' && typeof data.delta === 'string') {
              const pid = normalizeStreamProviderId(provider)
              const prev = streamAccRef.current[pid]?.content ?? ''
              mergeProvider(pid, { content: prev + data.delta, status: 'loading' })
            }

            if (evt === 'done') {
              const pid = normalizeStreamProviderId(provider)
              const existing = streamAccRef.current[pid]?.content ?? ''
              const finalContent = typeof data.content === 'string' && data.content.trim() ? data.content : existing
              const durationMs = noteProviderFinished(pid, data.durationMs ?? data.latency_ms)
              mergeProvider(pid, {
                content: finalContent.trim() ? finalContent : 'Provider returned no content.',
                status: finalContent.trim() ? 'success' : 'error',
                durationMs,
              })
            }

            if (evt === 'error') {
              fail(String(data.error ?? `${displayEngineName(provider)} chat error`))
            }
          }
        }
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return
        fail(e instanceof Error ? e.message : `${displayEngineName(provider)} chat failed.`)
      }
    }

    const fetchSearchProviderRequest = async (queryText: string, provider: string) => {
      const config = SEARCH_ROUTE_PROVIDER_CONFIGS[provider]
      if (!config) return

      const fail = (message: string) => {
        markProvidersErrored([provider], message)
        setStreamError(message)
      }

      try {
        const res = await fetch(searchApiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-App': 'XSeekBoxAI',
            'X-Feature': `cleanseek-x-desktop-${provider}`,
          },
          signal: ac.signal,
          body: JSON.stringify({
            query: queryText,
            provider: config.provider,
            model: config.model,
            capability: 'web-search',
            tier: 'cheap',
            extended: config.extended,
            cache_ttl_sec: 300,
          }),
        })

        if (!res.ok) {
          const detail = await readErrorDetail(res)
          fail(detail ? `${displayEngineName(provider)} search failed (HTTP ${res.status}): ${detail}` : `${displayEngineName(provider)} search failed (HTTP ${res.status}).`)
          return
        }

        const data = (await res.json().catch(() => null)) as SearchProviderResponse | null
        if (!data) {
          fail(`${displayEngineName(provider)} search returned an unreadable response.`)
          return
        }

        const durationMs = noteProviderFinished(provider, data.latency_ms)
        mergeProvider(normalizeStreamProviderId(provider), {
          content: formatSearchProviderContent(data),
          status: 'success',
          durationMs,
        })
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return
        fail(e instanceof Error ? e.message : `${displayEngineName(provider)} search failed.`)
      }
    }

    const streamSearchRequest = async (request: StreamSearchRequest) => {
      if (isRawXRequest(request)) {
        await discoverSearchRequest(request)
        return
      }

      const routedChatProviders = useSplitApi ? request.providers.filter((provider) => provider in CHAT_ROUTE_PROVIDER_CONFIGS) : []
      const routedSearchProviders = useSplitApi ? request.providers.filter((provider) => provider in SEARCH_ROUTE_PROVIDER_CONFIGS) : []
      const routedProviderSet = new Set([...routedChatProviders, ...routedSearchProviders])
      const classicLegacyProviders = request.providers.filter((provider) => CLASSIC_LEGACY_SEARCH_PROVIDERS.has(provider))
      const classicProviderSet = new Set(classicLegacyProviders)
      const legacyProviders = request.providers.filter((provider) => !routedProviderSet.has(provider) && !classicProviderSet.has(provider))
      const tasks: Array<Promise<void>> = []

      if (legacyProviders.length) {
        tasks.push(streamLegacySearchRequest({ ...request, providers: legacyProviders }, searchEndpoint))
      }
      if (classicLegacyProviders.length) {
        tasks.push(streamLegacySearchRequest({ ...request, providers: classicLegacyProviders }, classicSearchEndpoint))
      }
      for (const provider of routedSearchProviders) {
        tasks.push(fetchSearchProviderRequest(request.query, provider))
      }
      for (const provider of routedChatProviders) {
        tasks.push(streamChatProviderRequest(request.query, provider))
      }

      await Promise.all(tasks)
    }

    try {
      await Promise.all(streamRequests.map((request) => streamSearchRequest(request)))
    } finally {
      if (streamRafRef.current !== null) {
        cancelAnimationFrame(streamRafRef.current)
        streamRafRef.current = null
      }
      if (ac.signal.aborted) {
        const next = { ...streamAccRef.current }
        for (const k of Object.keys(next)) {
          if (next[k].status === 'loading') {
            const durationMs = noteProviderFinished(k)
            next[k] = {
              ...next[k],
              status: 'error',
              content: next[k].content?.trim() ? next[k].content : 'Stopped.',
              durationMs,
            }
          }
        }
        streamAccRef.current = next
      }
      flushStreamFrame()
      setIsSearching(false)

      if (!replaceOnlyProvider && !ac.signal.aborted && raw.trim()) {
        void saveHistory(raw.trim(), enabledProviders, streamAccRef.current, personalizationContext.historyClass)
      }
    }
  }

  const stop = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsSearching(false)
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (e: KeyboardEvent) => {
      const activeElement = typeof document !== 'undefined' ? document.activeElement : null
      const inputActive =
        Boolean(activeElement) &&
        (activeElement?.tagName === 'INPUT' ||
          activeElement?.tagName === 'TEXTAREA' ||
          (activeElement as HTMLElement | null)?.isContentEditable)

      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        queryInputRef.current?.focus()
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (!BACKEND_URL) return
        if (isSearching) {
          stop()
          return
        }
        void run()
        return
      }

      if (e.key === 'Escape' && inputActive) {
        e.preventDefault()
        ;(activeElement as HTMLElement | null)?.blur()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const fillSamplePrompt = (text: string) => {
    setQuery(text)
    syncCleanseekUrl(text, useLatest, activePreset)
    queryInputRef.current?.focus()
    queryInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const selectTickerSymbol = (sym: string) => {
    const s = normalizeTickerSymbol(sym)
    setTickerSymbol(s)
    writeTickerSeedSymbol(s)
    setQuery(`${s} stock`)
  }

  const runTickerPulse = (sym: string, queryOverride?: string) => {
    const s = normalizeTickerSymbol(sym)
    if (!BACKEND_URL || !s) return
    setTickerSymbol(s)
    writeTickerSeedSymbol(s)
    const q = queryOverride ?? buildTickerPulseQuery(s)
    setQuery(q)
    window.setTimeout(() => {
      if (!isSearching) void run({ queryOverride: q })
    }, 0)
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!autorunRef.current) return
    if (!BACKEND_URL) return
    if (isSearching) return
    if (!query.trim()) return
    autorunRef.current = false
    // Defer a tick so the input state is committed before running.
    const id = window.setTimeout(() => {
      if (!isSearching && query.trim()) void run()
    }, 0)
    return () => window.clearTimeout(id)
  }, [BACKEND_URL, isSearching, query])

  const isMobile = variant === 'mobile'
  const isRabbitHole = typeof window !== 'undefined' && window.location.pathname.endsWith('/rabbitholex')
  const isXmarks = layout === 'xmarks'
  const isTicker = layout === 'ticker'
  const isThreeColumnCleanseek = variant === 'desktop' && !isRabbitHole && !isXmarks && !isTicker
  const pageTitle = rawPlayground
    ? 'X.SeekBoxAI'
    : isXmarks
      ? 'X.SeekBoxAI'
      : isTicker
        ? 'X.SeekBoxAI'
        : 'X.SeekBoxAI'
  const pageEyebrow = rawPlayground
    ? 'Raw playground'
    : isXmarks
      ? 'The Spot'
      : isTicker
        ? 'Tickers'
        : 'multi-model search'
  const headerActive = rawPlayground ? 'xmarks' : isXmarks ? 'xmarks' : isTicker ? 'ticker' : 'search'
  const signInReturnTo =
    typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '/cleanseek-x'
  const workspaceActions = (
    <>
      {!disableGrokLive ? (
        <IconNavButton
          onClick={() =>
            setUseLatest((v) => {
              const next = !v
              syncCleanseekUrl(query, next, activePreset)
              return next
            })
          }
          tone="light"
          active={useLatest}
          label={useLatest ? 'Live X on' : 'Live X off'}
          description="Toggle freshest available X/live signals for the next run."
          icon={<Radio className="h-4 w-4" />}
        />
      ) : null}
      {canOpenOpsConsole ? (
        <IconNavButton
          onClick={() => {
            if (typeof window !== 'undefined') window.location.href = '/sbx-ops'
          }}
          tone="light"
          label="SBX Ops"
          description="Open the existing SeekBox operations console."
          icon={<Wrench className="h-4 w-4" />}
        />
      ) : null}
      {authUserId ? (
        <IconNavButton
          onClick={() => void signOut()}
          tone="light"
          label="Sign out"
          description="End this signed-in session."
          icon={<LogOut className="h-4 w-4" />}
          className="border-red-500/40 bg-red-50 text-red-800 hover:bg-red-100"
        />
      ) : null}
    </>
  )
  const pageShellClass = rawPlayground
    ? 'w-full px-3 py-4 sm:px-4 lg:px-5 lg:py-5'
    : 'mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-6'
  const searchBandClass = rawPlayground
    ? '-mx-3 border-b border-neutral-300 bg-[#fbfbf7]/95 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-[#fbfbf7]/85 sm:-mx-4 sm:px-4 lg:-mx-5 lg:px-5'
    : '-mx-4 border-b border-neutral-300 bg-[#fbfbf7]/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-[#fbfbf7]/85 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8'
  const searchBoxClass = rawPlayground
    ? 'flex w-full min-w-0 items-center gap-2 border border-neutral-300 bg-white px-4 py-3 shadow-[3px_3px_0_rgba(0,0,0,0.05)]'
    : 'mx-auto flex min-w-0 max-w-7xl items-center gap-2 border border-neutral-300 bg-white px-4 py-3 shadow-[3px_3px_0_rgba(0,0,0,0.05)]'
  const workbenchGridClass = rawPlayground
    ? 'mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)_300px] xl:grid-cols-[300px_minmax(0,1fr)_320px] 2xl:grid-cols-[320px_minmax(0,1fr)_340px] lg:items-start'
    : isThreeColumnCleanseek
      ? 'mt-6 grid grid-cols-1 gap-4 md:grid-cols-[180px_minmax(0,1fr)_260px] lg:grid-cols-[220px_minmax(0,1fr)_300px] xl:grid-cols-[260px_minmax(0,1fr)_320px] md:items-start'
      : isXmarks
        ? 'mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)_360px] xl:grid-cols-[340px_minmax(0,1fr)_380px] lg:items-start'
      : isTicker
        ? 'mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start'
        : ''

  return (
    <div className="min-h-screen bg-[#f7f8f4] text-neutral-950">
      <XSiteHeader
        active={headerActive}
        title={pageTitle}
        eyebrow={pageEyebrow}
        actions={workspaceActions}
        fullWidth={rawPlayground}
      />
      <div className={pageShellClass}>
        {!BACKEND_URL ? (
          <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {backendUrlOrError.error ?? 'Backend URL not configured.'} Set Netlify env var{' '}
            <span className="font-mono">VITE_BACKEND_URL</span> (for browser) and redeploy.
          </div>
        ) : null}

        {streamError ? (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <span className="flex-1 min-w-[200px]">{streamError}</span>
            <button
              type="button"
              onClick={() => setStreamError(null)}
              className="rounded-xl border border-amber-400/40 bg-black/20 px-3 py-1.5 text-xs font-black text-amber-50"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {!streamError && streamNotice ? (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
            <span className="flex-1 min-w-[200px]">{streamNotice}</span>
            <button
              type="button"
              onClick={() => setStreamNotice(null)}
              className="rounded-xl border border-cyan-400/40 bg-black/20 px-3 py-1.5 text-xs font-black text-cyan-50"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {rawPlayground ? (
          <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-50">
            <span className="font-black">Internal raw playground.</span> Use this to see what the current providers appear to return:
            live access checks, raw signal refs, gaps, and the short synthesis. It does not create a stored-post search index.
          </div>
        ) : null}

        <div className={searchBandClass}>
          <div className={searchBoxClass}>
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              ref={queryInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={searchInputMaxCharacters}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || e.shiftKey) return
                e.preventDefault()
                if (!BACKEND_URL) return
                if (isSearching) {
                  stop()
                  return
                }
                if (!query.trim()) return
                void run()
              }}
              placeholder={
                rawPlayground
                  ? 'Raw access check: topic, handle, ticker, claim, or X URL'
                  : isXmarks
                  ? 'Search X conversations, handles, tickers, claims, or URLs'
                  : 'Ask once… get all answers side-by-side'
              }
              className="min-w-0 flex-1 bg-transparent font-semibold text-neutral-950 outline-none placeholder:text-neutral-500"
              aria-label="Search query"
            />
            {inputHasCappedInternetProvider ? (
              <span
                className={`hidden shrink-0 rounded-full border px-2 py-1 text-[10px] font-black tabular-nums sm:inline-flex ${
                  internetSearchInputOverCap
                    ? 'border-amber-400/40 bg-amber-400/10 text-amber-100'
                    : 'border-slate-700 bg-slate-900/30 text-slate-400'
                }`}
              >
                {query.trim().length}/{INTERNET_SEARCH_QUERY_MAX_CHARS} web
              </span>
            ) : null}
            {isSearching ? (
              <button
                type="button"
                onClick={stop}
                className="shrink-0 border border-neutral-300 bg-white px-3 py-1.5 text-xs font-black text-neutral-800 hover:border-neutral-950"
              >
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void run()}
                disabled={
                  !BACKEND_URL ||
                  (enginePickMode === 'custom' && enabledEngineIds.length === 0) ||
                  (enginePickMode === 'preset' && activePreset === 'allin' && enabledEngineIds.length === 0)
                }
                className="shrink-0 bg-neutral-950 px-4 py-1.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Search
              </button>
            )}
            <button
              type="button"
              disabled
              title="Voice input coming soon"
              className="shrink-0 cursor-not-allowed border border-neutral-300 bg-[#f7f8f4] px-3 py-1.5 text-xs font-black text-neutral-500"
            >
              <span className="inline-flex items-center gap-2">
                <Mic className="h-3.5 w-3.5" /> Voice
              </span>
            </button>
          </div>
          <div className="mt-2 text-[11px] font-black uppercase tracking-widest text-neutral-500">
            {profileSummary.roleLabel}
            {profileSummary.searchesLeft !== null ? ` · ${profileSummary.searchesLeft} left` : ''}
            {` · ${query.length.toLocaleString()} / ${searchInputMaxCharacters.toLocaleString()} chars`}
            {personalizationPreview.enabled ? ` · personalized: ${personalizationPreview.historyClass.label}` : ''}
          </div>
        </div>

        <div
          className={workbenchGridClass}
        >
          {isThreeColumnCleanseek ? (
            <aside className="hidden md:block md:sticky md:top-5 md:max-h-[calc(100vh-2.5rem)] md:overflow-y-auto md:pr-1">
              <XmarksHistoryPanel
                isSearching={isSearching}
                returnTo={signInReturnTo}
                onSelectQuery={(q) => setQuery(q)}
                onRunQuery={(q) => {
                  setQuery(q)
                  if (!BACKEND_URL || !q.trim()) return
                  window.setTimeout(() => {
                    if (!isSearching && q.trim()) void run({ queryOverride: q })
                  }, 0)
                }}
              />
            </aside>
          ) : null}

          {isXmarks ? (
            <aside className="w-full lg:sticky lg:top-5 lg:max-h-[calc(100vh-2.5rem)] lg:overflow-y-auto lg:pr-1">
              <XmarksLibraryPanel
                isSearching={isSearching}
                onFill={(q) => setQuery(q)}
                onRun={(q) => {
                  setQuery(q)
                  if (!BACKEND_URL) return
                  if (!q.trim()) return
                  window.setTimeout(() => {
                    if (!isSearching && q.trim()) void run({ queryOverride: q })
                  }, 0)
                }}
              />
            </aside>
          ) : null}

          {isTicker ? (
            <aside className="order-2 w-full xl:col-start-2 xl:row-start-1">
              <TickerSidebarPanel
                isSearching={isSearching}
                onSelectSymbol={selectTickerSymbol}
                onRunPulse={runTickerPulse}
              />
            </aside>
          ) : null}

          <div className={`${isXmarks || isTicker || isThreeColumnCleanseek ? 'min-w-0 flex-1' : ''} ${isXmarks ? 'lg:col-start-2 lg:row-start-1' : ''} ${isTicker ? 'order-1 xl:col-start-1 xl:row-start-1' : ''}`}>
        {isTicker ? (
          <TickerContextPanel
            symbol={tickerSymbol}
            prominent
            isSearching={isSearching}
            onRunPulse={runTickerPulse}
            onFillPrompt={fillSamplePrompt}
          />
        ) : null}

        {/* Prompt modifiers — hidden in RabbitHole view (results-only). */}
        {!isRabbitHole && !isThreeColumnCleanseek && !isXmarks ? (
          <details
            className="mt-4 rounded-2xl border border-slate-700/70 bg-[#0A1128]/55 open:border-cyan-500/30"
            open={!isMobile && !isTicker && !isXmarks ? true : undefined}
          >
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm font-black text-slate-100 [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              {promptModifierActiveCount > 0 ? (
                <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-cyan-400" aria-hidden />
              ) : null}
              Prompt modifiers
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                {promptModifierActiveCount > 0 ? `${promptModifierActiveCount} active` : 'optional'}
              </span>
            </span>
            <span className="text-[11px] font-black text-slate-500">Tap to expand ▾</span>
          </summary>

          <div className="space-y-5 border-t border-slate-800/90 px-4 pb-4 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="max-w-3xl text-xs leading-snug text-slate-400">
                Response length, tone, persona, and comprehension append instruction suffixes to model prompts; sliders and checkboxes persist locally.
              </p>
              <p className="max-w-3xl text-xs leading-snug text-violet-200/80">
                Account personalization stays local for history/account context. Current history class{' '}
                <span className="font-black text-violet-100">{personalizationPreview.historyClass.label}</span>.{' '}
                <Link to="/account" className="font-black text-violet-100 underline decoration-violet-300/40 underline-offset-2">
                  Edit in Account
                </Link>
              </p>
              <button
                type="button"
                className="shrink-0 rounded-xl border border-slate-600 bg-slate-950/50 px-3 py-1.5 text-[11px] font-black text-slate-300 hover:border-slate-500 hover:text-slate-100"
                onClick={() => setPromptMods({ ...DEFAULT_PROMPT_MODS })}
              >
                Reset all
              </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              <div className="rounded-xl border border-slate-700/60 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-black text-slate-100">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-600 bg-slate-900 accent-cyan-500"
                      checked={promptMods.responseLengthEnabled}
                      onChange={(e) =>
                        setPromptMods((m) => ({ ...m, responseLengthEnabled: e.target.checked }))
                      }
                    />
                    Response length{responseLengthMaxWords ? ` · max ${responseLengthMaxWords.toLocaleString()} words` : ''}
                  </label>
                  <span className="text-[11px] font-bold tabular-nums text-cyan-400/90">
                    {RESPONSE_LENGTH_LEVELS[promptMods.responseLength]?.label ?? '—'}
                  </span>
                </div>
                <div
                  className={
                    promptMods.responseLengthEnabled ? 'mt-3 space-y-2' : 'pointer-events-none mt-3 space-y-2 opacity-40'
                  }
                >
                  <input
                    type="range"
                    min={0}
                    max={maxAllowedResponseLengthLevel}
                    step={1}
                    value={promptMods.responseLength}
                    disabled={!promptMods.responseLengthEnabled}
                    onChange={(e) =>
                      setPromptMods((m) => ({ ...m, responseLength: Math.min(Number(e.target.value), maxAllowedResponseLengthLevel) }))
                    }
                    className="w-full accent-cyan-500"
                    aria-label="Response length level"
                  />
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    <span>Brief</span>
                    <span>100w</span>
                    <span>In-depth</span>
                  </div>
                  <p className="text-[11px] text-slate-500">{RESPONSE_LENGTH_LEVELS[promptMods.responseLength]?.hint}</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-700/60 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-black text-slate-100">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-600 bg-slate-900 accent-cyan-500"
                      checked={promptMods.toneEnabled}
                      onChange={(e) => setPromptMods((m) => ({ ...m, toneEnabled: e.target.checked }))}
                    />
                    Tone
                  </label>
                  <span className="text-[11px] font-bold text-cyan-400/90">
                    {TONE_LEVELS[promptMods.toneLevel]?.emoji} {TONE_LEVELS[promptMods.toneLevel]?.label}
                  </span>
                </div>
                <div
                  className={
                    promptMods.toneEnabled ? 'mt-3 space-y-2' : 'pointer-events-none mt-3 space-y-2 opacity-40'
                  }
                >
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={1}
                    value={promptMods.toneLevel}
                    disabled={!promptMods.toneEnabled}
                    onChange={(e) =>
                      setPromptMods((m) => ({ ...m, toneLevel: Number(e.target.value) }))
                    }
                    className="w-full accent-cyan-500"
                    aria-label="Tone level"
                  />
                  <div className="flex justify-between text-[10px] font-bold text-slate-500">
                    <span>Sensitive</span>
                    <span>Angry</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-700/60 bg-black/20 p-4 lg:col-span-2 xl:col-span-1">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-black text-slate-100">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900 accent-cyan-500"
                    checked={promptMods.personaEnabled}
                    onChange={(e) => setPromptMods((m) => ({ ...m, personaEnabled: e.target.checked }))}
                  />
                  Persona
                </label>
                <textarea
                  value={promptMods.personaText}
                  disabled={!promptMods.personaEnabled}
                  onChange={(e) => setPromptMods((m) => ({ ...m, personaText: e.target.value }))}
                  placeholder="Describe yourself so answers stay relevant (same field as main CleanSeek)."
                  rows={3}
                  className="mt-3 w-full resize-y rounded-xl border border-slate-700 bg-[#050B14]/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-cyan-500/40 disabled:opacity-40"
                  aria-label="Persona description"
                />
              </div>

              <div className="rounded-xl border border-slate-700/60 bg-black/20 p-4 lg:col-span-2 xl:col-span-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-black text-slate-100">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-600 bg-slate-900 accent-cyan-500"
                      checked={promptMods.comprehensionEnabled}
                      onChange={(e) =>
                        setPromptMods((m) => ({ ...m, comprehensionEnabled: e.target.checked }))
                      }
                    />
                    Comprehension level
                  </label>
                  <span className="text-[11px] font-bold text-cyan-400/90">
                    {COMPREHENSION_LABELS[promptMods.comprehensionLevel]?.emoji}{' '}
                    {COMPREHENSION_LABELS[promptMods.comprehensionLevel]?.label}
                  </span>
                </div>
                <div
                  className={
                    promptMods.comprehensionEnabled
                      ? 'mt-3 space-y-2'
                      : 'pointer-events-none mt-3 space-y-2 opacity-40'
                  }
                >
                  <input
                    type="range"
                    min={0}
                    max={4}
                    step={1}
                    value={promptMods.comprehensionLevel}
                    disabled={!promptMods.comprehensionEnabled}
                    onChange={(e) =>
                      setPromptMods((m) => ({ ...m, comprehensionLevel: Number(e.target.value) }))
                    }
                    className="w-full accent-cyan-500"
                    aria-label="Comprehension level"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-700/60 bg-black/20 p-4">
              <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Analysis mode</div>
              <p className="mt-1 text-xs text-slate-400 leading-snug">
                Optional synthesizer pass using an analysis model. Default analysis model is <span className="text-slate-200 font-semibold">chatgpt</span>.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select
                  value={analysisMode}
                  onChange={(e) => setAnalysisMode(e.target.value)}
                  className="min-w-[220px] rounded-xl border border-slate-700 bg-[#050B14]/80 px-3 py-2 text-sm font-black text-slate-100 outline-none focus:border-cyan-500/40"
                  aria-label="Analysis mode"
                >
                  <option value="none">None</option>
                  {analysisModes.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>

                <select
                  value={analysisJudge}
                  onChange={(e) => setAnalysisJudge(e.target.value)}
                  className="min-w-[200px] rounded-xl border border-slate-700 bg-[#050B14]/80 px-3 py-2 text-sm font-black text-slate-100 outline-none focus:border-cyan-500/40"
                  aria-label="Analysis model"
                >
                  {analysisEngineCatalog.map((e) => (
                    <option key={e.id} value={e.id}>
                      Analysis model: {e.label}
                    </option>
                  ))}
                </select>

                {analysisMode !== 'none' ? (
                  <span className="rounded-xl border border-violet-500/35 bg-violet-500/10 px-3 py-2 text-xs font-black text-violet-100">
                    Enabled
                  </span>
                ) : (
                  <span className="rounded-xl border border-slate-700 bg-slate-950/30 px-3 py-2 text-xs font-black text-slate-500">
                    Off
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-700/60 bg-black/20 p-4">
              <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Reasoning style</div>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(REASONING_STYLES) as ReasoningStyle[]).map((id) => {
                  const cfg = REASONING_STYLES[id]
                  const on = promptMods.reasoningStyle === id
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() =>
                        setPromptMods((m) => ({
                          ...m,
                          reasoningStyle: m.reasoningStyle === id ? null : id,
                        }))
                      }
                      className={`rounded-xl border px-3 py-1.5 text-xs font-black ${
                        on
                          ? 'border-cyan-500/45 bg-cyan-500/15 text-cyan-50'
                          : 'border-slate-700 bg-slate-950/40 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {cfg.emoji} {cfg.label}
                    </button>
                  )
                })}
              </div>
              <div className="pt-1 text-[11px] font-black uppercase tracking-widest text-slate-500">Format</div>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(MODIFIER_FLAGS) as ModifierFlag[]).map((id) => {
                  const cfg = MODIFIER_FLAGS[id]
                  const on = promptMods.modifierFlags.includes(id)
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() =>
                        setPromptMods((m) => ({
                          ...m,
                          modifierFlags: on ? m.modifierFlags.filter((x) => x !== id) : [...m.modifierFlags, id],
                        }))
                      }
                      className={`rounded-xl border px-3 py-1.5 text-xs font-black ${
                        on
                          ? 'border-violet-500/45 bg-violet-500/15 text-violet-50'
                          : 'border-slate-700 bg-slate-950/40 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {cfg.emoji} {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          </details>
        ) : null}

        {/* Models + Search — hidden in RabbitHole view (results-only). */}
        {!isRabbitHole && !isThreeColumnCleanseek && !isXmarks
          ? (() => {
          const inner = (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Models + Search to run</div>
                  <p className="mt-1 max-w-2xl text-xs leading-snug text-slate-400">
                    <span className="font-semibold text-slate-300">My picks only</span> (default): Search runs exactly the models and
                    search sources you toggle. <span className="font-semibold text-slate-300">Preset bundles</span> match main CleanSeek:
                    Quick / Research / Web each ship a fixed provider list (All In uses your toggles).
                  </p>
                </div>
              </div>

          <div className="mt-4 flex flex-wrap gap-2 rounded-xl border border-slate-700/50 bg-black/25 p-1">
            <button
              type="button"
              onClick={() => {
                setEnginePickMode('preset')
                const pr = PRESETS.find((x) => x.id === activePreset)
                if (pr && pr.engineIds.length > 0) setEnabledEngineIds([...pr.engineIds])
              }}
              className={`flex-1 min-w-[140px] rounded-lg px-3 py-2 text-center text-xs font-black transition-colors sm:flex-none ${
                enginePickMode === 'preset'
                  ? 'bg-cyan-500/20 text-cyan-50 ring-1 ring-cyan-500/40'
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
              }`}
              aria-pressed={enginePickMode === 'preset'}
            >
              Preset bundles
            </button>
            <button
              type="button"
              onClick={() => setEnginePickMode('custom')}
              className={`flex-1 min-w-[140px] rounded-lg px-3 py-2 text-center text-xs font-black transition-colors sm:flex-none ${
                enginePickMode === 'custom'
                  ? 'bg-cyan-500/20 text-cyan-50 ring-1 ring-cyan-500/40'
                  : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
              }`}
              aria-pressed={enginePickMode === 'custom'}
            >
              My picks only
            </button>
          </div>

          <div className="mt-3 rounded-xl border border-slate-700/60 bg-slate-950/30 px-3 py-2 text-[11px] leading-snug text-slate-400">
            <span className="font-black uppercase tracking-wide text-slate-500">Next request · </span>
            <span className="font-mono text-slate-200">{idsActuallySent.map((id) => displayEngineName(id)).join(', ') || '—'}</span>
            {idsActuallySent.length ? <span className="ml-2 text-slate-500">({formatProviderMix(idsActuallySent)})</span> : null}
            {!disableGrokLive && useLatest && idsActuallySent.length && !idsActuallySent.includes('groksearch') ? (
              <span className="text-slate-500"> (+ live web when Live X is on)</span>
            ) : null}
          </div>

          {presetLocksEngines ? (
            <div
              className="mt-3 rounded-xl border border-amber-500/35 bg-amber-500/[0.08] px-3 py-2 text-xs leading-snug text-amber-100"
              role="status"
            >
              <span className="font-black text-amber-200">{activePresetLabel}</span> locks the model/search list while{' '}
              <strong className="text-amber-50">Preset bundles</strong> is on — always matches the list above. Changing any toggle
              switches you to <strong className="text-amber-50">My picks only</strong> so Search respects only what you select.
            </div>
          ) : null}

          <div className="mt-3 space-y-3">
            {(['model', 'search'] as ProviderKind[]).map((kind) => (
              <div key={kind}>
                <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {kind === 'model' ? 'Models' : 'Search Sources'}
                </div>
                <div className="flex flex-wrap gap-2">
                  {ENGINE_CATALOG.filter((eng) => eng.kind === kind).map((eng) => {
                    const on = enabledEngineIds.includes(eng.id)
                    const disabled = analysisMode !== 'none' && !analysisSelectableEngineIds.has(eng.id)
                    return (
                      <button
                        key={eng.id}
                        type="button"
                        onClick={() => toggleEngineEnabled(eng.id)}
                        disabled={disabled}
                        className={`rounded-xl px-3 py-1.5 text-xs font-black border transition-colors ${
                          disabled
                            ? 'cursor-not-allowed border-slate-800 bg-slate-950/20 text-slate-700 opacity-60'
                            : on
                              ? 'border-cyan-500/45 bg-cyan-500/15 text-cyan-50'
                              : 'border-slate-700 bg-slate-950/40 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                        }`}
                        aria-pressed={on}
                      >
                        {eng.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
            </>
          )

          if (isMobile || isTicker || isXmarks) {
            return (
              <details className="mt-4 rounded-2xl border border-slate-700/60 bg-[#0A1128]/40 open:border-cyan-500/30">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-sm font-black text-slate-100 [&::-webkit-details-marker]:hidden">
                  <span>Models + Search to run</span>
                  <span className="text-[11px] font-black text-slate-500">Tap to expand ▾</span>
                </summary>
                <div className="border-t border-slate-800/90 px-4 pb-4 pt-4">{inner}</div>
              </details>
            )
          }

          return <div className="mt-6 rounded-2xl border border-slate-700/60 bg-[#0A1128]/40 px-4 py-4">{inner}</div>
        })()
          : null}

        {/* Presets — hidden in RabbitHole view (results-only). */}
        {!isRabbitHole && !isThreeColumnCleanseek && !isXmarks ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
          {presets.map((p) => {
            const providerIds = providerIdsForPreset(p, enabledEngineIds)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  if (didLongPressRef.current) return
                  setActivePreset(p.id)
                  syncCleanseekUrl(query, useLatest, p.id)
                  // Presets should be actionable even when "My picks only" is selected:
                  // Selecting a preset applies its model/search list immediately.
                  if (p.engineIds.length > 0) {
                    setEnabledEngineIds([...p.engineIds])
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  openPresetEditor(p.id)
                }}
                onPointerDown={() => startPresetLongPress(p.id)}
                onPointerUp={stopPresetLongPress}
                onPointerCancel={stopPresetLongPress}
                onPointerLeave={stopPresetLongPress}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-black border ${
                  activePreset === p.id
                    ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-100'
                    : 'border-slate-700 bg-slate-900/30 text-slate-200'
                }`}
                aria-pressed={activePreset === p.id}
              >
                <span>
                  {p.emoji} {p.label}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 tabular-nums">
                  {formatProviderMix(providerIds)}
                </span>
              </button>
            )
          })}
          </div>
        ) : null}

        {lastSentPrompt ? (
          <section className="mt-4 rounded-2xl border border-slate-700/60 bg-[#0A1128]/45">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => setShowSentPrompt((v) => !v)}
                className="inline-flex min-w-0 flex-1 items-center gap-2 text-left text-xs font-black uppercase tracking-widest text-slate-300 hover:text-slate-100"
                aria-expanded={showSentPrompt}
              >
                <Code2 className="h-4 w-4 shrink-0 text-cyan-300" />
                <span className="truncate">Prompt sent</span>
                <span className="text-[10px] text-slate-500">{showSentPrompt ? 'Hide' : 'Show'}</span>
              </button>
              <button
                type="button"
                onClick={() => void copySentPrompt()}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-950/40 text-slate-300 hover:border-cyan-500/40 hover:text-cyan-100"
                aria-label="Copy sent prompt"
                title="Copy sent prompt"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            {showSentPrompt ? (
              <pre className="max-h-72 overflow-auto border-t border-slate-800/90 px-4 py-3 text-xs leading-5 text-slate-300">
                {lastSentPrompt}
              </pre>
            ) : null}
          </section>
        ) : null}

        {editingPresetId ? (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 px-4"
            role="dialog"
            aria-modal="true"
            aria-label="Edit preset models and search"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closePresetEditor()
            }}
          >
            <div className="w-full max-w-lg rounded-3xl border border-slate-700/70 bg-[#0A1128]/95 backdrop-blur-2xl p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-black">Edit models/search</div>
                  <div className="mt-1 text-xs text-slate-400">
                    Preset: <span className="font-mono">{editingPresetId}</span> · Long-press any preset pill to edit
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closePresetEditor}
                  className="rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 text-xs font-black text-slate-200"
                >
                  Close
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {(['model', 'search'] as ProviderKind[]).map((kind) => (
                  <div key={kind}>
                    <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      {kind === 'model' ? 'Models' : 'Search'}
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {ENGINE_CATALOG.filter((eng) => eng.kind === kind).map((eng) => {
                        const on = editingEngineIds.includes(eng.id)
                        return (
                          <button
                            key={eng.id}
                            type="button"
                            onClick={() => toggleEditingEngine(eng.id)}
                            className={`rounded-2xl px-3 py-2 text-xs font-black border transition-colors ${
                              on
                                ? 'border-cyan-500/45 bg-cyan-500/15 text-cyan-50'
                                : 'border-slate-700 bg-slate-950/40 text-slate-300 hover:border-slate-600'
                            }`}
                            aria-pressed={on}
                          >
                            {eng.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-slate-400">
                  Selected: <span className="font-black text-slate-200 tabular-nums">{formatProviderMix(editingEngineIds)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => applyPresetEngineSelection(initialEngineIds)}
                    className="rounded-2xl border border-slate-700 bg-slate-950/30 px-4 py-2 text-xs font-black text-slate-200"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetEngineSelection([])}
                    className="rounded-2xl border border-slate-700 bg-slate-950/30 px-4 py-2 text-xs font-black text-slate-200"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={closePresetEditor}
                    className="rounded-2xl bg-cyan-500 px-5 py-2 text-xs font-black text-[#050B14]"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Results — above demos; full-width responsive grid */}
        {!isTicker || isSearching || Object.keys(results).length > 0 ? (
        <section className="mt-6 w-full min-w-0" aria-label="Search results">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Results</span>
            {resultActionNotice ? (
              <span className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-100">
                {resultActionNotice}
              </span>
            ) : null}
          </div>
          {rawPlayground ? (
            <RawPlaygroundDebugPanel
              requests={rawDebugRequests}
              results={results}
              isSearching={isSearching}
            />
          ) : null}
          <div
            className={
              isMobile
                ? 'grid w-full min-w-0 gap-4 grid-cols-1'
                : 'grid w-full min-w-0 gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr))]'
            }
          >
          {Object.keys(results).length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-700/80 bg-[#0A1128]/40 px-6 py-14 text-center text-sm text-slate-400">
              No results yet — run Search above, or open the roadmap for curated starts.
            </div>
          ) : (
            (() => {
              const fallback = useLatest
                ? ['groksearch', 'tavily', 'chatgpt', 'claude', 'gemini', 'chatgptsearch', 'brave', 'grok', 'grok4', 'grokx']
                : ['tavily', 'chatgpt', 'claude', 'gemini', 'chatgptsearch', 'brave', 'groksearch', 'grok', 'grok4', 'grokx']
              const order = resultOrderRef.current.length ? resultOrderRef.current : fallback

              const items = Object.values(results)
              items.sort((a, b) => {
                const ia = order.indexOf(a.provider)
                const ib = order.indexOf(b.provider)
                return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
              })

	              return items.map((r) => {
	                const isGrokLive = useLatest && r.provider === 'groksearch'
	                const isXmarksEvidenceProvider = isXmarks && (r.provider === 'groksearch' || r.provider === 'grokx')
	                const isEvidenceProvider = isGrokLive || isXmarksEvidenceProvider
	                const isInternetResult = isInternetResultProvider(r.provider)
			                const ctx = isEvidenceProvider ? parseLiveXContext(r.content ?? '') : null
			                const xSynthesis = isEvidenceProvider ? parseXRunSynthesis(r.content ?? '', ctx) : null
			                const internetResults = isInternetResult ? parseInternetSearchResults(r.content ?? '') : []
			                const citationLinks = !isInternetResult && r.status !== 'loading' ? parseCitationLinks(r.content ?? '') : []
	                const start = resultStartTimesRef.current[r.provider]
	                const end = resultEndTimesRef.current[r.provider]
	                const measuredDuration = start && end ? end - start : null
	                const latencyText = formatDurationMs(r.durationMs ?? measuredDuration)
	                const statusText = r.status === 'loading' ? (isDeepDive && isEvidenceProvider ? 'deep dive...' : 'loading...') : r.status

	                return (
                  <div
                    key={r.provider}
	                    className={`min-w-0 w-full rounded-3xl border bg-[#0A1128]/70 backdrop-blur-2xl p-5 ${
	                      isEvidenceProvider
	                        ? 'border-emerald-400/40 shadow-[0_0_35px_rgba(16,185,129,0.18)]'
	                        : 'border-slate-700/60'
	                    }`}
                  >
	                    <div className="flex items-center justify-between gap-3">
	                      <div className="font-black flex items-center gap-2">
	                        {isEvidenceProvider ? (isXmarks ? 'X synthesis' : 'Live X') : displayEngineName(r.provider, r.providerName)}
	                        {isEvidenceProvider ? (
	                          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-[10px] font-black tracking-widest text-emerald-100">
	                            X REFS <span className="h-2 w-2 rounded-full bg-emerald-400" />
	                          </span>
	                        ) : (
                          <span className="rounded-full border border-slate-700 bg-slate-950/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            {providerKindLabel(r.provider)}
                          </span>
                        )}
                      </div>
	                      <div className="flex shrink-0 items-center gap-1">
	                        {latencyText ? (
	                          <span className="rounded-full border border-slate-700 bg-black/20 px-2 py-1 font-mono text-[10px] text-slate-400">
	                            {latencyText}
	                          </span>
	                        ) : null}
	                        <span className={`px-1 text-xs ${r.status === 'error' ? 'text-red-300' : 'text-slate-400'}`}>
	                          {statusText}
	                        </span>
	                        <button
	                          type="button"
	                          onClick={() => void copyResultText(r.provider, r.content)}
	                          disabled={!r.content.trim()}
	                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-700 bg-slate-950/30 text-slate-400 hover:border-cyan-500/40 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-35"
	                          aria-label={`Copy ${displayEngineName(r.provider, r.providerName)} result`}
	                          title="Copy result"
	                        >
	                          <Copy className="h-3.5 w-3.5" />
	                        </button>
	                        <button
	                          type="button"
	                          onClick={() => void run({ forceProvider: r.provider, replaceProvider: true })}
	                          disabled={isSearching}
	                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-700 bg-slate-950/30 text-slate-400 hover:border-cyan-500/40 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-35"
	                          aria-label={`Retry ${displayEngineName(r.provider, r.providerName)}`}
	                          title="Retry this source"
	                        >
	                          <RotateCcw className="h-3.5 w-3.5" />
	                        </button>
	                      </div>
                    </div>

	                    <div className={`mt-3 text-sm leading-relaxed ${isGrokLive ? 'text-slate-100' : 'text-slate-200/90'}`}>
	                      {r.content || r.status === 'loading' ? (
	                        isInternetResult && r.status !== 'loading' ? (
	                          <InternetResultList items={internetResults} fallback={r.content} />
	                        ) : (
	                          <div className="prose prose-invert prose-sm max-w-none prose-pre:bg-black/30 prose-pre:border prose-pre:border-slate-800 prose-pre:rounded-xl prose-pre:p-3 prose-code:text-slate-100 prose-code:bg-black/20 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-md prose-a:text-cyan-300 prose-a:underline-offset-4 prose-strong:text-slate-100 prose-h1:text-slate-100 prose-h2:text-slate-100 prose-h3:text-slate-100 prose-li:marker:text-slate-500">
	                            <ReactMarkdown
	                              remarkPlugins={[remarkGfm]}
	                              components={{
		                                a: ({ href, children, ...props }) => (
                                      href && isCitationMarker(reactNodeText(children as ReactNode)) ? (
                                        <ModelCitationInline citation={citationFromHref(reactNodeText(children as ReactNode), href)} />
                                      ) : (
		                                    <a href={href} target="_blank" rel="noreferrer" {...props}>
		                                      {children}
		                                    </a>
                                      )
		                                ),
	                                code: ({ className, children, ...props }) => {
	                                  const isBlock = /\blanguage-/.test(className ?? '')
	                                  if (isBlock) {
	                                    return (
	                                      <pre className="overflow-x-auto">
	                                        <code className={className} {...props}>
	                                          {String(children).replace(/\n$/, '')}
	                                        </code>
	                                      </pre>
	                                    )
	                                  }
	                                  return (
	                                    <code className={className} {...props}>
	                                      {children}
	                                    </code>
	                                  )
	                                },
	                              }}
		                            >
		                              {r.content || '…'}
		                            </ReactMarkdown>
                                <ModelSourceRail citations={citationLinks} />
		                          </div>
	                        )
	                      ) : null}
	                    </div>

	                    {isEvidenceProvider && xSynthesis ? (
	                      <XEvidenceSynthesisPanel
	                        synthesis={xSynthesis}
	                        context={ctx}
	                        isSearching={isSearching}
	                        canDeepDive={r.status !== 'loading'}
	                        onDeepDive={() =>
	                          run({
	                            forceProvider: isXmarks ? 'grokx' : 'groksearch',
	                            deepDive: true,
	                          })
	                        }
	                      />
	                    ) : null}
                  </div>
                )
              })
            })()
          )}
          </div>
          {!isSearching && suggestedFollowUps.length ? (
            <div className="mt-5 rounded-3xl border border-slate-700/60 bg-[#0A1128]/55 p-4">
              <div className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">Follow-ups</div>
              <div className="flex flex-wrap gap-2">
                {suggestedFollowUps.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => void run({ queryOverride: question })}
                    className="rounded-2xl border border-slate-700 bg-slate-950/35 px-3 py-2 text-left text-xs font-black text-slate-200 hover:border-cyan-500/40 hover:text-cyan-100"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>
        ) : null}

			          </div>

	          {isThreeColumnCleanseek || isXmarks ? (
	            <aside
	              className={
	                isThreeColumnCleanseek
	                  ? 'hidden md:block md:sticky md:top-5 md:max-h-[calc(100vh-2.5rem)] md:overflow-y-auto md:pl-1'
	                  : 'w-full lg:sticky lg:top-5 lg:max-h-[calc(100vh-2.5rem)] lg:overflow-y-auto lg:pl-1'
	              }
	            >
              <div className="space-y-4">
                <section className="rounded-3xl border border-slate-700/60 bg-[#0A1128]/70 p-4 backdrop-blur-2xl">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Models + Search</div>
                      <p className="mt-1 text-xs leading-snug text-slate-400">
                        Pick model bundles or search sources for the next run.
                      </p>
                    </div>
                    <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-black text-cyan-100">
                      {formatProviderMixCompact(idsActuallySent)}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {presets.map((p) => {
                      const providerIds = providerIdsForPreset(p, enabledEngineIds)
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            if (didLongPressRef.current) return
                            setActivePreset(p.id)
                            syncCleanseekUrl(query, useLatest, p.id)
                            if (p.engineIds.length > 0) setEnabledEngineIds([...p.engineIds])
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault()
                            openPresetEditor(p.id)
                          }}
                          onPointerDown={() => startPresetLongPress(p.id)}
                          onPointerUp={stopPresetLongPress}
                          onPointerCancel={stopPresetLongPress}
                          onPointerLeave={stopPresetLongPress}
                          className={`rounded-2xl border px-3 py-2 text-left text-xs font-black ${
                            activePreset === p.id
                              ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-100'
                              : 'border-slate-700 bg-slate-900/30 text-slate-300 hover:border-slate-600'
                          }`}
                          aria-pressed={activePreset === p.id}
                        >
                          <span className="block truncate">
                            {p.emoji} {p.label}
                          </span>
                          <span className="mt-1 block text-[10px] uppercase tracking-wide text-slate-500">
                            {formatProviderMix(providerIds)}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-slate-700/50 bg-black/25 p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEnginePickMode('preset')
                        const pr = PRESETS.find((x) => x.id === activePreset)
                        if (pr && pr.engineIds.length > 0) setEnabledEngineIds([...pr.engineIds])
                      }}
                      className={`rounded-xl px-3 py-2 text-center text-[11px] font-black ${
                        enginePickMode === 'preset'
                          ? 'bg-cyan-500/20 text-cyan-50 ring-1 ring-cyan-500/40'
                          : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                      }`}
                      aria-pressed={enginePickMode === 'preset'}
                    >
                      Preset
                    </button>
                    <button
                      type="button"
                      onClick={() => setEnginePickMode('custom')}
                      className={`rounded-xl px-3 py-2 text-center text-[11px] font-black ${
                        enginePickMode === 'custom'
                          ? 'bg-cyan-500/20 text-cyan-50 ring-1 ring-cyan-500/40'
                          : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                      }`}
                      aria-pressed={enginePickMode === 'custom'}
                    >
                      My picks
                    </button>
                  </div>

                  <div className="mt-3 rounded-2xl border border-slate-700/60 bg-slate-950/30 px-3 py-2 text-[11px] leading-snug text-slate-400">
                    <span className="font-black uppercase tracking-wide text-slate-500">Next · </span>
                    <span className="font-mono text-slate-200">{idsActuallySent.map((id) => displayEngineName(id)).join(', ') || '—'}</span>
                    {idsActuallySent.length ? <span className="ml-2 text-slate-500">({formatProviderMix(idsActuallySent)})</span> : null}
                  </div>

                  {presetLocksEngines ? (
                    <div className="mt-3 rounded-2xl border border-amber-500/35 bg-amber-500/[0.08] px-3 py-2 text-xs leading-snug text-amber-100">
                      <span className="font-black text-amber-200">{activePresetLabel}</span> locks the model/search list while Preset mode is on.
                    </div>
                  ) : null}

                  <div className="mt-3 space-y-3">
                    {(['model', 'search'] as ProviderKind[]).map((kind) => (
                      <div key={kind}>
                        <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                          {kind === 'model' ? 'Models' : 'Search Sources'}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {ENGINE_CATALOG.filter((eng) => eng.kind === kind).map((eng) => {
                            const on = enabledEngineIds.includes(eng.id)
                            const disabled = analysisMode !== 'none' && !analysisSelectableEngineIds.has(eng.id)
                            return (
                              <button
                                key={eng.id}
                                type="button"
                                onClick={() => toggleEngineEnabled(eng.id)}
                                disabled={disabled}
                                className={`rounded-xl border px-2.5 py-1.5 text-[11px] font-black ${
                                  disabled
                                    ? 'cursor-not-allowed border-slate-800 bg-slate-950/20 text-slate-700 opacity-60'
                                    : on
                                      ? 'border-cyan-500/45 bg-cyan-500/15 text-cyan-50'
                                      : 'border-slate-700 bg-slate-950/40 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                                }`}
                                aria-pressed={on}
                              >
                                {eng.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-700/60 bg-[#0A1128]/70 p-4 backdrop-blur-2xl">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Prompt modifiers</div>
                      <p className="mt-1 text-xs leading-snug text-slate-400">
                        {promptModifierActiveCount > 0 ? `${promptModifierActiveCount} active` : 'Optional instruction layer'}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-xl border border-slate-600 bg-slate-950/50 px-3 py-1.5 text-[11px] font-black text-slate-300 hover:border-slate-500 hover:text-slate-100"
                      onClick={() => setPromptMods({ ...DEFAULT_PROMPT_MODS })}
                    >
                      Reset
                    </button>
                  </div>

                  <div className="mt-4 space-y-4">
                    <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-700/60 bg-black/20 px-3 py-2">
                      <span className="text-xs font-black text-slate-100">
                        Response length{responseLengthMaxWords ? ` · max ${responseLengthMaxWords.toLocaleString()} words` : ''}
                      </span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-600 bg-slate-900 accent-cyan-500"
                        checked={promptMods.responseLengthEnabled}
                        onChange={(e) => setPromptMods((m) => ({ ...m, responseLengthEnabled: e.target.checked }))}
                      />
                    </label>
                    <div className={promptMods.responseLengthEnabled ? 'space-y-2' : 'pointer-events-none space-y-2 opacity-40'}>
                      <input
                        type="range"
                        min={0}
                        max={maxAllowedResponseLengthLevel}
                        step={1}
                        value={promptMods.responseLength}
                        disabled={!promptMods.responseLengthEnabled}
                        onChange={(e) =>
                          setPromptMods((m) => ({ ...m, responseLength: Math.min(Number(e.target.value), maxAllowedResponseLengthLevel) }))
                        }
                        className="w-full accent-cyan-500"
                        aria-label="Response length level"
                      />
                      <div className="text-[11px] font-bold text-cyan-300/90">
                        {RESPONSE_LENGTH_LEVELS[promptMods.responseLength]?.label ?? '—'}
                      </div>
                    </div>

                    <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-700/60 bg-black/20 px-3 py-2">
                      <span className="text-xs font-black text-slate-100">Tone</span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-600 bg-slate-900 accent-cyan-500"
                        checked={promptMods.toneEnabled}
                        onChange={(e) => setPromptMods((m) => ({ ...m, toneEnabled: e.target.checked }))}
                      />
                    </label>
                    <div className={promptMods.toneEnabled ? 'space-y-2' : 'pointer-events-none space-y-2 opacity-40'}>
                      <input
                        type="range"
                        min={0}
                        max={5}
                        step={1}
                        value={promptMods.toneLevel}
                        disabled={!promptMods.toneEnabled}
                        onChange={(e) => setPromptMods((m) => ({ ...m, toneLevel: Number(e.target.value) }))}
                        className="w-full accent-cyan-500"
                        aria-label="Tone level"
                      />
                      <div className="text-[11px] font-bold text-cyan-300/90">
                        {TONE_LEVELS[promptMods.toneLevel]?.emoji} {TONE_LEVELS[promptMods.toneLevel]?.label}
                      </div>
                    </div>

                    <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-700/60 bg-black/20 px-3 py-2">
                      <span className="text-xs font-black text-slate-100">Persona</span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-600 bg-slate-900 accent-cyan-500"
                        checked={promptMods.personaEnabled}
                        onChange={(e) => setPromptMods((m) => ({ ...m, personaEnabled: e.target.checked }))}
                      />
                    </label>
                    <textarea
                      value={promptMods.personaText}
                      disabled={!promptMods.personaEnabled}
                      onChange={(e) => setPromptMods((m) => ({ ...m, personaText: e.target.value }))}
                      placeholder="Describe yourself so answers stay relevant."
                      rows={3}
                      className="w-full resize-y rounded-2xl border border-slate-700 bg-[#050B14]/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-cyan-500/40 disabled:opacity-40"
                      aria-label="Persona description"
                    />

                    <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-700/60 bg-black/20 px-3 py-2">
                      <span className="text-xs font-black text-slate-100">Comprehension</span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-600 bg-slate-900 accent-cyan-500"
                        checked={promptMods.comprehensionEnabled}
                        onChange={(e) => setPromptMods((m) => ({ ...m, comprehensionEnabled: e.target.checked }))}
                      />
                    </label>
                    <div className={promptMods.comprehensionEnabled ? 'space-y-2' : 'pointer-events-none space-y-2 opacity-40'}>
                      <input
                        type="range"
                        min={0}
                        max={4}
                        step={1}
                        value={promptMods.comprehensionLevel}
                        disabled={!promptMods.comprehensionEnabled}
                        onChange={(e) => setPromptMods((m) => ({ ...m, comprehensionLevel: Number(e.target.value) }))}
                        className="w-full accent-cyan-500"
                        aria-label="Comprehension level"
                      />
                      <div className="text-[11px] font-bold text-cyan-300/90">
                        {COMPREHENSION_LABELS[promptMods.comprehensionLevel]?.emoji}{' '}
                        {COMPREHENSION_LABELS[promptMods.comprehensionLevel]?.label}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-700/60 bg-black/20 p-3">
                      <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Analysis</div>
                      <div className="mt-3 grid gap-2">
                        <select
                          value={analysisMode}
                          onChange={(e) => setAnalysisMode(e.target.value)}
                          className="w-full rounded-xl border border-slate-700 bg-[#050B14]/80 px-3 py-2 text-xs font-black text-slate-100 outline-none focus:border-cyan-500/40"
                          aria-label="Analysis mode"
                        >
                          <option value="none">None</option>
                          {analysisModes.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={analysisJudge}
                          onChange={(e) => setAnalysisJudge(e.target.value)}
                          className="w-full rounded-xl border border-slate-700 bg-[#050B14]/80 px-3 py-2 text-xs font-black text-slate-100 outline-none focus:border-cyan-500/40"
                          aria-label="Analysis model"
                        >
                          {analysisEngineCatalog.map((e) => (
                            <option key={e.id} value={e.id}>
                              Analysis model: {e.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <details className="rounded-2xl border border-slate-700/60 bg-black/20 open:border-cyan-500/30">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-black text-slate-100 [&::-webkit-details-marker]:hidden">
                        Reasoning and format
                        <span className="text-[10px] text-slate-500">Expand</span>
                      </summary>
                      <div className="space-y-3 border-t border-slate-800 px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          {(Object.keys(REASONING_STYLES) as ReasoningStyle[]).map((id) => {
                            const cfg = REASONING_STYLES[id]
                            const on = promptMods.reasoningStyle === id
                            return (
                              <button
                                key={id}
                                type="button"
                                onClick={() =>
                                  setPromptMods((m) => ({
                                    ...m,
                                    reasoningStyle: m.reasoningStyle === id ? null : id,
                                  }))
                                }
                                className={`rounded-xl border px-2.5 py-1.5 text-[11px] font-black ${
                                  on
                                    ? 'border-cyan-500/45 bg-cyan-500/15 text-cyan-50'
                                    : 'border-slate-700 bg-slate-950/40 text-slate-400 hover:border-slate-600'
                                }`}
                              >
                                {cfg.emoji} {cfg.label}
                              </button>
                            )
                          })}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(Object.keys(MODIFIER_FLAGS) as ModifierFlag[]).map((id) => {
                            const cfg = MODIFIER_FLAGS[id]
                            const on = promptMods.modifierFlags.includes(id)
                            return (
                              <button
                                key={id}
                                type="button"
                                onClick={() =>
                                  setPromptMods((m) => ({
                                    ...m,
                                    modifierFlags: on ? m.modifierFlags.filter((x) => x !== id) : [...m.modifierFlags, id],
                                  }))
                                }
                                className={`rounded-xl border px-2.5 py-1.5 text-[11px] font-black ${
                                  on
                                    ? 'border-violet-500/45 bg-violet-500/15 text-violet-50'
                                    : 'border-slate-700 bg-slate-950/40 text-slate-400 hover:border-slate-600'
                                }`}
                              >
                                {cfg.emoji} {cfg.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </details>
	                  </div>
	                </section>

		              </div>
	            </aside>
	          ) : null}

	          {isTicker ? (
            <aside className="order-3 w-full xl:col-span-2 xl:row-start-2">
              <WhalesEditionPanel
                symbol={tickerSymbol}
                onFillPrompt={(prompt) => {
                  setQuery(prompt)
                  if (typeof window !== 'undefined') {
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }
                }}
              />
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  )
}
