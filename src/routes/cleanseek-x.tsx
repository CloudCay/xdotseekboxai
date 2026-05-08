import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { getClientId } from '../lib/clientId'
import {
  composeCleanseekPrompt,
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
import { LogOut, Mic, Play, Search, Sparkles, UserRound } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { ensureAccount } from '../lib/ensureAccount'
import {
  DEFAULT_XMARKS_PRESETS,
  loadXmarksUserPicksFromLocalStorage,
  saveXmarksUserPicksToLocalStorage,
  type XmarksKind,
  type XmarksPreset,
} from '../lib/xmarksLibrary'

export const Route = createFileRoute('/cleanseek-x')({
  component: CleanSeekXMobileRoute,
})

const RECENCY_INSTRUCTION =
  ' [LIVE MODE: Prioritize information from the past 7 days. If you have live web or X (Twitter) access, format your response with the sections below. If you do not have live X access, write the literal text \"No live X signals available\" at the top, then answer normally.\n\n**Live pulse:** one sentence summarizing the current state.\n\n**Top X posts:** quote 2-3 recent posts in the format `> @handle - timestamp: post text` (only real posts, never fabricate).\n\n**Sentiment:** one word — Positive, Negative, Mixed, or Neutral.\n\n**Trending:** 1-3 hashtags or short phrases dominating the conversation.\n\nAfter those sections, answer the user\'s question normally.]'
const RECENCY_INSTRUCTION_COMPACT =
  ' [LIVE MODE: Prioritize information from the past 7 days. If live web/X access is unavailable, say \"No live X signals available\" and answer normally.]'

type PresetId = 'quick' | 'research' | 'web' | 'allin'
type Preset = { id: PresetId; label: string; emoji: string; engineIds: string[] }

const PRESETS: Preset[] = [
  { id: 'quick', label: 'Quick', emoji: '⚡', engineIds: ['chatgpt'] },
  { id: 'research', label: 'Research', emoji: '🔬', engineIds: ['claude', 'chatgpt', 'gemini'] },
  { id: 'web', label: 'Web', emoji: '🌐', engineIds: ['tavily', 'chatgptsearch', 'brave', 'groksearch'] },
  /** Empty list = use every engine that’s checked in “Engines for All In” (same rule as main `/cleanseek`). */
  { id: 'allin', label: 'All In', emoji: '🚀', engineIds: [] },
]

/** Must stay aligned with backend `enabledProviders` ids (see mobile `DEFAULT_ENGINES`; omit `wiki`). */
const ENGINE_CATALOG: { id: string; label: string }[] = [
  { id: 'tavily', label: 'Tavily' },
  { id: 'chatgpt', label: 'ChatGPT' },
  { id: 'claude', label: 'Claude' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'grok', label: 'Grok' },
  { id: 'grok4', label: 'Grok 4' },
  { id: 'brave', label: 'Brave' },
  { id: 'chatgptsearch', label: 'GPT Search' },
  { id: 'groksearch', label: 'Grok Web' },
  { id: 'grokx', label: 'Grok X' },
]

const ENABLED_ENGINES_STORAGE_KEY = 'seekbox_cleanseek_x_enabled_engines_v1'
const ENGINE_PICK_MODE_KEY = 'seekbox_cleanseek_x_engine_pick_mode_v1'
const XMARKS_ENABLED_ENGINES_STORAGE_KEY = 'seekbox_xmarks_enabled_engines_v1'
const XMARKS_ENGINE_PICK_MODE_KEY = 'seekbox_xmarks_engine_pick_mode_v1'
const XMARKS_PROMPT_MODIFIERS_STORAGE_KEY = 'seekbox_xmarks_prompt_modifiers_v1'

/** `preset`: Quick/Web/Research use fixed lists; All In uses toggles. `custom`: always use toggles. */
type EnginePickMode = 'preset' | 'custom'

function loadEnginePickMode(): EnginePickMode {
  // Default **custom** when unset so toggles match what runs (avoids “Web” silently overriding picks).
  if (typeof window === 'undefined') return 'custom'
  try {
    const v = window.localStorage.getItem(ENGINE_PICK_MODE_KEY)
    if (v === 'preset') return 'preset'
    if (v === 'custom') return 'custom'
    return 'custom'
  } catch {
    return 'custom'
  }
}

function saveEnginePickMode(m: EnginePickMode) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ENGINE_PICK_MODE_KEY, m)
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

function saveEnabledEngines(ids: string[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ENABLED_ENGINES_STORAGE_KEY, JSON.stringify(ids))
  } catch {
    /* noop */
  }
}

