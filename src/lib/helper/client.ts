import { getSupabaseClient } from '@/lib/supabase'
import type { HelperChatRequest, HelperChatResponse } from './types'
import { sanitizeHelperChatRequest } from './sanitize'

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL?.trim() || import.meta.env.EXPO_PUBLIC_SUPABASE_URL?.trim()
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ||
  import.meta.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim()

function functionUrl(): string | null {
  if (!SUPABASE_URL) return null
  return `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/helper`
}

export async function helperChat(req: HelperChatRequest): Promise<HelperChatResponse> {
  const start = Date.now()
  const url = functionUrl()
  if (!url || !SUPABASE_ANON_KEY) {
    return failure(start, req.intent, 'Seekly backend is not configured on this site.')
  }

  let bearer = SUPABASE_ANON_KEY
  try {
    const client = getSupabaseClient()
    const timeout = new Promise<null>((resolve) => {
      window.setTimeout(() => resolve(null), 3000)
    })
    const result = await Promise.race([client?.auth.getSession() ?? Promise.resolve(null), timeout])
    if (result && 'data' in result && result.data.session?.access_token) {
      bearer = result.data.session.access_token
    }
  } catch {
    // Anonymous calls still work with the anon key.
  }

  const body = sanitizeHelperChatRequest({
    ...req,
    origin: req.origin ?? 'seekbox-web',
  })

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${bearer}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    })
  } catch (error) {
    return failure(start, req.intent, `network: ${(error as Error)?.message ?? String(error)}`)
  }

  const text = await res.text()
  let parsed: HelperChatResponse | null = null
  try {
    parsed = text ? (JSON.parse(text) as HelperChatResponse) : null
  } catch {
    parsed = null
  }

  if (!res.ok) {
    return parsed?.error
      ? { ...failure(start, req.intent), error: parsed.error }
      : failure(start, req.intent, `helper ${res.status}: ${text.slice(0, 200)}`)
  }

  return parsed ?? failure(start, req.intent, 'helper returned empty body')
}

function failure(
  start: number,
  intent: HelperChatRequest['intent'],
  error = 'unknown error',
): HelperChatResponse {
  return {
    ok: false,
    reply: '',
    durationMs: Date.now() - start,
    costUsd: 0,
    generatedAt: new Date().toISOString(),
    knowledgeFiles: [],
    intent: intent ?? 'general',
    error,
  }
}
