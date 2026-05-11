import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/unusual-whales')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Record<string, unknown>
        try {
          body = (await request.json()) as Record<string, unknown>
        } catch {
          return Response.json({ error: 'Expected JSON body.' }, { status: 400 })
        }

        let symbol: string
        let apiKey: string
        let keySource: 'user' | 'server'
        try {
          symbol = cleanSymbol(body.symbol)
          const userApiKey = cleanOptionalApiKey(body.apiKey)
          const serverApiKey = cleanServerApiKey(process.env.UW_API_KEY)
          if (!userApiKey && serverApiKey) await requireHostedKeyAccess(request)
          apiKey = userApiKey ?? serverApiKey ?? ''
          keySource = userApiKey ? 'user' : 'server'
          if (!apiKey) throw new Error('Enter your Unusual Whales API key or set UW_API_KEY on the server.')
        } catch (error) {
          return Response.json({ error: error instanceof Error ? error.message : 'Invalid request.' }, { status: 400 })
        }

        const minPremium = cleanMoney(body.minPremium, 250_000)
        const side = cleanSide(body.side)
        const include = cleanInclude(body.include)
        const labKeys = cleanLabs(body.labs ?? body.lab)
        const endpointPlans = [
          ...buildEndpointPlans({ symbol, minPremium, side, include }),
          ...buildLabEndpointPlans(symbol, labKeys),
        ]

        const settled = await Promise.allSettled(endpointPlans.map((plan) => fetchUnusualWhales(plan, apiKey)))
        const errors: string[] = []
        const endpointErrors: Record<string, string> = {}
        const rawByKey: Record<string, unknown> = {}
        const okEndpoints: string[] = []

        settled.forEach((result, index) => {
          const plan = endpointPlans[index]
          if (result.status === 'fulfilled') {
            rawByKey[plan.key] = result.value.raw
            okEndpoints.push(plan.key)
          } else {
            const message = result.reason instanceof Error ? result.reason.message : `${plan.label} failed.`
            endpointErrors[plan.key] = message
            errors.push(message)
          }
        })

        const flowRows = normalizeRecentFlow(rawByKey.recentFlow)
        const alertRows = normalizeFlowAlerts(rawByKey.flowAlerts)
        const darkpoolRows = normalizeDarkpool(rawByKey.darkpool)
        const marketTide = normalizeMarketTide(rawByKey.marketTide)
        const metrics = deriveMetrics({ flowRows, alertRows, darkpoolRows, marketTide })
        const labs = summarizeLabResults({ labKeys, endpointPlans, rawByKey, endpointErrors })
        const labPrompt = labs.length ? buildLabPrompt({ symbol, labs }) : ''
        const prompt = [buildWhalesPrompt({ symbol, metrics, alertRows, darkpoolRows, marketTide }), labPrompt]
          .filter(Boolean)
          .join('\n\n')

        return Response.json({
          symbol,
          fetchedAt: new Date().toISOString(),
          keySource,
          endpoints: okEndpoints,
          errors,
          metrics,
          recentFlow: flowRows,
          flowAlerts: alertRows,
          darkpool: darkpoolRows,
          marketTide,
          labs,
          labPrompt,
          prompt,
          source: {
            name: 'Unusual Whales',
            docs: 'https://api.unusualwhales.com/docs',
          },
        })
      },
    },
  },
})

type IncludeFlags = {
  recentFlow: boolean
  flowAlerts: boolean
  darkpool: boolean
  marketTide: boolean
}

type LabKey = 'marketImpact' | 'gammaVol' | 'newsCatalyst' | 'ownershipPressure' | 'politicalTape' | 'etfTide'

type EndpointPlan = {
  key: string
  label: string
  path: string
  params?: Record<string, string | number | boolean | undefined>
  lab?: LabKey
}

type LabResult = {
  key: LabKey
  label: string
  status: 'ok' | 'partial' | 'empty' | 'error'
  endpoints: string[]
  rowCount: number
  metrics: Record<string, string | number | null>
  highlights: LabHighlight[]
  errors: string[]
}

type LabHighlight = {
  title: string
  meta?: string
  value?: string
}

