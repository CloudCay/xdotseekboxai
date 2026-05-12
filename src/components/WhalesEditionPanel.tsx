import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, BarChart3, Database, FlaskConical, KeyRound, Lock, RefreshCw, ShieldCheck } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

const API_KEY_STORAGE_KEY = 'seekbox_whales_unusual_whales_api_key_v1'
const REMEMBER_STORAGE_KEY = 'seekbox_whales_remember_key_v1'

const WHALE_BOARD_SYMBOLS: WhaleBoardSymbol[] = [
  {
    symbol: 'OKE',
    label: 'ONEOK',
    description: 'Energy midstream flow',
    sortOrder: 10,
    minPremium: 100_000,
    include: { recentFlow: true, flowAlerts: true, darkpool: true, marketTide: false },
  },
  {
    symbol: 'AAPL',
    label: 'Apple',
    description: 'Mega-cap single name',
    sortOrder: 20,
    minPremium: 500_000,
    include: { recentFlow: true, flowAlerts: true, darkpool: true, marketTide: false },
  },
  {
    symbol: 'SPY',
    label: 'SPY',
    description: 'Index ETF tape',
    sortOrder: 30,
    minPremium: 1_000_000,
    include: { recentFlow: true, flowAlerts: true, darkpool: true, marketTide: true },
  },
  {
    symbol: 'VIX',
    label: 'VIX',
    description: 'Volatility regime',
    sortOrder: 40,
    minPremium: 250_000,
    include: { recentFlow: false, flowAlerts: true, darkpool: false, marketTide: true },
  },
]

const UW_LAB_PACKS: Array<{ key: LabKey; label: string; description: string }> = [
  { key: 'marketImpact', label: 'Market impact', description: 'Top net impact, OI change, sectors, total options volume' },
  { key: 'gammaVol', label: 'Gamma/vol', description: 'GEX, IV rank, max pain, volatility shape' },
  { key: 'newsCatalyst', label: 'News', description: 'Ticker headlines for catalyst checks' },
  { key: 'ownershipPressure', label: 'Ownership', description: 'Insider, institution, short, and FTD pressure' },
  { key: 'politicalTape', label: 'Political', description: 'Congressional unusual trades when available' },
  { key: 'etfTide', label: 'ETF tide', description: 'ETF-specific tide against market tide' },
]

type LabKey = 'marketImpact' | 'gammaVol' | 'newsCatalyst' | 'ownershipPressure' | 'politicalTape' | 'etfTide'

type WhaleBoardSymbol = {
  symbol: string
  label: string
  description: string
  sortOrder?: number
  minPremium: number
  include: IncludeFlags
}

type IncludeFlags = {
  recentFlow: boolean
  flowAlerts: boolean
  darkpool: boolean
  marketTide: boolean
}

