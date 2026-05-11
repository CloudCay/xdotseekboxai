import { createFileRoute } from '@tanstack/react-router'
import { scopeValuesForIndustrySlug } from '../../lib/industryCatalog'

const PULSE_SELECT = [
  'id',
  'scope_type',
  'scope_value',
  'window_label',
  'from_date',
  'to_date',
  'handles',
  'query_used',
  'summary',
  'citations',
  'tool_calls',
  'cost_usd',
  'latency_ms',
  'tags',
  'metadata',
  'status',
  'error',
  'created_at',
].join(',')

export const Route = createFileRoute('/api/pulse-runs')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const limitRaw = Number(url.searchParams.get('limit') ?? 90)
        const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.round(limitRaw), 1), 150) : 90
        const scopeType = url.searchParams.get('scope_type')
        const scopeValue = url.searchParams.get('scope_value')

        const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL
        const publicKey =
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
          process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
          process.env.VITE_SUPABASE_ANON_KEY ??
          process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

        if (!supabaseUrl || !publicKey) {
          return Response.json({ rows: [], error: 'Supabase env is not configured.' }, { status: 200 })
        }

        const endpoint = new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/pulse_runs`)
        endpoint.searchParams.set('select', PULSE_SELECT)
        if (scopeType) endpoint.searchParams.set('scope_type', `eq.${scopeType}`)
        if (scopeValue) {
          const scopeValues = scopeType === 'industry' ? scopeValuesForIndustrySlug(scopeValue) : [scopeValue]
          endpoint.searchParams.set('scope_value', scopeValues.length > 1 ? `in.(${scopeValues.join(',')})` : `eq.${scopeValues[0]}`)
        }
        endpoint.searchParams.set('order', 'created_at.desc')
        endpoint.searchParams.set('limit', String(limit))

        const res = await fetch(endpoint, {
          headers: supabasePublicHeaders(publicKey),
        })

        const text = await res.text()
        if (!res.ok) {
          return Response.json(
            { rows: [], error: `pulse_runs query failed: ${res.status}`, detail: text.slice(0, 300) },
            { status: 502 },
          )
        }

        return new Response(JSON.stringify({ rows: JSON.parse(text) }), {
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

function supabasePublicHeaders(publicKey: string): HeadersInit {
  return {
    apikey: publicKey,
    ...(publicKey.startsWith('eyJ') ? { Authorization: `Bearer ${publicKey}` } : {}),
  }
}