type NormalizedFlowRow = {
  label: string
  expiry?: string
  date?: string
  callPremium: number
  putPremium: number
  callVolume: number
  putVolume: number
  netPremium: number
}

type NormalizedAlertRow = {
  id?: string
  contract?: string
  rule?: string
  side?: 'CALL' | 'PUT' | 'UNKNOWN'
  sentiment?: string
  premium: number
  volume: number
  openInterest?: number
  strike?: number
  expiry?: string
  tapeTime?: string
}

type NormalizedDarkpoolRow = {
  id?: string
  venue?: string
  price?: number
  size: number
  premium: number
  tapeTime?: string
}

type NormalizedTidePoint = {
  timestamp?: string
  netCallPremium: number
  netPutPremium: number
  netPremium: number
  netVolume?: number
}

type WhalesMetrics = {
  flowCount: number
  alertCount: number
  darkpoolCount: number
  callPremium: number
  putPremium: number
  netOptionsPremium: number
  darkpoolPremium: number
  largestAlertPremium: number
  largestDarkpoolPremium: number
  marketTideNetPremium: number | null
  bias: 'bullish' | 'bearish' | 'mixed' | 'quiet'
}

function buildEndpointPlans(args: {
  symbol: string
  minPremium: number
  side: string | null
  include: IncludeFlags
}): EndpointPlan[] {
  const plans: EndpointPlan[] = []
  if (args.include.recentFlow) {
    plans.push({
      key: 'recentFlow',
      label: 'Recent stock flow',
      path: `/api/stock/${encodeURIComponent(args.symbol)}/flow-recent`,
      params: { min_premium: args.minPremium, side: args.side ?? undefined },
    })
  }
  if (args.include.flowAlerts) {
    plans.push({
      key: 'flowAlerts',
      label: 'Flow alerts',
      path: '/api/option-trades/flow-alerts',
      params: { ticker_symbol: args.symbol, min_premium: args.minPremium, limit: 40 },
    })
  }
  if (args.include.darkpool) {
    plans.push({
      key: 'darkpool',
      label: 'Dark pool trades',
      path: `/api/darkpool/${encodeURIComponent(args.symbol)}`,
      params: { min_premium: args.minPremium, limit: 40 },
    })
  }
  if (args.include.marketTide) {
    plans.push({
      key: 'marketTide',
      label: 'Market tide',
      path: '/api/market/market-tide',
      params: { interval_5m: true },
    })
  }
  return plans.length ? plans : buildEndpointPlans({ ...args, include: { ...args.include, flowAlerts: true } })
}

const LAB_LABELS: Record<LabKey, string> = {
  marketImpact: 'Market impact',
  gammaVol: 'Gamma and volatility',
  newsCatalyst: 'News catalyst',
  ownershipPressure: 'Ownership and short pressure',
  politicalTape: 'Political tape',
  etfTide: 'ETF tide',
}

