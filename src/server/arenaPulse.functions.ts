import { createServerFn } from '@tanstack/react-start'
import { scopeValuesForIndustrySlug } from '../lib/industryCatalog'
import {
  rankPulseVoices,
  sortPulseVoiceRankings,
  type PulseVoiceRanking,
  type PulseVoiceSource,
} from '../lib/pulseVoiceRankings'

const PUBLIC_PULSE_SELECT = [
  'id',
  'scope_type',
  'scope_value',
  'window_label',
  'from_date',
  'to_date',
  'handles',
  'summary',
  'citations',
  'tags',
  'status',
  'created_at',
].join(',')

const PUBLIC_VOICE_SELECT = [
  'handle',
  'display_handle',
  'scope_type',
  'scope_value',
  'source',
  'rank_score',
  'heat_score',
  'novelty_score',
  'seen_count',
  'seed_count',
  'citation_count',
  'summary_mention_count',
  'first_seen_at',
  'last_seen_at',
  'sample_urls',
].join(',')

const BLOCKED_PUBLIC_STATUSES = new Set(['error', 'failed', 'failure', 'cancelled', 'canceled', 'running', 'pending', 'queued', 'in_progress'])
const ARENA_SUMMARY_MAX_CHARS = 1800

export type ArenaPulseCitation = {
  index?: number | null
  url?: string | null
}

export type ArenaPulseRow = {
  id: string
  scope_type: string | null
  scope_value: string | null
  window_label: string | null
  from_date: string | null
  to_date: string | null
  handles: string[] | null
  summary: string | null
  citations: ArenaPulseCitation[] | null
  tags: string[] | null
  status: string | null
  created_at: string
}

type ArenaPulseRequest = {
  scopeType?: string
  scopeValue?: string
  limit?: number
  voiceLimit?: number
}

export type ArenaPulseData = {
  rows: ArenaPulseRow[]
  voices: PulseVoiceRanking[]
  error: string | null
}

export const getArenaPulseData = createServerFn({ method: 'GET' })
  .inputValidator((data: ArenaPulseRequest | undefined) => ({
    scopeType: cleanScopeParam(data?.scopeType ?? 'industry', 40) ?? 'industry',
    scopeValue: cleanScopeParam(data?.scopeValue ?? null, 96),
    limit: cleanLimit(data?.limit, 500, 500),
    voiceLimit: cleanLimit(data?.voiceLimit, 50, 50),
  }))
  .handler(async ({ data }): Promise<ArenaPulseData> => {
    const env = supabaseEnv()
    if (!env) return { rows: [], voices: [], error: 'Supabase env is not configured.' }

    const rowsResult = await fetchArenaRows({ ...env, scopeType: data.scopeType, scopeValue: data.scopeValue, limit: data.limit })
    if (!rowsResult.ok) return { rows: [], voices: [], error: rowsResult.error }

    const persisted = await fetchPersistedVoices({ ...env, scopeType: data.scopeType, scopeValue: data.scopeValue, limit: data.voiceLimit })
    const voices =
      persisted.ok && persisted.voices.length
        ? sortPulseVoiceRankings(persisted.voices.map(publicVoice), data.voiceLimit)
        : rankPulseVoices(rowsResult.rows, data.voiceLimit).map(publicVoice)

    return { rows: rowsResult.rows, voices, error: null }
  })

function supabaseEnv(): { baseUrl: string; headers: HeadersInit } | null {
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL
  const publicKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !publicKey) return null
  return {
    baseUrl: supabaseUrl.replace(/\/$/, ''),
    headers: {
      apikey: publicKey,
      ...(publicKey.startsWith('eyJ') ? { Authorization: `Bearer ${publicKey}` } : {}),
    },
  }
}

