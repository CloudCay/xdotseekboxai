import { createFileRoute } from '@tanstack/react-router'
import { buildXBattlePrompt, normalizeHandle } from '../../../lib/xIntel/prompts'
import { parseXBattleSide } from '../../../lib/xIntel/parsers'
import {
  callGatewayChat,
  clientKey,
  corsHeaders,
  jsonResponse,
  withClientLimit,
} from '../../../lib/xIntel/server'
import type { BattleWindow, XBattleResponse, XBattleSide } from '../../../lib/xIntel/types'

export const Route = createFileRoute('/api/x-intel/x-battle')({
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

        let input: CleanBattleInput
        try {
          input = cleanBattleInput(body)
        } catch (error) {
          return jsonResponse(request, { error: error instanceof Error ? error.message : 'Invalid battle request.' }, 400)
        }

        const limited = await withClientLimit(clientKey(request, body.clientId), () => runBattle(input))
        if (!limited.ok) return jsonResponse(request, { error: limited.error }, limited.status)
        return jsonResponse(request, limited.value)
      },
    },
  },
})

type CleanBattleInput = {
  handleA: string
  handleB: string
  window: BattleWindow
}

function cleanBattleInput(body: Record<string, unknown>): CleanBattleInput {
  const handleA = cleanHandle(body.handleA)
  const handleB = cleanHandle(body.handleB)
  const window = body.window

  if (!handleA || !handleB) throw new Error('Both X handles are required.')
  if (handleA.toLowerCase() === handleB.toLowerCase()) throw new Error('Pick two different handles.')
  if (window !== '24h' && window !== '7d' && window !== '30d') throw new Error('Choose a valid window.')

  return { handleA, handleB, window }
}

function cleanHandle(value: unknown): string {
  if (typeof value !== 'string') return ''
  const fromUrl = value.match(/(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})/i)?.[1]
  const cleaned = (fromUrl ?? value).trim().replace(/^@+/, '')
  return /^[A-Za-z0-9_]{1,15}$/.test(cleaned) ? cleaned : ''
}

async function runBattle(input: CleanBattleInput): Promise<XBattleResponse> {
  const [a, b] = await Promise.all([
    runSide(input.handleA, input.window),
    runSide(input.handleB, input.window),
  ])
  const ok = a.status === 'success' || b.status === 'success'

  return {
    ok,
    handleA: input.handleA,
    handleB: input.handleB,
    window: input.window,
    sides: { a, b },
    generatedAt: new Date().toISOString(),
    error: ok ? undefined : 'Both X searches failed.',
  }
}

async function runSide(handle: string, window: BattleWindow): Promise<XBattleSide> {
  const normalized = normalizeHandle(handle)
  const response = await callGatewayChat({
    prompt: buildXBattlePrompt(handle, window),
    feature: `x-battle:${window}:${normalized}`,
    timeoutMs: 55_000,
  })

  if (!response.ok) {
    return {
      handle: normalized,
      status: 'error',
      themes: [],
      excerpts: [],
      error: response.error ?? 'X search returned no result.',
    }
  }

  const parsed = parseXBattleSide(response.content)
  return {
    handle: normalized,
    status: 'success',
    postCount: parsed.postCount,
    sentiment: parsed.sentiment,
    themes: parsed.themes,
    excerpts: parsed.excerpts,
  }
}
