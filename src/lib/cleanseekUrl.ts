export const CLEANSEEK_QUERY_MAX_CHARS = 400

export function compactCleanseekQuery(queryText: string, maxChars = CLEANSEEK_QUERY_MAX_CHARS): string {
  const normalized = queryText.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxChars) return normalized
  const clipped = normalized.slice(0, maxChars).trimEnd()
  return clipped.replace(/\s+\S*$/, '').trim() || clipped.trim()
}

export function cleanseekHref({
  query,
  latest = true,
  preset = 'web',
  autorun = false,
  path = '/cleanseek-x',
  maxChars = CLEANSEEK_QUERY_MAX_CHARS,
}: {
  query: string
  latest?: boolean
  preset?: string
  autorun?: boolean
  path?: string
  maxChars?: number
}): string {
  const params = new URLSearchParams()
  const compacted = compactCleanseekQuery(query, maxChars)
  if (compacted) params.set('q', compacted)
  params.set('latest', latest ? '1' : '0')
  if (preset) params.set('preset', preset)
  if (autorun) params.set('autorun', '1')
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}
