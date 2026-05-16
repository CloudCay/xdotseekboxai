import { getSupabaseClient } from '@/lib/supabase'
import type { HelperChatRequest, HelperChatResponse, HelperIntent } from './types'
import { sanitizeHelperChatRequest } from './sanitize'

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL?.trim() || import.meta.env.EXPO_PUBLIC_SUPABASE_URL?.trim()
const SUPABASE_PUBLIC_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  import.meta.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ||
  import.meta.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim()

function functionUrl(): string | null {
  if (!SUPABASE_URL) return null
  return `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/helper`
}

export async function helperChat(req: HelperChatRequest): Promise<HelperChatResponse> {
  const url = functionUrl()
  if (!url || !SUPABASE_PUBLIC_KEY) {
    return failure(req.intent, 'Seekly backend is not configured on this site.')
  }

  let bearer = ''
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
    // Anonymous calls still work because the helper function has verify_jwt = false.
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
        apikey: SUPABASE_PUBLIC_KEY,
      },
      body: JSON.stringify(body),
    })
  } catch (error) {
    return failure(req.intent, `network: ${(error as Error)?.message ?? String(error)}`)
  }

  const text = await res.text()
  let parsed: Record<string, unknown> | null = null
  try {
    const json = text ? JSON.parse(text) : null
    parsed = json && typeof json === 'object' ? (json as Record<string, unknown>) : null
  } catch {
    parsed = null
  }

  if (!res.ok) {
    return typeof parsed?.error === 'string'
      ? failure(req.intent, parsed.error)
      : failure(req.intent, `helper ${res.status}: ${text.slice(0, 200)}`)
  }

  return parsed ? publicHelperResponse(parsed, req.intent) : failure(req.intent, 'helper returned empty body')
}

function publicHelperResponse(raw: Record<string, unknown>, fallbackIntent: HelperChatRequest['intent']): HelperChatResponse {
  return {
    ok: raw.ok === true,
    reply: typeof raw.reply === 'string' ? raw.reply : '',
    intent: cleanIntent(raw.intent) ?? fallbackIntent ?? 'general',
    ...(typeof raw.conversationId === 'string' ? { conversationId: raw.conversationId } : {}),
    ...(typeof raw.error === 'string' ? { error: raw.error } : {}),
  }
}

function cleanIntent(value: unknown): HelperIntent | null {
  if (
    value === 'help' ||
    value === 'feedback' ||
    value === 'feature' ||
    value === 'bug' ||
    value === 'support' ||
    value === 'general' ||
    value === 'idea' ||
    value === 'must_have' ||
    value === 'roadmap'
  ) {
    return value
  }
  return null
}

function failure(intent: HelperChatRequest['intent'], error = 'unknown error'): HelperChatResponse {
  return {
    ok: false,
    reply: '',
    intent: intent ?? 'general',
    error,
  }
}
