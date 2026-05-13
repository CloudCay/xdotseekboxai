import { createFileRoute } from '@tanstack/react-router'
import { parseAntiEcho } from '../../../lib/xIntel/parsers'
import { buildAntiEchoPrompt } from '../../../lib/xIntel/prompts'
import {
  callGatewayChat,
  clientKey,
  corsHeaders,
  jsonResponse,
  withClientLimit,
} from '../../../lib/xIntel/server'
import type { AntiEchoResult } from '../../../lib/xIntel/types'

export const Route = createFileRoute('/api/x-intel/anti-echo')({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => new Response(null, { status: 204, headers: corsHeaders(request) }),
      POST: async ({ request }) => {
        let body: Record<string, unknown>
        try {
          body = (await request.json()) as Record<string, unknown>
        } catch {
          return jsonResponse(request, { error: 'Expected JSON body.' }, 400)
        }

        let claim: string
        try {
          claim = cleanClaim(body.claim)
        } catch (error) {
          return jsonResponse(request, { error: error instanceof Error ? error.message : 'Invalid claim.' }, 400)
        }

        const limited = await withClientLimit(clientKey(request, body.clientId), () => runAntiEcho(claim))
        if (!limited.ok) return jsonResponse(request, { error: limited.error }, limited.status)
        return jsonResponse(request, limited.value)
      },
    },
  },
})

function cleanClaim(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Claim is required.')
  const claim = value.replace(/\s+/g, ' ').trim()
  if (claim.length < 8) throw new Error('Claim is too short.')
  if (claim.length > 600) throw new Error('Claim must be 600 characters or less.')
  return claim
}

async function runAntiEcho(claim: string): Promise<AntiEchoResult> {
  const response = await callGatewayChat({
    prompt: buildAntiEchoPrompt(claim),
    feature: 'anti-echo:dissent',
    timeoutMs: 55_000,
  })

  if (!response.ok) {
    return {
      ok: false,
      claim,
      status: 'error',
      strongestCounters: [],
      posts: [],
      durationMs: response.durationMs,
      costUsd: response.costUsd,
      generatedAt: new Date().toISOString(),
      error: response.error ?? 'X search returned no result.',
    }
  }

  const parsed = parseAntiEcho(response.content)
  return {
    ok: true,
    claim,
    status: 'success',
    summary: parsed.summary,
    strongestCounters: parsed.strongestCounters,
    posts: parsed.posts,
    durationMs: response.durationMs,
    costUsd: response.costUsd,
    generatedAt: new Date().toISOString(),
  }
}
