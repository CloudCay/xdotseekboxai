import { createFileRoute } from '@tanstack/react-router'
import { rankSeekBoxCandidates, type CandidateVoiceClass, type SeekBoxCandidate } from '../../lib/rankingPipeline'
import type { PulseRunMetrics } from '../../lib/pulseMetrics'

const DISCOVERY_ROLE = 'superadmin'
const DEFAULT_TULSA_GEO = {
  label: 'Tulsa, OK',
  longitude: -95.9928,
  latitude: 36.154,
  radius: '25mi',
}
const X_RECENT_SEARCH_URL = 'https://api.x.com/2/tweets/search/recent'
const X_RECENT_COUNTS_URL = 'https://api.x.com/2/tweets/counts/recent'

type XDiscoverRequest = {
  query: string
  window_days: number
  max_results: number
  rank_authors: boolean
  geo: XDiscoverGeo | null
}

type XDiscoverGeo = {
  type: 'point_radius'
  longitude: number
  latitude: number
  radius: string
  label?: string | null
}

type XApiPost = {
  id?: string
  text?: string
  author_id?: string
  created_at?: string
  lang?: string
  geo?: { place_id?: string }
  public_metrics?: {
    retweet_count?: number
    reply_count?: number
    like_count?: number
    quote_count?: number
    impression_count?: number
  }
}

type XApiUser = {
  id?: string
  username?: string
  name?: string
  location?: string
  verified?: boolean
  public_metrics?: {
    followers_count?: number
    following_count?: number
    tweet_count?: number
    listed_count?: number
  }
}

type XApiPlace = {
  id?: string
  full_name?: string
  name?: string
  country?: string
  country_code?: string
  place_type?: string
}

type XApiResponse = {
  data?: XApiPost[]
  includes?: {
    users?: XApiUser[]
    places?: XApiPlace[]
  }
  meta?: Record<string, unknown>
  errors?: unknown[]
}

type XCountsResponse = {
  meta?: {
    total_tweet_count?: number
  }
  data?: Array<{
    tweet_count?: number
  }>
  errors?: unknown[]
}

type DiscoveredPost = {
  id: string
  url: string
  text_excerpt: string
  created_at: string | null
  lang: string | null
  author: {
    id: string | null
    username: string
    name: string | null
    location: string | null
    verified: boolean
    followers_count: number | null
    tweet_count: number | null
  }
  public_metrics: {
    reposts: number
    replies: number
    likes: number
    quotes: number
    impressions: number | null
  }
  geo: {
    place_id: string | null
    full_name: string | null
    basis: 'geo' | 'profile_location' | 'text_match'
  }
}

type RankedAuthor = {
  username: string
  name: string | null
  location: string | null
  verified: boolean
  voice_class: CandidateVoiceClass
  post_count: number
  engagement_score: number
  rank_score: number
  rank_explanation: string[]
  followers_count: number | null
  tweet_count: number | null
  cited_post_urls: string[]
  location_basis: Array<'geo' | 'profile_location' | 'text_match'>
  latest_post_at: string | null
}

