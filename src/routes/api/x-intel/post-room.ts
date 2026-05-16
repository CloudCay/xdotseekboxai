import { createFileRoute } from '@tanstack/react-router'
import { parsePostRoom } from '../../../lib/xIntel/parsers'
import { buildPostRoomPrompt } from '../../../lib/xIntel/prompts'
import {
  callGatewayChat,
  clientKey,
  corsHeaders,
  jsonResponse,
  withClientLimit,
} from '../../../lib/xIntel/server'
import type { PostRoomResult } from '../../../lib/xIntel/types'

export const Route = createFileRoute('/api/x-intel/post-room')({
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

        let input: string
        try {
          input = cleanInput(body.input)
        } catch (error) {
          return jsonResponse(request, { error: error instanceof Error ? error.message : 'Invalid room request.' }, 400)
        }

        const limited = await withClientLimit(clientKey(request, body.clientId), () => runPostRoom(input))
        if (!limited.ok) return jsonResponse(request, { error: limited.error }, limited.status)
        return jsonResponse(request, limited.value)
      },
    },
  },
})

function cleanInput(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Post URL or topic is required.')
  const input = value.replace(/\s+/g, ' ').trim()
  if (input.length < 4) throw new Error('Post URL or topic is too short.')
  if (input.length > 500) throw new Error('Post URL or topic must be 500 characters or less.')
  return input
}

async function runPostRoom(input: string): Promise<PostRoomResult> {
  const response = await callGatewayChat({
    prompt: buildPostRoomPrompt(input),
    feature: 'post-room:conversation',
    timeoutMs: 55_000,
  })

  if (!response.ok) {
    return {
      ok: false,
      input,
      status: 'error',
      positions: [],
      relatedPosts: [],
      generatedAt: new Date().toISOString(),
      error: response.error ?? 'X search returned no result.',
    }
  }

  const parsed = parsePostRoom(response.content)
  return {
    ok: true,
    input,
    status: 'success',
    roomSummary: parsed.roomSummary,
    whyItMatters: parsed.whyItMatters,
    positions: parsed.positions,
    relatedPosts: parsed.relatedPosts,
    dissent: parsed.dissent,
    generatedAt: new Date().toISOString(),
  }
}
