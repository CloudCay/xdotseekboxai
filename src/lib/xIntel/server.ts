import type { GatewayChatResponse } from './types'

const DEFAULT_GATEWAY_URL = 'https://api.seekbox.ai'
const activeByClient = new Map<string, number>()
const recentByClient = new Map<string, { count: number; resetAt: number }>()

type GatewayChatResult = {
  ok: boolean
  status: number
  content: string
  error?: string
}

export function jsonResponse(request: Request, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      Vary: 'Origin',
      'Cache-Control': 'no-store',
      ...corsHeaders(request),
    },
  })
}

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin')
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
  if (origin) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

export function clientKey(request: Request, clientId: unknown): string {
  const id = typeof clientId === 'string' ? clientId.trim().slice(0, 120) : ''
  if (id) return `client:${id}`
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return `ip:${forwarded || request.headers.get('x-real-ip') || 'unknown'}`
}

export async function withClientLimit<T>(
  key: string,
  task: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; status: number; error: string }> {
  const now = Date.now()
  const bucket = recentByClient.get(key)
  const current = bucket && bucket.resetAt > now ? bucket : { count: 0, resetAt: now + 60 * 60 * 1000 }
  if (current.count >= 30) {
    recentByClient.set(key, current)
    return { ok: false, status: 429, error: 'Hourly X Intel limit reached. Try again later.' }
  }
  if ((activeByClient.get(key) ?? 0) >= 1) {
    return { ok: false, status: 429, error: 'An X Intel run is already active for this session.' }
  }

  recentByClient.set(key, { count: current.count + 1, resetAt: current.resetAt })
  activeByClient.set(key, (activeByClient.get(key) ?? 0) + 1)
  try {
    return { ok: true, value: await task() }
  } finally {
    const active = (activeByClient.get(key) ?? 1) - 1
    if (active > 0) activeByClient.set(key, active)
    else activeByClient.delete(key)
  }
}

function gatewayUrl(): string {
  const configured =
    process.env.SEEKBOX_X_INTEL_GATEWAY_URL ??
    process.env.SEEKBOX_API_URL ??
    process.env.SEEKBOX_GATEWAY_URL ??
    DEFAULT_GATEWAY_URL
  return configured.trim().replace(/\/$/, '') || DEFAULT_GATEWAY_URL
}

export async function callGatewayChat(args: {
  prompt: string
  feature: string
  timeoutMs?: number
}): Promise<GatewayChatResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs ?? 35_000)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-App': 'x-seekboxai',
    'X-Feature': args.feature,
  }
  if (process.env.SEEKBOX_API_KEY) headers.Authorization = `Bearer ${process.env.SEEKBOX_API_KEY}`

  try {
    const response = await fetch(`${gatewayUrl()}/v1/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prompt: args.prompt,
        provider: 'xai',
        model: 'grok-x',
        stream: false,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      return {
        ok: false,
        status: response.status,
        content: '',
        error: body ? `Gateway HTTP ${response.status}: ${body.slice(0, 220)}` : `Gateway HTTP ${response.status}`,
      }
    }

    const raw = (await response.json().catch(() => null)) as GatewayChatResponse | null
    const content = raw?.choices?.[0]?.message?.content?.trim() ?? ''
    if (!content) {
      return {
        ok: false,
        status: response.status,
        content: '',
        error: 'Gateway returned no content.',
      }
    }

    return {
      ok: true,
      status: response.status,
      content,
    }
  } catch (error) {
    const timedOut = controller.signal.aborted
    return {
      ok: false,
      status: 0,
      content: '',
      error: timedOut
        ? `Live X request timed out after ${Math.round((args.timeoutMs ?? 35_000) / 1000)} seconds.`
        : error instanceof Error ? error.message : 'Gateway request failed.',
    }
  } finally {
    clearTimeout(timeout)
  }
}
