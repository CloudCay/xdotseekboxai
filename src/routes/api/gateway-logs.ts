import { createFileRoute } from '@tanstack/react-router'

const DEFAULT_SEEKBOX_API_URL = 'https://api.seekbox.ai'
const STATS_WINDOWS = new Set(['1h', '6h', '12h', '24h', '7d', '30d', 'all'])

export const Route = createFileRoute('/api/gateway-logs')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const statsWindow = cleanWindow(url.searchParams.get('window'), STATS_WINDOWS, '1h')
        const baseUrl = seekboxApiUrl()
        const stats = await fetchJson(`${baseUrl}/v1/stats?window=${encodeURIComponent(statsWindow)}`)

        const payload = {
          generatedAt: new Date().toISOString(),
          source: {
            mode: 'cloudflare-public-stats',
            baseUrl,
            statsWindow,
            adminRollups: false,
          },
          stats: sanitizeStats(stats),
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

async function fetchJson(endpoint: string): Promise<unknown> {
  const res = await fetch(endpoint, {
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
