export type CandidateSourceKind =
  | 'x'
  | 'web'
  | 'news'
  | 'internal_seed'
  | 'pulse'
  | 'music'
  | 'market_data'
  | 'user_upload'
  | 'unknown'

export type CandidateEntityType =
  | 'post'
  | 'voice'
  | 'article'
  | 'market'
  | 'venue'
  | 'artist'
  | 'company'
  | 'topic'
  | 'answer'
  | 'other'

export type CandidateVoiceClass =
  | 'industry'
  | 'media'
  | 'real_person'
  | 'creator'
  | 'institution'
  | 'brand'
  | 'unknown'

export type CandidateFeatures = {
  relevance?: number | null
  recency?: number | null
  velocity?: number | null
  engagement?: number | null
  credibility?: number | null
  sentiment?: number | null
  geoFit?: number | null
  personalization?: number | null
  novelty?: number | null
  sourceQuality?: number | null
  safetyPenalty?: number | null
  diversityPenalty?: number | null
}

export type SeekBoxCandidate = {
  id: string
  sourceKind: CandidateSourceKind
  entityType: CandidateEntityType
  title: string
  summary?: string | null
  sourceName?: string | null
  sourceId?: string | null
  sourceUrl?: string | null
  scopeType?: string | null
  scopeValue?: string | null
  voiceClass?: CandidateVoiceClass | null
  tags?: string[]
  createdAt?: string | null
  safePublic?: boolean
  features?: CandidateFeatures
  metadata?: Record<string, unknown>
}

export type CandidateScoreWeights = {
  relevance: number
  credibility: number
  recency: number
  velocity: number
  engagement: number
  personalization: number
  sourceQuality: number
  sentiment: number
  geoFit: number
  novelty: number
}

export type CandidateScoreBreakdown = {
  relevance: number
  credibility: number
  recency: number
  velocity: number
  engagement: number
  personalization: number
  sourceQuality: number
  sentiment: number
  geoFit: number
  novelty: number
  safetyPenalty: number
  diversityPenalty: number
  finalScore: number
}

export type RankedCandidate = SeekBoxCandidate & {
  rank: number
  score: number
  scoreBreakdown: CandidateScoreBreakdown
  explanation: string[]
}

export type CandidateRankingInput = {
  query?: string | null
  mode?: string | null
  candidates: SeekBoxCandidate[]
  weights?: Partial<CandidateScoreWeights>
  limit?: number
  diversify?: boolean
  maxPerSourceKind?: number
  maxPerVoiceClass?: number
}

export const DEFAULT_CANDIDATE_WEIGHTS: CandidateScoreWeights = {
  relevance: 0.28,
  credibility: 0.17,
  recency: 0.13,
  velocity: 0.1,
  engagement: 0.1,
  personalization: 0.09,
  sourceQuality: 0.06,
  sentiment: 0.03,
  geoFit: 0.025,
  novelty: 0.015,
}

export function rankSeekBoxCandidates(input: CandidateRankingInput): RankedCandidate[] {
  const limit = clampInt(input.limit ?? 24, 1, 100)
  const weights = { ...DEFAULT_CANDIDATE_WEIGHTS, ...input.weights }
  const scored = dedupeCandidates(input.candidates)
    .filter(isRankableCandidate)
    .map((candidate) => {
      const scoreBreakdown = scoreCandidate(candidate.features ?? {}, weights)
      return {
        ...candidate,
        rank: 0,
        score: scoreBreakdown.finalScore,
        scoreBreakdown,
        explanation: explainCandidateScore(candidate, scoreBreakdown),
      } satisfies RankedCandidate
    })
    .sort(compareRankedCandidates)

  const ranked = input.diversify === false
    ? scored
    : diversifyCandidates(scored, {
      maxPerSourceKind: input.maxPerSourceKind ?? 8,
      maxPerVoiceClass: input.maxPerVoiceClass ?? 10,
    })

  return ranked.slice(0, limit).map((candidate, index) => ({
    ...candidate,
    rank: index + 1,
  }))
}

export function scoreCandidate(
  features: CandidateFeatures,
  weights: CandidateScoreWeights = DEFAULT_CANDIDATE_WEIGHTS,
): CandidateScoreBreakdown {
  const positive = {
    relevance: normalizeScore(features.relevance, 50),
    credibility: normalizeScore(features.credibility, 50),
    recency: normalizeScore(features.recency, 50),
    velocity: normalizeScore(features.velocity, 0),
    engagement: normalizeScore(features.engagement, 0),
    personalization: normalizeScore(features.personalization, 0),
    sourceQuality: normalizeScore(features.sourceQuality, 50),
    sentiment: normalizeScore(features.sentiment, 50),
    geoFit: normalizeScore(features.geoFit, 0),
    novelty: normalizeScore(features.novelty, 0),
  }
  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + Math.max(0, weight), 0) || 1
  const weighted =
    positive.relevance * weights.relevance +
    positive.credibility * weights.credibility +
    positive.recency * weights.recency +
    positive.velocity * weights.velocity +
    positive.engagement * weights.engagement +
    positive.personalization * weights.personalization +
    positive.sourceQuality * weights.sourceQuality +
    positive.sentiment * weights.sentiment +
    positive.geoFit * weights.geoFit +
    positive.novelty * weights.novelty
  const safetyPenalty = normalizeScore(features.safetyPenalty, 0)
  const diversityPenalty = normalizeScore(features.diversityPenalty, 0)
  const finalScore = clamp(Math.round((weighted / totalWeight) - safetyPenalty * 0.7 - diversityPenalty * 0.35), 0, 100)

  return {
    ...positive,
    safetyPenalty,
    diversityPenalty,
    finalScore,
  }
}

