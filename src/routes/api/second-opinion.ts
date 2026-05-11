import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/second-opinion')({
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

        let payload: CleanSecondOpinionRequest
        try {
          payload = cleanRequest(body)
        } catch (error) {
          return jsonResponse(request, { error: error instanceof Error ? error.message : 'Invalid request.' }, 400)
        }
        const token = readBearerToken(request.headers.get('authorization'))
        const user = token ? await verifySupabaseUser(token) : null
        const providers = chooseProviders(payload.mode)
        const prompt = buildSecondOpinionPrompt(payload)

        let opinions: ProviderOpinion[] = []
        let upstreamError: string | null = null

        try {
          opinions = await runSearchStream({
            prompt,
            providers,
            clientId: payload.clientId,
            mode: payload.mode,
          })
        } catch (error) {
          upstreamError = error instanceof Error ? error.message : 'SeekBox backend did not return a second opinion.'
        }

        const summary = summarizeOpinions(opinions, upstreamError)
        const saved = user && payload.save ? await saveSecondOpinion({ payload, user, token: token ?? '', providers, opinions, summary }) : null

        return jsonResponse(request, {
          ok: opinions.some((opinion) => opinion.status === 'success' && opinion.content.trim()),
          mode: payload.mode,
          routeUsed: {
            strategy: payload.mode === 'compare' ? 'multi-provider' : 'rotating-cheap-provider',
            providers,
          },
          saved: Boolean(saved?.id),
          saveError: saved?.error ?? null,
          bookmarkId: saved?.id ?? null,
          signedIn: Boolean(user),
          upstreamError,
          summary,
          opinions,
          seekboxUrl: buildSeekBoxUrl(payload),
          generatedAt: new Date().toISOString(),
        })
      },
    },
  },
})

type SecondOpinionMode = 'quick' | 'compare'

type CleanSecondOpinionRequest = {
  mode: SecondOpinionMode
  url: string
  canonicalUrl: string | null
  title: string
  selectedText: string
  pageText: string
  question: string
  clientId: string
  save: boolean
}

type ProviderOpinion = {
  provider: string
  providerName: string
  content: string
  status: 'success' | 'error'
  error?: string
}

type SupabaseUser = {
  id: string
  email: string | null
}

function cleanRequest(body: Record<string, unknown>): CleanSecondOpinionRequest {
  const mode = body.mode === 'compare' ? 'compare' : 'quick'
  const url = cleanUrl(body.url)
  const canonicalUrl = typeof body.canonicalUrl === 'string' && body.canonicalUrl.trim() ? cleanUrl(body.canonicalUrl) : null
  const title = cleanText(body.title, 300)
  const selectedText = cleanText(body.selectedText, 8_000)
  const pageText = cleanText(body.pageText, 16_000)
  const question = cleanText(body.question, 500)
  const clientId = cleanText(body.clientId, 120) || `extension-${crypto.randomUUID()}`
  const save = body.save === true

  if (!url) throw new Error('URL is required.')
  if (!selectedText && !pageText && !title) throw new Error('No page context was provided.')

  return { mode, url, canonicalUrl, title, selectedText, pageText, question, clientId, save }
}

function cleanUrl(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return ''
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    url.hash = ''
    return url.toString()
  } catch {
    return ''
  }
}

function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, max)
}

function chooseProviders(mode: SecondOpinionMode): string[] {
  if (mode === 'compare') {
    return parseProviderList(process.env.SEEKBOX_SECOND_OPINION_COMPARE_PROVIDERS, ['chatgpt', 'claude', 'gemini', 'groksearch']).slice(0, 5)
  }

  const rotation = parseProviderList(
    process.env.SEEKBOX_SECOND_OPINION_ROTATION ?? process.env.SEEKBOX_SECOND_OPINION_QUICK_PROVIDER,
    ['chatgpt'],
  )
  const day = Math.floor(Date.now() / 86_400_000)
  return [rotation[day % rotation.length] ?? 'chatgpt']
}

function parseProviderList(value: unknown, fallback: string[]): string[] {
  if (typeof value !== 'string') return fallback
  const providers = value
    .split(',')
    .map((provider) => provider.trim())
    .filter((provider) => /^[a-z0-9_-]{2,32}$/i.test(provider))
  return providers.length ? providers : fallback
}

