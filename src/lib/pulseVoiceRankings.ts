import { canonicalizeIndustrySlug, getIndustryPage } from './industryCatalog'

export type PulseCitationLike = {
  index?: number | null
  url?: string | null
}

export type PulseRowLike = {
  id: string
  scope_type: string | null
  scope_value: string | null
  handles: string[] | null
  summary: string | null
  citations: PulseCitationLike[] | null
  tags: string[] | null
  created_at: string
}

export type PulseVoiceSource = 'seed' | 'discovered' | 'mixed'

export type PulseVoiceRanking = {
  handle: string
  displayHandle: string
  scopeKey: string
  scopeType: string
  scopeValue: string
  source: PulseVoiceSource
  rankScore: number
  heatScore: number
  noveltyScore: number
  seenCount: number
  seedCount: number
  citationCount: number
  summaryMentionCount: number
  firstSeenAt: string
  lastSeenAt: string
  sampleUrls: string[]
  sampleContexts: string[]
}

type MutableVoice = Omit<PulseVoiceRanking, 'source'> & {
  rowIds: Set<string>
}

const RESERVED_X_PATHS = new Set([
  'home',
  'i',
  'intent',
  'messages',
  'notifications',
  'search',
  'share',
  'status',
])

const COMMON_FALSE_HANDLES = new Set([
  'ai',
  'api',
  'app',
  'chat',
  'data',
  'http',
  'https',
  'news',
  'post',
  'posts',
  'user',
  'users',
])

export function normalizeXHandle(value: string | null | undefined): string | null {
  const raw = value?.trim()
  if (!raw) return null

  const fromUrl = extractHandleFromSocialUrl(raw)
  const candidate = (fromUrl ?? raw).replace(/^@+/, '').trim()
  if (!/^[A-Za-z0-9_]{2,15}$/.test(candidate)) return null

  const lower = candidate.toLowerCase()
  if (RESERVED_X_PATHS.has(lower) || COMMON_FALSE_HANDLES.has(lower)) return null
  return candidate
}

export function extractHandleFromSocialUrl(value: string | null | undefined): string | null {
  const raw = value?.trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    if (host !== 'x.com' && host !== 'twitter.com') return null
    const first = url.pathname.split('/').filter(Boolean)[0]
    if (!first || RESERVED_X_PATHS.has(first.toLowerCase())) return null
    return normalizeXHandle(first)
  } catch {
    return null
  }
}

export function extractHandlesFromText(text: string | null | undefined): string[] {
  const found = new Map<string, string>()
  const source = text ?? ''
  for (const match of source.matchAll(/@([A-Za-z0-9_]{2,15})\b/g)) {
    const handle = normalizeXHandle(match[1])
    if (handle) found.set(handle.toLowerCase(), handle)
  }
  for (const match of source.matchAll(/https?:\/\/(?:www\.)?(?:x|twitter)\.com\/[A-Za-z0-9_]{2,15}(?:\/status\/\d+)?/gi)) {
    const handle = extractHandleFromSocialUrl(match[0])
    if (handle) found.set(handle.toLowerCase(), handle)
  }
  return Array.from(found.values())
}

export function rankPulseVoices(rows: PulseRowLike[], limit = 12): PulseVoiceRanking[] {
  const voices = new Map<string, MutableVoice>()

  for (const row of rows) {
    const scope = scopeForRow(row)
    const summary = row.summary ?? ''
    const rowCreatedAt = cleanDate(row.created_at)
    const seedSet = seedHandlesForRow(row)
    const seenThisRow = new Set<string>()

    for (const raw of row.handles ?? []) {
      const handle = normalizeXHandle(raw)
      if (!handle) continue
      const isSeed = seedSet.has(handle.toLowerCase())
      addVoice(voices, scope, row, handle, rowCreatedAt, seenThisRow, {
        seedCount: isSeed ? 1 : 0,
        summaryMentionCount: isSeed ? 0 : 1,
        heat: isSeed ? 2 : 5,
        countSeen: !isSeed,
        context: contextForHandle(summary, handle),
      })
    }

    for (const handle of extractHandlesFromText(summary)) {
      const context = contextForHandle(summary, handle)
      if (context && isNoActivityContext(context)) continue
      addVoice(voices, scope, row, handle, rowCreatedAt, seenThisRow, {
        summaryMentionCount: 1,
        heat: seedSet.has(handle.toLowerCase()) ? 3 : 8,
        context,
      })
    }

    for (const citation of row.citations ?? []) {
      const handle = extractHandleFromSocialUrl(citation.url)
      if (!handle) continue
      addVoice(voices, scope, row, handle, rowCreatedAt, seenThisRow, {
        citationCount: 1,
        heat: seedSet.has(handle.toLowerCase()) ? 5 : 12,
        url: cleanSocialUrl(citation.url),
      })
    }
  }

  return sortPulseVoiceRankings(Array.from(voices.values()).map(finalizeVoice), limit)
}

export function sortPulseVoiceRankings(voices: PulseVoiceRanking[], limit = voices.length): PulseVoiceRanking[] {
  return [...voices]
    .sort((a, b) => {
      if (b.citationCount !== a.citationCount) return b.citationCount - a.citationCount
      if (b.seenCount !== a.seenCount) return b.seenCount - a.seenCount
      if (b.summaryMentionCount !== a.summaryMentionCount) return b.summaryMentionCount - a.summaryMentionCount
      if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore
      if (b.noveltyScore !== a.noveltyScore) return b.noveltyScore - a.noveltyScore
      return a.displayHandle.localeCompare(b.displayHandle)
    })
    .slice(0, limit)
}

