import { createFileRoute } from '@tanstack/react-router'
import { scopeValuesForIndustrySlug } from '../../lib/industryCatalog'
import type { PulseRunMetrics } from '../../lib/pulseMetrics'

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
  'metrics',
  'tags',
  'status',
  'created_at',
].join(',')

const BLOCKED_PUBLIC_STATUSES = new Set(['error', 'failed', 'failure', 'cancelled', 'canceled', 'running', 'pending', 'queued', 'in_progress'])
const PUBLIC_CACHE_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'public, max-age=0, must-revalidate',
  'netlify-cdn-cache-control': 'public, durable, max-age=60, stale-while-revalidate=600',
}

type PublicPulseCitation = {
  index?: number | null
  url?: string | null
}

type PublicPulseRow = {
  id: string
  scope_type: string | null
  scope_value: string | null
  window_label: string | null
  from_date: string | null
  to_date: string | null
  handles: string[] | null
  summary: string | null
  citations: PublicPulseCitation[] | null
  metrics: PulseRunMetrics | null
  tags: string[] | null
  status: string | null
  created_at: string
}

export const Route = createFileRoute('/api/pulse-runs')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const scopeType = cleanScopeParam(url.searchParams.get('scope_type'), 40)
        const scopeValue = cleanScopeParam(url.searchParams.get('scope_value'), 96)
        if (url.searchParams.get('scope_type') && !scopeType) {
          return Response.json({ rows: [], error: 'Invalid scope_type.' }, { status: 400 })
        }
        if (url.searchParams.get('scope_value') && !scopeValue) {
          return Response.json({ rows: [], error: 'Invalid scope_value.' }, { status: 400 })
        }
        const defaultLimit = scopeType === 'industry' && !scopeValue ? 500 : 90
        const limitRaw = Number(url.searchParams.get('limit') ?? defaultLimit)
        const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.round(limitRaw), 1), 500) : defaultLimit

        const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL
        const publicKey =
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
          process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
          process.env.VITE_SUPABASE_ANON_KEY ??
          process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

        if (!supabaseUrl || !publicKey) {
          return Response.json({ rows: [], error: 'Supabase env is not configured.' }, { status: 200 })
        }

        const baseUrl = supabaseUrl.replace(/\/$/, '')
        const headers = supabasePublicHeaders(publicKey)
        let res = await fetchPulseRows({ baseUrl, table: 'public_pulse_runs', headers, scopeType, scopeValue, limit })
        if (!res.ok && (res.status === 404 || res.status === 400)) {
          // Until the DB view is installed, still keep the API response public-only.
          res = await fetchPulseRows({ baseUrl, table: 'pulse_runs', headers, scopeType, scopeValue, limit })
        }

        const text = await res.text()
        if (!res.ok) {
          return Response.json({ rows: [], error: 'Pulse rows could not be loaded.' }, { status: 502 })
        }

        let rows: PublicPulseRow[]
        try {
          rows = sanitizePublicPulseRows(JSON.parse(text))
        } catch {
          return Response.json({ rows: [], error: 'Pulse rows returned malformed data.' }, { status: 502 })
        }

        return new Response(JSON.stringify({ rows }), {
          status: 200,
          headers: PUBLIC_CACHE_HEADERS,
        })
      },
    },
  },
})

async function fetchPulseRows(args: {
  baseUrl: string
  table: 'public_pulse_runs' | 'pulse_runs'
  headers: HeadersInit
  scopeType: string | null
  scopeValue: string | null
  limit: number
}): Promise<Response> {
  const endpoint = new URL(`${args.baseUrl}/rest/v1/${args.table}`)
  endpoint.searchParams.set('select', PUBLIC_PULSE_SELECT)
  if (args.scopeType) endpoint.searchParams.set('scope_type', `eq.${args.scopeType}`)
  if (args.scopeValue) {
    const scopeValues = args.scopeType === 'industry' ? scopeValuesForIndustrySlug(args.scopeValue) : [args.scopeValue]
    endpoint.searchParams.set('scope_value', scopeValues.length > 1 ? `in.(${scopeValues.join(',')})` : `eq.${scopeValues[0]}`)
  }
  endpoint.searchParams.append('summary', 'not.is.null')
  endpoint.searchParams.append('summary', 'neq.')
  endpoint.searchParams.set('order', 'created_at.desc')
  endpoint.searchParams.set('limit', String(args.limit))

  return fetch(endpoint, {
    headers: args.headers,
    signal: AbortSignal.timeout(8_000),
  })
}