function buildLabEndpointPlans(symbol: string, labKeys: LabKey[]): EndpointPlan[] {
  return labKeys.flatMap((lab): EndpointPlan[] => {
    if (lab === 'marketImpact') {
      return [
        { key: 'labTopNetImpact', lab, label: 'Top net impact', path: '/api/market/top-net-impact', params: { limit: 20 } },
        { key: 'labOiChange', lab, label: 'Market OI change', path: '/api/market/oi-change', params: { limit: 20 } },
        { key: 'labSectorEtfs', lab, label: 'Sector ETFs', path: '/api/market/sector-etfs' },
        { key: 'labTotalOptionsVolume', lab, label: 'Total options volume', path: '/api/market/total-options-volume' },
      ]
    }
    if (lab === 'gammaVol') {
      return [
        { key: 'labGreekExposure', lab, label: 'Greek exposure', path: `/api/stock/${encodeURIComponent(symbol)}/greek-exposure` },
        { key: 'labIvRank', lab, label: 'IV rank', path: `/api/stock/${encodeURIComponent(symbol)}/iv-rank` },
        { key: 'labMaxPain', lab, label: 'Max pain', path: `/api/stock/${encodeURIComponent(symbol)}/max-pain` },
        { key: 'labVolatilityStats', lab, label: 'Volatility stats', path: `/api/stock/${encodeURIComponent(symbol)}/volatility/stats` },
        { key: 'labVolatilityTerm', lab, label: 'Volatility term structure', path: `/api/stock/${encodeURIComponent(symbol)}/volatility/term-structure` },
      ]
    }
    if (lab === 'newsCatalyst') {
      return [
        { key: 'labNews', lab, label: 'News headlines', path: '/api/news/headlines', params: { ticker: symbol, major_only: true, limit: 10 } },
      ]
    }
    if (lab === 'ownershipPressure') {
      return [
        { key: 'labInsiderBuysSells', lab, label: 'Insider buy and sells', path: `/api/stock/${encodeURIComponent(symbol)}/insider-buy-sells` },
        { key: 'labInstitutionalOwnership', lab, label: 'Institutional ownership', path: `/api/institution/${encodeURIComponent(symbol)}/ownership` },
        { key: 'labShortData', lab, label: 'Short data', path: `/api/shorts/${encodeURIComponent(symbol)}/data` },
        { key: 'labFailuresToDeliver', lab, label: 'Failures to deliver', path: `/api/shorts/${encodeURIComponent(symbol)}/ftds` },
      ]
    }
    if (lab === 'politicalTape') {
      return [
        {
          key: 'labCongressTicker',
          lab,
          label: 'Congress unusual trades by ticker',
          path: '/api/congress/unusual-trades/by-tickers',
          params: { tickers: symbol, limit: 20 },
        },
      ]
    }
    return [
      { key: 'labEtfTide', lab, label: 'ETF tide', path: `/api/market/${encodeURIComponent(symbol)}/etf-tide` },
      { key: 'labEtfMarketTide', lab, label: 'Market tide comparison', path: '/api/market/market-tide', params: { interval_5m: true } },
    ]
  })
}

async function fetchUnusualWhales(plan: EndpointPlan, apiKey: string): Promise<{ key: EndpointPlan['key']; raw: unknown }> {
  const url = new URL(plan.path, 'https://api.unusualwhales.com')
  Object.entries(plan.params ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    url.searchParams.set(key, String(value))
  })

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(12_000),
  })

  const rawText = await response.text()
  const raw = parseMaybeJson(rawText)
  if (!response.ok) {
    throw new Error(`${plan.label}: ${formatUpstreamError(response.status, raw)}`)
  }
  return { key: plan.key, raw }
}

function parseMaybeJson(text: string): unknown {
  if (!text.trim()) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function formatUpstreamError(status: number, raw: unknown): string {
  const message = pickString(raw, ['message', 'error', 'detail'])
  return message ? `HTTP ${status} - ${message}` : `HTTP ${status}`
}

function cleanSymbol(value: unknown): string {
  const symbol = String(value ?? '')
    .trim()
    .replace(/^\$/, '')
    .toUpperCase()
  if (symbol === 'ONEOK') return 'OKE'
  if (symbol === '^VIX' || symbol === '.VIX' || symbol === 'VIX.X') return 'VIX'
  if (!/^[A-Z][A-Z0-9.-]{0,11}$/.test(symbol)) {
    throw new Error('Enter a valid stock symbol.')
  }
  return symbol
}

function cleanOptionalApiKey(value: unknown): string | null {
  if (value == null || value === '') return null
  if (typeof value !== 'string') throw new Error('Enter a valid Unusual Whales API key.')
  const key = value.trim()
  if (!key) return null
  if (key.length < 12) throw new Error('Enter a valid Unusual Whales API key.')
  return key
}

function cleanServerApiKey(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const key = value.trim()
  return key.length >= 12 ? key : null
}

async function requireHostedKeyAccess(request: Request): Promise<void> {
  const token = readBearerToken(request.headers.get('authorization'))
  if (!token) throw new Error('Sign in to use the hosted Unusual Whales key, or paste your own key.')

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL
  const publicKey = getSupabasePublicKey()
  if (!supabaseUrl || !publicKey) throw new Error('Hosted Unusual Whales mode needs Supabase env for sign-in checks.')

  const userResponse = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
    headers: {
      apikey: publicKey,
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(8_000),
  })
  if (!userResponse.ok) throw new Error('Sign in again to use the hosted Unusual Whales key, or paste your own key.')

  const user = (await userResponse.json()) as Record<string, unknown>
  const email = typeof user.email === 'string' ? user.email.trim().toLowerCase() : ''
  const allowedEmails = parseAllowedEmails(process.env.UW_ALLOWED_EMAILS)
  if (allowedEmails.length && !allowedEmails.includes(email)) {
    throw new Error('This hosted Unusual Whales key is limited to approved SeekBox users.')
  }
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

function parseAllowedEmails(value: unknown): string[] {
  if (typeof value !== 'string') return []
  return value
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

function cleanMoney(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[$,]/g, ''))
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.min(10_000_000, Math.round(n)))
}

