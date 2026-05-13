const ACRONYMS = new Set(['ai', 'api', 'b2b', 'b2c', 'dtc', 'ev', 'saas', 'seo', 'x'])
const GENERIC_TAGS = new Set(['industry', 'industries', 'pulse', 'weekly', 'daily'])
const STRUCTURED_INDUSTRY_TAGS = new Set([
  'agriculture',
  'automotive',
  'beauty cosmetics',
  'construction trades',
  'ecommerce retail',
  'education',
  'energy sustainability',
  'finance',
  'fitness wellness',
  'food beverage',
  'government public',
  'healthcare',
  'legal services',
  'manufacturing',
  'marketing advertising',
  'nonprofit charity',
  'real estate',
  'sports entertainment',
  'tech saas',
  'travel tourism',
])

const TOPIC_PATTERNS: Array<{ label: string; match: RegExp }> = [
  { label: 'AI', match: /\b(ai|artificial intelligence|agentic|model|models|automation)\b/i },
  { label: 'Dissent', match: /\b(dissent|pushback|push back|skeptic|critical|risk|warning|backlash)\b/i },
  { label: 'Policy', match: /\b(policy|regulation|regulatory|government|public sector|agency|compliance)\b/i },
  { label: 'Market Sentiment', match: /\b(market|markets|investor|capital|rate|rates|price|pricing|stock|equity)\b/i },
  { label: 'Consumer Demand', match: /\b(customer|customers|consumer|buyers|demand|adoption)\b/i },
  { label: 'Launches', match: /\b(launch|launched|release|released|new product|rollout|shipping)\b/i },
  { label: 'Trust', match: /\b(trust|safety|evidence|credibility|privacy|security)\b/i },
  { label: 'Labor', match: /\b(labor|jobs|hiring|workforce|workers|creator|creators)\b/i },
  { label: 'Climate', match: /\b(climate|energy|grid|sustainability|renewable|emissions)\b/i },
  { label: 'Live Events', match: /\b(playoff|election|conference|trial|lottery|event|summit|season)\b/i },
]

export function normalizePulseTopicTags(tags: readonly string[] | null | undefined): string[] {
  const out = new Set<string>()
  for (const tag of tags ?? []) {
    const clean = normalizeRawTopic(tag)
    if (!clean) continue
    out.add(clean)
  }
  return Array.from(out).slice(0, 8)
}

export function inferPulseTopicTags(tags: readonly string[] | null | undefined, text: string | null | undefined): string[] {
  const out = new Set(normalizePulseTopicTags(tags))
  const haystack = text ?? ''
  for (const topic of TOPIC_PATTERNS) {
    if (topic.match.test(haystack)) out.add(topic.label)
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
  if (!raw || /^industry:/i.test(raw) || /^window:/i.test(raw) || /^cron:/i.test(raw)) return null
  const value = raw.replace(/^topic:/i, '').trim()
  if (!value) return null
  const formatted = formatTopic(value)
  const lower = formatted.toLowerCase()
  if (!formatted || GENERIC_TAGS.has(lower) || STRUCTURED_INDUSTRY_TAGS.has(lower)) return null
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