function loadEnabledEnginesFromKey(storageKey: string): string[] {
  if (typeof window === 'undefined') return defaultEnabledEngineIds()
  try {
    const raw = window.localStorage.getItem(storageKey)
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

function saveEnabledEnginesToKey(storageKey: string, ids: string[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(ids))
  } catch {
    /* noop */
  }
}

function engineCountForPreset(preset: Preset, allInPool: string[]): number {
  return preset.engineIds.length > 0 ? preset.engineIds.length : allInPool.length
}

/** How many engines will run for this preset pill label (matches `run()` resolution). */
function enginesRunningCount(preset: Preset, pickIds: string[], mode: EnginePickMode): number {
  if (mode === 'custom') return pickIds.length
  return engineCountForPreset(preset, pickIds)
}

/** Single source of truth: which provider ids we send (before Grok-live append). */
function resolveSearchEngineIds(args: {
  enginePickMode: EnginePickMode
  activePreset: PresetId
  enabledEngineIds: string[]
  forceProvider?: string
}): string[] {
  if (args.forceProvider) return [args.forceProvider]
  if (args.enginePickMode === 'custom') return [...args.enabledEngineIds]
  const preset = PRESETS.find((p) => p.id === args.activePreset) ?? PRESETS[0]
  if (preset.engineIds.length > 0) return [...preset.engineIds]
  return [...args.enabledEngineIds]
}

const PROMPT_MODIFIERS_STORAGE_KEY = 'seekbox_cleanseek_x_prompt_modifiers_v1'

const DEFAULT_PROMPT_MODS: PromptModifierSnapshot = {
  responseLengthEnabled: true,
  // Default page-wide target: ~100 words (see RESPONSE_LENGTH_LEVELS index 1).
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

function loadPromptMods(): PromptModifierSnapshot {
  if (typeof window === 'undefined') return { ...DEFAULT_PROMPT_MODS }
  try {
    const raw = window.localStorage.getItem(PROMPT_MODIFIERS_STORAGE_KEY)
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

function savePromptMods(m: PromptModifierSnapshot) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PROMPT_MODIFIERS_STORAGE_KEY, JSON.stringify(m))
  } catch {
    /* noop */
  }
}

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

type ShowcasePrompt = { text: string; featured?: boolean; hint?: string }

/** Copy-paste demos tuned for Grok Live + side-by-side engines (CleanSeek-X niche path). */
const GROK_SHOWCASE_SECTIONS: { category: string; prompts: ShowcasePrompt[] }[] = [
  {
    category: 'Market & investing',
    prompts: [
      {
        text: "What is the real market reaction to Nvidia's latest earnings?",
        featured: true,
        hint: 'Great with Grok Live — fresh sentiment',
      },
      {
        text: 'Compare Tesla FSD v13 vs Waymo current performance and public sentiment',
        featured: true,
      },
      {
        text: 'Impact of solid-state batteries on EV stocks and market sentiment today',
        featured: true,
        hint: 'Matches landing-page narrative',
      },
      {
        text: 'Is Bitcoin overvalued right now? Show latest analyst and X opinions',
      },
    ],
  },
  {
    category: 'Tech & product launches',
    prompts: [
      {
        text: 'Compare Grok-4 vs Claude Sonnet 4 vs GPT-5.2 — which is best for coding?',
        featured: true,
        hint: 'Side-by-side model compare',
      },
      {
        text: 'What are developers actually saying about the new iOS 19 features on X?',
      },
      {
        text: 'Expo Router 5 vs Next.js App Router — pros, cons, and real user feedback',
      },
    ],
  },
  {
    category: 'News & current events',
    prompts: [
      {
        text:
          "What's the latest on today's biggest headline — compare all AI perspectives plus live X reaction",
      },
      {
        text: "Public sentiment on Trump's latest policy announcement",
      },
      {
        text: 'Did OpenAI just announce something big? Show real reactions',
      },
    ],
  },
  {
    category: 'Personal & professional',
    prompts: [
      {
        text: 'Best career advice for a mid-level software engineer in 2026',
      },
      {
        text: 'Should I buy a house in Austin, TX right now? Market plus sentiment analysis',
      },
      {
        text: 'Compare health risks of Ozempic vs natural alternatives',
      },
    ],
  },
  {
    category: 'Creative & fun',
    prompts: [
      {
        text: "Write a viral LinkedIn post about AI agents — then show what's actually working on X",
      },
      {
        text: 'Rank the top 5 sci-fi movies of 2026 so far with audience sentiment',
      },
      {
        text: "Explain quantum computing like I'm 15, then show expert discussions on X",
      },
    ],
  },
  {
    category: 'Deep analysis',
    prompts: [
      {
        text: 'CRAAP test the latest claims about AI replacing programmers',
      },
      {
        text: 'Triangulate: What do multiple sources say about climate change acceleration?',
      },
      {
        text: 'Debate: Is remote work dying in 2026?',
      },
      {
        text: 'What are the biggest risks and opportunities in AI investing right now?',
      },
    ],
  },
]

function syncCleanseekUrl(q: string, useLatest: boolean, preset: PresetId) {
  if (typeof window === 'undefined') return
  const sp = new URLSearchParams()
  if (q.trim()) sp.set('q', q.trim())
  sp.set('latest', useLatest ? '1' : '0')
  sp.set('preset', preset)
  window.history.replaceState({}, '', `${window.location.pathname}?${sp.toString()}`)
}

/** Product narrative — Grok’s differentiated native X access + how SeekBox exploits it */
const GROK_WHY_LIVE = {
  headline: 'Why Grok Live is different',
  sub:
    'Grok pulls fresh posts, trends, sentiment, and context from X minutes after they surface — not just crawl-delayed web pages or training snapshots.',
  bullets: [
    'Native real-time X signal alongside classic models → consensus vs contradiction in one run.',
    'Ideal every time “what people are saying *right now*” beats yesterday’s SEO summaries.',
    'SeekBoxAi stacks Grok search next to Tavily / GPT / Claude / Gemini so you verify narratives fast.',
  ],
}

/** One-shot “modes” — product framing, not generic demos (Grok Live + Web preset recommended). */
const GROK_SEARCH_MODES: { id: string; label: string; prompt: string }[] = [
  {
    id: 'earnings-reaction',
    label: 'Earnings reaction',
    prompt: 'Real-time market and X sentiment on Nvidia earnings right now',
  },
  {
    id: 'stock-deep-dive',
    label: 'Stock deep dive',
    prompt: 'Current trader sentiment on TSLA stock + key narratives on X',
  },
  {
    id: 'breaking-news',
    label: 'Breaking news',
    prompt: 'How is the market reacting to the latest Fed decision live on X?',
  },
  {
    id: 'sector-trend',
    label: 'Sector trend',
    prompt: 'Emerging narratives around solid-state batteries and EV stocks this week',
  },
  {
    id: 'meme-high-vol',
    label: 'Meme / high volatility',
    prompt: "What's the current hype level and risk on new Solana memecoins?",
  },
  {
    id: 'competitor-comparison',
    label: 'Competitor comparison',
    prompt: 'Trader reactions to Grok-4 vs Claude Sonnet 4 announcements',
  },
  {
    id: 'post-trade-validation',
    label: 'Post-trade validation',
    prompt: 'Current X sentiment and counter-narratives on my recent $AMD position',
  },
  {
    id: 'macro-event',
    label: 'Macro event',
    prompt: 'Live X pulse on Bitcoin after the latest ETF news',
  },
]

/** Five strategic angles — tap prompts to fill (keep Grok Live on). */
const GROK_USE_CASE_PLAYS: { title: string; audience: string; prompts: string[] }[] = [
  {
    title: 'Live market & sentiment',
    audience: 'Day traders · crypto · hedge/analyst workflows',
    prompts: [
      "What's the actual trader sentiment on Nvidia earnings right now?",
      'How is Bitcoin reacting on X in the last few hours — bullish or exhausted?',
    ],
  },
  {
    title: 'Breaking news & verification',
    audience: 'Journalists · crisis comms · political analysts',
    prompts: [
      "What's really happening with today's biggest headline — confirm vs rumor mill on X",
      'Debunk or contextualize this viral claim — cite opposing narratives seen on X',
    ],
  },
  {
    title: 'Product & brand pulse',
    audience: 'Founders · PMs · marketing / rapid iteration',
    prompts: [
      'What are developers saying about the latest Expo Router release on X?',
      'Public reaction to OpenAI’s most talked-about announcement today — sentiment snapshot',
    ],
  },
  {
    title: 'Emerging narratives',
    audience: 'VC · newsletters · futurists',
    prompts: [
      'What conversations around AI agents are bubbling on X this week beyond mainstream headlines?',
      'Early signals on a niche tech wave — what is X arguing about before it hits TechCrunch?',
    ],
  },
  {
    title: 'Niche community pulse',
    audience: 'Indie hackers · creators · hyper-target cohorts',
    prompts: [
      'Current vibe and debates among indie hackers on X — product-building sentiment',
      'What is the retro gaming community on X fired up about this month?',
    ],
  },
]

type EngineResult = {
  provider: string
  providerName?: string
  content: string
  status: 'loading' | 'success' | 'error'
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

function parseLiveXContext(raw: string): LiveXContext {
  const hasNoSignal = /No live X signals available/i.test(raw)

  const section = (label: string) => {
    const m = raw.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\n\\*\\*|\\n\\*\\*|$)`, 'i'))
    return m?.[1]?.trim() ?? null
  }

  const livePulse = section('Live pulse')
  const topPostsRaw = section('Top X posts')
  const sentiment = section('Sentiment')?.split('\n')[0]?.trim() ?? null
  const trending = section('Trending')?.split('\n')[0]?.trim() ?? null

  const topPosts = (topPostsRaw ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 6)

  return { hasNoSignal, livePulse, topPosts, sentiment, trending }
}

function normalizeBaseUrl(raw: string | undefined): string {
  const v = (raw ?? '').trim().replace(/\/$/, '')
  if (!v) throw new Error('EXPO_PUBLIC_BACKEND_URL environment variable is not set')
  if (!/^https?:\/\//i.test(v)) throw new Error(`EXPO_PUBLIC_BACKEND_URL must include https:// (got: ${v})`)
  return v
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

async function fetchAccountRoleLabel(uid: string): Promise<string | null> {
  const sb = isSupabaseConfigured ? supabase : null
  if (!sb) return null
  const tryCols = async (col: 'owner_user_id' | 'user_id' | 'id') => {
    const res = await sb.from('accounts').select('role,granted_role').eq(col, uid).maybeSingle()
    return res
  }
  for (const col of ['owner_user_id', 'user_id', 'id'] as const) {
    const res = await tryCols(col)
    if (!res.error && res.data) {
      const d = res.data as { role?: string | null; granted_role?: string | null }
      return (d.granted_role ?? d.role ?? null)?.trim() || null
    }
    const msg = String(res.error?.message ?? '')
    if (
      /does not exist/i.test(msg) ||
      /42703/i.test(msg) ||
      (/column/i.test(msg) && /owner_user_id|user_id/i.test(msg))
    ) {
      continue
    }
    break
  }
  return null
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

function isProbablyMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const w = window.innerWidth
    const coarsePointer = typeof window.matchMedia === 'function' ? window.matchMedia('(pointer:coarse)').matches : false
    return w < 900 || coarsePointer
  } catch {
    return false
  }
}

function CleanSeekXMobileRoute() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.location.pathname.endsWith('/desktop')) return
    if (isProbablyDesktopDevice()) {
      window.location.href = `/cleanseek-x/desktop${window.location.search}`
    }
  }, [])
  return <CleanSeekLite variant="mobile" />
}