function supabasePublicHeaders(publicKey: string): HeadersInit {
  return {
    apikey: publicKey,
    ...(publicKey.startsWith('eyJ') ? { Authorization: `Bearer ${publicKey}` } : {}),
  }
}

function cleanScopeParam(value: string | null, max: number): string | null {
  const clean = value?.trim()
  if (!clean) return null
  if (clean.length > max) return null
  return /^[a-z0-9_.:@$-]+$/i.test(clean) ? clean : null
}

function sanitizePublicPulseRows(value: unknown): PublicPulseRow[] {
  if (!Array.isArray(value)) return []
  return value
    .map((row) => sanitizePublicPulseRow(row))
    .filter((row): row is PublicPulseRow => Boolean(row))
}

function sanitizePublicPulseRow(value: unknown): PublicPulseRow | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const summary = cleanString(row.summary, 12_000)
  const status = cleanString(row.status, 80)
  if (!summary || isBlockedStatus(status)) return null

  return {
    id: cleanString(row.id, 120) || crypto.randomUUID(),
    scope_type: cleanString(row.scope_type, 80),
    scope_value: cleanString(row.scope_value, 140),
    window_label: cleanString(row.window_label, 80),
    from_date: cleanString(row.from_date, 40),
    to_date: cleanString(row.to_date, 40),
    handles: cleanStringArray(row.handles, 40, 80),
    summary,
    citations: sanitizePublicCitations(row.citations),
    metrics: sanitizePublicMetrics(row.metrics),
    tags: cleanStringArray(row.tags, 40, 80),
    status,
    created_at: cleanString(row.created_at, 80) || new Date().toISOString(),
  }
}

function sanitizePublicMetrics(value: unknown): PulseRunMetrics | null {
  if (!value || typeof value !== 'object') return null
  const obj = value as Record<string, unknown>
  const metrics: PulseRunMetrics = {
    basis: cleanString(obj.basis, 40),
    matchedPostCount: cleanNonNegativeNumber(obj.matchedPostCount, 1_000_000_000),
    samplePostCount: cleanNonNegativeNumber(obj.samplePostCount, 1_000_000),
    replyCount: cleanNonNegativeNumber(obj.replyCount, 1_000_000_000),
    viewCount: cleanNonNegativeNumber(obj.viewCount, 100_000_000_000_000),
    likeCount: cleanNonNegativeNumber(obj.likeCount, 100_000_000_000),
    repostCount: cleanNonNegativeNumber(obj.repostCount, 100_000_000_000),
    quoteCount: cleanNonNegativeNumber(obj.quoteCount, 100_000_000_000),
    confidence: cleanString(obj.confidence, 40),
    notes: cleanString(obj.notes, 240),
    generatedAt: cleanString(obj.generatedAt, 80),
  }
  return Object.values(metrics).some((item) => item !== null && item !== undefined) ? metrics : null
}

function sanitizePublicCitations(value: unknown): PublicPulseCitation[] {
  if (!Array.isArray(value)) return []
  const citations: PublicPulseCitation[] = []
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

function cleanString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const clean = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim()
  return clean ? clean.slice(0, max) : null
}

function cleanNonNegativeNumber(value: unknown, max: number): number | null {
  const raw = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(raw) || raw < 0) return null
  return Math.min(Math.round(raw), max)
}

function cleanStringArray(value: unknown, maxItems: number, maxChars: number): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => cleanString(item, maxChars))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems)
}

function isBlockedStatus(value: string | null): boolean {
  return value ? BLOCKED_PUBLIC_STATUSES.has(value.toLowerCase()) : false
}