export const Route = createFileRoute('/api/x-discover')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const access = await authorizeInternalRequest(request)
        if (!access.allowed) {
          return Response.json(
            {
              ok: false,
              access: {
                provider: 'x-api-recent-search',
                tokenConfigured: Boolean(readXBearerToken()),
                authorized: false,
                reason: access.reason,
              },
              posts: [],
              authors_ranked: [],
              limitations: ['This endpoint is internal because it can spend provider API credits.'],
            },
            { status: access.status },
          )
        }

        let body: Record<string, unknown>
        try {
          body = (await request.json()) as Record<string, unknown>
        } catch {
          return Response.json({ ok: false, error: 'Expected JSON body.', posts: [], authors_ranked: [] }, { status: 400 })
        }

        let cleaned: XDiscoverRequest
        try {
          cleaned = cleanRequest(body)
        } catch (error) {
          return Response.json(
            { ok: false, error: error instanceof Error ? error.message : 'Invalid request.', posts: [], authors_ranked: [] },
            { status: 400 },
          )
        }

        const token = readXBearerToken()
        const xQuery = buildXRecentSearchQuery(cleaned)
        if (!token) {
          return Response.json({
            ok: false,
            access: {
              provider: 'x-api-recent-search',
              tokenConfigured: false,
              authorized: true,
              query: xQuery,
              geo: cleaned.geo,
            },
            posts: [],
            authors_ranked: [],
            limitations: [
              'No X bearer token is configured. Set X_BEARER_TOKEN, X_API_BEARER_TOKEN, or TWITTER_BEARER_TOKEN on the server.',
              'Without direct X API access this endpoint can only show the request it would make.',
            ],
            generatedAt: new Date().toISOString(),
          })
        }

        const endpoint = buildXRecentSearchUrl(xQuery, cleaned)
        const [upstream, countResult] = await Promise.all([
          fetch(endpoint, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(15_000),
          }).catch((error) => error),
          fetchXRecentPostCount(token, xQuery, cleaned),
        ])

        if (upstream instanceof Error) {
          return Response.json(
            {
              ok: false,
              access: {
                provider: 'x-api-recent-search',
                tokenConfigured: true,
                authorized: true,
                query: xQuery,
                geo: cleaned.geo,
              },
              error: upstream.message,
              posts: [],
              authors_ranked: [],
              generatedAt: new Date().toISOString(),
            },
            { status: 502 },
          )
        }

        const text = await upstream.text()
        let payload: XApiResponse | null = null
        try {
          payload = JSON.parse(text) as XApiResponse
        } catch {
          payload = null
        }

        if (!upstream.ok || !payload) {
          return Response.json(
            {
              ok: false,
              access: {
                provider: 'x-api-recent-search',
                tokenConfigured: true,
                authorized: true,
                query: xQuery,
                geo: cleaned.geo,
              },
              error: payload?.errors ?? (text.slice(0, 600) || `X API HTTP ${upstream.status}`),
              posts: [],
              authors_ranked: [],
              generatedAt: new Date().toISOString(),
            },
            { status: 502 },
          )
        }

        const posts = buildDiscoveredPosts(payload, cleaned)
        const signalMetrics = buildSignalMetrics(posts, countResult)
        const authors = rankAuthors(posts).slice(0, 25)

        return Response.json({
          ok: true,
          access: {
            provider: 'x-api-recent-search',
            tokenConfigured: true,
            authorized: true,
            endpoint: '/2/tweets/search/recent',
            query: xQuery,
            geo: cleaned.geo,
            resultCount: posts.length,
            matchedPostCount: signalMetrics.matchedPostCount ?? null,
            newest_id: payload.meta?.newest_id ?? null,
            oldest_id: payload.meta?.oldest_id ?? null,
          },
          signal_metrics: signalMetrics,
          posts,
          authors_ranked: cleaned.rank_authors ? authors : [],
          limitations: [
            'Recent Search covers the last seven days.',
            'Geo operators only match posts with usable geo/place signals, so local coverage can be sparse.',
            'Profile location and text matches are weaker than post geo metadata.',
          ],
          generatedAt: new Date().toISOString(),
        })
      },
    },
  },
})

function cleanRequest(body: Record<string, unknown>): XDiscoverRequest {
  const query = cleanText(body.query, 240)
  if (!query) throw new Error('query is required.')

  const windowDaysRaw = Number(body.window_days ?? 7)
  const window_days = Number.isFinite(windowDaysRaw) ? Math.min(Math.max(Math.round(windowDaysRaw), 1), 7) : 7
  const maxRaw = Number(body.max_results ?? 30)
  const max_results = Number.isFinite(maxRaw) ? Math.min(Math.max(Math.round(maxRaw), 10), 100) : 30
  const geo = cleanGeo(body.geo) ?? inferGeoPreset(query)

  return {
    query,
    window_days,
    max_results,
    rank_authors: body.rank_authors !== false,
    geo,
  }
}

function cleanGeo(value: unknown): XDiscoverGeo | null {
  if (!value || typeof value !== 'object') return null
  const geo = value as Record<string, unknown>
  if (geo.type !== 'point_radius') return null
  const longitude = Number(geo.longitude)
  const latitude = Number(geo.latitude)
  const radius = cleanRadius(geo.radius)
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null
  if (!radius) return null
  return {
    type: 'point_radius',
    longitude,
    latitude,
    radius,
    label: cleanText(geo.label, 80) || null,
  }
}

