import { createFileRoute } from '@tanstack/react-router'
import { scopeValuesForIndustrySlug } from '../../lib/industryCatalog'
import { rankPulseVoices, sortPulseVoiceRankings, type PulseRowLike, type PulseVoiceRanking, type PulseVoiceSource } from '../../lib/pulseVoiceRankings'

const PUBLIC_PULSE_SELECT = [
  'id',
  'scope_type',
  'scope_value',
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
const PUBLIC_CACHE_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'public, max-age=0, must-revalidate',
  'netlify-cdn-cache-control': 'public, durable, max-age=60, stale-while-revalidate=600',
}

export const Route = createFileRoute('/api/pulse-voices')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const scopeTypeParam = url.searchParams.get('scope_type')
        const scopeValueParam = url.searchParams.get('scope_value')
        const parsedScopeType = cleanScopeParam(scopeTypeParam, 40)
        const scopeValue = cleanScopeParam(scopeValueParam, 96)
        if (scopeTypeParam && !parsedScopeType) {
          return Response.json({ voices: [], error: 'Invalid scope_type.' }, { status: 400 })
        }
        if (scopeValueParam && !scopeValue) {
          return Response.json({ voices: [], error: 'Invalid scope_value.' }, { status: 400 })
        }
        const scopeType = parsedScopeType ?? 'industry'

        const limitRaw = Number(url.searchParams.get('limit') ?? 12)
        const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.round(limitRaw), 1), 50) : 12
        const env = supabaseEnv()
        if (!env) return Response.json({ voices: [], source: 'empty', error: 'Supabase env is not configured.' }, { status: 200 })

        const persisted = await fetchPersistedVoices({ ...env, scopeType, scopeValue, limit })
        if (persisted.ok && persisted.voices.length) {
          return json({ voices: sortPulseVoiceRankings(persisted.voices.map(publicVoice), limit), source: 'rankings', generatedAt: new Date().toISOString() })
        }

        const rows = await fetchPulseRowsForVoices({ ...env, scopeType, scopeValue, limit: 500 })
        if (!rows.ok) {
          return Response.json({ voices: [], source: 'empty', error: rows.error }, { status: 502 })
        }

        return json({
          voices: rankPulseVoices(rows.rows, limit).map(publicVoice),
          source: 'derived',
          generatedAt: new Date().toISOString(),
        })
      },
    },
  },
})

function publicVoice(voice: PulseVoiceRanking): PulseVoiceRanking {
  return {
    ...voice,
    sampleContexts: [],
  }
}

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: PUBLIC_CACHE_HEADERS,
  })
}

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

async function fetchPulseRowsForVoices(args: {
  baseUrl: string
  headers: HeadersInit
  scopeType: string
  scopeValue: string | null
  limit: number
}): Promise<{ ok: true; rows: PulseRowLike[] } | { ok: false; error: string }> {
  let res = await fetchPulseRowsFromTable({ ...args, table: 'public_pulse_runs' })
  if (!res?.ok && (res?.status === 404 || res?.status === 400)) {
    res = await fetchPulseRowsFromTable({ ...args, table: 'pulse_runs' })
  }
  if (!res?.ok) return { ok: false, error: 'Pulse voice rows could not be loaded.' }
  const raw = await res.json().catch(() => null)
  return { ok: true, rows: sanitizePulseRows(raw) }
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

function sanitizePersistedVoices(value: unknown): PulseVoiceRanking[] {
  if (!Array.isArray(value)) return []
  const voices: PulseVoiceRanking[] = []
  for (const row of value) {
    const obj = row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
    const handle = cleanHandle(obj.handle)
    const scopeType = cleanString(obj.scope_type, 40) ?? 'industry'
    const scopeValue = cleanString(obj.scope_value, 96) ?? 'global'
    if (!handle) continue
    const source = cleanSource(obj.source)
    voices.push({
      handle: handle.toLowerCase(),
      displayHandle: cleanString(obj.display_handle, 24) ?? handle,
      scopeKey: `${scopeType}:${scopeValue}`,
      scopeType,
      scopeValue,
      source,
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

function sanitizePulseRows(value: unknown): PulseRowLike[] {
  if (!Array.isArray(value)) return []
  const rows: PulseRowLike[] = []
  for (const row of value) {
    const obj = row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
    const summary = cleanString(obj.summary, 12_000)
    const status = cleanString(obj.status, 80)
    if (!summary || (status && BLOCKED_PUBLIC_STATUSES.has(status.toLowerCase()))) continue
    rows.push({
      id: cleanString(obj.id, 120) ?? crypto.randomUUID(),
      scope_type: cleanString(obj.scope_type, 80),
      scope_value: cleanString(obj.scope_value, 140),
      handles: cleanStringArray(obj.handles, 60, 80),
      summary,
      citations: cleanCitationArray(obj.citations),
      tags: cleanStringArray(obj.tags, 40, 80),
      created_at: cleanString(obj.created_at, 80) ?? new Date().toISOString(),
    })
  }
  return rows
}

function cleanCitationArray(value: unknown): Array<{ index?: number | null; url?: string | null }> {
  if (!Array.isArray(value)) return []
  const citations: Array<{ index?: number | null; url?: string | null }> = []
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

function cleanScopeParam(value: string | null, max: number): string | null {
  const clean = value?.trim()
  if (!clean) return null
  if (clean.length > max) return null
  return /^[a-z0-9_.:@$-]+$/i.test(clean) ? clean : null
}

function cleanSource(value: unknown): PulseVoiceSource {
  return value === 'seed' || value === 'mixed' || value === 'discovered' ? value : 'discovered'
}

function cleanHandle(value: unknown): string | null {
  const clean = cleanString(value, 24)?.replace(/^@+/, '')
  return clean && /^[A-Za-z0-9_]{2,15}$/.test(clean) ? clean : null
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

function cleanUrlArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map(cleanPublicUrl)
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

function cleanNumber(value: unknown, min: number, max: number): number {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return min
  return Math.round(Math.min(max, Math.max(min, num)))
}