function cleanSide(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (raw === 'ask' || raw === 'bid') return raw
  return null
}

function cleanInclude(value: unknown): IncludeFlags {
  const obj = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return {
    recentFlow: cleanBoolean(obj.recentFlow, true),
    flowAlerts: cleanBoolean(obj.flowAlerts, true),
    darkpool: cleanBoolean(obj.darkpool, true),
    marketTide: cleanBoolean(obj.marketTide, false),
  }
}

function cleanLabs(value: unknown): LabKey[] {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  const allowed = new Set<LabKey>(['marketImpact', 'gammaVol', 'newsCatalyst', 'ownershipPressure', 'politicalTape', 'etfTide'])
  const labs: LabKey[] = []
  raw.forEach((item) => {
    const key = typeof item === 'string' ? item.trim() : ''
    if (allowed.has(key as LabKey) && !labs.includes(key as LabKey)) labs.push(key as LabKey)
  })
  return labs.slice(0, 6)
}

function cleanBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (value === 'true') return true
    if (value === 'false') return false
  }
  return fallback
}

function normalizeRecentFlow(raw: unknown): NormalizedFlowRow[] {
  return dataRows(raw)
    .slice(0, 24)
    .map((row) => {
      const callPremium = pickNumber(row, ['call_premium', 'callPremium', 'call_ask_premium'])
      const putPremium = pickNumber(row, ['put_premium', 'putPremium', 'put_ask_premium'])
      return {
        label: pickString(row, ['expiry', 'date', 'ticker']) ?? 'Flow',
        expiry: pickString(row, ['expiry']),
        date: pickString(row, ['date']),
        callPremium,
        putPremium,
        callVolume: pickNumber(row, ['call_volume', 'callVolume']),
        putVolume: pickNumber(row, ['put_volume', 'putVolume']),
        netPremium: callPremium - putPremium,
      }
    })
}

function normalizeFlowAlerts(raw: unknown): NormalizedAlertRow[] {
  return dataRows(raw)
    .slice(0, 40)
    .map((row) => {
      const isCall = pickBoolean(row, ['is_call', 'isCall']) || /call/i.test(pickString(row, ['option_type', 'call_put', 'side']) ?? '')
      const isPut = pickBoolean(row, ['is_put', 'isPut']) || /put/i.test(pickString(row, ['option_type', 'call_put', 'side']) ?? '')
      return {
        id: pickString(row, ['id', 'alert_id']),
        contract: pickString(row, ['option_symbol', 'contract', 'option_contract', 'symbol']),
        rule: pickString(row, ['rule_name', 'rule', 'alert_rule', 'alert_type', 'name']),
        side: isCall ? 'CALL' : isPut ? 'PUT' : 'UNKNOWN',
        sentiment: pickString(row, ['sentiment', 'direction', 'side', 'ask_bid']),
        premium: pickNumber(row, ['total_premium', 'premium', 'cost_basis', 'trade_premium']),
        volume: pickNumber(row, ['volume', 'total_volume', 'size']),
        openInterest: optionalNumber(row, ['open_interest', 'oi']),
        strike: optionalNumber(row, ['strike', 'strike_price']),
        expiry: pickString(row, ['expiry', 'expiration', 'expiration_date']),
        tapeTime: pickString(row, ['tape_time', 'created_at', 'timestamp', 'executed_at']),
      }
    })
    .sort((a, b) => b.premium - a.premium)
}

