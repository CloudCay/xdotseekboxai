import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Clock3,
  ExternalLink,
  Flame,
  LineChart,
  Newspaper,
  Search,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { getIndustryPage } from '../lib/industryCatalog'
import { SeekBoxLogo } from './SeekBoxLogo'

type PulseCitation = {
  index?: number | null
  url?: string | null
}

type PulseToolCall = {
  name?: string | null
  status?: string | null
}

type PulseRow = {
  id: string
  scope_type: string | null
  scope_value: string | null
  window_label: string | null
  from_date: string | null
  to_date: string | null
  handles: string[] | null
  query_used: string | null
  summary: string | null
  citations: PulseCitation[] | null
  tool_calls: PulseToolCall[] | null
  cost_usd: number | null
  latency_ms: number | null
  tags: string[] | null
  metadata: Record<string, unknown> | null
  status: string | null
  error: string | null
  created_at: string
}

type Mood = 'optimistic' | 'mixed' | 'critical' | 'neutral'
type DataSource = 'api' | 'browser' | 'sample'

type DerivedPulse = {
  row: PulseRow
  scopeKey: string
  scopeLabel: string
  lane: string
  headline: string
  dek: string
  why: string
  mood: Mood
  heat: number
  novelty: number
  dissent: number
  citationCount: number
  toolCallCount: number
  costUsd: number
  latencyMs: number
  handles: string[]
  tags: string[]
  sections: string[]
  spark: number[]
}

const FALLBACK_ROWS: PulseRow[] = [
  {
    id: 'mock-tech-saas',
    scope_type: 'industry',
    scope_value: 'tech-saas',
    window_label: '7d',
    from_date: '2026-05-03',
    to_date: '2026-05-10',
    handles: ['sama', 'karpathy', 'swyx', 'levie', 'dharmesh'],
    query_used: null,
    summary:
      '1. Enterprise AI agents are moving from demos to implementation work, with SaaS operators focusing on deployment, token budgeting, and API parity.\n\n2. Dominant themes: Enterprise deployment is positive; token budgeting is neutral; agentic workflows are positive.\n\n3. Top posts worth knowing: @levie on enterprise implementation; @dharmesh on platform API parity; @swyx on competitive model economics.\n\n4. Dissent: practical limits around rate limits, trust, and non-automatable customer work keep the story grounded.',
    citations: [
      { index: 1, url: 'https://x.com/i/status/2053192407664259251' },
      { index: 2, url: 'https://x.com/i/status/2051344780328858040' },
      { index: 3, url: 'https://x.com/i/status/2051678219812675875' },
    ],
    tool_calls: [
      { name: 'x_keyword_search', status: 'completed' },
      { name: 'x_semantic_search', status: 'completed' },
    ],
    cost_usd: 0.051912,
    latency_ms: 89269,
    tags: ['industry:tech-saas', 'window:7d'],
    metadata: { citations_count: 3, tool_calls_count: 2 },
    status: 'completed',
    error: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-healthcare',
    scope_type: 'industry',
    scope_value: 'healthcare',
    window_label: '7d',
    from_date: '2026-05-03',
    to_date: '2026-05-10',
    handles: ['EricTopol', 'PeterAttiaMD', 'ZDoggMD', 'hubermanlab'],
    query_used: null,
    summary:
      '1. Healthcare discussion is mixed: optimism around diagnostics and prevention is colliding with regulatory, trust, and evidence-quality questions.\n\n2. Dominant themes: prevention, AI workflow, clinical evidence, and patient trust.\n\n3. Top posts worth knowing: researchers cite AI diagnostics; clinicians push back on hype; wellness voices emphasize prevention.\n\n4. Dissent: several voices warn that shortcuts without evidence will create more confusion than progress.',
    citations: [{ index: 1, url: 'https://x.com/i/status/2050000000000000001' }],
    tool_calls: [{ name: 'x_keyword_search', status: 'completed' }],
    cost_usd: 0.042,
    latency_ms: 48260,
    tags: ['industry:healthcare', 'window:7d'],
    metadata: { citations_count: 1, tool_calls_count: 1 },
    status: 'completed',
    error: null,
    created_at: new Date(Date.now() - 38 * 60 * 1000).toISOString(),
  },
]