function addVoice(
  voices: Map<string, MutableVoice>,
  scope: { key: string; type: string; value: string },
  row: PulseRowLike,
  handle: string,
  seenAt: string,
  seenThisRow: Set<string>,
  signal: {
    seedCount?: number
    citationCount?: number
    summaryMentionCount?: number
    heat?: number
    url?: string | null
    context?: string | null
    countSeen?: boolean
  },
) {
  const handleKey = handle.toLowerCase()
  const key = `${scope.key}:${handleKey}`
  const existing = voices.get(key)
  const voice =
    existing ??
    ({
      handle: handleKey,
      displayHandle: handle,
      scopeKey: scope.key,
      scopeType: scope.type,
      scopeValue: scope.value,
      rankScore: 0,
      heatScore: 0,
      noveltyScore: 0,
      seenCount: 0,
      seedCount: 0,
      citationCount: 0,
      summaryMentionCount: 0,
      firstSeenAt: seenAt,
      lastSeenAt: seenAt,
      sampleUrls: [],
      sampleContexts: [],
      rowIds: new Set<string>(),
    } satisfies MutableVoice)

  if (signal.countSeen !== false && !seenThisRow.has(key)) {
    voice.seenCount += 1
    voice.rowIds.add(row.id)
    seenThisRow.add(key)
  }

  voice.seedCount += signal.seedCount ?? 0
  voice.citationCount += signal.citationCount ?? 0
  voice.summaryMentionCount += signal.summaryMentionCount ?? 0
  voice.heatScore += signal.heat ?? 0
  voice.firstSeenAt = minIso(voice.firstSeenAt, seenAt)
  voice.lastSeenAt = maxIso(voice.lastSeenAt, seenAt)

  if (signal.url && !voice.sampleUrls.includes(signal.url)) voice.sampleUrls.push(signal.url)
  if (signal.context && !voice.sampleContexts.includes(signal.context)) voice.sampleContexts.push(signal.context)

  voice.sampleUrls = voice.sampleUrls.slice(0, 6)
  voice.sampleContexts = voice.sampleContexts.slice(0, 4)
  voices.set(key, voice)
}

function finalizeVoice(voice: MutableVoice): PulseVoiceRanking {
  const isSeedOnly = voice.seedCount > 0 && voice.citationCount === 0 && voice.summaryMentionCount === 0
  const source: PulseVoiceSource = voice.seedCount > 0 && !isSeedOnly ? 'mixed' : voice.seedCount > 0 ? 'seed' : 'discovered'
  const lastSeenDays = ageDays(voice.lastSeenAt)
  const firstSeenDays = ageDays(voice.firstSeenAt)
  const recency = clamp(28 - lastSeenDays * 3, 0, 28)
  const novelty = source === 'seed' ? 0 : clamp(76 - firstSeenDays * 4 + voice.citationCount * 8 + voice.summaryMentionCount * 4, 12, 99)
  const score =
    voice.seenCount * 7 +
    voice.citationCount * 13 +
    voice.summaryMentionCount * 8 +
    Math.min(voice.seedCount * 2, 8) +
    recency +
    novelty * 0.25

  return {
    handle: voice.handle,
    displayHandle: voice.displayHandle,
    scopeKey: voice.scopeKey,
    scopeType: voice.scopeType,
    scopeValue: voice.scopeValue,
    source,
    rankScore: clamp(score, 1, 999),
    heatScore: clamp(voice.heatScore + recency, 1, 100),
    noveltyScore: novelty,
    seenCount: voice.seenCount,
    seedCount: voice.seedCount,
    citationCount: voice.citationCount,
    summaryMentionCount: voice.summaryMentionCount,
    firstSeenAt: voice.firstSeenAt,
    lastSeenAt: voice.lastSeenAt,
    sampleUrls: voice.sampleUrls,
    sampleContexts: voice.sampleContexts,
  }
}

function scopeForRow(row: PulseRowLike): { key: string; type: string; value: string } {
  const scopeType = row.scope_type || 'pulse'
  const value =
    scopeType === 'industry'
      ? canonicalizeIndustrySlug(row.scope_value)
      : row.scope_value?.trim() || row.tags?.[0]?.trim() || 'global'
  return {
    key: `${scopeType}:${value || 'global'}`,
    type: scopeType,
    value: value || 'global',
  }
}

function seedHandlesForRow(row: PulseRowLike): Set<string> {
  if (row.scope_type !== 'industry') return new Set()
  const industry = getIndustryPage(row.scope_value)
  return new Set((industry?.handles ?? []).map((handle) => handle.toLowerCase()))
}

function cleanSocialUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    if (host !== 'x.com' && host !== 'twitter.com') return null
    url.protocol = 'https:'
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

function contextForHandle(summary: string, handle: string): string | null {
  if (!summary) return null
  const escaped = handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`[^.!?\\n]{0,110}@${escaped}[^.!?\\n]{0,150}`, 'i').exec(summary)
  return match?.[0]?.replace(/\s+/g, ' ').trim().slice(0, 260) ?? null
}

function isNoActivityContext(context: string): boolean {
  return /\b(no posts|no detectable|nothing detectable|no visible activity|no activity|not identified|no posts were identified|posted nothing)\b/i.test(context)
}

function cleanDate(value: string): string {
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : new Date().toISOString()
}

function minIso(a: string, b: string): string {
  return new Date(a).getTime() <= new Date(b).getTime() ? a : b
}

function maxIso(a: string, b: string): string {
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b
}

function ageDays(value: string): number {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return 0
  return Math.max(0, (Date.now() - timestamp) / 86400000)
}

function clamp(value: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, value)))
}
