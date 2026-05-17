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
import { cleanseekHref } from '../lib/cleanseekUrl'
import { INDUSTRY_PAGES, getIndustryPage, type IndustryPageConfig } from '../lib/industryCatalog'
import {
  extractHandlesFromText,
  normalizeXHandle,
  rankPulseVoices,
  sortPulseVoiceRankings,
  voiceProfileHref,
  type PulseVoiceRanking,
} from '../lib/pulseVoiceRankings'
import { pulseTopicHref } from '../lib/pulseTopics'
import { LazySection } from './LazySection'
import { PulseCitationLink } from './PulseCitationLink'
import { XSiteHeader } from './XSiteHeader'

type PulseCitation = {
  index?: number | null
  url?: string | null
}

type PulseRow = {
  id: string
  scope_type: string | null
  scope_value: string | null
  window_label: string | null
  from_date: string | null
  to_date: string | null
  handles: string[] | null
  summary: string | null
  citations: PulseCitation[] | null
  tags: string[] | null
  status: string | null
  created_at: string
}

type DataSource = 'api' | 'empty'

export function IndustryHubPage() {
  return (
    <main className="min-h-screen bg-[#f7f8f4] text-neutral-950">
      <IndustryHeader />
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <div className="mb-7 max-w-4xl">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-500">Live intelligence pages</div>
          <h1 className="mt-2 text-3xl font-black leading-[1.05] tracking-tight sm:text-4xl lg:text-5xl">
            Industry pulse pages that read before they ask.
          </h1>
          <p className="mt-5 max-w-3xl text-base font-medium leading-7 text-neutral-600">
            These pages are the cheap, scalable layer: cached X intelligence, source trails, and just enough charts
            to show where a deeper live pull is worth paying for.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {INDUSTRY_PAGES.map((industry) => (
            <a
              key={industry.slug}
              href={`/industries/${industry.slug}`}
              className="group flex min-h-[300px] flex-col border border-neutral-300 bg-white p-5 shadow-[4px_4px_0_rgba(0,0,0,0.05)] transition hover:-translate-y-0.5 hover:shadow-[6px_6px_0_rgba(0,0,0,0.08)]"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full border border-neutral-300 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-neutral-500">
                  {industry.eyebrow}
                </span>
                <ArrowRight className="h-4 w-4 text-neutral-400 transition group-hover:translate-x-1 group-hover:text-neutral-950" />
              </div>
              <h2 className="mt-6 text-2xl font-black tracking-tight">{industry.label}</h2>
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
  const [persistedVoices, setPersistedVoices] = useState<PulseVoiceRanking[]>([])

  useEffect(() => {
    if (!industry) return
    const activeIndustry = industry
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const next = await loadIndustryRows(activeIndustry.slug)
        if (cancelled) return
        setRows(next)
        setPersistedVoices([])
        setSource(next.length ? 'api' : 'empty')
        setLoading(false)

        void loadIndustryVoices(activeIndustry.slug).then((voices) => {
          if (!cancelled && voices.length) setPersistedVoices(voices)
        })
      } catch (e) {
        if (cancelled) return
        setRows([])
        setPersistedVoices([])
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

  const derived = useMemo(() => (industry ? deriveIndustryRows(rows, industry) : { latest: null, history: [] }), [rows, industry])
  const latest = derived.latest
  const sections = latest ? splitSections(latest.row.summary ?? '') : []
  const stats = useMemo(() => summarizeRows(derived.history), [derived.history])
  const voiceRankings = useMemo(() => {
    if (persistedVoices.length) return sortPulseVoiceRankings(persistedVoices, 10)
    const derivedVoices = rankPulseVoices(derived.history.map((row) => row.row), 8)
    return derivedVoices.length ? derivedVoices : industry ? seedVoiceRankings(industry) : []
  }, [derived.history, industry, persistedVoices])
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
            <h1 className="max-w-4xl text-3xl font-black leading-[1.05] tracking-tight sm:text-4xl lg:text-5xl">
              {industry.label} pulse
            </h1>
            <p className="mt-5 max-w-3xl text-base font-medium leading-7 text-neutral-600">{industry.description}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {industry.tags.map((tag) => (
                <a
                  key={tag}
                  href={pulseTopicHref(tag)}
                  className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-black text-neutral-600 hover:border-neutral-950 hover:text-neutral-950"
                >
                  {tag}
                </a>
              ))}
            </div>
          </div>

          <div className="border-l-4 border-neutral-950 bg-white p-5 shadow-[6px_6px_0_rgba(0,0,0,0.08)]">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-500">My read</div>
            <p className="mt-3 text-base font-black leading-7">{industry.whyGrok}</p>
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
        <StatCard icon={<Activity className="h-5 w-5" />} label="Avg heat" value={stats.avgHeat ? String(stats.avgHeat) : '—'} />
        <StatCard icon={<Clock3 className="h-5 w-5" />} label="Latest age" value={latest ? formatAge(latest.row.created_at) : '—'} />
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
              <PulseSection title="Executive read" eyebrow="What matters" body={sections[0] ?? latest.row.summary ?? ''} citations={latest.row.citations} />
              <PulseSection title="Themes" eyebrow="Narrative clusters" body={sections[1] ?? ''} citations={latest.row.citations} />
              <PulseSection title="Posts worth knowing" eyebrow="Source trail" body={sections[2] ?? ''} citations={latest.row.citations} />
              <PulseSection title="Dissent" eyebrow="Where consensus breaks" body={sections[3] ?? ''} citations={latest.row.citations} />
            </>
          ) : (
            <EmptyState industry={industry} loading={loading} />
          )}
        </div>

        <aside className="space-y-5">
          <ChartPanel title="Customer fit" icon={<Sparkles className="h-5 w-5" />}>
            <div className="space-y-3">
              {questions.map((question, index) => (
                <SearchLink key={question} industry={industry} question={question} index={index + 1} />
              ))}
            </div>
          </ChartPanel>

          <ChartPanel title="Heat history" icon={<LineChart className="h-5 w-5" />}>
            <Sparkline values={derived.history.map((row) => row.heat)} />
            <div className="mt-3 text-xs font-semibold leading-5 text-neutral-500">
              Derived from citations, summary depth, and recency across cached rows.
            </div>
          </ChartPanel>

          <ChartPanel title="Rising voices" icon={<TrendingUp className="h-5 w-5" />}>
            <div className="space-y-3">
              {voiceRankings.map((voice) => (
                <VoiceRankBar key={`${voice.scopeKey}-${voice.handle}`} voice={voice} max={voiceRankings[0]?.rankScore ?? 1} />
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

      <LazySection label="Preparing citations" placeholderHeight={300}>
        <section className="border-y border-neutral-300 bg-white">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-500">Citations</div>
              <h2 className="mt-1 text-3xl font-black tracking-tight">Open the receipts</h2>
              <p className="mt-3 max-w-xl text-sm font-semibold leading-7 text-neutral-600">
                The page is meant to be read fast, but every cached pulse keeps the source trail visible so a customer
                can decide when to run a fresh live pull.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(latest?.row.citations ?? []).length ? (
                (latest?.row.citations ?? []).slice(0, 10).map((citation, index) => (
                  <PulseCitationLink
                    key={`${citation.url ?? index}`}
                    citation={citation}
                    index={index}
                    layout="card"
                    showProfile={false}
                  />
                ))
              ) : (
                <div className="border border-dashed border-neutral-300 bg-[#f7f8f4] px-4 py-8 text-sm font-bold text-neutral-500">
                  No citations cached yet for this vertical.
                </div>
              )}
            </div>
          </div>
        </section>
      </LazySection>

      <LazySection label="Preparing live-search actions" placeholderHeight={180}>
        <section className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 border border-neutral-300 bg-neutral-950 px-5 py-5 text-white md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400">Deep pull</div>
              <div className="mt-1 text-xl font-black sm:text-2xl">Turn the cached read into a customer question.</div>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-neutral-300">
                This is where live search earns the click: fresh X posts, dissent, trader/fan/operator sentiment, and citations.
              </p>
            </div>
            <a
              href={searchUrl(industry, questions[0] ?? `${industry.label} pulse on X this week`)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-300 px-5 py-3 text-sm font-black text-neutral-950"
            >
              Search live
              <Search className="h-4 w-4" />
            </a>
            <a
              href={antiEchoUrl(latest, industry)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 px-5 py-3 text-sm font-black text-white"
            >
              Find dissent
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </section>
      </LazySection>
    </main>
  )
}

function IndustryHeader() {
  return <XSiteHeader active="industries" title="X.SeekBoxAI Pulse" eyebrow="industry desk" />
}

async function loadIndustryRows(slug: string): Promise<PulseRow[]> {
  const res = await fetch(`/api/pulse-runs?limit=30&scope_type=industry&scope_value=${encodeURIComponent(slug)}`)
  if (!res.ok) throw new Error(`pulse API failed: ${res.status}`)
  const json = (await res.json()) as { rows?: PulseRow[] }
  return (json.rows ?? []).filter((row) => row.summary && row.status !== 'error')
}

async function loadIndustryVoices(slug: string): Promise<PulseVoiceRanking[]> {
  const res = await fetch(`/api/pulse-voices?limit=10&scope_type=industry&scope_value=${encodeURIComponent(slug)}`)
  if (!res.ok) return []
  const json = (await res.json()) as { voices?: PulseVoiceRanking[] }
  return Array.isArray(json.voices) ? json.voices : []
}

function deriveIndustryRows(rows: PulseRow[], industry: IndustryPageConfig | null) {
  if (!industry) return { latest: null as DerivedIndustryRow | null, history: [] as DerivedIndustryRow[] }
  const history = rows.map((row) => deriveIndustryRow(row)).sort((a, b) => new Date(a.row.created_at).getTime() - new Date(b.row.created_at).getTime())
  return { latest: history[history.length - 1] ?? null, history }
}

type DerivedIndustryRow = {
  row: PulseRow
  heat: number
  citationCount: number
  handles: string[]
}

function deriveIndustryRow(row: PulseRow): DerivedIndustryRow {
  const citationCount = Array.isArray(row.citations) ? row.citations.length : 0
  const handles = Array.from(
    new Set(
      [...(row.handles ?? []), ...extractHandlesFromText(row.summary)]
        .map((handle) => normalizeXHandle(handle))
        .filter((handle): handle is string => Boolean(handle)),
    ),
  ).slice(0, 12)
  const ageHours = Math.max(0, (Date.now() - new Date(row.created_at).getTime()) / 3600000)
  const freshness = clamp(26 - ageHours * 0.9, 0, 26)
  const summaryWeight = Math.min(((row.summary ?? '').length / 3000) * 18, 18)
  const heat = clamp(24 + citationCount * 4.5 + freshness + summaryWeight, 8, 99)
  return { row, heat, citationCount, handles }
}

function splitSections(summary: string): string[] {
  return summary
    .split(/(?=^\s*(?:\*\*)?\s*\d+[.)]\s*(?:\*\*)?)/m)
    .map((part) => cleanSection(part))
    .filter(Boolean)
}

function cleanSection(section: string): string {
  return section
    .replace(/\[\[\d+\]\]\([^)]+\)/g, '')
    .replace(/\[(\d+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/^\s*(?:[-+•]\s*)+/, '')
    .replace(/^\s*#{1,6}\s*/, '')
    .replace(/^\s*(?:\d+[.)]\s*)+/, '')
    .replace(/^two-sentence executive summary of the overall mood and what people are talking about\.?\s*/i, '')
    .replace(/^(?:executive summary|summary)\s*[:.-]\s*/i, '')
    .replace(/^["“”]+|["“”]+$/g, '')
    .replace(/\s+\n/g, '\n')
    .trim()
}

function summarizeRows(rows: DerivedIndustryRow[]) {
  const count = rows.length
  const citations = rows.reduce((sum, row) => sum + row.citationCount, 0)
  const avgHeat = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.heat, 0) / rows.length) : 0
  return {
    count,
    citations,
    avgHeat,
  }
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
  return cleanseekHref({ query, latest: true, preset: 'web', autorun: true })
}

function antiEchoUrl(latest: DerivedIndustryRow | null, industry: IndustryPageConfig): string {
  const fallback = `${industry.label} consensus is moving in one direction this week.`
  const sections = latest ? splitSections(latest.row.summary ?? '') : []
  const claim = (sections[0] || latest?.row.summary || fallback).replace(/\s+/g, ' ').trim().slice(0, 600)
  return `/labs/anti-echo?claim=${encodeURIComponent(claim)}`
}

function seedVoiceRankings(industry: IndustryPageConfig): PulseVoiceRanking[] {
  return industry.handles.slice(0, 8).map((handle, index) => {
    const normalized = normalizeXHandle(handle) ?? handle
    return {
      handle: normalized.toLowerCase(),
      displayHandle: normalized,
      scopeKey: `industry:${industry.slug}`,
      scopeType: 'industry',
      scopeValue: industry.slug,
      source: 'seed',
      rankScore: Math.max(1, 8 - index),
      heatScore: 0,
      noveltyScore: 0,
      seenCount: 0,
      seedCount: 1,
      citationCount: 0,
      summaryMentionCount: 0,
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      sampleUrls: [],
      sampleContexts: [],
    }
  })
}

function MiniMetric({ label, value, text = false }: { label: string; value: number | string; text?: boolean }) {
  return (
    <div className="border border-neutral-300 bg-[#f7f8f4] px-3 py-3">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">{label}</div>
      <div className={`${text ? 'text-base' : 'text-2xl'} mt-1 font-black text-neutral-950`}>{value}</div>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border border-neutral-300 bg-white px-4 py-4 shadow-[3px_3px_0_rgba(0,0,0,0.05)]">
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">{label}</div>
        <div className="mt-1 text-xl font-black">{value}</div>
      </div>
      <div className="grid h-10 w-10 place-items-center border border-neutral-300 bg-[#f7f8f4] text-neutral-700">{icon}</div>
    </div>
  )
}

function PulseSection({ title, eyebrow, body, citations }: { title: string; eyebrow: string; body: string; citations?: PulseCitation[] | null }) {
  if (!body.trim()) return null
  return (
    <article className="border border-neutral-300 bg-white p-5 shadow-[4px_4px_0_rgba(0,0,0,0.05)]">
      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-500">{eyebrow}</div>
      <h2 className="mt-1 text-2xl font-black tracking-tight">{title}</h2>
      <p className="mt-4 whitespace-pre-line text-sm font-semibold leading-7 text-neutral-700">{body}</p>
      <CitationRefs citations={citations ?? null} />
    </article>
  )
}

function CitationRefs({ citations, limit = 4 }: { citations: PulseCitation[] | null; limit?: number }) {
  const refs = (citations ?? []).filter((citation) => citation.url).slice(0, limit)
  if (!refs.length) return null
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-3">
      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">Referenced sources</span>
      {refs.map((citation, index) => (
        <CitationLink key={`${citation.url ?? index}`} citation={citation} index={index} />
      ))}
    </div>
  )
}

function CitationLink({ citation, index }: { citation: PulseCitation; index: number }) {
  return <PulseCitationLink citation={citation} index={index} />
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
      <h2 className="mt-2 text-2xl font-black sm:text-3xl">{loading ? 'Checking the pulse table.' : 'This vertical is ready for data.'}</h2>
      <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-neutral-600">
        The page shell is built. Once the Worker writes a completed pulse for {industry.slug}, the executive read,
        charts, citations, and voice rail will fill from the X.SeekBoxAI cache.
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

function VoiceRankBar({ voice, max }: { voice: PulseVoiceRanking; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((voice.rankScore / max) * 100)) : 0
  const badge =
    voice.source === 'discovered'
      ? 'bg-cyan-50 text-cyan-900 border-cyan-200'
      : voice.source === 'mixed'
        ? 'bg-amber-50 text-amber-900 border-amber-200'
        : 'bg-neutral-100 text-neutral-700 border-neutral-300'
  return (
    <a href={voiceProfileHref(voice.handle)} className="group block">
      <div className="mb-1 flex items-center justify-between gap-3 text-xs font-black">
        <span className="min-w-0 truncate text-neutral-700 group-hover:text-neutral-950 group-hover:underline">@{voice.displayHandle}</span>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wide ${badge}`}>{voice.source}</span>
      </div>
      <div className="h-2 bg-neutral-100">
        <div className="h-full bg-neutral-950" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] font-bold text-neutral-500">
        <span>{voice.seenCount ? `${voice.seenCount} runs` : 'seed'} · {voice.citationCount} cites</span>
        <span>{voice.rankScore}</span>
      </div>
    </a>
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