async function fetchArenaRows(args: {
  baseUrl: string
  headers: HeadersInit
  scopeType: string
  scopeValue: string | null
  limit: number
}): Promise<{ ok: true; rows: ArenaPulseRow[] } | { ok: false; error: string }> {
  let res = await fetchPulseRowsFromTable({ ...args, table: 'public_pulse_runs' })
  if (!res?.ok && (res?.status === 404 || res?.status === 400)) {
    res = await fetchPulseRowsFromTable({ ...args, table: 'pulse_runs' })
  }
  if (!res?.ok) return { ok: false, error: 'Pulse rows could not be loaded.' }

  const raw = await res.json().catch(() => null)
  return { ok: true, rows: sanitizeArenaRows(raw) }
}

function fetchPulseRowsFromTable(args: {
  baseUrl: string
  headers: HeadersInit
  scopeType: string
  scopeValue: string | null
  limit: number
  table: 'public_pulse_runs' | 'pulse_runs'
}): Promise<Response | null> {
  const endpoint = new URL(`${args.baseUrl}/rest/v1/${args.table}`)
  endpoint.searchParams.set('select', PUBLIC_PULSE_SELECT)
  endpoint.searchParams.set('scope_type', `eq.${args.scopeType}`)
  if (args.scopeValue) {
    const scopeValues = args.scopeType === 'industry' ? scopeValuesForIndustrySlug(args.scopeValue) : [args.scopeValue]
    endpoint.searchParams.set('scope_value', scopeValues.length > 1 ? `in.(${scopeValues.join(',')})` : `eq.${scopeValues[0]}`)
  }
  endpoint.searchParams.append('summary', 'not.is.null')
  endpoint.searchParams.append('summary', 'neq.')
  endpoint.searchParams.set('order', 'created_at.desc')
  endpoint.searchParams.set('limit', String(args.limit))

  return fetch(endpoint, { headers: args.headers, signal: AbortSignal.timeout(8_000) }).catch(() => null)
}

async function fetchPersistedVoices(args: {
  baseUrl: string
  headers: HeadersInit
  scopeType: string
  scopeValue: string | null
  limit: number
}): Promise<{ ok: true; voices: PulseVoiceRanking[] } | { ok: false }> {
  const endpoint = new URL(`${args.baseUrl}/rest/v1/public_pulse_voice_rankings`)
  endpoint.searchParams.set('select', PUBLIC_VOICE_SELECT)
  endpoint.searchParams.set('scope_type', `eq.${args.scopeType}`)
  if (args.scopeValue) {
    const scopeValues = args.scopeType === 'industry' ? scopeValuesForIndustrySlug(args.scopeValue) : [args.scopeValue]
    endpoint.searchParams.set('scope_value', scopeValues.length > 1 ? `in.(${scopeValues.join(',')})` : `eq.${scopeValues[0]}`)
  }
  endpoint.searchParams.set('order', 'citation_count.desc,seen_count.desc,rank_score.desc,last_seen_at.desc')
  endpoint.searchParams.set('limit', String(args.limit))

  const res = await fetch(endpoint, { headers: args.headers, signal: AbortSignal.timeout(8_000) }).catch(() => null)
  if (!res?.ok) return { ok: false }
  const raw = await res.json().catch(() => null)
  return { ok: true, voices: sanitizePersistedVoices(raw) }
}

function sanitizeArenaRows(value: unknown): ArenaPulseRow[] {
  if (!Array.isArray(value)) return []
  return value
    .map((row) => sanitizeArenaRow(row))
    .filter((row): row is ArenaPulseRow => Boolean(row))
}

function sanitizeArenaRow(value: unknown): ArenaPulseRow | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const summary = cleanString(row.summary, ARENA_SUMMARY_MAX_CHARS)
  const status = cleanString(row.status, 80)
  if (!summary || isBlockedStatus(status)) return null

  return {
    id: cleanString(row.id, 120) || crypto.randomUUID(),
    scope_type: cleanString(row.scope_type, 80),
    scope_value: cleanString(row.scope_value, 140),
    window_label: cleanString(row.window_label, 80),
    from_date: cleanString(row.from_date, 40),
    to_date: cleanString(row.to_date, 40),
    handles: cleanStringArray(row.handles, 60, 80),
    summary,
    citations: cleanCitationArray(row.citations),
    tags: cleanStringArray(row.tags, 40, 80),
    status,
    created_at: cleanString(row.created_at, 80) || new Date().toISOString(),
  }
}

