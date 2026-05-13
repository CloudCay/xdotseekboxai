import type { AntiEchoPost, XIntelExcerpt } from './types'

export function sanitizeSocialUrl(value: string | undefined): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    if (host !== 'x.com' && host !== 'twitter.com') return undefined
    url.protocol = 'https:'
    url.hash = ''
    return url.toString()
  } catch {
    return undefined
  }
}

function extractField(content: string, label: string): string | undefined {
  const match = new RegExp(`^\\s*${label}\\s*:\\s*(.+)$`, 'mi').exec(content)
  return match?.[1]?.trim()
}

function extractList(content: string, label: string): string[] {
  const idx = content.search(new RegExp(`^\\s*${label}\\s*:`, 'mi'))
  if (idx < 0) return []
  const lines = content.slice(idx).split(/\r?\n/).slice(1)
  const out: string[] = []

  for (const line of lines) {
    if (/^\s*[A-Z][A-Z0-9_ ]{2,30}:/.test(line)) break
    const match = /^\s*[-*]\s+(.+)$/.exec(line)
    if (match) out.push(match[1].trim())
    else if (out.length && line.trim() === '') break
  }

  return out
}

function extractInlineList(content: string, label: string): string[] {
  const field = extractField(content, label)
  if (!field) return []
  return field
    .split(/\s*;\s*|\s*\|\s*/)
    .map((item) => item.replace(/^\s*[-*]\s+/, '').trim())
    .filter(Boolean)
}

function extractParagraph(content: string, label: string): string | undefined {
  const match = new RegExp(`^\\s*${label}\\s*:\\s*([\\s\\S]*?)(?=\\n\\s*[A-Z][A-Z0-9_ ]{2,30}:|$)`, 'mi').exec(content)
  return match?.[1]?.trim().replace(/\s+/g, ' ')
}

function splitTextAndUrl(item: string): XIntelExcerpt {
  const match = /^(.*?)\s*\((https?:\/\/[^)\s]+)\)\s*$/.exec(item)
  if (match) {
    return {
      text: match[1].trim(),
      url: sanitizeSocialUrl(match[2]),
    }
  }
  const inline = /(https?:\/\/[^\s),;]+)/.exec(item)
  if (!inline) return { text: item.trim() }
  return {
    text: item.replace(inline[1], '').replace(/\s+/g, ' ').trim(),
    url: sanitizeSocialUrl(inline[1]),
  }
}

export function parseXBattleSide(content: string): {
  postCount?: string
  sentiment?: string
  themes: string[]
  excerpts: XIntelExcerpt[]
} {
  return {
    postCount: extractField(content, 'POST_COUNT'),
    sentiment: extractField(content, 'SENTIMENT'),
    themes: (extractList(content, 'THEMES').length ? extractList(content, 'THEMES') : extractInlineList(content, 'THEMES')).slice(0, 5),
    excerpts: (extractList(content, 'TOP_POSTS').length ? extractList(content, 'TOP_POSTS') : extractInlineList(content, 'TOP_POSTS')).map(splitTextAndUrl).slice(0, 5),
  }
}

function extractPosts(content: string, label: string): AntiEchoPost[] {
  const rows = extractList(content, label)
  const items = rows.length ? rows : extractInlineList(content, label)
  const posts: AntiEchoPost[] = []

  for (const item of items) {
      const handleMatch = /^(@[\w_]+):?\s*(.*)$/.exec(item)
      const handle = handleMatch?.[1]
      const rest = handleMatch?.[2] || item
      const parsed = splitTextAndUrl(rest)
      if (!parsed.text && parsed.url && posts.length) {
        const previous = posts[posts.length - 1]
        if (!previous.url) previous.url = parsed.url
        continue
      }
      posts.push({
        text: parsed.text,
        url: parsed.url,
        handle,
      })
  }

  return posts.filter((post) => post.text || post.url).slice(0, 8)
}

function extractDissentingPosts(content: string): AntiEchoPost[] {
  return extractPosts(content, 'DISSENTING_POSTS')
}

export function parseAntiEcho(content: string): {
  summary?: string
  strongestCounters: string[]
  posts: AntiEchoPost[]
} {
  return {
    summary: extractParagraph(content, 'SUMMARY'),
    strongestCounters: (extractList(content, 'STRONGEST_COUNTERS').length
      ? extractList(content, 'STRONGEST_COUNTERS')
      : extractInlineList(content, 'STRONGEST_COUNTERS')).slice(0, 5),
    posts: extractDissentingPosts(content),
  }
}

export function parsePostRoom(content: string): {
  roomSummary?: string
  whyItMatters?: string
  positions: string[]
  relatedPosts: AntiEchoPost[]
  dissent?: string
} {
  return {
    roomSummary: extractParagraph(content, 'ROOM_SUMMARY'),
    whyItMatters: extractParagraph(content, 'WHY_IT_MATTERS'),
    positions: (extractList(content, 'POSITIONS').length ? extractList(content, 'POSITIONS') : extractInlineList(content, 'POSITIONS')).slice(0, 5),
    relatedPosts: extractPosts(content, 'RELATED_POSTS'),
    dissent: extractParagraph(content, 'DISSENT'),
  }
}