function normalizeDarkpool(raw: unknown): NormalizedDarkpoolRow[] {
  return dataRows(raw)
    .slice(0, 40)
    .map((row) => ({
      id: pickString(row, ['id', 'tracking_id', 'trade_id']),
      venue: pickString(row, ['exchange', 'venue', 'market_center']),
      price: optionalNumber(row, ['price', 'executed_price']),
      size: pickNumber(row, ['size', 'volume', 'shares']),
      premium: pickNumber(row, ['premium', 'notional', 'total_premium']),
      tapeTime: pickString(row, ['tape_time', 'timestamp', 'executed_at', 'created_at']),
    }))
    .sort((a, b) => b.premium - a.premium)
}

function normalizeMarketTide(raw: unknown): NormalizedTidePoint[] {
  return dataRows(raw)
    .slice(-90)
    .map((row) => {
      const netCallPremium = pickNumber(row, ['net_call_premium', 'net_call_prem'])
      const netPutPremium = pickNumber(row, ['net_put_premium', 'net_put_prem'])
      return {
        timestamp: pickString(row, ['timestamp', 'time', 'date']),
        netCallPremium,
        netPutPremium,
        netPremium: netCallPremium - Math.abs(netPutPremium),
        netVolume: optionalNumber(row, ['net_volume', 'net_vol']),
      }
    })
}

function summarizeLabResults(args: {
  labKeys: LabKey[]
  endpointPlans: EndpointPlan[]
  rawByKey: Record<string, unknown>
  endpointErrors: Record<string, string>
}): LabResult[] {
  return args.labKeys.map((lab) => {
    const plans = args.endpointPlans.filter((plan) => plan.lab === lab)
    const errors = plans.map((plan) => args.endpointErrors[plan.key]).filter(Boolean)
    const highlights = plans.flatMap((plan) => labHighlightsForPlan(plan, args.rawByKey[plan.key])).slice(0, 8)
    const rowCount = plans.reduce((total, plan) => total + compactRows(args.rawByKey[plan.key]).length, 0)
    const hasPayload = plans.some((plan) => Object.prototype.hasOwnProperty.call(args.rawByKey, plan.key))
    const status: LabResult['status'] =
      !hasPayload && errors.length
        ? 'error'
        : rowCount > 0 || highlights.length
          ? errors.length
            ? 'partial'
            : 'ok'
          : errors.length
            ? 'partial'
            : 'empty'

    return {
      key: lab,
      label: LAB_LABELS[lab],
      status,
      endpoints: plans.map((plan) => plan.key),
      rowCount,
      metrics: buildLabMetrics(lab, args.rawByKey),
      highlights,
      errors,
    }
  })
}

function buildLabMetrics(lab: LabKey, rawByKey: Record<string, unknown>): Record<string, string | number | null> {
  if (lab === 'marketImpact') {
    return {
      topImpactRows: compactRows(rawByKey.labTopNetImpact).length,
      oiChangeRows: compactRows(rawByKey.labOiChange).length,
      sectorRows: compactRows(rawByKey.labSectorEtfs).length,
      totalVolumeRows: compactRows(rawByKey.labTotalOptionsVolume).length,
    }
  }
  if (lab === 'gammaVol') {
    return {
      greekExposureRows: compactRows(rawByKey.labGreekExposure).length,
      ivRankRows: compactRows(rawByKey.labIvRank).length,
      maxPainRows: compactRows(rawByKey.labMaxPain).length,
      volatilityRows: compactRows(rawByKey.labVolatilityStats).length + compactRows(rawByKey.labVolatilityTerm).length,
    }
  }
  if (lab === 'newsCatalyst') return { headlines: compactRows(rawByKey.labNews).length }
  if (lab === 'ownershipPressure') {
    return {
      insiderRows: compactRows(rawByKey.labInsiderBuysSells).length,
      ownershipRows: compactRows(rawByKey.labInstitutionalOwnership).length,
      shortRows: compactRows(rawByKey.labShortData).length,
      ftdRows: compactRows(rawByKey.labFailuresToDeliver).length,
    }
  }
  if (lab === 'politicalTape') return { congressionalRows: compactRows(rawByKey.labCongressTicker).length }
  return {
    etfTidePoints: compactRows(rawByKey.labEtfTide).length,
    marketTidePoints: compactRows(rawByKey.labEtfMarketTide).length,
  }
}