type WhalesPayload = {
  symbol: string
  fetchedAt: string
  keySource?: 'user' | 'server'
  endpoints: string[]
  errors: string[]
  metrics: {
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
  recentFlow: Array<{
    label: string
    expiry?: string
    date?: string
    callPremium: number
    putPremium: number
    callVolume: number
    putVolume: number
    netPremium: number
  }>
  flowAlerts: Array<{
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
  }>
  darkpool: Array<{
    id?: string
    venue?: string
    price?: number
    size: number
    premium: number
    tapeTime?: string
  }>
  marketTide: Array<{
    timestamp?: string
    netCallPremium: number
    netPutPremium: number
    netPremium: number
    netVolume?: number
  }>
  labs?: Array<{
    key: LabKey
    label: string
    status: 'ok' | 'partial' | 'empty' | 'error'
    endpoints: string[]
    rowCount: number
    metrics: Record<string, string | number | null>
    highlights: Array<{
      title: string
      meta?: string
      value?: string
    }>
    errors: string[]
  }>
  labPrompt?: string
  prompt: string
  source?: { name?: string; docs?: string }
}

type BoardSnapshotState = {
  loading: boolean
  payload: WhalesPayload | null
  error: string | null
  updatedAt: string | null
}

export function WhalesEditionPanel({
  symbol,
  onFillPrompt,
}: {
  symbol: string
  onFillPrompt: (prompt: string) => void
}) {
  const [activeSymbol, setActiveSymbol] = useState<string>(() => normalizeWhaleSymbol(symbol) || 'NVDA')
  const [apiKey, setApiKey] = useState<string>('')
  const [rememberKey, setRememberKey] = useState<boolean>(false)
  const [showKey, setShowKey] = useState<boolean>(false)
  const [minPremium, setMinPremium] = useState<string>('250000')
  const [side, setSide] = useState<'all' | 'ask' | 'bid'>('all')
  const [include, setInclude] = useState<IncludeFlags>({
    recentFlow: true,
    flowAlerts: true,
    darkpool: true,
    marketTide: false,
  })
  const [loading, setLoading] = useState<boolean>(false)
  const [boardLoading, setBoardLoading] = useState<boolean>(false)
  const [labLoading, setLabLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<WhalesPayload | null>(null)
  const [boardSnapshots, setBoardSnapshots] = useState<Record<string, BoardSnapshotState>>({})
  const [watchlistSymbols, setWatchlistSymbols] = useState<WhaleBoardSymbol[]>(WHALE_BOARD_SYMBOLS)
  const [selectedLabs, setSelectedLabs] = useState<Record<LabKey, boolean>>({
    marketImpact: true,
    gammaVol: true,
    newsCatalyst: false,
    ownershipPressure: false,
    politicalTape: false,
    etfTide: false,
  })

  useEffect(() => {
    const next = normalizeWhaleSymbol(symbol)
    if (next) setActiveSymbol(next)
  }, [symbol])

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('uw_symbols')
        .select('symbol, display_name, profile, default_min_premium, default_include, sort_order')
        .eq('is_seeded', true)
        .order('sort_order', { ascending: true })
      if (cancelled || error || !Array.isArray(data) || !data.length) return
      const symbols = data.map(mapWatchlistRow).filter(Boolean) as WhaleBoardSymbol[]
      if (symbols.length) setWatchlistSymbols(symbols)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const remembered = window.localStorage.getItem(REMEMBER_STORAGE_KEY) === 'true'
    setRememberKey(remembered)
    if (remembered) setApiKey(window.localStorage.getItem(API_KEY_STORAGE_KEY) ?? '')
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(REMEMBER_STORAGE_KEY, rememberKey ? 'true' : 'false')
    if (rememberKey && apiKey.trim()) {
      window.localStorage.setItem(API_KEY_STORAGE_KEY, apiKey.trim())
    } else if (!rememberKey) {
      window.localStorage.removeItem(API_KEY_STORAGE_KEY)
    }
  }, [apiKey, rememberKey])

  const requestSnapshot = useCallback(async (args: { symbol: string; include?: IncludeFlags; minPremium?: number | string; labs?: LabKey[] }) => {
    const requestSymbol = normalizeWhaleSymbol(args.symbol) || 'NVDA'
    const ownKey = apiKey.trim()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (!ownKey && isSupabaseConfigured && supabase) {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (token) headers.Authorization = `Bearer ${token}`
    }
    const response = await fetch('/api/unusual-whales', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        apiKey: ownKey || undefined,
        symbol: requestSymbol,
        minPremium: args.minPremium ?? minPremium,
        side: side === 'all' ? null : side,
        include: args.include ?? include,
        labs: args.labs ?? [],
      }),
    })
    const json = (await response.json()) as { error?: string } & WhalesPayload
    if (!response.ok) throw new Error(json.error || `HTTP ${response.status}`)
    return json
  }, [apiKey, include, minPremium, side])

  const cleanSymbol = activeSymbol

  const loadSnapshot = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const json = await requestSnapshot({ symbol: cleanSymbol })
      setPayload(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load whale flow.')
    } finally {
      setLoading(false)
    }
  }, [cleanSymbol, requestSnapshot])

  const loadBoardSnapshot = useCallback(async (profile: WhaleBoardSymbol) => {
    setBoardSnapshots((current) => ({
      ...current,
      [profile.symbol]: {
        loading: true,
        payload: current[profile.symbol]?.payload ?? null,
        error: null,
        updatedAt: current[profile.symbol]?.updatedAt ?? null,
      },
    }))
    try {
      const json = await requestSnapshot({
        symbol: profile.symbol,
        include: profile.include,
        minPremium: profile.minPremium,
      })
      setBoardSnapshots((current) => ({
        ...current,
        [profile.symbol]: { loading: false, payload: json, error: null, updatedAt: new Date().toISOString() },
      }))
      if (profile.symbol === cleanSymbol) setPayload(json)
      return json
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load whale flow.'
      setBoardSnapshots((current) => ({
        ...current,
        [profile.symbol]: {
          loading: false,
          payload: current[profile.symbol]?.payload ?? null,
          error: message,
          updatedAt: current[profile.symbol]?.updatedAt ?? null,
        },
      }))
      return null
    }
  }, [cleanSymbol, requestSnapshot])

  const loadBoard = useCallback(async () => {
    setBoardLoading(true)
    try {
      for (const profile of watchlistSymbols) {
        await loadBoardSnapshot(profile)
      }
    } finally {
      setBoardLoading(false)
    }
  }, [loadBoardSnapshot, watchlistSymbols])

  const biasTone = payload?.metrics.bias ?? 'quiet'
  const tapeRead = useMemo(() => deriveTapeRead(payload), [payload])
  const selectedLabKeys = useMemo(() => UW_LAB_PACKS.filter((pack) => selectedLabs[pack.key]).map((pack) => pack.key), [selectedLabs])
  const watchlistText = useMemo(() => watchlistSymbols.map((profile) => profile.label).join(', '), [watchlistSymbols])
  const hasUserKey = apiKey.trim().length > 0

  const runLab = useCallback(async () => {
    if (!selectedLabKeys.length) return
    setLabLoading(true)
    setError(null)
    try {
      const json = await requestSnapshot({ symbol: cleanSymbol, labs: selectedLabKeys })
      setPayload(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load UW lab.')
    } finally {
      setLabLoading(false)
    }
  }, [cleanSymbol, requestSnapshot, selectedLabKeys])

  return (
    <div className="rounded-3xl border border-slate-700/60 bg-[#0A1128]/70 p-4 backdrop-blur-2xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-100">
            <Database className="h-3.5 w-3.5" />
            X.SeekBoxAI Whales Edition
          </div>
          <div className="mt-2 text-lg font-black text-slate-100">{cleanSymbol} tape scanner</div>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">
            Connect your own Unusual Whales key for BYOK whale-flow reads, or use hosted X.SeekBoxAI access when your
            role allows it.
          </p>
        </div>
        <div className={`rounded-2xl border px-3 py-2 text-center ${biasClass(biasTone)}`}>
          <div className="text-[10px] font-black uppercase tracking-widest">Bias</div>
          <div className="text-sm font-black capitalize">{biasTone}</div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="rounded-2xl border border-cyan-400/25 bg-cyan-400/10 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-cyan-100">
                <KeyRound className="h-3.5 w-3.5" />
                Connect your own Unusual Whales
              </div>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-300">
                Paste your personal UW API key to run this page against your plan. X.SeekBoxAI does not save the key
                unless you choose to remember it on this device.
              </p>
            </div>
            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
              hasUserKey
                ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-100'
                : 'border-slate-600/70 bg-slate-900/45 text-slate-300'
            }`}>
              {hasUserKey ? 'Connected' : 'BYOK'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (typeof document !== 'undefined') document.getElementById('seekbox-whales-api-key')?.focus()
            }}
            className="mt-3 rounded-xl border border-cyan-400/35 bg-slate-950/30 px-3 py-2 text-[11px] font-black text-cyan-100 hover:bg-cyan-400/10"
          >
            {hasUserKey ? 'Manage key' : 'Connect key'}
          </button>
        </div>

        <label className="block">
          <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
            <KeyRound className="h-3.5 w-3.5" />
            Your Unusual Whales API key
          </span>
          <div className="mt-1 flex gap-2">
            <input
              id="seekbox-whales-api-key"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              type={showKey ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              placeholder="Paste your UW API key"
              className="min-w-0 flex-1 rounded-2xl border border-slate-700 bg-slate-950/45 px-3 py-2 text-sm font-semibold text-slate-100 outline-none focus:border-cyan-400/50"
            />
            <button
              type="button"
              onClick={() => setShowKey((next) => !next)}
              className="rounded-2xl border border-slate-700 bg-slate-900/40 px-3 py-2 text-[11px] font-black text-slate-200 hover:border-slate-500"
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Min premium</span>
            <input
              value={minPremium}
              onChange={(event) => setMinPremium(event.target.value.replace(/[^\d]/g, ''))}
              inputMode="numeric"
              className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/45 px-3 py-2 text-sm font-black text-slate-100 outline-none focus:border-cyan-400/50"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Side</span>
            <select
              value={side}
              onChange={(event) => setSide(event.target.value as 'all' | 'ask' | 'bid')}
              className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/45 px-3 py-2 text-sm font-black text-slate-100 outline-none focus:border-cyan-400/50"
            >
              <option value="all">All</option>
              <option value="ask">Ask side</option>
              <option value="bid">Bid side</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Toggle label="Recent flow" checked={include.recentFlow} onChange={(checked) => setInclude((next) => ({ ...next, recentFlow: checked }))} />
          <Toggle label="Flow alerts" checked={include.flowAlerts} onChange={(checked) => setInclude((next) => ({ ...next, flowAlerts: checked }))} />
          <Toggle label="Dark pool" checked={include.darkpool} onChange={(checked) => setInclude((next) => ({ ...next, darkpool: checked }))} />
          <Toggle label="Market tide" checked={include.marketTide} onChange={(checked) => setInclude((next) => ({ ...next, marketTide: checked }))} />
        </div>

        <label className="flex items-center gap-2 rounded-2xl border border-slate-700/70 bg-black/20 px-3 py-2 text-xs font-semibold text-slate-300">
          <input
            type="checkbox"
            checked={rememberKey}
            onChange={(event) => setRememberKey(event.target.checked)}
            className="h-4 w-4 accent-cyan-400"
          />
          Remember this key on this device only
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadSnapshot()}
            disabled={loading}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-3 py-2 text-sm font-black text-[#050B14] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
            Load whale snapshot
          </button>
          <button
            type="button"
            onClick={() => {
              setApiKey('')
              setRememberKey(false)
              if (typeof window !== 'undefined') window.localStorage.removeItem(API_KEY_STORAGE_KEY)
            }}
            className="rounded-2xl border border-slate-700 bg-slate-900/35 px-3 py-2 text-[11px] font-black text-slate-200 hover:border-slate-500"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-700/60 bg-black/20 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Whale board</div>
            <div className="mt-1 text-xs font-semibold leading-5 text-slate-400">
              Public watchlist: {watchlistText}.
            </div>
          </div>
          <button
            type="button"
            disabled={boardLoading}
            onClick={() => void loadBoard()}
            className="shrink-0 rounded-2xl border border-cyan-400/35 bg-cyan-400/10 px-3 py-2 text-[11px] font-black text-cyan-100 hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {boardLoading ? 'Loading' : 'Load board'}
          </button>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {watchlistSymbols.map((profile) => {
            const state = boardSnapshots[profile.symbol]
            const metrics = state?.payload?.metrics ?? null
            const isActive = profile.symbol === cleanSymbol
            return (
              <div
                key={profile.symbol}
                className={`rounded-2xl border p-3 ${
                  isActive
                    ? 'border-cyan-400/45 bg-cyan-400/10'
                    : 'border-slate-700/70 bg-slate-950/30'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSymbol(profile.symbol)
                      if (state?.payload) setPayload(state.payload)
                    }}
                    className="min-w-0 text-left"
                  >
                    <div className="text-sm font-black text-slate-100">
                      {profile.label}
                      <span className="text-slate-500"> / {profile.symbol}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] font-semibold text-slate-400">{profile.description}</div>
                  </button>
                  <button
                    type="button"
                    disabled={state?.loading}
                    onClick={() => void loadBoardSnapshot(profile)}
                    className="shrink-0 rounded-xl border border-slate-700 bg-slate-900/45 px-2.5 py-1 text-[10px] font-black text-slate-200 hover:border-cyan-400/35 disabled:opacity-60"
                  >
                    {state?.loading ? '...' : 'Load'}
                  </button>
                </div>
                {state?.error ? (
                  <div className="mt-2 text-[10px] leading-4 text-amber-200">{state.error}</div>
                ) : metrics ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <MiniMetric label="Bias" value={metrics.bias} />
                    <MiniMetric label="Net" value={formatMoney(metrics.netOptionsPremium)} />
                    <MiniMetric label="Alerts" value={String(metrics.alertCount)} />
                    <MiniMetric label="Dark" value={formatMoney(metrics.darkpoolPremium)} />
                  </div>
                ) : (
                  <div className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                    Waiting for snapshot
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-700/60 bg-black/20 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
              <FlaskConical className="h-3.5 w-3.5" />
              UW Lab
            </div>
            <div className="mt-1 text-xs font-semibold leading-5 text-slate-400">
              Over-sample endpoint packs for product discovery, then keep only the reads worth paying for.
            </div>
          </div>
          <button
            type="button"
            disabled={labLoading || !selectedLabKeys.length}
            onClick={() => void runLab()}
            className="shrink-0 rounded-2xl border border-emerald-400/35 bg-emerald-400/10 px-3 py-2 text-[11px] font-black text-emerald-100 hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {labLoading ? 'Running' : `Run ${selectedLabKeys.length}`}
          </button>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {UW_LAB_PACKS.map((pack) => (
            <LabPackToggle
              key={pack.key}
              label={pack.label}
              description={pack.description}
              checked={selectedLabs[pack.key]}
              onChange={(checked) => setSelectedLabs((next) => ({ ...next, [pack.key]: checked }))}
            />
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setSelectedLabs({
              marketImpact: true,
              gammaVol: true,
              newsCatalyst: true,
              ownershipPressure: true,
              politicalTape: true,
              etfTide: true,
            })}
            className="rounded-xl border border-slate-700 bg-slate-900/45 px-2.5 py-1.5 text-[10px] font-black text-slate-200 hover:border-cyan-400/35"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={() => setSelectedLabs({
              marketImpact: true,
              gammaVol: true,
              newsCatalyst: false,
              ownershipPressure: false,
              politicalTape: false,
              etfTide: false,
            })}
            className="rounded-xl border border-slate-700 bg-slate-900/45 px-2.5 py-1.5 text-[10px] font-black text-slate-200 hover:border-cyan-400/35"
          >
            Core only
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100">
          {error}
        </div>
      ) : null}

      {payload ? (
        <div className="mt-5 space-y-4">
          {payload.errors.length ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] leading-5 text-amber-100">
              {payload.errors.slice(0, 3).join(' | ')}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <MetricCard label="Calls" value={formatMoney(payload.metrics.callPremium)} />
            <MetricCard label="Puts" value={formatMoney(payload.metrics.putPremium)} />
            <MetricCard label="Dark pool" value={formatMoney(payload.metrics.darkpoolPremium)} />
            <MetricCard label="Alerts" value={String(payload.metrics.alertCount)} />
          </div>

          <div className="rounded-2xl border border-slate-700/60 bg-black/20 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">Options pressure</div>
              <div className="text-[11px] font-black text-slate-300">{formatMoney(payload.metrics.netOptionsPremium)} net</div>
            </div>
            <SplitBar left={payload.metrics.callPremium} right={payload.metrics.putPremium} leftLabel="Call" rightLabel="Put" />
          </div>

          {payload.marketTide.length ? (
            <div className="rounded-2xl border border-slate-700/60 bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Market tide
                </div>
                <div className="text-[11px] font-black text-slate-300">
                  {formatMoney(payload.metrics.marketTideNetPremium ?? 0)}
                </div>
              </div>
              <TideSparkline points={payload.marketTide.map((point) => point.netPremium)} />
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-700/60 bg-black/20 p-3">
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">X.SeekBoxAI read</div>
            <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
              Key mode: {payload.keySource === 'server' ? 'X.SeekBoxAI hosted' : 'User supplied'}
            </div>
            <div className="mt-2 space-y-2">
              {tapeRead.map((item) => (
                <div key={item} className="text-xs leading-5 text-slate-300">
                  {item}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onFillPrompt(payload.prompt)}
              className="mt-3 w-full rounded-2xl border border-emerald-400/35 bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-100 hover:bg-emerald-400/15"
            >
              Fill X/web pulse prompt
            </button>
          </div>

          {payload.labs?.length ? (
            <div className="rounded-2xl border border-slate-700/60 bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                  <FlaskConical className="h-3.5 w-3.5" />
                  UW Lab results
                </div>
                <div className="text-[11px] font-black text-slate-300">{payload.labs.length} packs</div>
              </div>
              <div className="space-y-2">
                {payload.labs.map((lab) => (
                  <div key={lab.key} className="rounded-xl border border-slate-800/90 bg-slate-950/30 px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-black text-slate-100">{lab.label}</div>
                        <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                          {lab.status} | {lab.rowCount} normalized rows
                        </div>
                      </div>
                      <div className="shrink-0 text-[10px] font-black text-cyan-100">{lab.endpoints.length} endpoints</div>
                    </div>
                    {lab.highlights.length ? (
                      <div className="mt-2 space-y-1.5">
                        {lab.highlights.slice(0, 3).map((item) => (
                          <div key={`${lab.key}:${item.title}:${item.value ?? item.meta}`} className="flex items-start justify-between gap-3 text-[11px] leading-4">
                            <div className="min-w-0">
                              <div className="truncate font-black text-slate-200">{item.title}</div>
                              <div className="truncate text-slate-500">{item.meta ?? 'No metadata'}</div>
                            </div>
                            {item.value ? <div className="shrink-0 font-black text-slate-200">{item.value}</div> : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 text-[11px] text-slate-500">
                        {lab.errors[0] ?? 'No rows returned for this pack.'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <ResultList title="Flow alerts" empty="No flow alerts returned." rows={payload.flowAlerts.slice(0, 5).map((row) => ({
            key: row.id ?? `${row.contract}:${row.premium}:${row.tapeTime}`,
            title: `${row.side ?? 'UNKNOWN'} ${row.contract ?? 'contract'}`,
            meta: [row.rule, row.expiry, row.tapeTime ? shortTime(row.tapeTime) : null].filter(Boolean).join(' | '),
            value: formatMoney(row.premium),
          }))} />

          <ResultList title="Dark pool" empty="No dark pool prints returned." rows={payload.darkpool.slice(0, 5).map((row) => ({
            key: row.id ?? `${row.price}:${row.size}:${row.tapeTime}`,
            title: `${formatNumber(row.size)} shares${row.price ? ` at ${formatPrice(row.price)}` : ''}`,
            meta: [row.venue, row.tapeTime ? shortTime(row.tapeTime) : null].filter(Boolean).join(' | '),
            value: formatMoney(row.premium),
          }))} />

          <div className="flex items-start gap-2 rounded-2xl border border-slate-700/70 bg-slate-950/35 px-3 py-2 text-[11px] leading-5 text-slate-400">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
            <span>
              Third-party data. Hosted-key usage should move behind role quotas before wider release. This is a
              research surface, not financial advice.
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-slate-700/60 bg-black/20 p-3">
          <div className="flex items-center gap-2 text-xs font-black text-slate-200">
            <Lock className="h-4 w-4 text-cyan-300" />
            Bring your own UW key
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            Hosted mode reads `UW_API_KEY` from Netlify for approved X.SeekBoxAI users. Everyone else can connect their
            own Unusual Whales key and keep usage tied to their UW account.
          </p>
        </div>
      )}
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 rounded-2xl border border-slate-700/70 bg-black/20 px-3 py-2 text-[11px] font-black text-slate-300">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-cyan-400" />
    </label>
  )
}

function LabPackToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className={`block rounded-2xl border p-3 ${checked ? 'border-emerald-400/35 bg-emerald-400/10' : 'border-slate-700/70 bg-slate-950/30'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-black text-slate-100">{label}</div>
          <div className="mt-0.5 text-[10px] leading-4 text-slate-500">{description}</div>
        </div>
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-400" />
      </div>
    </label>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800/90 bg-black/20 px-2 py-1.5">
      <div className="text-[9px] font-black uppercase tracking-widest text-slate-600">{label}</div>
      <div className="mt-0.5 truncate text-[11px] font-black capitalize text-slate-200">{value}</div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-700/60 bg-black/20 p-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-black text-slate-100">{value}</div>
    </div>
  )
}

function SplitBar({ left, right, leftLabel, rightLabel }: { left: number; right: number; leftLabel: string; rightLabel: string }) {
  const total = Math.max(1, Math.abs(left) + Math.abs(right))
  const leftPct = Math.max(8, Math.round((Math.abs(left) / total) * 100))
  const rightPct = Math.max(8, 100 - leftPct)
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-800">
        <div className="bg-emerald-400" style={{ width: `${leftPct}%` }} />
        <div className="bg-rose-400" style={{ width: `${rightPct}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-[11px] font-black text-slate-400">
        <span>{leftLabel} {formatMoney(left)}</span>
        <span>{rightLabel} {formatMoney(right)}</span>
      </div>
    </div>
  )
}

function TideSparkline({ points }: { points: number[] }) {
  const path = useMemo(() => sparkPath(points), [points])
  return (
    <svg viewBox="0 0 180 54" className="h-16 w-full overflow-visible" role="img" aria-label="Market tide sparkline">
      <line x1="0" y1="27" x2="180" y2="27" stroke="rgba(148,163,184,0.35)" strokeDasharray="4 4" />
      <path d={path} fill="none" stroke="rgb(34,211,238)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ResultList({
  title,
  empty,
  rows,
}: {
  title: string
  empty: string
  rows: Array<{ key: string; title: string; meta: string; value: string }>
}) {
  return (
    <div className="rounded-2xl border border-slate-700/60 bg-black/20 p-3">
      <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">{title}</div>
      {rows.length ? (
        <div className="mt-2 space-y-2">
          {rows.map((row) => (
            <div key={row.key} className="rounded-xl border border-slate-800/90 bg-slate-950/30 px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-xs font-black text-slate-100">{row.title}</div>
                  <div className="mt-0.5 truncate text-[10px] text-slate-500">{row.meta || 'No timestamp'}</div>
                </div>
                <div className="shrink-0 text-xs font-black text-cyan-100">{row.value}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2 text-xs text-slate-400">{empty}</div>
      )}
    </div>
  )
}

function deriveTapeRead(payload: WhalesPayload | null): string[] {
  if (!payload) return []
  const topAlert = payload.flowAlerts[0]
  const topDark = payload.darkpool[0]
  const out = [
    `Options read: ${payload.metrics.bias} tape with ${formatMoney(payload.metrics.netOptionsPremium)} net options premium.`,
    `Dark pool: ${formatMoney(payload.metrics.darkpoolPremium)} total across ${payload.metrics.darkpoolCount} prints.`,
  ]
  if (topAlert) out.push(`Top alert: ${topAlert.side ?? 'UNKNOWN'} ${topAlert.contract ?? 'contract'} for ${formatMoney(topAlert.premium)}.`)
  if (topDark) out.push(`Top dark print: ${formatMoney(topDark.premium)}${topDark.price ? ` at ${formatPrice(topDark.price)}` : ''}.`)
  if (payload.metrics.marketTideNetPremium != null) out.push(`Market tide latest net is ${formatMoney(payload.metrics.marketTideNetPremium)}.`)
  return out
}

function biasClass(bias: WhalesPayload['metrics']['bias']): string {
  if (bias === 'bullish') return 'border-emerald-400/35 bg-emerald-400/10 text-emerald-100'
  if (bias === 'bearish') return 'border-rose-400/35 bg-rose-400/10 text-rose-100'
  if (bias === 'mixed') return 'border-amber-400/35 bg-amber-400/10 text-amber-100'
  return 'border-slate-600/70 bg-slate-900/40 text-slate-300'
}

function sparkPath(points: number[]): string {
  if (!points.length) return 'M0 27 L180 27'
  const maxAbs = Math.max(1, ...points.map((point) => Math.abs(point)))
  return points
    .map((point, index) => {
      const x = points.length === 1 ? 0 : (index / (points.length - 1)) * 180
      const y = 27 - (point / maxAbs) * 24
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

function formatMoney(value: number): string {
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`
  return `${sign}$${abs.toFixed(0)}`
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
}

function shortTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function mapWatchlistRow(row: unknown): WhaleBoardSymbol | null {
  if (!row || typeof row !== 'object') return null
  const record = row as Record<string, unknown>
  const symbol = normalizeWhaleSymbol(String(record.symbol ?? ''))
  if (!symbol) return null
  return {
    symbol,
    label: String(record.display_name ?? symbol),
    description: String(record.profile ?? 'Public watchlist symbol'),
    sortOrder: typeof record.sort_order === 'number' ? record.sort_order : Number(record.sort_order ?? 100),
    minPremium: typeof record.default_min_premium === 'number' ? record.default_min_premium : Number(record.default_min_premium ?? 250_000),
    include: normalizeIncludeFlags(record.default_include),
  }
}

function normalizeIncludeFlags(value: unknown): IncludeFlags {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
  return {
    recentFlow: typeof record.recentFlow === 'boolean' ? record.recentFlow : true,
    flowAlerts: typeof record.flowAlerts === 'boolean' ? record.flowAlerts : true,
    darkpool: typeof record.darkpool === 'boolean' ? record.darkpool : true,
    marketTide: typeof record.marketTide === 'boolean' ? record.marketTide : false,
  }
}

function normalizeWhaleSymbol(value: string): string {
  const raw = value.trim().replace(/^\$/, '').toUpperCase()
  if (!raw) return ''
  if (raw === 'ONEOK') return 'OKE'
  if (raw === '^VIX' || raw === '.VIX' || raw === 'VIX.X') return 'VIX'
  return raw
}