function buildSecondOpinionPrompt(payload: CleanSecondOpinionRequest): string {
  const context = payload.selectedText || payload.pageText
  return [
    'You are SeekBox Second Opinions: a quiet browser utility that gives another read before the user trusts a page.',
    'Do not be breathless. Do not pretend certainty. Do not give legal, medical, financial, or safety-critical advice.',
    payload.question ? `User question: ${payload.question}` : 'User question: Give me a second opinion on this page.',
    `Page title: ${payload.title || 'Untitled'}`,
    `URL: ${payload.url}`,
    payload.canonicalUrl ? `Canonical URL: ${payload.canonicalUrl}` : '',
    payload.selectedText ? 'The user selected this text, so prioritize it over the whole page.' : 'No text was selected, so use the page excerpt.',
    `Context:\n${context}`,
    'Answer with four short sections: Bottom line, What seems solid, What to question, What I would ask next.',
  ]
    .filter(Boolean)
    .join('\n\n')
}

async function runSearchStream(args: {
  prompt: string
  providers: string[]
  clientId: string
  mode: SecondOpinionMode
}): Promise<ProviderOpinion[]> {
  const backendUrl = cleanBackendUrl(process.env.VITE_BACKEND_URL ?? process.env.EXPO_PUBLIC_BACKEND_URL)
  if (!backendUrl) throw new Error('SeekBox backend URL is not configured.')

  const response = await fetch(`${backendUrl}/api/search/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      query: args.prompt,
      enabledProviders: args.providers,
      sessionId: args.clientId,
      clientId: args.clientId,
      userId: args.clientId,
      searchSource: 'cleanseek',
      platform: 'browser-extension',
      promptCharacterCount: args.prompt.length,
      enabledEngineCount: args.providers.length,
      liveDataMode: false,
      secondOpinionMode: args.mode,
    }),
    signal: AbortSignal.timeout(args.mode === 'compare' ? 45_000 : 25_000),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text ? `Search backend HTTP ${response.status}: ${text.slice(0, 240)}` : `Search backend HTTP ${response.status}`)
  }
  if (!response.body) throw new Error('Search backend returned an empty stream.')

  return parseSearchStream(response.body, args.providers)
}

function cleanBackendUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const url = value.trim().replace(/\/$/, '')
  return /^https?:\/\//i.test(url) ? url : null
}

async function parseSearchStream(stream: ReadableStream<Uint8Array>, providers: string[]): Promise<ProviderOpinion[]> {
  const acc: Record<string, ProviderOpinion> = Object.fromEntries(
    providers.map((provider) => [provider, { provider, providerName: provider, content: '', status: 'error' as const }]),
  )
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let eventName = ''

  const dispatch = (event: string, payload: string) => {
    const trimmed = payload.trim()
    if (!trimmed) return
    let data: Record<string, unknown>
    try {
      data = JSON.parse(trimmed) as Record<string, unknown>
    } catch {
      return
    }

    const kind = event || String(data.event ?? data.type ?? '')
    const provider = normalizeProviderId(String(data.provider ?? data.engine ?? data.providerId ?? providers[0] ?? 'unknown'))
    const current = acc[provider] ?? { provider, providerName: provider, content: '', status: 'error' as const }

    if (kind === 'result-chunk') {
      acc[provider] = { ...current, content: current.content + String(data.delta ?? data.content ?? ''), status: 'success' }
    } else if (kind === 'result-done') {
      acc[provider] = {
        ...current,
        content: data.content !== undefined ? String(data.content) : current.content,
        status: 'success',
      }
    } else if (kind === 'result-error') {
      acc[provider] = {
        ...current,
        content: current.content,
        status: 'error',
        error: String(data.error ?? 'Provider failed.'),
      }
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (let line of lines) {
      line = line.replace(/\r$/, '')
      if (!line || line.startsWith(':')) continue
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim()
        continue
      }
      if (line.startsWith('data:')) dispatch(eventName, line.slice(5).trimStart())
    }
  }

  if (buf.trim()) {
    for (let line of buf.split('\n')) {
      line = line.replace(/\r$/, '')
      if (line.startsWith('data:')) dispatch(eventName, line.slice(5).trimStart())
    }
  }

  return Object.values(acc).map((opinion) => ({
    ...opinion,
    content: opinion.content.trim(),
    status: opinion.content.trim() && !opinion.error ? 'success' : opinion.status,
  }))
}

function normalizeProviderId(value: string): string {
  const id = value.trim()
  return id === 'grokx' ? 'groksearch' : id || 'unknown'
}

function summarizeOpinions(opinions: ProviderOpinion[], upstreamError: string | null): string {
  const success = opinions.find((opinion) => opinion.status === 'success' && opinion.content.trim())
  if (success) return success.content.split(/\n{2,}/)[0]?.slice(0, 700) || success.content.slice(0, 700)
  return upstreamError ?? 'No second opinion was generated.'
}

async function verifySupabaseUser(token: string): Promise<SupabaseUser | null> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL
  const publicKey = getSupabasePublicKey()
  if (!supabaseUrl || !publicKey) return null

  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
    headers: {
      apikey: publicKey,
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null)

  if (!response?.ok) return null
  const user = (await response.json()) as Record<string, unknown>
  const id = typeof user.id === 'string' ? user.id : ''
  if (!id) return null
  return { id, email: typeof user.email === 'string' ? user.email : null }
}

async function saveSecondOpinion(args: {
  payload: CleanSecondOpinionRequest
  user: SupabaseUser
  token: string
  providers: string[]
  opinions: ProviderOpinion[]
  summary: string
}): Promise<{ id: string | null; error: string | null }> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL
  const publicKey = getSupabasePublicKey()
  if (!supabaseUrl || !publicKey) return { id: null, error: 'Supabase env is not configured.' }

  const sourceDomain = safeHostname(args.payload.url)
  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/seekbox_second_opinions`, {
    method: 'POST',
    headers: {
      apikey: publicKey,
      Authorization: `Bearer ${args.token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      user_id: args.user.id,
      url: args.payload.url,
      canonical_url: args.payload.canonicalUrl,
      title: args.payload.title || null,
      source_domain: sourceDomain,
      selected_text: args.payload.selectedText || null,
      page_excerpt: args.payload.pageText.slice(0, 4000) || null,
      question: args.payload.question || null,
      mode: args.payload.mode,
      route_used: { providers: args.providers },
      opinions: args.opinions,
      summary: args.summary,
    }),
    signal: AbortSignal.timeout(8_000),
  }).catch((error) => ({ ok: false, status: 0, text: async () => String(error) }) as Response)

  const text = await response.text().catch(() => '')
  if (!response.ok) return { id: null, error: text ? text.slice(0, 240) : `Save failed (${response.status}).` }

  try {
    const rows = JSON.parse(text) as Array<{ id?: string }>
    return { id: rows[0]?.id ?? null, error: null }
  } catch {
    return { id: null, error: null }
  }
}

function getSupabasePublicKey(): string | undefined {
  return (
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  )
}

function safeHostname(value: string): string | null {
  try {
    return new URL(value).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

function buildSeekBoxUrl(payload: CleanSecondOpinionRequest): string {
  const origin = process.env.SEEKBOX_SECOND_OPINION_APP_ORIGIN?.trim().replace(/\/$/, '') || 'https://x.seekboxai.com'
  const query = [
    'SeekBox Second Opinion',
    payload.title ? `Page: ${payload.title}` : '',
    `URL: ${payload.url}`,
    payload.selectedText ? `Selected text: ${payload.selectedText.slice(0, 1400)}` : `Page excerpt: ${payload.pageText.slice(0, 1400)}`,
  ]
    .filter(Boolean)
    .join('\n\n')
  const params = new URLSearchParams({ q: query, latest: '1', preset: 'web', autorun: '1' })
  return `${origin}/cleanseek-x?${params.toString()}`
}

function readBearerToken(value: string | null): string | null {
  const match = value?.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('origin') ?? ''
  const allowedOrigin =
    origin.startsWith('chrome-extension://') ||
    /^https:\/\/(x\.)?seekboxai\.com$/i.test(origin) ||
    /^https:\/\/(www\.)?seekboxai\.com$/i.test(origin) ||
    /^https:\/\/(www\.)?seekbox\.ai$/i.test(origin)
      ? origin
      : '*'
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, authorization, x-seekbox-extension',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function jsonResponse(request: Request, body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders(request) })
}