function labHighlightsForPlan(plan: EndpointPlan, raw: unknown): LabHighlight[] {
  return compactRows(raw)
    .slice(0, 3)
    .map((row, index) => {
      const title =
        pickString(row, ['headline', 'title', 'ticker', 'symbol', 'company_name', 'name', 'politician', 'representative', 'issuer_name', 'expiry', 'expiration']) ??
        `${plan.label} ${index + 1}`
      const meta = [
        plan.label,
        pickString(row, ['source', 'source_name', 'transaction_type', 'sentiment', 'direction', 'side']),
        pickString(row, ['date', 'transaction_date', 'report_date', 'published_at', 'created_at', 'timestamp', 'expiry', 'expiration']),
      ]
        .filter(Boolean)
        .join(' | ')
      return {
        title,
        meta,
        value: pickLabValue(row),
      }
    })
}

function compactRows(raw: unknown): Record<string, unknown>[] {
  const rows = dataRows(raw)
  if (rows.length) return rows
  if (isRecord(raw) && isRecord(raw.data)) return [raw.data]
  if (isRecord(raw)) return [raw]
  return []
}

function pickLabValue(row: Record<string, unknown>): string | undefined {
  const moneyKeys = [
    'net_premium',
    'net_call_premium',
    'net_put_premium',
    'premium',
    'total_premium',
    'amount',
    'value',
    'market_value',
    'notional',
  ]
  for (const key of moneyKeys) {
    const value = optionalNumber(row, [key])
    if (value != null) return money(value)
  }

  const percentKeys = ['iv_rank', 'iv_percentile', 'short_interest_pct_float', 'short_volume_ratio', 'percent_of_float']
  for (const key of percentKeys) {
    const value = optionalNumber(row, [key])
    if (value != null) return `${value.toFixed(value >= 10 ? 0 : 1)}%`
  }

  const numberKeys = ['volume', 'open_interest', 'shares', 'short_interest', 'days_to_cover', 'gamma_exposure', 'call_volume', 'put_volume']
  for (const key of numberKeys) {
    const value = optionalNumber(row, [key])
    if (value != null) return formatCount(value)
  }

  return undefined
}

function deriveMetrics(args: {
  flowRows: NormalizedFlowRow[]
  alertRows: NormalizedAlertRow[]
  darkpoolRows: NormalizedDarkpoolRow[]
  marketTide: NormalizedTidePoint[]
}): WhalesMetrics {
  const flowCallPremium = sum(args.flowRows.map((row) => row.callPremium))
  const flowPutPremium = sum(args.flowRows.map((row) => row.putPremium))
  const alertCallPremium = sum(args.alertRows.filter((row) => row.side === 'CALL').map((row) => row.premium))
  const alertPutPremium = sum(args.alertRows.filter((row) => row.side === 'PUT').map((row) => row.premium))
  const callPremium = flowCallPremium + alertCallPremium
  const putPremium = flowPutPremium + alertPutPremium
  const netOptionsPremium = callPremium - putPremium
  const darkpoolPremium = sum(args.darkpoolRows.map((row) => row.premium))
  const marketTideNetPremium = args.marketTide.length ? args.marketTide[args.marketTide.length - 1].netPremium : null
  const directional = marketTideNetPremium ?? netOptionsPremium
  const activity = callPremium + putPremium + darkpoolPremium
  return {
    flowCount: args.flowRows.length,
    alertCount: args.alertRows.length,
    darkpoolCount: args.darkpoolRows.length,
    callPremium,
    putPremium,
    netOptionsPremium,
    darkpoolPremium,
    largestAlertPremium: Math.max(0, ...args.alertRows.map((row) => row.premium)),
    largestDarkpoolPremium: Math.max(0, ...args.darkpoolRows.map((row) => row.premium)),
    marketTideNetPremium,
    bias: activity <= 0 ? 'quiet' : directional > activity * 0.08 ? 'bullish' : directional < -activity * 0.08 ? 'bearish' : 'mixed',
  }
}