function XmarksHistoryPanel(props: {
  onSelectQuery: (q: string) => void
  onRunQuery: (q: string) => void
  isSearching: boolean
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
          <a href="/signin?returnTo=/xmarks" className="underline underline-offset-4 text-cyan-300">
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
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">XMarks library</div>
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
type TickerHolding = { id: string; symbol: string; shares: number; avg_cost?: number | null }

function TickerSidebarPanel(props: {
  isSearching: boolean
  onSelectSymbol: (symbol: string) => void
  onRunPulse: (symbol: string) => void
}) {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [err, setErr] = useState<string | null>(null)
  const [selected, setSelected] = useState<string>('NVDA')
  const [watch, setWatch] = useState<TickerWatchItem[]>([])

  useEffect(() => {
    props.onSelectSymbol(selected)
  }, [props, selected])

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
      setSelected(sym)
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
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Ticker</div>
          <div className="mt-1 text-xs font-black text-slate-100">{selected}</div>
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
          onChange={(e) => setSelected(e.target.value.toUpperCase())}
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
                  onClick={() => setSelected(w.symbol)}
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

function TickerContextPanel(props: { symbol: string }) {
  const [loading, setLoading] = useState<boolean>(false)
  const [err, setErr] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [payload, setPayload] = useState<{
    prefix?: string
    wikipedia?: { title: string; extract: string; url?: string } | null
    rss?: Array<{ feed: string; items: { title: string; link?: string }[] }>
    quotes?: Array<{ symbol: string; price?: string; changePercent?: string; error?: string }>
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
  const relevantNews = useMemo(() => {
    const s = props.symbol.trim().toUpperCase()
    const nm = (companyName ?? '').trim()
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
  }, [companyName, payload?.rss, props.symbol])

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
        <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Quote</div>
        {quote ? (
          quote.error ? (
            <div className="mt-2 text-xs text-amber-200">{quote.symbol}: {quote.error}</div>
          ) : (
            <div className="mt-2 flex items-baseline justify-between gap-3">
              <div className="text-sm font-black text-slate-100">{quote.symbol}</div>
              <div className="text-sm font-black text-slate-100">{quote.price ?? '—'}</div>
              <div className="text-xs font-black text-slate-400">{quote.changePercent != null ? `${quote.changePercent}%` : '—'}</div>
            </div>
          )
        ) : (
          <div className="mt-2 text-xs text-slate-400">No quote available (check `TWELVE_API_KEY`).</div>
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
  defaultPreset,
  defaultUseLatest,
  defaultEnabledEngineIds,
  defaultEnginePickMode,
  storageKeys,
}: {
  variant?: CleanSeekVariant
  layout?: CleanSeekLayout
  defaultPreset?: PresetId
  defaultUseLatest?: boolean
  defaultEnabledEngineIds?: string[]
  defaultEnginePickMode?: EnginePickMode
  storageKeys?: { enabledEnginesKey: string; enginePickModeKey: string; promptModsKey: string }
}) {
  const backendUrlOrError = useMemo(() => {
    // Vite only exposes client env vars prefixed with VITE_.
    // Prefer VITE_BACKEND_URL in the browser, fall back to EXPO_PUBLIC_BACKEND_URL
    // for server-side/edge rendering where process.env is available.
    const viteUrl =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Vite env
      (import.meta as any)?.env?.VITE_BACKEND_URL as string | undefined
    const raw = viteUrl ?? process.env.EXPO_PUBLIC_BACKEND_URL
    try {
      return { url: normalizeBaseUrl(raw), error: null as string | null }
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
  const [useLatest, setUseLatest] = useState<boolean>(defaultUseLatest ?? true)
  const [activePreset, setActivePreset] = useState<PresetId>(defaultPreset ?? 'web')
  /** Engines included when preset is All In — persisted like main CleanSeek’s settings engines. */
  const [enabledEngineIds, setEnabledEngineIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return defaultEnabledEngineIds ?? loadEnabledEngines()
    const loaded = loadEnabledEnginesFromKey(keys.enabledEnginesKey)
    if (loaded.length) return loaded
    return defaultEnabledEngineIds && defaultEnabledEngineIds.length ? defaultEnabledEngineIds : loaded
  })
  /** When `custom`, every search uses `enabledEngineIds`; when `preset`, only All In does. */
  const [enginePickMode, setEnginePickMode] = useState<EnginePickMode>(() => {
    if (typeof window === 'undefined') return defaultEnginePickMode ?? loadEnginePickMode()
    return loadEnginePickModeFromKey(keys.enginePickModeKey)
  })
  /** Response length, tone, persona, comprehension, reasoning — persisted; appended to query like `/cleanseek`. */
  const [promptMods, setPromptMods] = useState<PromptModifierSnapshot>(() => loadPromptModsFromKey(keys.promptModsKey))
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
  const [tickerSymbol, setTickerSymbol] = useState<string>('NVDA')
  const [isDeepDive, setIsDeepDive] = useState<boolean>(false)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [authEmail, setAuthEmail] = useState<string | null>(null)
  const [authUserId, setAuthUserId] = useState<string | null>(null)
  const [roleLabel, setRoleLabel] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const queryInputRef = useRef<HTMLInputElement | null>(null)
  const hydratedFromUrlRef = useRef<boolean>(false)
  const autorunRef = useRef<boolean>(false)
  /** Accumulate streamed deltas without triggering a React render per token (aligned with mobile `useStreamingSearch`). */
  const streamAccRef = useRef<Record<string, EngineResult>>({})
  const streamRafRef = useRef<number | null>(null)

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

      if (q != null && q.trim()) setQuery(q.trim())
      if (latest != null) setUseLatest(latest !== '0' && latest.toLowerCase() !== 'false')

      setActivePreset(initialPreset)

      const pm = loadEnginePickModeFromKey(keys.enginePickModeKey)
      setEnginePickMode(pm)
      if (pm === 'preset') {
        const pr = PRESETS.find((x) => x.id === initialPreset)
        if (pr && pr.engineIds.length > 0) setEnabledEngineIds([...pr.engineIds])
        else setEnabledEngineIds(loadEnabledEnginesFromKey(keys.enabledEnginesKey))
      } else {
        const loaded = loadEnabledEnginesFromKey(keys.enabledEnginesKey)
        if (loaded.length) setEnabledEngineIds(loaded)
        else if (defaultEnabledEngineIds && defaultEnabledEngineIds.length) setEnabledEngineIds(defaultEnabledEngineIds)
        else setEnabledEngineIds(loadEnabledEngines())
      }

      setPromptMods(loadPromptModsFromKey(keys.promptModsKey))
    } catch {
      // ignore
    }
  }, [defaultEnabledEngineIds, defaultPreset, keys.enabledEnginesKey, keys.enginePickModeKey, keys.promptModsKey])

  useEffect(() => {
    savePromptModsToKey(keys.promptModsKey, promptMods)
  }, [keys.promptModsKey, promptMods])

  useEffect(() => {
    saveEnabledEnginesToKey(keys.enabledEnginesKey, enabledEngineIds)
  }, [enabledEngineIds, keys.enabledEnginesKey])

  useEffect(() => {
    saveEnginePickModeToKey(keys.enginePickModeKey, enginePickMode)
  }, [enginePickMode, keys.enginePickModeKey])

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

  const idsActuallySent = useMemo(
    () =>
      resolveSearchEngineIds({
        enginePickMode,
        activePreset,
        enabledEngineIds,
      }),
    [enginePickMode, activePreset, enabledEngineIds],
  )

  const presetLocksEngines =
    enginePickMode === 'preset' &&
    (PRESETS.find((p) => p.id === activePreset)?.engineIds.length ?? 0) > 0

  const activePresetLabel = PRESETS.find((p) => p.id === activePreset)?.label ?? activePreset

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
      const email = u?.email ?? null
      const uid = u?.id ?? null
      setAuthEmail(email)
      setAuthUserId(uid)
      setRoleLabel(null)
      if (uid) {
        try {
          await ensureAccount(u as any)
        } catch {
          // non-fatal
        }
        const role = await fetchAccountRoleLabel(uid)
        if (!cancelled) setRoleLabel(role)
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
        const { data, error } = await sb
          .from('analysis_modes')
          .select('id, label, name, mode, slug, description, enabled, sort_order')
          .order('sort_order', { ascending: true })
          .limit(100)
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
    async (queryText: string, enabledProviders: string[], finalResults: Record<string, EngineResult>) => {
      const sb = isSupabaseConfigured ? supabase : null
      if (!sb) return
      try {
        const { data } = await sb.auth.getUser()
        const u = data.user
        if (!u) return

        const clientId = getClientId()
        const searchMode = `cleanseekx_${activePreset}_${enginePickMode}_${useLatest ? 'latest1' : 'latest0'}_${enabledProviders.length}`

        const { data: sess, error: sessErr } = await sb
          .from('search_sessions')
          .insert({
            client_id: clientId,
            session_id: clientId,
            query: queryText,
            search_mode: searchMode,
            fun_mode: false,
            search_source: 'web',
            user_id: u.id,
          } as any)
          .select('id')
          .single()

        if (sessErr || !sess?.id) return

        const sessionId = String(sess.id)
        const rows: SavedEngineRow[] = []
        for (const prov of enabledProviders) {
          const r = finalResults[prov]
          const txt = (r?.content ?? '').toString()
          if (!txt.trim() && r?.status !== 'error') continue
          const words = txt.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean)
          rows.push({
            engine: prov,
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
    [activePreset, enginePickMode, useLatest],
  )

  const signOut = async () => {
    const sb = isSupabaseConfigured ? supabase : null
    if (!sb) return
    await sb.auth.signOut()
    setAuthEmail(null)
    setAuthUserId(null)
    setRoleLabel(null)
    if (typeof window !== 'undefined') window.location.href = '/cleanseek-x'
  }

  const run = async (opts?: { forceProvider?: string; deepDive?: boolean; queryOverride?: string }) => {
    if (!BACKEND_URL) return
    const raw = (opts?.queryOverride ?? query).trim()
    if (!raw || isSearching) return

    if (opts?.queryOverride != null) setQuery(raw)
    syncCleanseekUrl(raw, useLatest, activePreset)

    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    let augmentedRaw = raw
    const looksLikeTickerOnly = /^[A-Za-z]{1,6}$/.test(raw) && !/\s/.test(raw)
    if (typeof window !== 'undefined' && !looksLikeTickerOnly) {
      try {
        const sr = await fetch(`${window.location.origin}/api/supplementary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ac.signal,
          body: JSON.stringify({ query: raw }),
        })
        if (sr.ok) {
          const sj = (await sr.json()) as { prefix?: string }
          if (sj.prefix?.trim()) augmentedRaw = `${sj.prefix.trim()}\n\n${raw}`
        }
      } catch {
        /* supplementary is optional */
      }
    }

    let enabledProvidersPreview = resolveSearchEngineIds({
      enginePickMode,
      activePreset,
      enabledEngineIds,
      forceProvider: opts?.forceProvider,
    })
    if (useLatest && enabledProvidersPreview.length && !enabledProvidersPreview.includes('groksearch')) {
      enabledProvidersPreview = [...enabledProvidersPreview, 'groksearch']
    }
    const includesWebEngine = enabledProvidersPreview.some((id) => id === 'tavily' || id === 'brave' || id === 'chatgptsearch' || id === 'groksearch')
    const liveInstr = useLatest ? (includesWebEngine ? RECENCY_INSTRUCTION_COMPACT : RECENCY_INSTRUCTION) : ''
    // Live mode should never be constrained by the response-length cap.
    const modsForThisRun = useLatest ? { ...promptMods, responseLengthEnabled: false } : promptMods
    const qBuilt = composeCleanseekPrompt(augmentedRaw, modsForThisRun, liveInstr)

    setStreamError(null)
    setIsSearching(true)
    streamAccRef.current = {}
    setResults({})
    setIsDeepDive(Boolean(opts?.deepDive))

    let enabledProviders = resolveSearchEngineIds({
      enginePickMode,
      activePreset,
      enabledEngineIds,
      forceProvider: opts?.forceProvider,
    })

    if (useLatest && enabledProviders.length && !enabledProviders.includes('groksearch')) {
      enabledProviders = [...enabledProviders, 'groksearch']
    }

    if (!opts?.forceProvider && enabledProviders.length === 0) {
      setIsSearching(false)
      setStreamError(
        enginePickMode === 'custom'
          ? 'Pick at least one engine below (My picks only), then Search.'
          : 'Turn on at least one engine for All In, switch to My picks only, or select Quick / Research / Web.',
      )
      return
    }

    resultOrderRef.current = [...enabledProviders]

    // Pre-create loading cards — mirror into stream accumulator for RAF-batched streaming updates.
    if (enabledProviders.length) {
      const init: Record<string, EngineResult> = {}
      for (const p of enabledProviders) {
        init[p] = { provider: p, providerName: p, content: '', status: 'loading' }
      }
      const snap = snapshotResults(init)
      streamAccRef.current = snap
      setResults(snap)
    }

    const clientId = getClientId()
    const streamUserId = authUserId ?? clientId

    let res: Response
    try {
      res = await fetch(`${BACKEND_URL}/api/search/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        signal: ac.signal,
        body: JSON.stringify({
          query:
            opts?.deepDive && useLatest
              ? `${qBuilt}\n\n[LIVE MODE: Deep Live Dive. Expand Top X posts to 6-10, include handles, timestamps, and a 3-bullet \"What it means\" summary. Never fabricate posts. If no X access, write \"No live X signals available\".]\n`
              : qBuilt,
          useLocation: false,
          enabledProviders: enabledProviders.length ? enabledProviders : undefined,
          sessionId: clientId,
          clientId,
          userId: streamUserId,
          searchSource: 'cleanseek',
          platform: 'web',
          promptCharacterCount: augmentedRaw.length,
          enabledEngineCount: enabledProviders.length || undefined,
          liveDataMode: useLatest,
          grokLive: useLatest,
          responseLengthSetting: promptMods.responseLength,
          persona:
            promptMods.personaEnabled && promptMods.personaText.trim() ? promptMods.personaText.trim() : undefined,
          comprehensionEnabled: promptMods.comprehensionEnabled,
          comprehensionLevel: promptMods.comprehensionEnabled ? promptMods.comprehensionLevel : undefined,
          ...(analysisMode !== 'none' && analysisJudge
            ? {
                analysisMode,
                analysisJudge,
                // Legacy backend compatibility: many deployments read `<mode>Judge`.
                [`${analysisMode}Judge`]: analysisJudge,
              }
            : {}),
        }),
      })
    } catch (e) {
      setIsSearching(false)
      if ((e as Error)?.name === 'AbortError') return
      setStreamError(e instanceof Error ? e.message : 'Search failed.')
      return
    }

    if (!res.ok) {
      setIsSearching(false)
      let detail = ''
      try {
        const t = await res.text()
        if (t) {
          try {
            const j = JSON.parse(t) as Record<string, unknown>
            detail =
              (typeof j.error === 'string' && j.error) ||
              (typeof j.message === 'string' && j.message) ||
              t.slice(0, 400)
          } catch {
            detail = t.slice(0, 400)
          }
        }
      } catch {
        /* noop */
      }
      setStreamError(detail ? `Search failed (HTTP ${res.status}): ${detail}` : `Search failed (HTTP ${res.status}).`)
      return
    }

    if (!res.body) {
      setIsSearching(false)
      setStreamError('Search failed: empty response body.')
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    let evt = ''

    const mergeProvider = (pid: string, patch: Partial<EngineResult>) => {
      const cur =
        streamAccRef.current[pid] ??
        ({ provider: pid, providerName: pid, content: '', status: 'loading' as const })
      streamAccRef.current = { ...streamAccRef.current, [pid]: { ...cur, ...patch } }
      scheduleStreamFlush()
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
        mergeProvider(pid, {
          content: doneContent !== undefined ? doneContent : cur?.content ?? '',
          status: 'success',
        })
        return
      }
      if (kind === 'result-error') {
        mergeProvider(pid, {
          content: `Error: ${String(d.error ?? 'failed')}`,
          status: 'error',
        })
      }
    }

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
        setStreamError(e instanceof Error ? e.message : 'Stream interrupted.')
      }
    } finally {
      if (streamRafRef.current !== null) {
        cancelAnimationFrame(streamRafRef.current)
        streamRafRef.current = null
      }
      if (ac.signal.aborted) {
        const next = { ...streamAccRef.current }
        for (const k of Object.keys(next)) {
          if (next[k].status === 'loading') {
            next[k] = {
              ...next[k],
              status: 'error',
              content: next[k].content?.trim() ? next[k].content : 'Stopped.',
            }
          }
        }
        streamAccRef.current = next
      }
      flushStreamFrame()
      setIsSearching(false)

      if (!ac.signal.aborted && raw.trim()) {
        void saveHistory(raw.trim(), enabledProviders, streamAccRef.current)
      }
    }
  }

  const stop = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsSearching(false)
  }

  const featuredPrompts = useMemo(
    () => GROK_SHOWCASE_SECTIONS.flatMap((s) => s.prompts).filter((p) => p.featured),
    [],
  )

  const fillSamplePrompt = (text: string) => {
    setQuery(text)
    syncCleanseekUrl(text, useLatest, activePreset)
    queryInputRef.current?.focus()
    queryInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
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

  useEffect(() => {
    if (typeof window === 'undefined') return
    // If the desktop dashboard is opened on a phone, bounce back.
    if (variant === 'desktop' && isProbablyMobileDevice() && window.location.pathname.endsWith('/desktop')) {
      window.location.href = `/cleanseek-x${window.location.search}`
    }
  }, [variant])

  const isMobile = variant === 'mobile'
  const isRabbitHole = typeof window !== 'undefined' && window.location.pathname.endsWith('/rabbitholex')
  const isXmarks = layout === 'xmarks'
  const isTicker = layout === 'ticker'

  return (
    <div className="min-h-screen bg-[#050B14] text-slate-50">
      <div className="w-full max-w-none px-3 sm:px-5 xl:px-10 2xl:px-14 py-8">
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

        {/* Top bar */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-4">
          <Link to="/" className="flex shrink-0 items-center gap-3 font-black text-lg">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-500/30">
              <Search className="h-4 w-4 text-cyan-300" />
            </span>
            SeekBoxAi
          </Link>

          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-slate-700/60 bg-[#0A1128]/70 px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              ref={queryInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
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
              placeholder="Ask once… get all answers side-by-side"
              className="min-w-0 flex-1 bg-transparent outline-none text-slate-100 placeholder-slate-500"
              aria-label="Search query"
            />
            {isSearching ? (
              <button
                type="button"
                onClick={stop}
                className="shrink-0 rounded-xl border border-slate-600 bg-slate-900/40 px-3 py-1.5 text-xs font-black text-slate-200 hover:bg-slate-800/60"
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
                className="shrink-0 rounded-xl bg-cyan-500 text-[#050B14] px-4 py-1.5 text-xs font-black disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Search
              </button>
            )}
            <button
              type="button"
              disabled
              title="Voice input coming soon"
              className="shrink-0 rounded-xl border border-slate-800 bg-slate-900/20 px-3 py-1.5 text-xs font-black text-slate-500 cursor-not-allowed"
            >
              <span className="inline-flex items-center gap-2">
                <Mic className="h-3.5 w-3.5" /> Voice
              </span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
            <a
              href="/cleanseek-x/history"
              className="rounded-2xl border border-slate-700 bg-slate-900/30 px-4 py-3 text-sm font-black text-slate-200 hover:border-slate-500 hover:bg-slate-800/50"
            >
              History
            </a>
            <a
              href="/xmarks"
              className="rounded-2xl border border-slate-700 bg-slate-900/30 px-4 py-3 text-sm font-black text-slate-200 hover:border-slate-500 hover:bg-slate-800/50"
              title="XMarks: Grok X only dashboard"
            >
              XMarks
            </a>
            <a
              href={`/cleanseek-x/rabbitholex?q=${encodeURIComponent(query.trim())}&latest=${useLatest ? '1' : '0'}&autorun=1`}
              className="rounded-2xl border border-slate-700 bg-slate-900/30 px-4 py-3 text-sm font-black text-slate-200 hover:border-slate-500 hover:bg-slate-800/50"
              title="Open a dedicated page that prints all results."
            >
              RabbitHoleX
            </a>

            <button
              type="button"
              onClick={() =>
                setUseLatest((v) => {
                  const next = !v
                  syncCleanseekUrl(query, next, activePreset)
                  return next
                })
              }
              className={`rounded-2xl px-5 py-3 text-sm font-black border ${
                useLatest
                  ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100 shadow-[0_0_25px_rgba(16,185,129,0.15)]'
                  : 'border-slate-700 bg-slate-900/30 text-slate-200'
              }`}
            >
              {useLatest ? 'Grok Live' : 'Grok Live off'}
            </button>

            {authUserId && authEmail ? (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-700/80 bg-[#0A1128]/80 px-3 py-2">
                <span
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/20 text-sm font-black text-cyan-100"
                  title={authEmail}
                >
                  {(authEmail[0] ?? '?').toUpperCase()}
                </span>
                <div className="hidden min-w-0 max-w-[160px] sm:block">
                  <div className="truncate text-xs font-bold text-slate-100" title={authEmail}>
                    {authEmail}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1">
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-black/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-300">
                      <UserRound className="h-3 w-3 opacity-80" />
                      {roleLabel ?? 'member'}
                    </span>
                  </div>
                </div>
                <Link
                  to="/account"
                  className="rounded-xl border border-slate-600 bg-slate-900/40 px-3 py-2 text-xs font-black text-slate-200 hover:bg-slate-800/60"
                >
                  Account
                </Link>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-black text-red-100 hover:bg-red-500/15"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </div>
            ) : isSupabaseConfigured ? (
              <a
                href="/signin?returnTo=/cleanseek-x"
                className="rounded-2xl border border-slate-700 bg-slate-900/30 px-4 py-3 text-sm font-black text-slate-200 hover:border-slate-500 hover:bg-slate-800/50"
              >
                Sign in
              </a>
            ) : (
              <span className="rounded-2xl border border-slate-800 bg-slate-900/20 px-4 py-3 text-sm font-black text-slate-500">
                Sign in (soon)
              </span>
            )}
          </div>
        </div>

        <div className={isXmarks || isTicker ? 'mt-6 flex flex-col gap-4 lg:flex-row lg:items-start' : ''}>
          {isXmarks ? (
            <aside className="w-full lg:w-[340px] lg:shrink-0">
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
            <aside className="w-full lg:w-[360px] lg:shrink-0">
              <TickerSidebarPanel
                isSearching={isSearching}
                onSelectSymbol={(sym) => {
                  // Keep input in sync with symbol-focused mode.
                  const s = sym.trim().toUpperCase()
                  if (!s) return
                  setTickerSymbol(s)
                  setQuery(`${s} stock`)
                }}
                onRunPulse={(sym) => {
                  const s = sym.trim().toUpperCase()
                  if (!BACKEND_URL || !s) return
                  setTickerSymbol(s)
                  const q = `${s} — stock pulse: price drivers, notable news, sentiment on X, and key risks. Include any notable posts if available and cite links when possible.`
                  setQuery(q)
                  window.setTimeout(() => {
                    if (!isSearching) void run({ queryOverride: q })
                  }, 0)
                }}
              />
            </aside>
          ) : null}

          <div className={isXmarks || isTicker ? 'min-w-0 flex-1' : ''}>
        {/* Prompt modifiers — hidden in RabbitHole view (results-only). */}
        {!isRabbitHole ? (
          <details
            className="mt-4 rounded-2xl border border-slate-700/70 bg-[#0A1128]/55 open:border-cyan-500/30"
            defaultOpen={!isMobile}
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
                Response length, tone, persona, and comprehension append the same instruction suffixes as the main CleanSeek page; sliders and checkboxes persist locally.
              </p>
              <button
                type="button"
                className="shrink-0 rounded-xl border border-slate-600 bg-slate-950/50 px-3 py-1.5 text-[11px] font-black text-slate-300 hover:border-slate-500 hover:text-slate-100"
                onClick={() => setPromptMods({ ...DEFAULT_PROMPT_MODS })}
              >
                Reset all
              </button>
            </div>

            <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
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
                    Response length
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
                    max={4}
                    step={1}
                    value={promptMods.responseLength}
                    disabled={!promptMods.responseLengthEnabled}
                    onChange={(e) =>
                      setPromptMods((m) => ({ ...m, responseLength: Number(e.target.value) }))
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
                Optional synthesizer pass using a judge model. Default judge is <span className="text-slate-200 font-semibold">chatgpt</span>.
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
                  aria-label="Analysis judge engine"
                >
                  {analysisEngineCatalog.map((e) => (
                    <option key={e.id} value={e.id}>
                      Judge: {e.label}
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

        {/* Engines — hidden in RabbitHole view (results-only). */}
        {!isRabbitHole
          ? (() => {
          const inner = (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Engines to run</div>
                  <p className="mt-1 max-w-2xl text-xs leading-snug text-slate-400">
                    <span className="font-semibold text-slate-300">My picks only</span> (default): Search runs exactly the engines you
                    toggle — what you see is what you get. <span className="font-semibold text-slate-300">Preset bundles</span>{' '}
                    matches main CleanSeek: Quick / Research / Web each ship a fixed provider list (All In uses your toggles).
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
            <span className="font-mono text-slate-200">{idsActuallySent.join(', ') || '—'}</span>
            {useLatest && idsActuallySent.length && !idsActuallySent.includes('groksearch') ? (
              <span className="text-slate-500"> (+ groksearch when Grok Live is on)</span>
            ) : null}
          </div>

          {presetLocksEngines ? (
            <div
              className="mt-3 rounded-xl border border-amber-500/35 bg-amber-500/[0.08] px-3 py-2 text-xs leading-snug text-amber-100"
              role="status"
            >
              <span className="font-black text-amber-200">{activePresetLabel}</span> locks providers while{' '}
              <strong className="text-amber-50">Preset bundles</strong> is on — always matches the list above. Changing any toggle
              switches you to <strong className="text-amber-50">My picks only</strong> so Search respects only what you select.
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            {ENGINE_CATALOG.map((eng) => {
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
            </>
          )

          if (isMobile) {
            return (
              <details className="mt-6 rounded-2xl border border-slate-700/60 bg-[#0A1128]/40 open:border-cyan-500/30">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-sm font-black text-slate-100 [&::-webkit-details-marker]:hidden">
                  <span>Engines to run</span>
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
        {!isRabbitHole ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => {
            const n = enginesRunningCount(p, enabledEngineIds, enginePickMode)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setActivePreset(p.id)
                  syncCleanseekUrl(query, useLatest, p.id)
                  if (enginePickMode === 'preset' && p.engineIds.length > 0) {
                    setEnabledEngineIds([...p.engineIds])
                  }
                }}
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
                  {n} engine{n !== 1 ? 's' : ''}
                </span>
              </button>
            )
          })}
          </div>
        ) : null}

        {/* Results — above demos; full-width responsive grid */}
        <section className="mt-6 w-full min-w-0" aria-label="Search results">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Results</span>
          </div>
          <div
            className={
              isMobile
                ? 'grid w-full min-w-0 gap-4 grid-cols-1'
                : 'grid w-full min-w-0 gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr))]'
            }
          >
          {Object.keys(results).length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-700/80 bg-[#0A1128]/40 px-6 py-14 text-center text-sm text-slate-400">
              No results yet — run Search above, or open the demo library below.
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
                const ctx = isGrokLive ? parseLiveXContext(r.content ?? '') : null

                return (
                  <div
                    key={r.provider}
                    className={`min-w-0 w-full rounded-3xl border bg-[#0A1128]/70 backdrop-blur-2xl p-5 ${
                      isGrokLive
                        ? 'border-emerald-400/40 shadow-[0_0_35px_rgba(16,185,129,0.18)]'
                        : 'border-slate-700/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-black flex items-center gap-2">
                        {isGrokLive ? 'Grok X' : (r.providerName ?? r.provider)}
                        {isGrokLive ? (
                          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-[10px] font-black tracking-widest text-emerald-100">
                            LIVE <span className="h-2 w-2 rounded-full bg-emerald-400" />
                          </span>
                        ) : null}
                      </div>
                      <div className={`text-xs ${r.status === 'error' ? 'text-red-300' : 'text-slate-400'}`}>
                        {r.status === 'loading' ? (isDeepDive && isGrokLive ? 'deep dive…' : 'loading…') : r.status}
                      </div>
                    </div>

                    <div className={`mt-3 text-sm leading-relaxed ${isGrokLive ? 'text-slate-100' : 'text-slate-200/90'}`}>
                      {r.content || r.status === 'loading' ? (
                        <div className="prose prose-invert prose-sm max-w-none prose-pre:bg-black/30 prose-pre:border prose-pre:border-slate-800 prose-pre:rounded-xl prose-pre:p-3 prose-code:text-slate-100 prose-code:bg-black/20 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-md prose-a:text-cyan-300 prose-a:underline-offset-4 prose-strong:text-slate-100 prose-h1:text-slate-100 prose-h2:text-slate-100 prose-h3:text-slate-100 prose-li:marker:text-slate-500">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              a: ({ href, children, ...props }) => (
                                <a href={href} target="_blank" rel="noreferrer" {...props}>
                                  {children}
                                </a>
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
                        </div>
                      ) : null}
                    </div>

                    {isGrokLive && ctx ? (
                      <div className="mt-5 rounded-2xl border border-slate-700/60 bg-black/20 p-4">
                        <div className="text-xs font-black text-slate-200">Live X Context</div>
                        {ctx.hasNoSignal ? (
                          <div className="mt-2 text-xs text-slate-400">No live X signals available.</div>
                        ) : (
                          <>
                            {ctx.livePulse ? <div className="mt-2 text-xs text-slate-300"><span className="font-black">Pulse:</span> {ctx.livePulse}</div> : null}
                            {ctx.sentiment ? (
                              <div className="mt-3 flex items-center justify-between text-[11px]">
                                <span className="text-slate-400 font-bold">Sentiment</span>
                                <span className="text-slate-200 font-black">{ctx.sentiment}</span>
                              </div>
                            ) : null}
                            {ctx.trending ? (
                              <div className="mt-2 text-[11px] text-slate-300">
                                <span className="text-slate-400 font-bold">Trending:</span> {ctx.trending}
                              </div>
                            ) : null}
                            {ctx.topPosts.length ? (
                              <div className="mt-3 space-y-2">
                                {ctx.topPosts.slice(0, 3).map((p, i) => (
                                  <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/30 p-3 text-[11px] text-slate-200">
                                    {p}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </>
                        )}

                        <button
                          onClick={() => run({ forceProvider: 'groksearch', deepDive: true })}
                          disabled={isSearching}
                          className="mt-4 w-full rounded-2xl bg-emerald-400/15 border border-emerald-400/30 text-emerald-100 font-black px-4 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          Deep Live Dive
                        </button>
                      </div>
                    ) : null}
                  </div>
                )
              })
            })()
          )}
          </div>
        </section>

        <details className="mt-10 rounded-2xl border border-slate-700/60 bg-[#050B14]/90 open:border-emerald-500/40 shadow-[0_-12px_40px_rgba(0,0,0,0.35)]">
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 rounded-t-2xl px-4 py-4 text-sm font-black text-slate-100 hover:bg-white/[0.03] sm:px-6 [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-emerald-400" />
              Ideas, modes & demo prompt library
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Expand</span>
          </summary>
          <div className="border-t border-slate-800/90 px-3 pb-6 pt-4 sm:px-5">
            <div className="rounded-3xl border border-emerald-500/25 bg-gradient-to-b from-emerald-500/[0.06] to-transparent p-5 sm:p-6">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="inline-flex items-center gap-2 text-emerald-100">
                              <Sparkles className="h-5 w-5 shrink-0 text-emerald-300" />
                              <span className="text-lg font-black tracking-tight">Grok Live showcase</span>
                            </div>
                            <p className="mt-2 max-w-2xl text-sm text-slate-400 leading-relaxed">
                              Twenty copy-paste demos built for side-by-side answers plus live X verification.{' '}
                              <span className="text-slate-300 font-semibold">Featured</span> runs instantly (keep Grok Live on). Others fill the
                              search box — tap Search when ready.
                            </p>
                          </div>
                          <div className="shrink-0 rounded-2xl border border-slate-700/80 bg-black/25 px-4 py-3 text-[11px] font-semibold text-slate-400 leading-snug max-w-xs">
                            Tip: Use <span className="text-slate-200">Web</span> preset for Tavily + Grok search breadth;{' '}
                            <span className="text-slate-200">Research</span> for pure model compare.
                          </div>
                        </div>

                        <div className="mt-6 rounded-2xl border border-slate-700/60 bg-black/25 px-4 py-4 sm:px-5">
                          <div className="text-sm font-black text-emerald-100/95">{GROK_WHY_LIVE.headline}</div>
                          <p className="mt-2 text-xs text-slate-400 leading-relaxed">{GROK_WHY_LIVE.sub}</p>
                          <ul className="mt-3 space-y-2 text-xs text-slate-300 leading-relaxed list-disc pl-4 marker:text-emerald-500/80">
                            {GROK_WHY_LIVE.bullets.map((b) => (
                              <li key={b}>{b}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="mt-8">
                          <div className="text-[11px] font-black uppercase tracking-widest text-cyan-400/90">Eight search modes</div>
                          <p className="mt-2 max-w-3xl text-xs text-slate-500 leading-relaxed">
                            Not just demos — <span className="text-slate-300 font-semibold">modes</span> you can drop users into. Each card loads a tuned prompt;
                            keep <span className="text-emerald-300 font-semibold">Grok Live</span> on and use <span className="text-slate-200 font-semibold">Web</span>{' '}
                            for breadth.
                          </p>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {GROK_SEARCH_MODES.map((m) => (
                              <div
                                key={m.id}
                                className="flex flex-col rounded-2xl border border-cyan-500/25 bg-gradient-to-b from-cyan-500/[0.06] to-[#0A1128]/90 p-4"
                              >
                                <div className="text-[13px] font-black text-cyan-100 tracking-tight">{m.label}</div>
                                <p className="mt-2 flex-1 text-[11px] leading-snug text-slate-400">
                                  <span className="text-slate-600">&ldquo;</span>
                                  {m.prompt}
                                  <span className="text-slate-600">&rdquo;</span>
                                </p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    disabled={!BACKEND_URL || isSearching}
                                    onClick={() => void run({ queryOverride: m.prompt })}
                                    className="inline-flex flex-1 min-w-[100px] items-center justify-center gap-1.5 rounded-xl bg-cyan-500 text-[#050B14] px-3 py-2 text-[11px] font-black disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <Play className="h-3 w-3 fill-[#050B14]" />
                                    Run
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => fillSamplePrompt(m.prompt)}
                                    className="rounded-xl border border-slate-600 bg-slate-900/40 px-3 py-2 text-[11px] font-black text-slate-200 hover:bg-slate-800/60"
                                  >
                                    Fill
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="mt-8">
                          <div className="text-[11px] font-black uppercase tracking-widest text-emerald-400/90">Five plays to exploit Grok X</div>
                          <p className="mt-2 max-w-3xl text-xs text-slate-500 leading-relaxed">
                            Starter prompts mapped to high-leverage workflows — tap one to fill, then Search (or use Run now on featured cards below).
                          </p>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                            {GROK_USE_CASE_PLAYS.map((play) => (
                              <div
                                key={play.title}
                                className="flex flex-col rounded-2xl border border-slate-700/70 bg-[#0A1128]/60 p-4 shadow-inner"
                              >
                                <div className="text-[13px] font-black text-slate-100 leading-tight">{play.title}</div>
                                <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{play.audience}</div>
                                <div className="mt-3 flex flex-col gap-2">
                                  {play.prompts.map((t) => (
                                    <button
                                      key={t}
                                      type="button"
                                      onClick={() => fillSamplePrompt(t)}
                                      className="rounded-xl border border-slate-600/90 bg-black/30 px-2.5 py-2 text-left text-[11px] leading-snug text-slate-200 hover:border-emerald-500/35 hover:bg-emerald-500/[0.07]"
                                    >
                                      {t}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="mt-8">
                          <div className="text-[11px] font-black uppercase tracking-widest text-emerald-400/90">Featured demos</div>
                          <div className="mt-3 flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
                            {featuredPrompts.map((p) => (
                              <div
                                key={p.text}
                                className="snap-start shrink-0 w-[min(100%,320px)] rounded-2xl border border-emerald-400/35 bg-[#0A1128]/90 p-4 shadow-[0_0_28px_rgba(16,185,129,0.12)]"
                              >
                                <p className="text-sm font-bold text-slate-100 leading-snug">{p.text}</p>
                                {p.hint ? <p className="mt-2 text-[11px] text-emerald-200/80">{p.hint}</p> : null}
                                <div className="mt-4 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    disabled={!BACKEND_URL || isSearching}
                                    onClick={() => void run({ queryOverride: p.text })}
                                    className="inline-flex flex-1 min-w-[120px] items-center justify-center gap-2 rounded-xl bg-emerald-500 text-[#050B14] px-4 py-2.5 text-xs font-black disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <Play className="h-3.5 w-3.5 fill-[#050B14]" />
                                    Run now
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => fillSamplePrompt(p.text)}
                                    className="rounded-xl border border-slate-600 bg-slate-900/40 px-4 py-2.5 text-xs font-black text-slate-200 hover:bg-slate-800/60"
                                  >
                                    Fill only
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="mt-8 space-y-5">
                          <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">All prompts (tap to fill)</div>
                          {GROK_SHOWCASE_SECTIONS.map((section) => (
                            <details
                              key={section.category}
                              className="group rounded-2xl border border-slate-700/70 bg-black/20 open:bg-black/30 [&_summary::-webkit-details-marker]:hidden"
                              open={section.category === 'Market & investing'}
                            >
                              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-black text-slate-100 flex items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                                <span>{section.category}</span>
                                <span className="text-[10px] font-bold text-slate-500 group-open:text-emerald-400">▼</span>
                              </summary>
                              <div className="flex flex-wrap gap-2 border-t border-slate-800/80 px-4 py-4">
                                {section.prompts.map((p) => (
                                  <button
                                    key={p.text}
                                    type="button"
                                    onClick={() => fillSamplePrompt(p.text)}
                                    className="max-w-full rounded-xl border border-slate-700 bg-slate-900/35 px-3 py-2 text-left text-[13px] leading-snug text-slate-200 hover:border-cyan-500/40 hover:bg-cyan-500/5"
                                  >
                                    {p.text}
                                  </button>
                                ))}
                              </div>
                            </details>
                          ))}
                        </div>
            </div>
          </div>
        </details>
          </div>

          {isXmarks ? (
            <aside className="w-full lg:w-[380px] lg:shrink-0">
              <div className="rounded-3xl border border-slate-700/60 bg-[#0A1128]/70 backdrop-blur-2xl p-4">
                <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Analysis modes</div>
                <p className="mt-1 text-xs text-slate-400 leading-snug">
                  Optional synthesizer pass using a judge model.
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  <select
                    value={analysisMode}
                    onChange={(e) => setAnalysisMode(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-[#050B14]/80 px-3 py-2 text-sm font-black text-slate-100 outline-none focus:border-cyan-500/40"
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
                    className="w-full rounded-xl border border-slate-700 bg-[#050B14]/80 px-3 py-2 text-sm font-black text-slate-100 outline-none focus:border-cyan-500/40"
                    aria-label="Analysis judge engine"
                  >
                    {analysisEngineCatalog.map((e) => (
                      <option key={e.id} value={e.id}>
                        Judge: {e.label}
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
            </aside>
          ) : null}

          {isTicker ? (
            <aside className="w-full lg:w-[420px] lg:shrink-0">
              <TickerContextPanel symbol={tickerSymbol} />
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  )
}