const PULSE_SELECT = [
  'id',
  'scope_type',
  'scope_value',
  'window_label',
  'from_date',
  'to_date',
  'handles',
  'query_used',
  'summary',
  'citations',
  'tool_calls',
  'cost_usd',
  'latency_ms',
  'tags',
  'metadata',
  'status',
  'error',
  'created_at',
].join(',')

export function PulseReaderPage() {
  const [rows, setRows] = useState<PulseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dataSource, setDataSource] = useState<DataSource | null>(null)
  const [selectedLane, setSelectedLane] = useState<string>('all')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      setDataSource(null)
      const failures: string[] = []
      try {
        const apiRows = await loadRowsFromApi().catch((e) => {
          failures.push(e instanceof Error ? e.message : 'pulse API failed')
          return []
        })
        if (!cancelled && apiRows.length > 0) {
          setRows(apiRows)
          setDataSource('api')
          return
        }

        const browserRows = await loadRowsFromBrowserSupabase().catch((e) => {
          failures.push(e instanceof Error ? e.message : 'browser cache fallback failed')
          return []
        })
        if (!cancelled && browserRows.length > 0) {
          setRows(browserRows)
          setDataSource('browser')
          return
        }

        if (!cancelled) {
          setRows(FALLBACK_ROWS)
          setDataSource('sample')
          if (failures.length) setError(failures.join(' · '))
        }
      } catch (e) {
        if (!cancelled) {
          setRows(FALLBACK_ROWS)
          setDataSource('sample')
          setError(e instanceof Error ? e.message : 'Pulse data could not be loaded.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const pulses = useMemo(() => derivePulseSet(rows), [rows])
  const lanes = useMemo(() => ['all', ...Array.from(new Set(pulses.latest.map((p) => p.lane)))], [pulses.latest])
  const visible = useMemo(
    () => (selectedLane === 'all' ? pulses.latest : pulses.latest.filter((p) => p.lane === selectedLane)),
    [pulses.latest, selectedLane],
  )
  const hero = visible[0] ?? pulses.latest[0]
  const topStories = visible.slice(0, 6)
  const stats = useMemo(() => summarize(visible), [visible])
  const voiceBars = useMemo(() => topVoices(visible), [visible])
  const topicBars = useMemo(() => topTopicTags(visible), [visible])
  const source = sourceCopy(dataSource, loading)

  return (
    <main className="min-h-screen bg-[#f7f8f4] text-neutral-950">
      <section className="border-b border-neutral-300 bg-[#fbfbf7]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <a href="/" className="flex items-center gap-3">
              <SeekBoxLogo tone="light" size="lg" />
              <div>
                <div className="text-2xl font-black tracking-tight">SeekBoX Pulse</div>
                <div className="text-[11px] font-black uppercase tracking-[0.24em] text-neutral-500">
                  live SeekBox cache
                </div>
              </div>
            </a>

            <nav className="flex flex-wrap gap-2 text-sm font-black">
              <a href="/pulse" className="rounded-lg bg-neutral-950 px-4 py-2 text-white">
                Reader
              </a>
              <a href="/industries" className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-neutral-800">
                Industries
              </a>
              <a href="/cleanseek-x" className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-neutral-800">
                Search live
              </a>
              <a href="/xmarks" className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-neutral-800">
                XMarks
              </a>
            </nav>
          </header>

          <div className="grid gap-6 py-2 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch">
            <div className="flex h-full flex-col border-l-4 border-neutral-950 bg-white p-5 shadow-[6px_6px_0_rgba(0,0,0,0.08)]">
              <div className="sticky top-0 z-10 -mx-5 -mt-5 mb-5 border-b border-neutral-200 bg-white px-5 py-4">
                <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-neutral-600">
                  <span className={`h-2 w-2 rounded-full ${source.dot}`} />
                  {source.label}
                </div>
                <h1 className="mt-3 max-w-5xl text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
                  Read the room before you search it.
                </h1>
              </div>
              <p className="max-w-3xl text-lg font-medium leading-8 text-neutral-600">
                A skimmable wire of generated X intelligence from cached industry rows: what changed,
                who is shaping it, and where the narrative is gaining heat.
              </p>
            </div>

            <div className="flex h-full flex-col border-l-4 border-neutral-950 bg-white p-5 shadow-[6px_6px_0_rgba(0,0,0,0.08)]">
              <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-black uppercase tracking-[0.18em] text-neutral-500">
                <span>Lead brief</span>
                <span>{hero ? formatAge(hero.row.created_at) : loading ? 'loading' : 'pending'}</span>
              </div>
              <h2 className="text-2xl font-black leading-tight">
                {hero ? hero.headline : 'Loading the latest cached industry pulse data'}
              </h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-neutral-600">
                {hero ? hero.dek : 'The reader is cache-first; live rows will fill the cards as soon as the pulse feed responds.'}
              </p>
              <div className="mt-auto grid grid-cols-3 gap-2 pt-5">
                <MiniMetric label="Heat" value={hero?.heat ?? '—'} />
                <MiniMetric label="Novelty" value={hero?.novelty ?? '—'} />
                <MiniMetric label="Dissent" value={hero?.dissent ?? '—'} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {lanes.map((lane) => (
              <button
                key={lane}
                type="button"
                onClick={() => setSelectedLane(lane)}
                className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-wide ${
                  selectedLane === lane
                    ? 'border-neutral-950 bg-neutral-950 text-white'
                    : 'border-neutral-300 bg-white text-neutral-600 hover:border-neutral-500'
                }`}
              >
                {lane === 'all' ? 'All' : lane}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-4 lg:px-8">
        <StatCard icon={<Newspaper className="h-5 w-5" />} label="Pulse rows" value={String(stats.count)} />
        <StatCard icon={<ExternalLink className="h-5 w-5" />} label="Citations" value={String(stats.citations)} />
        <StatCard icon={<Clock3 className="h-5 w-5" />} label="Median latency" value={stats.latencyLabel} />
        <StatCard icon={<Activity className="h-5 w-5" />} label="Avg cost" value={stats.costLabel} />
      </section>

      {error ? (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-start gap-3 border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Live SeekBox cache rows did not load, so the page is showing the built-in mock rows. {error}
          </div>
        </div>
      ) : null}

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
        <div>
          <SectionHeader eyebrow="Top highlights" title="The pieces worth reading first" />
          <div className="grid gap-4 xl:grid-cols-2">
            {topStories.length ? (
              topStories.map((pulse) => <HighlightCard key={pulse.row.id} pulse={pulse} />)
            ) : (
              <EmptyPanel title="No pulse rows yet" body="Tech and healthcare briefs will land here as soon as the cache returns rows." />
            )}
          </div>
        </div>

        <aside className="space-y-5">
          <ChartPanel title="Heat leaderboard" icon={<BarChart3 className="h-5 w-5" />}>
            <div className="space-y-3">
              {visible.length ? (
                visible.slice(0, 7).map((pulse) => <ScoreBar key={pulse.row.id} label={pulse.scopeLabel} value={pulse.heat} />)
              ) : (
                <EmptyChart label="Waiting for industry rows" />
              )}
            </div>
          </ChartPanel>

          <ChartPanel title="Mood mix" icon={<Flame className="h-5 w-5" />}>
            <MoodStack pulses={visible} />
          </ChartPanel>

          <ChartPanel title="Top voices" icon={<Sparkles className="h-5 w-5" />}>
            <div className="space-y-3">
              {voiceBars.length ? (
                voiceBars.map((v) => <ScoreBar key={v.label} label={`@${v.label}`} value={v.value} max={voiceBars[0]?.value ?? 1} />)
              ) : (
                <EmptyChart label="No handles found yet" />
              )}
            </div>
          </ChartPanel>
        </aside>
      </section>

      <section className="border-y border-neutral-300 bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
          <div>
            <SectionHeader eyebrow="Trending model" title="Charts from the data we already have" />
            <p className="max-w-2xl text-sm font-medium leading-7 text-neutral-600">
              These charts are derived from cached industry rows today. When the Worker starts writing structured
              topic scores, the same panels can become real trend charts instead of heuristics.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <MiniMetric label="Freshest" value={formatAge(stats.freshest)} text />
              <MiniMetric label="Hottest" value={stats.hottest} text />
              <MiniMetric label="Avg heat" value={stats.avgHeat} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ChartPanel title="Lead scope trend" icon={<LineChart className="h-5 w-5" />}>
              <Sparkline values={hero?.spark ?? []} />
              <div className="mt-3 text-sm font-black">{hero?.scopeLabel ?? 'Pulse feed'}</div>
              <div className="text-xs font-semibold text-neutral-500">Derived heat across recent cached runs.</div>
            </ChartPanel>
            <ChartPanel title="Topic tags" icon={<TrendingUp className="h-5 w-5" />}>
              <div className="space-y-3">
                {topicBars.length ? (
                  topicBars.map((t) => <ScoreBar key={t.label} label={t.label} value={t.value} max={topicBars[0]?.value ?? 1} />)
                ) : (
                  <EmptyChart label="No tags found yet" />
                )}
              </div>
            </ChartPanel>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <SectionHeader eyebrow="Brief shelf" title="Open briefs, citations, and source trails" />
        <div className="grid gap-4 lg:grid-cols-3">
          {visible.length ? (
            visible.slice(0, 12).map((pulse) => <BriefCard key={`${pulse.row.id}-brief`} pulse={pulse} />)
          ) : (
            <EmptyPanel title="No briefs to show" body="The shelf is wired to pulse_runs and will populate from completed industry rows." />
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-24 pt-2 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 border border-neutral-300 bg-neutral-950 px-5 py-5 text-white md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400">Deep mode</div>
            <div className="mt-1 text-2xl font-black">Need a fresh pull or custom angle?</div>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-neutral-300">
              Keep reading cached highlights here. Use the Grok X console when the question deserves a new run.
            </p>
          </div>
          <a
            href="/cleanseek-x"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-300 px-5 py-3 text-sm font-black text-neutral-950"
          >
            Search live
            <Search className="h-4 w-4" />
          </a>
        </div>
      </section>
    </main>
  )
}

async function loadRowsFromApi(): Promise<PulseRow[]> {
  const res = await fetch('/api/pulse-runs?limit=90&scope_type=industry')
  if (!res.ok) throw new Error(`pulse API failed: ${res.status}`)
  const json = (await res.json()) as { rows?: PulseRow[] }
  return cleanRows(json.rows ?? [])
}

async function loadRowsFromBrowserSupabase(): Promise<PulseRow[]> {
  if (!isSupabaseConfigured || !supabase) return []
  const { data, error } = await supabase
    .from('pulse_runs')
    .select(PULSE_SELECT)
    .eq('scope_type', 'industry')
    .order('created_at', { ascending: false })
    .limit(90)
  if (error) throw error
  return cleanRows((data as PulseRow[]) ?? [])
}

function cleanRows(rows: PulseRow[]): PulseRow[] {
  return rows.filter((row) => row.summary && row.status !== 'error' && row.scope_type === 'industry' && canonicalIndustry(row))
}

function derivePulseSet(rows: PulseRow[]) {
  const clean = rows
  const history = new Map<string, DerivedPulse[]>()
  const derived = clean.map((row) => derivePulse(row))
  for (const pulse of derived) {
    const list = history.get(pulse.scopeKey) ?? []
    list.push(pulse)
    history.set(pulse.scopeKey, list)
  }

  for (const [key, list] of history.entries()) {
    const ordered = list.sort((a, b) => new Date(a.row.created_at).getTime() - new Date(b.row.created_at).getTime())
    const values = ordered.map((p) => p.heat)
    for (const pulse of list) pulse.spark = values
    history.set(key, ordered)
  }

  const seen = new Set<string>()
  const latest: DerivedPulse[] = []
  for (const pulse of derived.sort((a, b) => new Date(b.row.created_at).getTime() - new Date(a.row.created_at).getTime())) {
    if (seen.has(pulse.scopeKey)) continue
    seen.add(pulse.scopeKey)
    latest.push(pulse)
  }
  latest.sort((a, b) => b.heat - a.heat)
  return { latest, history }
}

function derivePulse(row: PulseRow): DerivedPulse {
  const summary = row.summary ?? ''
  const sections = splitSections(summary)
  const canonical = canonicalIndustry(row)
  const scopeKey = canonical?.key ?? `${row.scope_type ?? 'pulse'}:${row.scope_value ?? row.id}`
  const scopeLabel = canonical?.label ?? labelScope(row.scope_value ?? row.scope_type ?? 'Pulse')
  const tags = normalizeTags(row.tags, row.scope_type)
  const handles = extractHandles(row)
  const headline = firstSentence(cleanSection(sections[0] ?? summary)) || `${scopeLabel} pulse is moving`
  const dek = secondSentence(cleanSection(sections[0] ?? summary)) || cleanSection(sections[1] ?? summary).slice(0, 180)
  const why = firstSentence(cleanSection(sections[2] ?? sections[1] ?? summary)) || 'Worth watching because the conversation is changing quickly.'
  const citationCount = arrayCount(row.citations) || numberFromMeta(row, 'citations_count')
  const toolCallCount = arrayCount(row.tool_calls) || numberFromMeta(row, 'tool_calls_count')
  const latencyMs = Number(row.latency_ms ?? 0)
  const costUsd = Number(row.cost_usd ?? numberFromMeta(row, 'grok_cost_usd') ?? 0)
  const mood = detectMood(summary)
  const novelty = noveltyScore(summary, tags)
  const dissent = dissentScore(sections, summary)
  const heat = heatScore(row, citationCount, toolCallCount, novelty, dissent)

  return {
    row,
    scopeKey,
    scopeLabel,
    lane: row.scope_type === 'industry' ? scopeLabel : laneFor(row.scope_type, row.scope_value, tags),
    headline,
    dek,
    why,
    mood,
    heat,
    novelty,
    dissent,
    citationCount,
    toolCallCount,
    costUsd,
    latencyMs,
    handles,
    tags,
    sections,
    spark: [heat],
  }
}

function splitSections(summary: string): string[] {
  return summary
    .split(/(?=^\d+\.\s)/m)
    .map((part) => part.trim())
    .filter(Boolean)
}

function cleanSection(section: string): string {
  return section.replace(/^\d+\.\s*/, '').replace(/\[\[\d+\]\]\([^)]+\)/g, '').replace(/\s+/g, ' ').trim()
}

function firstSentence(text: string): string {
  return sentenceParts(text)[0] ?? ''
}

function secondSentence(text: string): string {
  return sentenceParts(text)[1] ?? ''
}

function sentenceParts(text: string): string[] {
  const protectedText = text
    .replace(/U\.S\./g, 'U§S§')
    .replace(/([A-Z])\.([A-Z])\./g, '$1§$2§')
    .replace(/(\d)\.(\d)/g, '$1§$2')
  const sentences = protectedText.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? []
  return sentences.map((sentence) => sentence.replace(/§/g, '.').trim()).filter(Boolean)
}

function labelScope(raw: string): string {
  const spaced = raw.replace(/^industry:/, '').replace(/[-_]+/g, ' ').trim()
  if (!spaced) return 'Pulse'
  if (spaced.toLowerCase() === 'tech saas') return 'Tech & SaaS'
  return spaced.replace(/\b\w/g, (m) => m.toUpperCase()).replace(/\bAi\b/g, 'AI').replace(/\bSaas\b/g, 'SaaS')
}

function canonicalIndustry(row: PulseRow): { key: string; label: string } | null {
  const text = [row.scope_value, ...(row.tags ?? [])].filter(Boolean).join(' ').toLowerCase()
  const configured = getIndustryPage(row.scope_value)
  if (configured) return { key: `industry:${configured.slug}`, label: configured.label }
  if (text.includes('health')) return { key: 'industry:healthcare', label: 'Healthcare' }
  if (text.includes('tech') || text.includes('saas') || text.includes('artificial intelligence') || /\bai\b/.test(text)) {
    return { key: 'industry:tech-saas', label: 'Tech & SaaS' }
  }
  if (text.includes('finance') || text.includes('market') || text.includes('macro')) {
    return { key: 'industry:finance', label: 'Finance & Markets' }
  }
  if (text.includes('sports') || text.includes('entertainment')) {
    return { key: 'industry:sports-entertainment', label: 'Sports & Entertainment' }
  }
  return null
}

function normalizeTags(tags: string[] | null, scopeType: string | null): string[] {
  const out = new Set<string>()
  if (scopeType) out.add(scopeType)
  for (const tag of tags ?? []) {
    const clean = tag.replace(/^industry:/, '').replace(/^window:.+$/, '').replace(/^cron:.+$/, '').trim()
    if (clean) out.add(clean)
  }
  return Array.from(out).slice(0, 6)
}

function extractHandles(row: PulseRow): string[] {
  const found = new Set<string>()
  for (const h of row.handles ?? []) {
    const clean = h.replace(/^@/, '').trim()
    if (clean) found.add(clean)
  }
  const summary = row.summary ?? ''
  for (const match of summary.matchAll(/@([A-Za-z0-9_]{2,24})/g)) {
    found.add(match[1])
  }
  return Array.from(found).slice(0, 12)
}

function detectMood(summary: string): Mood {
  const s = summary.toLowerCase()
  const positive = countWords(s, ['optimistic', 'positive', 'bullish', 'growth', 'breakthrough', 'opportunity', 'surge'])
  const negative = countWords(s, ['negative', 'risk', 'concern', 'warning', 'dissent', 'critical', 'problem', 'constraint'])
  if (positive >= 2 && negative >= 2) return 'mixed'
  if (positive > negative) return 'optimistic'
  if (negative > positive) return 'critical'
  return 'neutral'
}

function noveltyScore(summary: string, tags: string[]): number {
  const s = summary.toLowerCase()
  const hits = countWords(s, ['new', 'emerging', 'breakthrough', 'first', 'shift', 'moving', 'launch', 'agent', 'trend'])
  return clamp(35 + hits * 7 + Math.min(tags.length * 3, 12), 18, 96)
}

function dissentScore(sections: string[], summary: string): number {
  const dissentText = sections.find((section) => /dissent|counter|push back|crit/i.test(section)) ?? ''
  const base = dissentText ? 52 : 25
  const hits = countWords(summary.toLowerCase(), ['dissent', 'counter', 'warn', 'risk', 'push back', 'critical'])
  return clamp(base + hits * 6, 12, 94)
}

function heatScore(
  row: PulseRow,
  citationCount: number,
  toolCallCount: number,
  novelty: number,
  dissent: number,
): number {
  const ageHours = Math.max(0, (Date.now() - new Date(row.created_at).getTime()) / 3600000)
  const freshness = clamp(22 - ageHours * 0.8, 0, 22)
  const summaryWeight = Math.min(((row.summary ?? '').length / 3200) * 16, 16)
  return clamp(24 + citationCount * 3.5 + toolCallCount * 2.5 + freshness + summaryWeight + novelty * 0.12 + dissent * 0.08, 10, 99)
}

function laneFor(scopeType: string | null, scopeValue: string | null, tags: string[]): string {
  if (scopeType === 'industry') return labelScope(scopeValue ?? 'industry')
  if (scopeType === 'ticker') return 'tickers'
  if (scopeType === 'handle') return 'people'
  if (scopeType === 'topic') return 'topics'
  if (tags.some((tag) => tag.includes('finance') || tag.includes('crypto'))) return 'markets'
  return scopeType === 'industry' ? 'industries' : 'watchlist'
}

function sourceCopy(source: DataSource | null, loading: boolean): { label: string; dot: string } {
  if (loading) return { label: 'LOADING SEEKBOX CACHE', dot: 'bg-amber-400' }
  if (source === 'api') return { label: 'LIVE SEEKBOX CACHE', dot: 'bg-emerald-500' }
  if (source === 'browser') return { label: 'LIVE SEEKBOX CACHE', dot: 'bg-emerald-500' }
  return { label: 'SAMPLE SEEKBOX CACHE', dot: 'bg-neutral-500' }
}

function countWords(text: string, words: string[]): number {
  return words.reduce((sum, word) => sum + (text.includes(word) ? 1 : 0), 0)
}

function arrayCount(value: unknown[] | null): number {
  return Array.isArray(value) ? value.length : 0
}

function numberFromMeta(row: PulseRow, key: string): number {
  const value = row.metadata?.[key]
  return typeof value === 'number' ? value : 0
}

function clamp(value: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, value)))
}

function formatAge(createdAt: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function summarize(pulses: DerivedPulse[]) {
  const count = pulses.length
  const citations = pulses.reduce((sum, pulse) => sum + pulse.citationCount, 0)
  const costs = pulses.map((pulse) => pulse.costUsd).filter((n) => n > 0)
  const latencies = pulses.map((pulse) => pulse.latencyMs).filter((n) => n > 0).sort((a, b) => a - b)
  const avgCost = costs.length ? costs.reduce((sum, n) => sum + n, 0) / costs.length : 0
  const medianLatency = latencies.length ? latencies[Math.floor(latencies.length / 2)] : 0
  const avgHeat = pulses.length ? Math.round(pulses.reduce((sum, pulse) => sum + pulse.heat, 0) / pulses.length) : 0
  const hottest = pulses[0]?.scopeLabel ?? 'Pulse'
  const freshest = pulses.reduce((latest, pulse) => {
    return new Date(pulse.row.created_at).getTime() > new Date(latest).getTime() ? pulse.row.created_at : latest
  }, pulses[0]?.row.created_at ?? new Date().toISOString())
  return {
    count,
    citations,
    latencyLabel: medianLatency ? `${(medianLatency / 1000).toFixed(0)}s` : '—',
    costLabel: avgCost ? `$${avgCost.toFixed(3)}` : '—',
    avgHeat,
    hottest,
    freshest,
  }
}

function topVoices(pulses: DerivedPulse[]) {
  const counts = new Map<string, number>()
  for (const pulse of pulses) {
    for (const h of pulse.handles) counts.set(h, (counts.get(h) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7)
}

function topTopicTags(pulses: DerivedPulse[]) {
  const counts = new Map<string, number>()
  for (const pulse of pulses) {
    for (const tag of pulse.tags) counts.set(labelScope(tag), (counts.get(labelScope(tag)) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7)
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-4">
      <div className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-500">{eyebrow}</div>
      <h2 className="mt-1 text-3xl font-black tracking-tight text-neutral-950">{title}</h2>
    </div>
  )
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-dashed border-neutral-300 bg-white px-5 py-8">
      <div className="text-lg font-black text-neutral-950">{title}</div>
      <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-neutral-500">{body}</p>
    </div>
  )
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="border border-dashed border-neutral-300 bg-neutral-50 px-4 py-5 text-center text-xs font-black uppercase tracking-wide text-neutral-500">
      {label}
    </div>
  )
}

function MiniMetric({ label, value, text = false }: { label: string; value: number | string; text?: boolean }) {
  return (
    <div className="border border-neutral-300 bg-[#f7f8f4] px-3 py-3">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">{label}</div>
      <div className={`${text ? 'text-lg' : 'text-3xl'} mt-1 font-black text-neutral-950`}>{value}</div>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border border-neutral-300 bg-white px-4 py-4 shadow-[3px_3px_0_rgba(0,0,0,0.05)]">
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">{label}</div>
        <div className="mt-1 text-2xl font-black">{value}</div>
      </div>
      <div className="grid h-10 w-10 place-items-center border border-neutral-300 bg-[#f7f8f4] text-neutral-700">{icon}</div>
    </div>
  )
}

function HighlightCard({ pulse }: { pulse: DerivedPulse }) {
  return (
    <article className="border border-neutral-300 bg-white p-5 shadow-[4px_4px_0_rgba(0,0,0,0.05)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-neutral-300 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-neutral-600">
            {pulse.lane}
          </span>
          <MoodBadge mood={pulse.mood} />
        </div>
        <span className="text-xs font-bold text-neutral-500">{formatAge(pulse.row.created_at)}</span>
      </div>
      <h3 className="mt-4 text-2xl font-black leading-tight">{pulse.headline}</h3>
      <p className="mt-3 text-sm font-semibold leading-6 text-neutral-600">{pulse.dek}</p>
      <p className="mt-4 border-l-2 border-neutral-950 pl-3 text-sm font-bold leading-6 text-neutral-800">{pulse.why}</p>
      <div className="mt-5 grid grid-cols-3 gap-2">
        <ScorePill label="Heat" value={pulse.heat} />
        <ScorePill label="Novelty" value={pulse.novelty} />
        <ScorePill label="Dissent" value={pulse.dissent} />
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {pulse.handles.slice(0, 5).map((handle) => (
          <span key={handle} className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-black text-neutral-600">
            @{handle}
          </span>
        ))}
      </div>
    </article>
  )
}

function BriefCard({ pulse }: { pulse: DerivedPulse }) {
  const citations = pulse.row.citations ?? []
  return (
    <article className="flex min-h-[280px] flex-col border border-neutral-300 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-black uppercase tracking-[0.16em] text-neutral-500">{pulse.scopeLabel}</div>
        <Sparkline values={pulse.spark} compact />
      </div>
      <h3 className="mt-4 text-xl font-black leading-tight">{pulse.headline}</h3>
      <p className="mt-3 flex-1 text-sm font-medium leading-6 text-neutral-600">{pulse.dek}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {pulse.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="rounded-full border border-neutral-300 px-2 py-1 text-[10px] font-black uppercase text-neutral-500">
            {labelScope(tag)}
          </span>
        ))}
      </div>
      <div className="mt-4 border-t border-neutral-200 pt-3">
        <div className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">
          {pulse.citationCount} citations · {pulse.toolCallCount} tool calls
        </div>
        <div className="flex flex-wrap gap-2">
          {citations.slice(0, 4).map((citation, index) => (
            <a
              key={`${pulse.row.id}-${citation.url ?? index}`}
              href={citation.url ?? '#'}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-neutral-950 px-2.5 py-1 text-xs font-black text-white"
            >
              [{citation.index ?? index + 1}]
              <ExternalLink className="h-3 w-3" />
            </a>
          ))}
        </div>
      </div>
    </article>
  )
}

function ChartPanel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border border-neutral-300 bg-white p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-black">
        <span className="grid h-8 w-8 place-items-center border border-neutral-300 bg-[#f7f8f4] text-neutral-700">{icon}</span>
        {title}
      </div>
      {children}
    </section>
  )
}

function ScoreBar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs font-black">
        <span className="truncate text-neutral-700">{label}</span>
        <span className="text-neutral-500">{value}</span>
      </div>
      <div className="h-2 bg-neutral-100">
        <div className="h-full bg-neutral-950" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function ScorePill({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-neutral-100 px-3 py-2">
      <div className="text-[10px] font-black uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-0.5 text-xl font-black text-neutral-950">{value}</div>
    </div>
  )
}

function MoodBadge({ mood }: { mood: Mood }) {
  const label = mood.charAt(0).toUpperCase() + mood.slice(1)
  const tone =
    mood === 'optimistic'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : mood === 'critical'
        ? 'bg-rose-50 text-rose-800 border-rose-200'
        : mood === 'mixed'
          ? 'bg-amber-50 text-amber-800 border-amber-200'
          : 'bg-neutral-100 text-neutral-700 border-neutral-300'
  return <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${tone}`}>{label}</span>
}

function MoodStack({ pulses }: { pulses: DerivedPulse[] }) {
  const moods: Mood[] = ['optimistic', 'mixed', 'critical', 'neutral']
  const total = Math.max(1, pulses.length)
  return (
    <div>
      <div className="flex h-4 overflow-hidden bg-neutral-100">
        {moods.map((mood) => {
          const count = pulses.filter((pulse) => pulse.mood === mood).length
          const width = (count / total) * 100
          const color =
            mood === 'optimistic' ? 'bg-emerald-500' : mood === 'mixed' ? 'bg-amber-500' : mood === 'critical' ? 'bg-rose-500' : 'bg-neutral-400'
          return <div key={mood} className={color} style={{ width: `${width}%` }} />
        })}
      </div>
      <div className="mt-4 grid gap-2">
        {moods.map((mood) => (
          <div key={mood} className="flex items-center justify-between text-xs font-black text-neutral-600">
            <span>{mood}</span>
            <span>{pulses.filter((pulse) => pulse.mood === mood).length}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Sparkline({ values, compact = false }: { values: number[]; compact?: boolean }) {
  const safe = values.length > 1 ? values : [values[0] ?? 30, values[0] ?? 30]
  const min = Math.min(...safe)
  const max = Math.max(...safe)
  const spread = Math.max(1, max - min)
  const points = safe
    .map((value, index) => {
      const x = (index / Math.max(1, safe.length - 1)) * 100
      const y = 42 - ((value - min) / spread) * 34
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg viewBox="0 0 100 48" className={compact ? 'h-10 w-24' : 'h-28 w-full'} role="img" aria-label="Heat trend line">
      <polyline points="0,42 100,42" fill="none" stroke="#e5e5e5" strokeWidth="2" />
      <polyline points={points} fill="none" stroke="#111111" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {safe.map((value, index) => {
        const x = (index / Math.max(1, safe.length - 1)) * 100
        const y = 42 - ((value - min) / spread) * 34
        return <circle key={`${value}-${index}`} cx={x} cy={y} r={compact ? 2.5 : 3.5} fill="#111111" />
      })}
    </svg>
  )
}