function buildWhalesPrompt(args: {
  symbol: string
  metrics: WhalesMetrics
  alertRows: NormalizedAlertRow[]
  darkpoolRows: NormalizedDarkpoolRow[]
  marketTide: NormalizedTidePoint[]
}): string {
  const topAlert = args.alertRows[0]
  const topDarkpool = args.darkpoolRows[0]
  const tide = args.metrics.marketTideNetPremium
  return [
    `${args.symbol} SeekBox Whales Edition read: use the whale-flow snapshot below as private context, then compare it against current X/web narratives and company news.`,
    `Bias: ${args.metrics.bias}. Options net premium: ${money(args.metrics.netOptionsPremium)}. Calls: ${money(args.metrics.callPremium)}. Puts: ${money(args.metrics.putPremium)}.`,
    `Dark pool total: ${money(args.metrics.darkpoolPremium)} across ${args.metrics.darkpoolCount} prints.`,
    topAlert
      ? `Largest alert: ${topAlert.side ?? 'UNKNOWN'} ${topAlert.contract ?? 'contract'} ${money(topAlert.premium)} ${topAlert.rule ? `(${topAlert.rule})` : ''}.`
      : 'Largest alert: none returned.',
    topDarkpool ? `Largest dark pool print: ${money(topDarkpool.premium)} at ${topDarkpool.price ?? 'unknown price'}.` : 'Largest dark pool print: none returned.',
    tide != null ? `Market tide latest net: ${money(tide)}.` : 'Market tide not included.',
    'Answer in sections: whale tape, confirming public narrative, contradiction/risk, and what to watch next. Do not give financial advice.',
  ].join('\n')
}

function buildLabPrompt(args: { symbol: string; labs: LabResult[] }): string {
  const lines = args.labs.map((lab) => {
    const highlights = lab.highlights
      .slice(0, 3)
      .map((item) => `${item.title}${item.value ? ` (${item.value})` : ''}`)
      .join('; ')
    return `${lab.label}: ${lab.status}, ${lab.rowCount} normalized rows${highlights ? `; ${highlights}` : ''}.`
  })
  return [
    `${args.symbol} UW Lab context: compare these private endpoint reads against public market/X narratives and explain which sources are useful enough to productize.`,
    ...lines,
    'Respect the provider license posture: do not redistribute raw or derived provider data publicly.',
  ].join('\n')
}

function dataRows(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw.filter(isRecord)
  if (!isRecord(raw)) return []
  const data = raw.data
  if (Array.isArray(data)) return data.filter(isRecord)
  if (isRecord(data) && Array.isArray(data.data)) return data.data.filter(isRecord)
  for (const value of Object.values(raw)) {
    if (Array.isArray(value)) return value.filter(isRecord)
  }
  return []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function pickString(raw: unknown, keys: string[]): string | undefined {
  if (!isRecord(raw)) return undefined
  for (const key of keys) {
    const value = raw[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return undefined
}

function pickNumber(raw: unknown, keys: string[]): number {
  return optionalNumber(raw, keys) ?? 0
}

function optionalNumber(raw: unknown, keys: string[]): number | undefined {
  if (!isRecord(raw)) return undefined
  for (const key of keys) {
    const value = raw[key]
    const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.replace(/[$,%]/g, '')) : Number.NaN
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function pickBoolean(raw: unknown, keys: string[]): boolean {
  if (!isRecord(raw)) return false
  for (const key of keys) {
    const value = raw[key]
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      if (value.toLowerCase() === 'true') return true
      if (value.toLowerCase() === 'false') return false
    }
  }
  return false
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0)
}

function money(value: number): string {
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`
  return `${sign}$${abs.toFixed(0)}`
}

function formatCount(value: number): string {
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`
  return `${sign}${abs.toFixed(0)}`
}
