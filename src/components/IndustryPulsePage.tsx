import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Activity,
  ArrowRight,
  BarChart3,
  Clock3,
  ExternalLink,
  LineChart,
  Newspaper,
  Search,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { INDUSTRY_PAGES, getIndustryPage, type IndustryPageConfig } from '../lib/industryCatalog'
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

type DataSource = 'api' | 'empty'

export function IndustryHubPage() {
  return (
    <main className="min-h-screen bg-[#f7f8f4] text-neutral-950">
      <IndustryHeader />
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <div className="mb-7 max-w-4xl">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-500">Grok customer pages</div>
          <h1 className="mt-2 text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl">
            Industry pulse pages that read before they ask.
          </h1>
          <p className="mt-5 max-w-3xl text-lg font-medium leading-8 text-neutral-600">
            These pages are the cheap, scalable layer: cached X intelligence, source trails, and just enough charts
            to show where a deeper Grok pull is worth paying for.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {INDUSTRY_PAGES.map((industry) => (
            <a
              key={industry.slug}
              href={`/industries/${industry.slug}`}
              className="group flex min-h-[340px] flex-col border border-neutral-300 bg-white p-5 shadow-[4px_4px_0_rgba(0,0,0,0.05)] transition hover:-translate-y-0.5 hover:shadow-[6px_6px_0_rgba(0,0,0,0.08)]"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full border border-neutral-300 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-neutral-500">
                  {industry.eyebrow}
                </span>
                <ArrowRight className="h-4 w-4 text-neutral-400 transition group-hover:translate-x-1 group-hover:text-neutral-950" />
              </div>
              <h2 className="mt-6 text-3xl font-black tracking-tight">{industry.label}</h2>
              <p className="mt-3 flex-1 text-sm font-semibold leading-6 text-neutral-600">{industry.description}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {industry.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-black text-neutral-600">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-5 border-t border-neutral-200 pt-4 text-xs font-black uppercase tracking-wide text-neutral-500">
                For {industry.customer}
              </div>
            </a>
          ))}
        </div>
      </section>
    </main>
  )
}

export function IndustryPulsePage({ slug }: { slug: string }) {
  const industry = getIndustryPage(slug)
  const [rows, setRows] = useState<PulseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<DataSource>('empty')

  useEffect(() => {
    if (!industry) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const next = await loadIndustryRows(industry.slug)
        if (cancelled) return
        setRows(next)
        setSource(next.length ? 'api' : 'empty')
      } catch (e) {
        if (cancelled) return
        setRows([])
        setSource('empty')
        setError(e instanceof Error ? e.message : 'Industry pulse rows could not be loaded.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [industry])

  const derived = useMemo(() => deriveIndustryRows(rows, industry), [rows, industry])
  const latest = derived.latest
  const sections = latest ? splitSections(latest.row.summary ?? '') : []
  const stats = useMemo(() => summarizeRows(derived.history), [derived.history])
  const questions = industry?.questions ?? []

  if (!industry) {
    return (
      <main className="min-h-screen bg-[#f7f8f4] text-neutral-950">
        <IndustryHeader />
        <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-500">Industry not found</div>
          <h1 className="mt-3 text-4xl font-black">That xdot industry page does not exist yet.</h1>
          <a href="/industries" className="mt-6 inline-flex rounded-lg bg-neutral-950 px-5 py-3 text-sm font-black text-white">
            Browse industries
          </a>
        </section>
      </main>
    )
  }

  const liveCopy = source === 'api' ? 'LIVE SEEKBOX CACHE' : loading ? 'LOADING SEEKBOX CACHE' : 'SEEKBOX CACHE READY'
  const liveDot = source === 'api' ? 'bg-emerald-500' : loading ? 'bg-amber-400' : 'bg-neutral-500'

  return (
    <main className="min-h-screen bg-[#f7f8f4] text-neutral-950">
      <IndustryHeader />

      <section className="border-b border-neutral-300 bg-[#fbfbf7]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_390px] lg:px-8">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-neutral-600">
              <span className={`h-2 w-2 rounded-full ${liveDot}`} />
              {liveCopy}
            </div>
            <h1 className="max-w-5xl text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
              {industry.label} pulse
            </h1>
            <p className="mt-5 max-w-3xl text-lg font-medium leading-8 text-neutral-600">{industry.description}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {industry.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-black text-neutral-600">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="border-l-4 border-neutral-950 bg-white p-5 shadow-[6px_6px_0_rgba(0,0,0,0.08)]">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-500">My read</div>
            <p className="mt-3 text-lg font-black leading-7">{industry.whyGrok}</p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <MiniMetric label="Rows" value={stats.count} />
              <MiniMetric label="Cites" value={stats.citations} />
              <MiniMetric label="Age" value={latest ? formatAge(latest.row.created_at) : '—'} text />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-4 lg:px-8">
        <StatCard icon={<Newspaper className="h-5 w-5" />} label="Briefs cached" value={String(stats.count)} />
        <StatCard icon={<ExternalLink className="h-5 w-5" />} label="Citations" value={String(stats.citations)} />
        <StatCard icon={<Clock3 className="h-5 w-5" />} label="Median latency" value={stats.latencyLabel} />
        <StatCard icon={<Activity className="h-5 w-5" />} label="Avg cost" value={stats.costLabel} />
      </section>

      {error ? (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{error}</div>
        </div>
      ) : null}

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-8">
        <div className="space-y-5">
          {latest ? (
            <>
              <PulseSection title="Executive read" eyebrow="What matters" body={sections[0] ?? latest.row.summary ?? ''} />
              <PulseSection title="Themes" eyebrow="Narrative clusters" body={sections[1] ?? ''} />
              <PulseSection title="Posts worth knowing" eyebrow="Source trail" body={sections[2] ?? ''} />
              <PulseSection title="Dissent" eyebrow="Where consensus breaks" body={sections[3] ?? ''} />
            </>
          ) : (
            <EmptyState industry={industry} loading={loading} />
          )}
        </div>

        <aside className="space-y-5">
          <ChartPanel title="Grok customer fit" icon={<Sparkles className="h-5 w-5" />}>
            <div className="space-y-3">
              {questions.map((question, index) => (
                <SearchLink key={question} industry={industry} question={question} index={index + 1} />
              ))}
            </div>
          </ChartPanel>

          <ChartPanel title="Heat history" icon={<LineChart className="h-5 w-5" />}>
            <Sparkline values={derived.history.map((row) => row.heat)} />
            <div className="mt-3 text-xs font-semibold leading-5 text-neutral-500">
              Derived from citations, tool calls, summary depth, and recency across cached rows.
            </div>
          </ChartPanel>

          <ChartPanel title="Top voices" icon={<TrendingUp className="h-5 w-5" />}>
            <div className="space-y-3">
              {topVoices(derived.history, industry).map((voice) => (
                <ScoreBar key={voice.label} label={`@${voice.label}`} value={voice.value} max={1} />
              ))}
            </div>
          </ChartPanel>

          <ChartPanel title="Operator view" icon={<BarChart3 className="h-5 w-5" />}>
            <div className="space-y-3">
              {industry.operatorView.map((item) => (
                <p key={item} className="border-l-2 border-neutral-950 pl-3 text-sm font-bold leading-6 text-neutral-700">
                  {item}
                </p>
              ))}
            </div>
          </ChartPanel>
        </aside>
      </section>

      <section className="border-y border-neutral-300 bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-500">Citations</div>
            <h2 className="mt-1 text-3xl font-black tracking-tight">Open the receipts</h2>
            <p className="mt-3 max-w-xl text-sm font-semibold leading-7 text-neutral-600">
              The page is meant to be read fast, but every cached pulse keeps the source trail visible so a customer
              can decide when to run a fresh Grok pull.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(latest?.row.citations ?? []).length ? (
              (latest?.row.citations ?? []).slice(0, 10).map((citation, index) => (
                <a
                  key={`${citation.url ?? index}`}
                  href={citation.url ?? '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-3 border border-neutral-300 bg-[#f7f8f4] px-4 py-3 text-sm font-black text-neutral-800 hover:border-neutral-950"
                >
                  <span>Source [{citation.index ?? index + 1}]</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              ))
            ) : (
              <div className="border border-dashed border-neutral-300 bg-[#f7f8f4] px-4 py-8 text-sm font-bold text-neutral-500">
                No citations cached yet for this vertical.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 border border-neutral-300 bg-neutral-950 px-5 py-5 text-white md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400">Deep pull</div>
            <div className="mt-1 text-2xl font-black">Turn the cached read into a customer question.</div>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-neutral-300">
              This is where Grok earns the click: fresh X posts, dissent, trader/fan/operator sentiment, and citations.
            </p>
          </div>
          <a
            href={searchUrl(industry, questions[0] ?? `${industry.label} pulse on X this week`)}
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

function IndustryHeader() {
  return (
    <header className="border-b border-neutral-300 bg-[#fbfbf7]">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <a href="/" className="flex items-center gap-3">
          <SeekBoxLogo tone="light" size="md" />
          <div>
            <div className="text-xl font-black tracking-tight">SeekBoX Pulse</div>
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">industry desk</div>
          </div>
        </a>
        <nav className="flex flex-wrap gap-2 text-sm font-black">
          <a href="/pulse" className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-neutral-800">
            Reader
          </a>
          <a href="/industries" className="rounded-lg bg-neutral-950 px-4 py-2 text-white">
            Industries
          </a>
          <a href="/ticker" className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-neutral-800">
            Ticker
          </a>
          <a href="/cleanseek-x" className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-neutral-800">
            Search live
          </a>
        </nav>
      </div>
    </header>
  )
}

async function loadIndustryRows(slug: string): Promise<PulseRow[]> {
  const res = await fetch(`/api/pulse-runs?limit=30&scope_type=industry&scope_value=${encodeURIComponent(slug)}`)
  if (!res.ok) throw new Error(`pulse API failed: ${res.status}`)
  const json = (await res.json()) as { rows?: PulseRow[] }
  return (json.rows ?? []).filter((row) => row.summary && row.status !== 'error')
}

function deriveIndustryRows(rows: PulseRow[], industry: IndustryPageConfig | null) {
  if (!industry) return { latest: null as DerivedIndustryRow | null, history: [] as DerivedIndustryRow[] }
  const history = rows.map((row) => deriveIndustryRow(row, industry)).sort((a, b) => new Date(a.row.created_at).getTime() - new Date(b.row.created_at).getTime())
  return { latest: history[history.length - 1] ?? null, history }
}

type DerivedIndustryRow = {
  row: PulseRow
  heat: number
  citationCount: number
  toolCallCount: number
  costUsd: number
  latencyMs: number
  handles: string[]
}

function deriveIndustryRow(row: PulseRow, industry: IndustryPageConfig): DerivedIndustryRow {
  const citationCount = Array.isArray(row.citations) ? row.citations.length : numberFromMeta(row, 'citations_count')
  const toolCallCount = Array.isArray(row.tool_calls) ? row.tool_calls.length : numberFromMeta(row, 'tool_calls_count')
  const latencyMs = Number(row.latency_ms ?? 0)
  const costUsd = Number(row.cost_usd ?? numberFromMeta(row, 'grok_cost_usd') ?? 0)
  const handles = Array.from(new Set([...(row.handles ?? []), ...industry.handles])).slice(0, 12)
  const ageHours = Math.max(0, (Date.now() - new Date(row.created_at).getTime()) / 3600000)
  const freshness = clamp(26 - ageHours * 0.9, 0, 26)
  const summaryWeight = Math.min(((row.summary ?? '').length / 3000) * 18, 18)
  const heat = clamp(20 + citationCount * 4 + toolCallCount * 2.75 + freshness + summaryWeight, 8, 99)
  return { row, heat, citationCount, toolCallCount, costUsd, latencyMs, handles }
}

function splitSections(summary: string): string[] {
  return summary
    .split(/(?=^\d+\.\s)/m)
    .map((part) => cleanSection(part))
    .filter(Boolean)
}

function cleanSection(section: string): string {
  return section.replace(/^\d+\.\s*/, '').replace(/\[\[\d+\]\]\([^)]+\)/g, '').replace(/\s+\n/g, '\n').trim()
}

function summarizeRows(rows: DerivedIndustryRow[]) {
  const count = rows.length
  const citations = rows.reduce((sum, row) => sum + row.citationCount, 0)
  const costs = rows.map((row) => row.costUsd).filter((n) => n > 0)
  const latencies = rows.map((row) => row.latencyMs).filter((n) => n > 0).sort((a, b) => a - b)
  const avgCost = costs.length ? costs.reduce((sum, n) => sum + n, 0) / costs.length : 0
  const medianLatency = latencies.length ? latencies[Math.floor(latencies.length / 2)] : 0
  return {
    count,
    citations,
    latencyLabel: medianLatency ? `${(medianLatency / 1000).toFixed(0)}s` : '—',
    costLabel: avgCost ? `$${avgCost.toFixed(3)}` : '—',
  }
}

function topVoices(rows: DerivedIndustryRow[], industry: IndustryPageConfig) {
  const counts = new Map<string, number>()
  for (const row of rows) {
    for (const handle of row.handles) counts.set(handle, (counts.get(handle) ?? 0) + 1)
  }
  if (!counts.size) for (const handle of industry.handles) counts.set(handle, 1)
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
}

function numberFromMeta(row: PulseRow, key: string): number {
  const value = row.metadata?.[key]
  return typeof value === 'number' ? value : 0
}

function clamp(value: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, value)))
}

function formatAge(createdAt: string): string {
  const timestamp = new Date(createdAt).getTime()
  if (!Number.isFinite(timestamp)) return 'just now'
  const mins = Math.max(0, Math.floor((Date.now() - timestamp) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function searchUrl(industry: IndustryPageConfig, question: string) {
  const query = `${industry.label} X pulse: ${question}. Include recent X posts, sentiment, dissent, and citations.`
  return `/cleanseek-x?q=${encodeURIComponent(query)}&latest=1&preset=web&autorun=1`
}

function MiniMetric({ label, value, text = false }: { label: string; value: number | string; text?: boolean }) {
  return (
    <div className="border border-neutral-300 bg-[#f7f8f4] px-3 py-3">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">{label}</div>
      <div className={`${text ? 'text-lg' : 'text-3xl'} mt-1 font-black text-neutral-950`}>{value}</div>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
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

function PulseSection({ title, eyebrow, body }: { title: string; eyebrow: string; body: string }) {
  if (!body.trim()) return null
  return (
    <article className="border border-neutral-300 bg-white p-5 shadow-[4px_4px_0_rgba(0,0,0,0.05)]">
      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-500">{eyebrow}</div>
      <h2 className="mt-1 text-2xl font-black tracking-tight">{title}</h2>
      <p className="mt-4 whitespace-pre-line text-sm font-semibold leading-7 text-neutral-700">{body}</p>
    </article>
  )
}

function ChartPanel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
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

function SearchLink({ industry, question, index }: { industry: IndustryPageConfig; question: string; index: number }) {
  return (
    <a
      href={searchUrl(industry, question)}
      className="group flex items-start gap-3 border border-neutral-200 bg-[#f7f8f4] px-3 py-3 hover:border-neutral-950"
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center bg-neutral-950 text-xs font-black text-white">{index}</span>
      <span className="text-sm font-bold leading-5 text-neutral-700 group-hover:text-neutral-950">{question}</span>
    </a>
  )
}

function EmptyState({ industry, loading }: { industry: IndustryPageConfig; loading: boolean }) {
  return (
    <section className="border border-dashed border-neutral-300 bg-white p-6">
      <div className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-500">
        {loading ? 'Loading cached pulse' : 'No cached pulse yet'}
      </div>
      <h2 className="mt-2 text-3xl font-black">{loading ? 'Checking the pulse table.' : 'This vertical is ready for data.'}</h2>
      <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-neutral-600">
        The page shell is built. Once the Worker writes a completed pulse for {industry.slug}, the executive read,
        charts, citations, and voice rail will fill from the SeekBox cache.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {industry.questions.map((question) => (
          <a
            key={question}
            href={searchUrl(industry, question)}
            className="border border-neutral-300 bg-[#f7f8f4] px-4 py-3 text-sm font-black text-neutral-700 hover:border-neutral-950"
          >
            {question}
          </a>
        ))}
      </div>
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

function Sparkline({ values }: { values: number[] }) {
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
    <svg viewBox="0 0 100 48" className="h-28 w-full" role="img" aria-label="Heat trend line">
      <polyline points="0,42 100,42" fill="none" stroke="#e5e5e5" strokeWidth="2" />
      <polyline points={points} fill="none" stroke="#111111" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {safe.map((value, index) => {
        const x = (index / Math.max(1, safe.length - 1)) * 100
        const y = 42 - ((value - min) / spread) * 34
        return <circle key={`${value}-${index}`} cx={x} cy={y} r="3.5" fill="#111111" />
      })}
    </svg>
  )
}
