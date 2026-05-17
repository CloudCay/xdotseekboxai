export type PulseMetricBasis =
  | 'x_recent_counts'
  | 'x_recent_sample'
  | 'grok_reported'
  | 'cache_derived'
  | 'mixed'
  | 'unknown'

export type PulseRunMetrics = {
  basis?: PulseMetricBasis | string | null
  matchedPostCount?: number | null
  samplePostCount?: number | null
  replyCount?: number | null
  viewCount?: number | null
  likeCount?: number | null
  repostCount?: number | null
  quoteCount?: number | null
  confidence?: string | null
  notes?: string | null
  generatedAt?: string | null
}

export function bestPostCount(metrics: PulseRunMetrics | null | undefined): number | null {
  if (!metrics) return null
  return firstNumber(metrics.matchedPostCount, metrics.samplePostCount)
}

export function formatCompactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-'
  if (Math.abs(value) < 1000) return String(Math.round(value))
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: Math.abs(value) >= 10000 ? 0 : 1,
  }).format(value)
}

export function metricBasisLabel(value: string | null | undefined): string {
  switch (value) {
    case 'x_recent_counts':
      return 'X count'
    case 'x_recent_sample':
      return 'X sample'
    case 'grok_reported':
      return 'Grok reported'
    case 'cache_derived':
      return 'Cache derived'
    case 'mixed':
      return 'Mixed'
    default:
      return 'Unknown'
  }
}

function firstNumber(...values: Array<number | null | undefined>): number | null {
  for (const value of values) {
    if (value !== null && value !== undefined && Number.isFinite(value)) return value
  }
  return null
}
