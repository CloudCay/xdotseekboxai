const SEEKBOX_API_URL = 'https://api.seekbox.ai'
const LEGACY_SEARCH_API_URL = 'https://ruffled-snail.vibecode.run'

type UpstreamKind = 'json' | 'stream'

export function seekboxApiUrl(path: string): string {
  return `${cleanBaseUrl(
    process.env.VITE_SEEKBOX_API_URL ??
      process.env.EXPO_PUBLIC_SEEKBOX_API_URL ??
      process.env.VITE_BACKEND_URL ??
      process.env.EXPO_PUBLIC_BACKEND_URL,
    SEEKBOX_API_URL,
  )}${path}`
}

export function legacySearchApiUrl(path: string): string {
  return `${cleanBaseUrl(
    process.env.VITE_LEGACY_BACKEND_URL ?? process.env.EXPO_PUBLIC_LEGACY_BACKEND_URL,
    LEGACY_SEARCH_API_URL,
  )}${path}`
}

export async function proxySearchRequest(request: Request, upstreamUrl: string, kind: UpstreamKind): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() })
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders() })
  }

  let upstream: Response
  try {
    upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers: forwardedHeaders(request),
      body: await request.text(),
      signal: request.signal,
    })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Search proxy failed.' },
      { status: 502, headers: corsHeaders() },
    )
  }

  if (kind === 'json') return sanitizeJsonResponse(upstream)
  return streamResponse(upstream)
}

function forwardedHeaders(request: Request): Headers {
  const headers = new Headers()
  const contentType = request.headers.get('content-type')
  const authorization = request.headers.get('authorization')
  const xApp = request.headers.get('x-app')
  const xFeature = request.headers.get('x-feature')
  const xSessionId = request.headers.get('x-session-id')
  const xClientId = request.headers.get('x-client-id')
  const xUserId = request.headers.get('x-user-id')
  const xOperationId = request.headers.get('x-operation-id')
  const xRunId = request.headers.get('x-run-id')
  const xSearchRunId = request.headers.get('x-search-run-id')
  const accept = request.headers.get('accept')
  if (contentType) headers.set('content-type', contentType)
  if (authorization) headers.set('authorization', authorization)
  if (xApp) headers.set('x-app', xApp)
  if (xFeature) headers.set('x-feature', xFeature)
  if (xSessionId) headers.set('x-session-id', xSessionId)
  if (xClientId) headers.set('x-client-id', xClientId)
  if (xUserId) headers.set('x-user-id', xUserId)
  if (xOperationId) headers.set('x-operation-id', xOperationId)
  if (xRunId) headers.set('x-run-id', xRunId)
  if (xSearchRunId) headers.set('x-search-run-id', xSearchRunId)
  if (accept) headers.set('accept', accept)
  return headers
}

async function sanitizeJsonResponse(upstream: Response): Promise<Response> {
  const contentType = upstream.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) return streamResponse(upstream)

  const data = stripPublicCostFields(await upstream.json().catch(() => null))
  return Response.json(data, {
    status: upstream.status,
    headers: corsHeaders({ 'cache-control': 'no-store' }),
  })
}

function streamResponse(upstream: Response): Response {
  const contentType = upstream.headers.get('content-type') ?? 'text/event-stream; charset=utf-8'
  const headers = corsHeaders({
    'content-type': contentType,
    'cache-control': 'no-store',
  })
  if (upstream.body) {
    const body = contentType.includes('text/event-stream') ? sanitizeEventStream(upstream.body) : upstream.body
    return new Response(body, { status: upstream.status, headers })
  }
  return new Response(null, { status: upstream.status, headers })
}

function sanitizeEventStream(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buffer = ''

  return new ReadableStream({
    async start(controller) {
      const reader = body.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            controller.enqueue(encoder.encode(`${sanitizeEventStreamLine(line)}\n`))
          }
        }
        if (buffer) controller.enqueue(encoder.encode(sanitizeEventStreamLine(buffer)))
      } finally {
        controller.close()
        reader.releaseLock()
      }
    },
  })
}

function sanitizeEventStreamLine(line: string): string {
  const normalized = line.replace(/\r$/, '')
  if (!normalized.startsWith('data:')) return line

  const payload = normalized.slice(5).trimStart()
  if (!payload || payload === '[DONE]') return line

  try {
    return `data: ${JSON.stringify(stripPublicCostFields(JSON.parse(payload)))}`
  } catch {
    return line
  }
}

function stripPublicCostFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripPublicCostFields)
  if (!value || typeof value !== 'object') return value

  const out: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    const lower = key.toLowerCase()
    if (lower.includes('cost') || lower === 'billing') continue
    out[key] = stripPublicCostFields(child)
  }
  return out
}

function corsHeaders(extra?: Record<string, string>): Headers {
  return new Headers({
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization, x-app, x-feature, x-session-id, x-client-id, x-user-id, x-operation-id, x-run-id, x-search-run-id, accept',
    ...extra,
  })
}

function cleanBaseUrl(value: string | null | undefined, fallback: string): string {
  return (value?.trim() || fallback).replace(/\/$/, '')
}
