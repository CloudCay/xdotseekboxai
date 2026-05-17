import { createFileRoute } from '@tanstack/react-router'

type VotePayload = {
  featureId?: unknown
  clientId?: unknown
  sourcePath?: unknown
}

export const Route = createFileRoute('/api/roadmap-votes')({
  server: {
    handlers: {
      GET: async () => {
        const config = getSupabaseRestConfig()
        if (!config) {
          return Response.json({ ok: true, counts: {}, persisted: false, reason: 'Supabase env is not configured.' })
        }

        const endpoint = new URL(`${config.supabaseUrl.replace(/\/$/, '')}/rest/v1/roadmap_vote_counts`)
        endpoint.searchParams.set('select', 'feature_id,vote_count')

        const response = await fetch(endpoint, {
          headers: {
            apikey: config.publicKey,
            authorization: `Bearer ${config.publicKey}`,
          },
        }).catch(() => null)

        if (!response?.ok) {
          return Response.json({ ok: true, counts: {}, persisted: false, reason: 'Roadmap vote count view is not ready.' })
        }

        const rows = (await response.json().catch(() => [])) as Array<{ feature_id?: unknown; vote_count?: unknown }>
        const counts: Record<string, number> = {}
        for (const row of rows) {
          const featureId = cleanId(row.feature_id)
          const voteCount = typeof row.vote_count === 'number' ? row.vote_count : Number(row.vote_count)
          if (featureId && Number.isFinite(voteCount) && voteCount > 0) counts[featureId] = Math.floor(voteCount)
        }

        return Response.json({ ok: true, counts, persisted: true })
      },
      POST: async ({ request }) => {
        let payload: VotePayload
        try {
          payload = (await request.json()) as VotePayload
        } catch {
          return Response.json({ ok: false, persisted: false, error: 'Invalid vote payload.' }, { status: 400 })
        }

        const featureId = cleanId(payload.featureId)
        const clientId = cleanId(payload.clientId, 80)
        const sourcePath = cleanPath(payload.sourcePath)
        if (!featureId || !clientId) {
          return Response.json({ ok: false, persisted: false, error: 'Missing featureId or clientId.' }, { status: 400 })
        }

        const config = getSupabaseRestConfig()
        if (!config) {
          return Response.json({ ok: true, persisted: false, reason: 'Supabase env is not configured.' })
        }

        const endpoint = new URL(`${config.supabaseUrl.replace(/\/$/, '')}/rest/v1/roadmap_votes`)
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            apikey: config.publicKey,
            authorization: `Bearer ${config.publicKey}`,
            'content-type': 'application/json',
            prefer: 'return=minimal',
          },
          body: JSON.stringify({
            feature_id: featureId,
            client_id: clientId,
            source_path: sourcePath,
          }),
        }).catch(() => null)

        if (response?.status === 409) {
          return Response.json({ ok: true, persisted: true, duplicate: true })
        }

        if (!response?.ok) {
          return Response.json({ ok: true, persisted: false, reason: 'Roadmap vote table is not ready.' })
        }

        return Response.json({ ok: true, persisted: true })
      },
    },
  },
})

function getSupabaseRestConfig(): { supabaseUrl: string; publicKey: string } | null {
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL
  const publicKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !publicKey) return null
  return { supabaseUrl, publicKey }
}

function cleanId(value: unknown, max = 64): string | null {
  if (typeof value !== 'string') return null
  const clean = value.trim().slice(0, max)
  return /^[A-Za-z0-9_.:-]+$/.test(clean) ? clean : null
}

function cleanPath(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const clean = value.trim().slice(0, 160)
  if (!clean.startsWith('/') || clean.startsWith('//')) return null
  return clean
}
