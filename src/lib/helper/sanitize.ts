import type { HelperChatRequest, HelperMessage } from '@/lib/helper/types'

export const SEEKLY_LIMITS = {
  messageChars: 12_000,
  pageContextChars: 2_000,
  historyMaxMessages: 24,
  historyEntryChars: 8_000,
  tryTopicChars: 400,
} as const

export function stripDangerousControls(value: string): string {
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
}

export function truncateUtf16(value: string, max: number): string {
  if (value.length <= max) return value
  return value.slice(0, max)
}

export function sanitizeHelperChatRequest(req: HelperChatRequest): HelperChatRequest {
  const message = truncateUtf16(
    stripDangerousControls(req.message ?? '').trim(),
    SEEKLY_LIMITS.messageChars,
  )
  const rawHistory = Array.isArray(req.history) ? req.history : []
  const history: HelperMessage[] = []

  for (const row of rawHistory.slice(-SEEKLY_LIMITS.historyMaxMessages)) {
    if (!row || typeof row !== 'object') continue
    const role = row.role === 'assistant' ? 'assistant' : 'user'
    const content = truncateUtf16(
      stripDangerousControls(String(row.content ?? '').trim()),
      SEEKLY_LIMITS.historyEntryChars,
    )
    if (content) history.push({ role, content })
  }

  let pageContext = req.pageContext
  if (typeof pageContext === 'string') {
    const clean = truncateUtf16(
      stripDangerousControls(pageContext).trim(),
      SEEKLY_LIMITS.pageContextChars,
    )
    pageContext = clean.length ? clean : undefined
  } else {
    pageContext = undefined
  }

  const clipOpaque = (value: string | undefined, max: number) => {
    if (typeof value !== 'string') return undefined
    const clipped = truncateUtf16(stripDangerousControls(value).trim(), max)
    return clipped.length ? clipped : undefined
  }

  const conversationId = clipOpaque(req.conversationId, 80)
  const clientId = clipOpaque(req.clientId, 160)
  const origin =
    req.origin === 'seekbox-web' || req.origin === 'seekbox-native' ? req.origin : undefined

  return {
    history,
    message,
    ...(typeof req.intent === 'string' ? { intent: req.intent } : {}),
    ...(conversationId ? { conversationId } : {}),
    ...(clientId ? { clientId } : {}),
    ...(typeof req.userId === 'string' && /^[a-f0-9-]{36}$/i.test(req.userId.trim())
      ? { userId: req.userId.trim().toLowerCase() }
      : {}),
    ...(origin ? { origin } : {}),
    ...(pageContext !== undefined ? { pageContext } : {}),
  }
}

export function sanitizeTryTopic(raw: string): string {
  const oneLine = stripDangerousControls(raw).replace(/\s+/g, ' ').trim()
  return truncateUtf16(oneLine, SEEKLY_LIMITS.tryTopicChars)
}