function sanitizePersistedVoices(value: unknown): PulseVoiceRanking[] {
  if (!Array.isArray(value)) return []
  const voices: PulseVoiceRanking[] = []
  for (const row of value) {
    const obj = row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
    const handle = cleanHandle(obj.handle)
    const scopeType = cleanString(obj.scope_type, 40) ?? 'industry'
    const scopeValue = cleanString(obj.scope_value, 96) ?? 'global'
    if (!handle) continue
    voices.push({
      handle: handle.toLowerCase(),
      displayHandle: cleanString(obj.display_handle, 24) ?? handle,
      scopeKey: `${scopeType}:${scopeValue}`,
      scopeType,
      scopeValue,
      source: cleanSource(obj.source),
      rankScore: cleanNumber(obj.rank_score, 0, 1_000_000),
      heatScore: cleanNumber(obj.heat_score, 0, 100),
      noveltyScore: cleanNumber(obj.novelty_score, 0, 100),
      seenCount: cleanNumber(obj.seen_count, 0, 10000),
      seedCount: cleanNumber(obj.seed_count, 0, 10000),
      citationCount: cleanNumber(obj.citation_count, 0, 10000),
      summaryMentionCount: cleanNumber(obj.summary_mention_count, 0, 10000),
      firstSeenAt: cleanString(obj.first_seen_at, 80) ?? new Date().toISOString(),
      lastSeenAt: cleanString(obj.last_seen_at, 80) ?? new Date().toISOString(),
      sampleUrls: cleanUrlArray(obj.sample_urls),
      sampleContexts: [],
    })
  }
  return voices
}

function publicVoice(voice: PulseVoiceRanking): PulseVoiceRanking {
  return { ...voice, sampleContexts: [] }
}

function cleanScopeParam(value: string | null | undefined, max: number): string | null {
  const clean = value?.trim()
  if (!clean || clean.length > max) return null
  return /^[a-z0-9_.:@$-]+$/i.test(clean) ? clean : null
}

function cleanLimit(value: number | undefined, fallback: number, max: number): number {
  const n = Number(value ?? fallback)
  return Number.isFinite(n) ? Math.min(Math.max(Math.round(n), 1), max) : fallback
}

function cleanString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const clean = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim()
  return clean ? clean.slice(0, max) : null
}

function cleanStringArray(value: unknown, maxItems: number, maxChars: number): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => cleanString(item, maxChars))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems)
}

function cleanCitationArray(value: unknown): ArenaPulseCitation[] {
  if (!Array.isArray(value)) return []
  const citations: ArenaPulseCitation[] = []
  for (const [index, item] of value.slice(0, 24).entries()) {
    const obj = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    const url = cleanPublicUrl(obj.url)
    if (!url) continue
    const rawIndex = typeof obj.index === 'number' ? obj.index : Number(obj.index)
    citations.push({
      index: Number.isFinite(rawIndex) && rawIndex > 0 ? Math.round(rawIndex) : index + 1,
      url,
    })
  }
  return citations
}

function cleanUrlArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => cleanPublicUrl(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, 8)
}

function cleanPublicUrl(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw || raw.length > 2048) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

function cleanHandle(value: unknown): string | null {
  const raw = cleanString(value, 24)?.replace(/^@/, '')
  return raw && /^[A-Za-z0-9_]{2,15}$/.test(raw) ? raw : null
}

function cleanSource(value: unknown): PulseVoiceSource {
  return value === 'seed' || value === 'discovered' || value === 'mixed' ? value : 'mixed'
}

function cleanNumber(value: unknown, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return min
  return Math.min(Math.max(Math.round(n), min), max)
}

function isBlockedStatus(value: string | null): boolean {
  return value ? BLOCKED_PUBLIC_STATUSES.has(value.toLowerCase()) : false
}