export function explainCandidateScore(candidate: SeekBoxCandidate, breakdown: CandidateScoreBreakdown): string[] {
  const drivers = [
    ['relevance', breakdown.relevance],
    ['credibility', breakdown.credibility],
    ['recency', breakdown.recency],
    ['velocity', breakdown.velocity],
    ['engagement', breakdown.engagement],
    ['personalization', breakdown.personalization],
    ['source quality', breakdown.sourceQuality],
    ['geo fit', breakdown.geoFit],
    ['novelty', breakdown.novelty],
  ] as const
  const topDrivers = drivers
    .filter(([, value]) => value >= 60)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label, value]) => `${label} ${Math.round(value)}`)

  const explanation = [
    `${candidate.sourceKind}/${candidate.entityType} scored ${breakdown.finalScore}.`,
    topDrivers.length ? `Primary drivers: ${topDrivers.join(', ')}.` : 'No dominant positive driver; ranked by blended fit.',
  ]

  if (breakdown.safetyPenalty >= 30) explanation.push(`Safety penalty ${Math.round(breakdown.safetyPenalty)} lowered rank.`)
  if (breakdown.diversityPenalty >= 30) explanation.push(`Diversity penalty ${Math.round(breakdown.diversityPenalty)} reduced repetition.`)
  return explanation
}

export function candidateIdentity(candidate: SeekBoxCandidate): string {
  const url = normalizeUrl(candidate.sourceUrl)
  if (url) return `url:${url}`
  if (candidate.sourceId) return `${candidate.sourceKind}:${candidate.sourceId.toLowerCase()}`
  return `${candidate.sourceKind}:${candidate.entityType}:${candidate.title.toLowerCase().replace(/\s+/g, ' ').trim()}`
}

function dedupeCandidates(candidates: SeekBoxCandidate[]): SeekBoxCandidate[] {
  const byKey = new Map<string, SeekBoxCandidate>()
  for (const candidate of candidates) {
    const key = candidateIdentity(candidate)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, candidate)
      continue
    }
    const existingScore = scoreCandidate(existing.features ?? {}).finalScore
    const nextScore = scoreCandidate(candidate.features ?? {}).finalScore
    if (nextScore > existingScore) byKey.set(key, candidate)
  }
  return [...byKey.values()]
}

function isRankableCandidate(candidate: SeekBoxCandidate): boolean {
  if (!candidate.id || !candidate.title.trim()) return false
  if (normalizeScore(candidate.features?.safetyPenalty, 0) >= 100) return false
  return true
}

function compareRankedCandidates(a: RankedCandidate, b: RankedCandidate): number {
  return b.score - a.score || sourcePriority(a.sourceKind) - sourcePriority(b.sourceKind) || a.title.localeCompare(b.title)
}

function diversifyCandidates(
  candidates: RankedCandidate[],
  config: { maxPerSourceKind: number; maxPerVoiceClass: number },
): RankedCandidate[] {
  const selected: RankedCandidate[] = []
  const deferred: RankedCandidate[] = []
  const sourceCounts = new Map<CandidateSourceKind, number>()
  const voiceCounts = new Map<CandidateVoiceClass, number>()

  for (const candidate of candidates) {
    const sourceCount = sourceCounts.get(candidate.sourceKind) ?? 0
    const voiceClass = candidate.voiceClass ?? 'unknown'
    const voiceCount = voiceCounts.get(voiceClass) ?? 0
    if (sourceCount >= config.maxPerSourceKind || voiceCount >= config.maxPerVoiceClass) {
      deferred.push(candidate)
      continue
    }
    selected.push(candidate)
    sourceCounts.set(candidate.sourceKind, sourceCount + 1)
    voiceCounts.set(voiceClass, voiceCount + 1)
  }

  return [...selected, ...deferred]
}

function sourcePriority(source: CandidateSourceKind): number {
  if (source === 'x') return 0
  if (source === 'pulse') return 1
  if (source === 'news') return 2
  if (source === 'web') return 3
  if (source === 'internal_seed') return 4
  return 5
}

function normalizeUrl(value?: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    url.hash = ''
    url.searchParams.sort()
    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

function normalizeScore(value: number | null | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return clamp(value <= 1 && value >= 0 ? value * 100 : value, 0, 100)
}

function clampInt(value: number, min: number, max: number): number {
  return Math.round(clamp(value, min, max))
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
