/**
 * Free/supplementary context sources (mirrors backend patterns: parallel public APIs).
 * Runs on the TanStack / Netlify server only — keys stay server-side.
 */

const UA = 'SeekBoxAiSupplementary/1.0 (+https://seekboxai.com)'

const RSS_FEEDS = [
  { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'BBC Tech', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' },
  { name: 'BBC Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { name: 'BBC Science', url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml' },
  { name: 'NPR News', url: 'https://feeds.npr.org/1001/rss.xml' },
  // Stock/markets-focused (public feeds; no keys)
  { name: 'CNBC Top News', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
  { name: 'MarketWatch Top Stories', url: 'https://feeds.marketwatch.com/marketwatch/topstories/' },
  { name: 'Yahoo Finance', url: 'https://finance.yahoo.com/news/rssindex' },
] as const

const TICKER_STOPWORDS = new Set(
  'THE AND FOR ARE BUT NOT YOU ALL CAN HER WAS ONE OUR OUT DAY GET HAS HIM HIS HOW ITS MAY NEW NOW OLD SEE TWO WHO BOY DID WAY SHE BAD NOR OWN SAID'.split(
    ' ',
  ),
)

export type SupplementaryPayload = {
  weather: { location: string; line: string } | null
  wikipedia: { title: string; extract: string; url?: string } | null
  rss: Array<{ feed: string; items: { title: string; link?: string }[] }>
  quotes: Array<{ symbol: string; price?: string; changePercent?: string; error?: string }>
  meta: { ms: number; errors: string[] }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit | undefined,
  ms: number,
): Promise<Response> {
  const c = new AbortController()
  const id = setTimeout(() => c.abort(), ms)
  try {
    return await fetch(url, {
      ...init,
      signal: c.signal,
      headers: { 'User-Agent': UA, ...(init?.headers as Record<string, string> | undefined) },
    })
  } finally {
    clearTimeout(id)
  }
}

/** Minimal RSS item extraction — no XML dependency. */
export function parseRssItems(xml: string, limit: number): { title: string; link?: string }[] {
  const out: { title: string; link?: string }[] = []
  const itemRe = /<item\b[\s\S]*?<\/item>/gi
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(xml)) !== null && out.length < limit) {
    const block = m[0]
    const tit = /<title>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]+))<\/title>/i.exec(block)
    const t = (tit?.[1] ?? tit?.[2] ?? '').trim()
    const link = /<link>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]+))<\/link>/i.exec(block)?.[1]?.trim() ??
      /<link>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]+))<\/link>/i.exec(block)?.[2]?.trim()
    const title = t.replace(/\s+/g, ' ').trim()
    if (title) out.push({ title, link: link || undefined })
  }
  return out
}

export function extractTickerCandidates(query: string, max = 5): string[] {
  const found = new Set<string>()
  const re = /\b([A-Z]{2,5})\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(query.toUpperCase())) !== null && found.size < max) {
    const s = m[1]
    if (s && !TICKER_STOPWORDS.has(s)) found.add(s)
  }
  return [...found]
}

async function openMeteoSnippet(query: string, errors: string[]): Promise<SupplementaryPayload['weather']> {
  const q = query.trim().slice(0, 64)
  if (!q) return null
  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`
    const geoRes = await fetchWithTimeout(geoUrl, undefined, 5000)
    if (!geoRes.ok) {
      errors.push(`open-meteo geocode: HTTP ${geoRes.status}`)
      return null
    }
    const geo = (await geoRes.json()) as { results?: { name: string; latitude: number; longitude: number }[] }
    const hit = geo.results?.[0]
    if (!hit) return null

    const wxUrl = `https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`
    const wxRes = await fetchWithTimeout(wxUrl, undefined, 5000)
    if (!wxRes.ok) {
      errors.push(`open-meteo forecast: HTTP ${wxRes.status}`)
      return null
    }
    const wx = (await wxRes.json()) as {
      current?: { temperature_2m?: number; relative_humidity_2m?: number; wind_speed_10m?: number }
    }
    const t = wx.current?.temperature_2m
    const line =
      t !== undefined
        ? `~${Math.round(t)}°C, humidity ${wx.current?.relative_humidity_2m ?? '?'}%, wind ${wx.current?.wind_speed_10m ?? '?'} km/h (current)`
        : 'Forecast retrieved.'
    return { location: hit.name, line }
  } catch (e) {
    errors.push(`open-meteo: ${e instanceof Error ? e.message : String(e)}`)
    return null
  }
}

async function wikipediaSnippet(query: string, errors: string[]): Promise<SupplementaryPayload['wikipedia']> {
  const q = query.trim().slice(0, 120)
  if (!q) return null
  try {
    const osUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=1&namespace=0&format=json`
    const osRes = await fetchWithTimeout(osUrl, undefined, 5000)
    if (!osRes.ok) {
      errors.push(`wikipedia opensearch: HTTP ${osRes.status}`)
      return null
    }
    const os = (await osRes.json()) as [string, string[], string[], string[]]
    const title = os[1]?.[0]
    if (!title) return null

    const sumUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`
    const sumRes = await fetchWithTimeout(sumUrl, { headers: { Accept: 'application/json' } }, 5000)
    if (!sumRes.ok) {
      errors.push(`wikipedia summary: HTTP ${sumRes.status}`)
      return null
    }
    const doc = (await sumRes.json()) as { extract?: string; title?: string; content_urls?: { desktop?: { page?: string } } }
    const extract = (doc.extract ?? '').trim()
    if (!extract) return null
    return {
      title: doc.title ?? title,
      extract: extract.slice(0, 1200),
      url: doc.content_urls?.desktop?.page,
    }
  } catch (e) {
    errors.push(`wikipedia: ${e instanceof Error ? e.message : String(e)}`)
    return null
  }
}

async function rssSnippets(errors: string[]): Promise<SupplementaryPayload['rss']> {
  const out: SupplementaryPayload['rss'] = []
  await Promise.all(
    RSS_FEEDS.map(async ({ name, url }) => {
      try {
        const res = await fetchWithTimeout(url, undefined, 6000)
        if (!res.ok) {
          errors.push(`rss ${name}: HTTP ${res.status}`)
          return
        }
        const xml = await res.text()
        const items = parseRssItems(xml, 4)
        if (items.length) out.push({ feed: name, items })
      } catch (e) {
        errors.push(`rss ${name}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }),
  )
  return out
}