function inferGeoPreset(query: string): XDiscoverGeo | null {
  if (!/\btulsa\b/i.test(query)) return null
  return { type: 'point_radius', ...DEFAULT_TULSA_GEO }
}

function cleanRadius(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  const match = raw.match(/^(\d{1,3})(mi|km)$/)
  if (!match) return null
  const amount = Number(match[1])
  if (!Number.isFinite(amount) || amount < 1 || amount > 100) return null
  return `${amount}${match[2]}`
}

function buildXRecentSearchQuery(request: XDiscoverRequest): string {
  const base = normalizeSearchTerms(request.query)
  const parts = [base, '-is:retweet']
  if (request.geo?.type === 'point_radius') {
    parts.push(`point_radius:[${request.geo.longitude} ${request.geo.latitude} ${request.geo.radius}]`)
  }
  return parts.filter(Boolean).join(' ').slice(0, 512)
}

function normalizeSearchTerms(query: string): string {
  const withoutAdminWords = query
    .replace(/\b(x|top|posters?|authors?|accounts?|voices?|rank|ranking|leaderboard)\b/gi, ' ')
    .replace(/\b(in|near|around|from)\s+tulsa(?:,\s*ok(?:lahoma)?)?\b/gi, ' Tulsa OR #Tulsa OR "Tulsa OK" ')
    .replace(/\s+/g, ' ')
    .trim()

  if (/\btulsa\b/i.test(query)) {
    const extraTerms = withoutAdminWords
      .replace(/"Tulsa OK"/gi, ' ')
      .replace(/#Tulsa/gi, ' ')
      .replace(/\bTulsa\b/gi, ' ')
      .replace(/\bOK\b/gi, ' ')
      .replace(/\bOR\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return [`(Tulsa OR #Tulsa OR "Tulsa OK")`, extraTerms].filter(Boolean).join(' ')
  }

  return withoutAdminWords || query
}

function buildXRecentSearchUrl(query: string, request: XDiscoverRequest): string {
  const endpoint = new URL(X_RECENT_SEARCH_URL)
  endpoint.searchParams.set('query', query)
  endpoint.searchParams.set('max_results', String(request.max_results))
  endpoint.searchParams.set('tweet.fields', 'author_id,created_at,entities,geo,lang,public_metrics')
  endpoint.searchParams.set('expansions', 'author_id,geo.place_id')
  endpoint.searchParams.set('user.fields', 'description,location,name,public_metrics,username,verified')
  endpoint.searchParams.set('place.fields', 'country,country_code,full_name,geo,name,place_type')
  endpoint.searchParams.set('start_time', new Date(Date.now() - request.window_days * 86_400_000).toISOString())
  return endpoint.toString()
}

function buildXRecentCountsUrl(query: string, request: XDiscoverRequest): string {
  const endpoint = new URL(X_RECENT_COUNTS_URL)
  endpoint.searchParams.set('query', query)
  endpoint.searchParams.set('start_time', new Date(Date.now() - request.window_days * 86_400_000).toISOString())
  return endpoint.toString()
}

async function fetchXRecentPostCount(
  token: string,
  query: string,
  request: XDiscoverRequest,
): Promise<{ count: number | null; error: string | null }> {
  const response = await fetch(buildXRecentCountsUrl(query, request), {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  }).catch((error) => error)

  if (response instanceof Error) return { count: null, error: response.message }
  const payload = (await response.json().catch(() => null)) as XCountsResponse | null
  if (!response.ok || !payload) {
    return { count: null, error: payload?.errors ? JSON.stringify(payload.errors).slice(0, 240) : `X counts HTTP ${response.status}` }
  }
  const metaCount = cleanNumber(payload.meta?.total_tweet_count)
  const bucketCount = Array.isArray(payload.data)
    ? payload.data.reduce((sum, bucket) => sum + (cleanNumber(bucket.tweet_count) ?? 0), 0)
    : null
  return { count: metaCount ?? bucketCount, error: null }
}

function buildDiscoveredPosts(payload: XApiResponse, request: XDiscoverRequest): DiscoveredPost[] {
  const users = new Map((payload.includes?.users ?? []).map((user) => [user.id, user]))
  const places = new Map((payload.includes?.places ?? []).map((place) => [place.id, place]))

  return (payload.data ?? [])
    .map((post): DiscoveredPost | null => {
      const id = cleanText(post.id, 80)
      if (!id) return null
      const user = users.get(post.author_id)
      const username = cleanHandle(user?.username) ?? 'unknown'
      const place = post.geo?.place_id ? places.get(post.geo.place_id) : null
      const basis = place ? 'geo' : user?.location && isLocalText(user.location, request) ? 'profile_location' : 'text_match'
      const metrics = post.public_metrics ?? {}
      const userMetrics = user?.public_metrics ?? {}

      return {
        id,
        url: username === 'unknown' ? `https://x.com/i/status/${id}` : `https://x.com/${username}/status/${id}`,
        text_excerpt: cleanText(post.text, 360),
        created_at: cleanText(post.created_at, 80) || null,
        lang: cleanText(post.lang, 16) || null,
        author: {
          id: cleanText(user?.id, 80) || null,
          username,
          name: cleanText(user?.name, 120) || null,
          location: cleanText(user?.location, 160) || null,
          verified: user?.verified === true,
          followers_count: cleanNumber(userMetrics.followers_count),
          tweet_count: cleanNumber(userMetrics.tweet_count),
        },
        public_metrics: {
          reposts: cleanNumber(metrics.retweet_count) ?? 0,
          replies: cleanNumber(metrics.reply_count) ?? 0,
          likes: cleanNumber(metrics.like_count) ?? 0,
          quotes: cleanNumber(metrics.quote_count) ?? 0,
          impressions: cleanNumber(metrics.impression_count),
        },
        geo: {
          place_id: cleanText(post.geo?.place_id, 120) || null,
          full_name: cleanText(place?.full_name ?? place?.name, 160) || null,
          basis,
        },
      }
    })
    .filter((post): post is DiscoveredPost => Boolean(post))
}

function rankAuthors(posts: DiscoveredPost[]): RankedAuthor[] {
  const byHandle = new Map<string, RankedAuthor>()

  for (const post of posts) {
    const key = post.author.username.toLowerCase()
    const current =
      byHandle.get(key) ??
      ({
        username: post.author.username,
        name: post.author.name,
        location: post.author.location,
        verified: post.author.verified,
        voice_class: inferVoiceClass(post.author),
        post_count: 0,
        engagement_score: 0,
        rank_score: 0,
        rank_explanation: [],
        followers_count: post.author.followers_count,
        tweet_count: post.author.tweet_count,
        cited_post_urls: [],
        location_basis: [],
        latest_post_at: null,
      } satisfies RankedAuthor)

    current.post_count += 1
    current.engagement_score +=
      post.public_metrics.likes + post.public_metrics.reposts * 2 + post.public_metrics.replies + post.public_metrics.quotes * 2
    if (current.cited_post_urls.length < 8) current.cited_post_urls.push(post.url)
    if (!current.location_basis.includes(post.geo.basis)) current.location_basis.push(post.geo.basis)
    current.latest_post_at = maxIso(current.latest_post_at, post.created_at)
    byHandle.set(key, current)
  }

  const authors = Array.from(byHandle.values())
  const postMax = Math.max(...authors.map((author) => author.post_count), 1)
  const engagementMax = Math.max(...authors.map((author) => author.engagement_score), 1)
  const followerMax = Math.max(...authors.map((author) => author.followers_count ?? 0), 1)
  const ranked = rankSeekBoxCandidates({
    mode: 'x-discover-authors',
    candidates: authors.map((author) => authorToCandidate(author, { postMax, engagementMax, followerMax })),
    limit: authors.length,
    diversify: false,
  })
  const rankById = new Map(ranked.map((candidate) => [candidate.id, candidate]))

  return authors
    .map((author) => {
      const rankedAuthor = rankById.get(`x-author:${author.username.toLowerCase()}`)
      return {
        ...author,
        rank_score: rankedAuthor?.score ?? 0,
        rank_explanation: rankedAuthor?.explanation ?? [],
      }
    })
    .sort((a, b) => b.rank_score - a.rank_score || b.post_count - a.post_count || b.engagement_score - a.engagement_score || a.username.localeCompare(b.username))
}

function buildSignalMetrics(
  posts: DiscoveredPost[],
  countResult: { count: number | null; error: string | null },
): PulseRunMetrics {
  const samplePostCount = posts.length
  const replyCount = posts.reduce((sum, post) => sum + post.public_metrics.replies, 0)
  const likeCount = posts.reduce((sum, post) => sum + post.public_metrics.likes, 0)
  const repostCount = posts.reduce((sum, post) => sum + post.public_metrics.reposts, 0)
  const quoteCount = posts.reduce((sum, post) => sum + post.public_metrics.quotes, 0)
  const viewPosts = posts.filter((post) => post.public_metrics.impressions !== null)
  const viewCount = viewPosts.length
    ? viewPosts.reduce((sum, post) => sum + (post.public_metrics.impressions ?? 0), 0)
    : null
  const basis = countResult.count !== null
    ? samplePostCount > 0 ? 'mixed' : 'x_recent_counts'
    : 'x_recent_sample'

  return {
    basis,
    matchedPostCount: countResult.count,
    samplePostCount,
    replyCount,
    viewCount,
    likeCount,
    repostCount,
    quoteCount,
    confidence: countResult.count !== null ? 'medium' : 'low',
    notes: countResult.error
      ? `X counts unavailable; sampled ${samplePostCount} returned posts.`
      : `X counts matched ${countResult.count ?? 0} posts; sampled ${samplePostCount} returned posts.`,
    generatedAt: new Date().toISOString(),
  }
}

function authorToCandidate(
  author: RankedAuthor,
  max: { postMax: number; engagementMax: number; followerMax: number },
): SeekBoxCandidate {
  const locationQuality = author.location_basis.includes('geo')
    ? 95
    : author.location_basis.includes('profile_location')
      ? 70
      : author.location_basis.includes('text_match')
        ? 48
        : 20
  const followerScore = author.followers_count ? Math.log10(author.followers_count + 1) / Math.log10(max.followerMax + 1) * 100 : 0

  return {
    id: `x-author:${author.username.toLowerCase()}`,
    sourceKind: 'x',
    entityType: 'voice',
    voiceClass: author.voice_class,
    title: `@${author.username}`,
    summary: author.name ?? author.location,
    sourceName: 'x-api-recent-search',
    sourceId: author.username.toLowerCase(),
    sourceUrl: `https://x.com/${author.username}`,
    safePublic: true,
    createdAt: author.latest_post_at,
    features: {
      relevance: locationQuality,
      credibility: Math.max(author.verified ? 78 : 35, followerScore),
      recency: recencyScore(author.latest_post_at),
      velocity: author.post_count / max.postMax * 100,
      engagement: author.engagement_score / max.engagementMax * 100,
      geoFit: locationQuality,
      sourceQuality: locationQuality,
      sentiment: 50,
      novelty: author.verified ? 25 : 60,
    },
    metadata: {
      post_count: author.post_count,
      engagement_score: author.engagement_score,
      followers_count: author.followers_count,
      location_basis: author.location_basis,
    },
  }
}

function inferVoiceClass(author: DiscoveredPost['author']): CandidateVoiceClass {
  const text = `${author.name ?? ''} ${author.location ?? ''}`.toLowerCase()
  if (/\b(news|times|journal|media|radio|tv|press|reporter|anchor|editor)\b/.test(text)) return 'media'
  if (/\b(official|city of|university|school|gov|agency|department|chamber)\b/.test(text)) return 'institution'
  if (/\b(co|inc|llc|studio|shop|restaurant|venue|brand)\b/.test(text)) return 'brand'
  if ((author.followers_count ?? 0) >= 50000 || author.verified) return 'creator'
  return 'real_person'
}

function recencyScore(value: string | null): number {
  if (!value) return 35
  const ageMs = Date.now() - new Date(value).getTime()
  if (!Number.isFinite(ageMs) || ageMs < 0) return 50
  const ageHours = ageMs / 3_600_000
  return Math.max(15, Math.round(100 - ageHours * 3))
}

function maxIso(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b
}

async function authorizeInternalRequest(request: Request): Promise<{ allowed: true } | { allowed: false; reason: string; status: number }> {
  const url = new URL(request.url)
  if (['localhost', '127.0.0.1', '::1'].includes(url.hostname)) return { allowed: true }

  const configuredKey = process.env.X_RAW_DISCOVER_ADMIN_KEY?.trim()
  const requestKey = request.headers.get('x-seekbox-internal-key')?.trim()
  if (configuredKey && requestKey && timingSafeEqual(configuredKey, requestKey)) return { allowed: true }

  const token = readBearerToken(request.headers.get('authorization'))
  if (!token) return { allowed: false, reason: 'Missing internal authorization.', status: 401 }

  const user = await verifySupabaseUser(token)
  if (!user?.id) return { allowed: false, reason: 'Invalid Supabase session.', status: 401 }

  const role = await fetchUserRole(user.id, token, user.email)
  if (role !== DISCOVERY_ROLE) return { allowed: false, reason: `Role ${role} cannot use X discovery.`, status: 403 }
  return { allowed: true }
}

async function verifySupabaseUser(token: string): Promise<{ id: string; email: string | null } | null> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL
  const publicKey = getSupabasePublicKey()
  if (!supabaseUrl || !publicKey) return null

  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
    headers: { apikey: publicKey, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null)
  if (!response?.ok) return null

  const user = (await response.json().catch(() => null)) as Record<string, unknown> | null
  const id = typeof user?.id === 'string' ? user.id : ''
  if (!id) return null
  return { id, email: typeof user?.email === 'string' ? user.email : null }
}

async function fetchUserRole(userId: string, token: string, email: string | null): Promise<string> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL
  const publicKey = getSupabasePublicKey()
  if (!supabaseUrl || !publicKey) return 'unknown'

  const baseUrl = supabaseUrl.replace(/\/$/, '')
  const headers = { apikey: publicKey, Authorization: `Bearer ${token}` }
  const selects = ['role,granted_role,role_id', 'role,granted_role', 'role_id']

  for (const col of ['owner_user_id', 'user_id', 'id']) {
    for (const select of selects) {
      const endpoint = new URL(`${baseUrl}/rest/v1/accounts`)
      endpoint.searchParams.set('select', select)
      endpoint.searchParams.set(col, `eq.${userId}`)
      endpoint.searchParams.set('limit', '1')
      const response = await fetch(endpoint, { headers, signal: AbortSignal.timeout(8_000) }).catch(() => null)
      if (!response?.ok) continue
      const rows = (await response.json().catch(() => null)) as Array<Record<string, unknown>> | null
      const row = Array.isArray(rows) ? rows[0] : null
      const role = normalizeRole(row?.granted_role ?? row?.role_id ?? row?.role, email)
      if (role) return role
    }
  }

  return email ? 'trial' : 'anon'
}

function readXBearerToken(): string | null {
  return (
    process.env.X_BEARER_TOKEN ??
    process.env.X_API_BEARER_TOKEN ??
    process.env.TWITTER_BEARER_TOKEN ??
    process.env.TWITTER_API_BEARER_TOKEN ??
    ''
  ).trim() || null
}

function getSupabasePublicKey(): string | undefined {
  return (
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  )
}

function readBearerToken(value: string | null): string | null {
  const match = value?.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

function normalizeRole(value: unknown, email: string | null): string | null {
  if (typeof value !== 'string') return null
  const role = value.trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_')
  if (!role) return null
  if (role === 'guest') return email ? 'trial' : 'anon'
  if (email && role === 'anon') return 'trial'
  return role
}

function cleanHandle(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.replace(/^@+/, '').trim() : ''
  return /^[A-Za-z0-9_]{1,15}$/.test(raw) ? raw : null
}

function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function cleanNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null
}

function isLocalText(text: string, request: XDiscoverRequest): boolean {
  const haystack = text.toLowerCase()
  if (request.geo?.label && haystack.includes(request.geo.label.toLowerCase().split(',')[0])) return true
  return /\btulsa\b/.test(haystack)
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return result === 0
}
