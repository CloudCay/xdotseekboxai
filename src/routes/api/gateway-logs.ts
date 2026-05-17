import { createFileRoute } from '@tanstack/react-router'

const DEFAULT_SEEKBOX_API_URL = 'https://api.seekbox.ai'
const STATS_WINDOWS = new Set(['1h', '6h', '12h', '24h', '7d', '30d', 'all'])
const COST_WINDOWS = new Set(['24h', '7d', '30d'])

export const Route = createFileRoute('/api/gateway-logs')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const statsWindow = cleanWindow(url.searchParams.get('window'), STATS_WINDOWS, '1h')
        const costWindow = cleanWindow(url.searchParams.get('cost_window'), COST_WINDOWS, statsWindow === '30d' ? '30d' : statsWindow === '7d' ? '7d' : '24h')
        const baseUrl = seekboxApiUrl()
        const adminToken = readAdminToken()

        const [stats, byEndpoint, byProvider, byApp, bySearchRun] = await Promise.all([
          fetchJson(`${baseUrl}/v1/stats?window=${encodeURIComponent(statsWindow)}`),
          adminToken ? fetchJson(`${baseUrl}/v1/admin/costs?window=${encodeURIComponent(costWindow)}&group_by=endpoint`, adminToken) : Promise.resolve(null),
          adminToken ? fetchJson(`${baseUrl}/v1/admin/costs?window=${encodeURIComponent(costWindow)}&group_by=provider`, adminToken) : Promise.resolve(null),
          adminToken ? fetchJson(`${baseUrl}/v1/admin/costs?window=${encodeURIComponent(costWindow)}&group_by=app`, adminToken) : Promise.resolve(null),
          adminToken ? fetchJson(`${baseUrl}/v1/admin/costs?window=${encodeURIComponent(costWindow)}&group_by=search_run`, adminToken) : Promise.resolve(null),
        ])

        const payload = {
          generatedAt: new Date().toISOString(),
          source: {
            mode: adminToken ? 'cloudflare-admin-costs' : 'cloudflare-public-stats',
            baseUrl,
            statsWindow,
            costWindow: adminToken ? costWindow : null,
            adminRollups: Boolean(adminToken),
          },
          stats: sanitizeStats(stats),
          costs: adminToken
            ? {
                endpoint: sanitizeCostRollup(byEndpoint),
                provider: sanitizeCostRollup(byProvider),
                app: sanitizeCostRollup(byApp),
                searchRun: sanitizeCostRollup(bySearchRun),
              }
            : null,
        }

        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
          },
        })
      },
    },
  },
})

async function fetchJson(endpoint: string, adminToken?: string): Promise<unknown> {
  const res = await fetch(endpoint, {
    headers: adminToken ? { 'X-Admin-Token': adminToken } : undefined,
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null)

  if (!res?.ok) return null
  return res.json().catch(() => null)
}

function seekboxApiUrl(): string {
  const raw =
    process.env.SEEKBOX_API_URL ??
    process.env.VITE_SEEKBOX_API_URL ??
    process.env.EXPO_PUBLIC_SEEKBOX_API_URL ??
    process.env.VITE_BACKEND_URL ??
    process.env.EXPO_PUBLIC_BACKEND_URL ??
    DEFAULT_SEEKBOX_API_URL
  const clean = raw.trim().replace(/\/$/, '')
  return clean || DEFAULT_SEEKBOX_API_URL
}

function readAdminToken(): string | null {
  const token = process.env.SBX_ADMIN_TOKEN ?? process.env.SEEKBOX_ADMIN_TOKEN
  const clean = token?.trim()
  return clean || null
}

function cleanWindow(value: string | null, allowed: Set<string>, fallback: string): string {
  const clean = value?.trim().toLowerCase()
  return clean && allowed.has(clean) ? clean : fallback
}

function sanitizeStats(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  return {
    window_sec: numberOrNull(row.window_sec),
    as_of: stringOrNull(row.as_of, 80),
    totals: sanitizeTotals(row.totals),
    by_app: sanitizeSummaryRows(row.by_app, 'app'),
    by_provider: sanitizeSummaryRows(row.by_provider, 'provider'),
    daily: sanitizeDailyRows(row.daily),
  }
}

function sanitizeTotals(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  return {
    calls: numberOrZero(row.calls),
    cost_usd: numberOrZero(row.cost_usd),
    input_tokens: numberOrZero(row.input_tokens),
    output_tokens: numberOrZero(row.output_tokens),
    cached_tokens: numberOrZero(row.cached_tokens),
    distinct_apps: numberOrZero(row.distinct_apps),
    distinct_providers: numberOrZero(row.distinct_providers),
    errors: numberOrZero(row.errors),
    cache_hits: numberOrZero(row.cache_hits),
    avg_latency_ms: numberOrZero(row.avg_latency_ms),
    p95_latency_ms: numberOrZero(row.p95_latency_ms),
  }
}

function sanitizeSummaryRows(value: unknown, keyName: 'app' | 'provider') {
  if (!Array.isArray(value)) return []
  return value.slice(0, 20).map((item) => {
    const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    return {
      key: stringOrNull(row[keyName], 120) ?? 'unknown',
      calls: numberOrZero(row.calls),
      cost_usd: numberOrZero(row.cost_usd),
      avg_latency_ms: numberOrNull(row.avg_latency_ms),
    }
  })
}

function sanitizeDailyRows(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.slice(0, 40).map((item) => {
    const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    return {
      day: stringOrNull(row.day, 80),
      calls: numberOrZero(row.calls),
      cost_usd: numberOrZero(row.cost_usd),
    }
  })
}

function sanitizeCostRollup(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  return {
    window: stringOrNull(row.window, 40),
    window_interval: stringOrNull(row.window_interval, 80),
    since: stringOrNull(row.since, 80),
    group_by: stringOrNull(row.group_by, 40),
    total_cost_usd: numberOrZero(row.total_cost_usd),
    total_calls: numberOrZero(row.total_calls),
    total_pulses: numberOrZero(row.total_pulses),
    total_research_runs: numberOrZero(row.total_research_runs),
    total_images: numberOrZero(row.total_images),
    rows: sanitizeCostRows(row.rows),
  }
}

function sanitizeCostRows(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.slice(0, 100).map((item) => {
    const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    return {
      key: stringOrNull(row.key, 160) ?? 'unknown',
      count: numberOrZero(row.count),
      cost_usd: numberOrZero(row.cost_usd),
      in_tok: numberOrZero(row.in_tok),
      out_tok: numberOrZero(row.out_tok),
    }
  })
}

function stringOrNull(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const clean = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim()
  return clean ? clean.slice(0, max) : null
}

function numberOrNull(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

function numberOrZero(value: unknown): number {
  return numberOrNull(value) ?? 0
}