async function twelveDataQuotes(
  symbols: string[],
  apiKey: string | undefined,
  errors: string[],
): Promise<SupplementaryPayload['quotes']> {
  if (!apiKey?.trim() || symbols.length === 0) return []
  const quotes: SupplementaryPayload['quotes'] = []
  const slice = symbols.slice(0, 4)
  await Promise.all(
    slice.map(async (symbol) => {
      try {
        const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`
        const res = await fetchWithTimeout(url, undefined, 5000)
        const j = (await res.json()) as Record<string, unknown>
        if (!res.ok) {
          quotes.push({
            symbol,
            error: typeof j.message === 'string' ? j.message : `HTTP ${res.status}`,
          })
          return
        }
        if ((j as { status?: string }).status === 'error') {
          quotes.push({ symbol, error: String(j.message ?? 'error') })
          return
        }
        quotes.push({
          symbol,
          price: j.close != null ? String(j.close) : j.price != null ? String(j.price) : undefined,
          changePercent: j.percent_change != null ? String(j.percent_change) : undefined,
        })
      } catch (e) {
        quotes.push({ symbol, error: e instanceof Error ? e.message : String(e) })
      }
    }),
  )
  return quotes
}

export function formatSupplementaryPrefix(p: SupplementaryPayload): string {
  const blocks: string[] = []
  if (p.weather) blocks.push(`Weather (${p.weather.location}): ${p.weather.line}`)
  if (p.wikipedia) {
    const u = p.wikipedia.url ? ` ${p.wikipedia.url}` : ''
    blocks.push(`Wikipedia — ${p.wikipedia.title}:${u}\n${p.wikipedia.extract}`)
  }
  for (const sec of p.rss) {
    const lines = sec.items.map((i) => `• ${i.title}${i.link ? ` (${i.link})` : ''}`).join('\n')
    blocks.push(`RSS ${sec.feed}:\n${lines}`)
  }
  if (p.quotes.length) {
    const q = p.quotes
      .map((x) =>
        x.error ? `${x.symbol}: ${x.error}` : `${x.symbol}: ${x.price ?? '?'} (${x.changePercent ?? '?'}%)`,
      )
      .join('; ')
    blocks.push(`Quotes (Twelve Data): ${q}`)
  }
  if (!blocks.length) return ''
  return `[Supplementary context — factual APIs]\n${blocks.join('\n\n')}`
}

export async function gatherSupplementaryContext(args: {
  query: string
  symbols?: string[]
  twelveApiKey?: string | null
}): Promise<SupplementaryPayload> {
  const t0 = Date.now()
  const errors: string[] = []
  const query = args.query.trim()
  const symbols =
    args.symbols?.length ? [...new Set(args.symbols.map((s) => s.toUpperCase()))].slice(0, 6) : extractTickerCandidates(query)

  const [weather, wikipedia, rss, quotes] = await Promise.all([
    openMeteoSnippet(query, errors),
    wikipediaSnippet(query, errors),
    rssSnippets(errors),
    twelveDataQuotes(symbols, args.twelveApiKey ?? process.env.TWELVE_API_KEY, errors),
  ])

  return {
    weather,
    wikipedia,
    rss,
    quotes,
    meta: { ms: Date.now() - t0, errors },
  }
}
