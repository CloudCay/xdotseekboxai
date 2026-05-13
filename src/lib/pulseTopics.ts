const ACRONYMS = new Set(['ai', 'api', 'b2b', 'b2c', 'dtc', 'ev', 'saas', 'seo', 'x'])
const GENERIC_TAGS = new Set(['industry', 'industries', 'pulse', 'weekly', 'daily'])

export function normalizePulseTopicTags(tags: readonly string[] | null | undefined): string[] {
  const out = new Set<string>()
  for (const tag of tags ?? []) {
    const clean = normalizeRawTopic(tag)
    if (!clean) continue
    out.add(clean)
  }
  return Array.from(out).slice(0, 8)
}

export function pulseTopicSlug(topic: string): string {
  return topic
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function pulseTopicLabel(slug: string): string {
  return formatTopic(slug.replace(/-/g, ' '))
}

export function pulseTopicHref(topic: string): string {
  const slug = pulseTopicSlug(topic)
  return slug ? `/topics/${slug}` : '/topics'
}

function normalizeRawTopic(tag: string): string | null {
  const raw = tag.trim()
  if (!raw || /^window:/i.test(raw) || /^cron:/i.test(raw)) return null
  const value = raw.replace(/^industry:/i, '').replace(/^topic:/i, '').trim()
  if (!value) return null
  const formatted = formatTopic(value)
  if (!formatted || GENERIC_TAGS.has(formatted.toLowerCase())) return null
  return formatted
}

function formatTopic(topic: string): string {
  return topic
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => {
      const lower = word.toLowerCase()
      if (ACRONYMS.has(lower)) return lower.toUpperCase()
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')
    .replace(/\bAnd\b/g, '&')
}
