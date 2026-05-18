import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Activity, AlertTriangle, ArrowRight, ExternalLink, Hash, Newspaper, Search, TrendingUp } from 'lucide-react'
import { cleanseekHref } from '../lib/cleanseekUrl'
import { canonicalizeIndustrySlug, getIndustryPage } from '../lib/industryCatalog'
import { inferPulseTopicTags, pulseTopicLabel, pulseTopicSlug } from '../lib/pulseTopics'
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
  handles: string[] | null
  summary: string | null
  citations: PulseCitation[] | null
  tags: string[] | null
  status: string | null
  created_at: string
}

type TopicBrief = {
  row: PulseRow
  industryLabel: string
  industryHref: string
  headline: string
  dek: string
  citations: PulseCitation[]
  heat: number
}

type TopicSummary = {
  slug: string
  label: string
  count: number
  citations: number
  heat: number
  freshest: string
  industries: Array<{ label: string; href: string; count: number }>
  briefs: TopicBrief[]
}

export function TopicTagsPage({ tagSlug }: { tagSlug?: string }) {
  const [rows, setRows] = useState<PulseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const next = await loadRowsFromApi()
        if (!cancelled) setRows(next)
      } catch (e) {
        if (!cancelled) {
          setRows([])
          setError(e instanceof Error ? e.message : 'Topic tags could not load.')
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

  const topics = useMemo(() => buildTopicIndex(rows), [rows])
  const active = tagSlug ? topics.find((topic) => topic.slug === tagSlug) ?? null : null
  const stats = useMemo(() => summarizeTopics(topics), [topics])

  if (tagSlug && !active && !loading) {
    return (
      <main className="min-h-screen bg-[#f7f8f4] text-neutral-950">
        <TopicHeader active="topics" />
        <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-500">Topic not found</div>
          <h1 className="mt-3 text-4xl font-black">{pulseTopicLabel(tagSlug)} is not in the cached pulse yet.</h1>
          <a href="/topics" className="mt-6 inline-flex rounded-lg bg-neutral-950 px-5 py-3 text-sm font-black text-white">
            Browse topic tags
          </a>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f7f8f4] text-neutral-950">
      <TopicHeader active="topics" />

      <section className="border-b border-neutral-300 bg-[#fbfbf7]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-neutral-600">
              <span className={`h-2 w-2 rounded-full ${loading ? 'bg-amber-400' : 'bg-emerald-500'}`} />
              {loading ? 'LOADING SEEKBOX CACHE' : 'TOPIC INDEX'}
            </div>
            <h1 className="mt-4 max-w-4xl text-3xl font-black leading-[1.05] tracking-tight sm:text-4xl lg:text-5xl">
              {active ? `${active.label} across the pulse` : 'Topic tags across the industry pulse'}
            </h1>
            <p className="mt-5 max-w-3xl text-base font-medium leading-7 text-neutral-600">
              Topic pages cut across verticals. Use them when the question is not “which industry?” but “where is this
              narrative showing up, and what should we read next?”
            </p>
          </div>

          <div className="border-l-4 border-neutral-950 bg-white p-5 shadow-[6px_6px_0_rgba(0,0,0,0.08)]">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-500">Tag model</div>
            <p className="mt-3 text-base font-black leading-7">
              Tags come from the pulse metadata plus light keyword extraction, so the index can survive sparse cached rows.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <MiniMetric label="Tags" value={stats.tags} />
              <MiniMetric label="Briefs" value={stats.briefs} />
              <MiniMetric label="Cites" value={stats.citations} />
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
          <div className="flex items-start gap-3 border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        </div>
      ) : null}

      {active ? <TopicDetail topic={active} /> : <TopicIndex topics={topics} loading={loading} />}
    </main>
  )
}

function TopicIndex({ topics, loading }: { topics: TopicSummary[]; loading: boolean }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <SectionHeader eyebrow="Drilldown" title="Pick the narrative, not the vertical" />
        <a
          href="/industries"
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-black text-neutral-800 hover:border-neutral-950"
        >
          Browse industries
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {topics.length ? (
          topics.map((topic) => <TopicCard key={topic.slug} topic={topic} />)
        ) : (
          <EmptyPanel
            title={loading ? 'Building topic tags' : 'No topic tags yet'}
            body="The topic index fills from completed industry pulse rows."
          />
        )}
      </div>
    </section>
  )
}

function TopicDetail({ topic }: { topic: TopicSummary }) {
  const topIndustries = topic.industries.slice(0, 8)
  return (
    <>
      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-4 lg:px-8">
        <StatCard icon={<Hash className="h-5 w-5" />} label="Tagged briefs" value={String(topic.count)} />
        <StatCard icon={<ExternalLink className="h-5 w-5" />} label="Citations" value={String(topic.citations)} />
        <StatCard icon={<Activity className="h-5 w-5" />} label="Heat" value={String(topic.heat)} />
        <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Freshest" value={formatAge(topic.freshest)} />
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <div>
          <SectionHeader eyebrow="Related briefs" title={`${topic.label} source trail`} />
          <div className="grid gap-4 2xl:grid-cols-2">
            {topic.briefs.slice(0, 12).map((brief) => (
              <TopicBriefCard key={`${topic.slug}-${brief.row.id}`} brief={brief} />
            ))}
          </div>
        </div>

        <aside className="space-y-5">
          <ChartPanel title="Industries carrying it" icon={<Newspaper className="h-5 w-5" />}>
            <div className="space-y-3">
              {topIndustries.map((industry) => (
                <a key={industry.href} href={industry.href} className="block group">
                  <div className="mb-1 flex items-center justify-between gap-3 text-xs font-black">
                    <span className="truncate text-neutral-700 group-hover:text-neutral-950">{industry.label}</span>
                    <span className="text-neutral-500">{industry.count}</span>
                  </div>
                  <div className="h-2 bg-neutral-100">
                    <div className="h-full bg-neutral-950" style={{ width: `${Math.min(100, industry.count * 22)}%` }} />
                  </div>
                </a>
              ))}
            </div>
          </ChartPanel>

          <ChartPanel title="Next pull" icon={<Search className="h-5 w-5" />}>
            <p className="text-sm font-semibold leading-6 text-neutral-600">
              Use live search when the cached tag is pointing at something that needs fresh posts, dissent, and stronger citations.
            </p>
            <a
              href={searchUrl(topic)}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-950 px-4 py-3 text-sm font-black text-white"
            >
              Search this topic
              <Search className="h-4 w-4" />
            </a>
          </ChartPanel>

          <a
            href="/topics"
            className="flex items-center justify-between border border-neutral-300 bg-white px-4 py-3 text-sm font-black text-neutral-800 hover:border-neutral-950"
          >
            Back to all tags
            <ArrowRight className="h-4 w-4 rotate-180" />
          </a>
        </aside>
      </section>
    </>
  )
}

function TopicCard({ topic }: { topic: TopicSummary }) {
  const lead = topic.briefs[0]
  return (
    <a
      href={`/topics/${topic.slug}`}
      className="group flex min-h-[280px] flex-col border border-neutral-300 bg-white p-5 shadow-[4px_4px_0_rgba(0,0,0,0.05)] transition hover:-translate-y-0.5 hover:border-neutral-950 hover:shadow-[6px_6px_0_rgba(0,0,0,0.08)]"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full border border-neutral-300 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-neutral-500">
          {topic.count} briefs
        </span>
        <ArrowRight className="h-4 w-4 text-neutral-400 transition group-hover:translate-x-1 group-hover:text-neutral-950" />
      </div>
      <h2 className="mt-5 text-2xl font-black tracking-tight">{topic.label}</h2>
      <p className="mt-3 flex-1 text-sm font-semibold leading-6 text-neutral-600">
        {lead?.headline ?? 'Waiting for more cached briefs to shape this tag.'}
      </p>
      <div className="mt-5 grid grid-cols-3 gap-2">
        <MiniMetric label="Heat" value={topic.heat} />
        <MiniMetric label="Cites" value={topic.citations} />
        <MiniMetric label="Fresh" value={formatAge(topic.freshest)} text />
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {topic.industries.slice(0, 3).map((industry) => (
          <span key={industry.href} className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-black text-neutral-600">
            {industry.label}
          </span>
        ))}
      </div>
    </a>
  )
}

function TopicBriefCard({ brief }: { brief: TopicBrief }) {
  return (
    <article className="border border-neutral-300 bg-white p-5 shadow-[4px_4px_0_rgba(0,0,0,0.05)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <a href={brief.industryHref} className="text-[11px] font-black uppercase tracking-[0.16em] text-neutral-500 hover:text-neutral-950">
          {brief.industryLabel}
        </a>
        <span className="text-xs font-bold text-neutral-500">{formatAge(brief.row.created_at)}</span>
      </div>
      <h3 className="mt-4 text-xl font-black leading-tight">{brief.headline}</h3>
      <p className="mt-3 text-sm font-semibold leading-6 text-neutral-600">{brief.dek}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <MiniMetric label="Heat" value={brief.heat} />
        <MiniMetric label="Cites" value={brief.citations.length} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-3">
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">Sources</span>
        {brief.citations.slice(0, 4).map((citation, index) => (
          <CitationLink key={`${brief.row.id}-${citation.url ?? index}`} citation={citation} index={index} />
        ))}
      </div>
    </article>
  )
}

function CitationLink({ citation, index }: { citation: PulseCitation; index: number }) {
  return <PulseCitationLink citation={citation} index={index} />
}

function TopicHeader({ active }: { active: 'topics' | 'none' }) {
  return <XSiteHeader active={active === 'topics' ? 'topics' : 'none'} title="X.SeekBoxAI Pulse" eyebrow="topic desk" />
}

async function loadRowsFromApi(): Promise<PulseRow[]> {
  const res = await fetch('/api/pulse-runs?limit=160&scope_type=industry')
  if (!res.ok) throw new Error(`pulse API failed: ${res.status}`)
  const json = (await res.json()) as { rows?: PulseRow[] }
  return (json.rows ?? []).filter((row) => row.summary && row.status !== 'error' && row.scope_type === 'industry')
}

function buildTopicIndex(rows: PulseRow[]): TopicSummary[] {
  const topics = new Map<string, TopicSummary>()
  for (const row of rows) {
    const brief = briefFromRow(row)
    const rowTopics = topicTagsForRow(row)
    for (const label of rowTopics) {
      const slug = pulseTopicSlug(label)
      if (!slug) continue
      const existing =
        topics.get(slug) ??
        ({
          slug,
          label,
          count: 0,
          citations: 0,
          heat: 0,
          freshest: row.created_at,
          industries: [],
          briefs: [],
        } satisfies TopicSummary)
      existing.count += 1
      existing.citations += brief.citations.length
      existing.freshest = newerDate(existing.freshest, row.created_at)
      existing.briefs.push(brief)
      existing.industries = mergeIndustry(existing.industries, brief.industryLabel, brief.industryHref)
      topics.set(slug, existing)
    }
  }

  const sortedTopics = Array.from(topics.values())
    .map((topic) => ({
      ...topic,
      briefs: topic.briefs.sort((a, b) => b.heat - a.heat || new Date(b.row.created_at).getTime() - new Date(a.row.created_at).getTime()),
      industries: topic.industries.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    }))

  return scoreTopics(sortedTopics).sort((a, b) => b.heat - a.heat || b.count - a.count || b.citations - a.citations)
}

function topicTagsForRow(row: PulseRow): string[] {
  return inferPulseTopicTags(row.tags, row.summary).slice(0, 8)
}

function briefFromRow(row: PulseRow): TopicBrief {
  const summary = row.summary ?? ''
  const sections = splitSections(summary)
  const industry = industryForRow(row)
  const citations = (row.citations ?? []).filter((citation) => citation.url)
  const headline = firstSentence(sections[0] ?? summary) || `${industry.label} pulse is moving`
  const dek = firstSentence(sections[1] ?? sections[0] ?? summary) || 'A cached source trail is ready for review.'
  const heat = briefHeatScore(row, citations.length)
  return {
    row,
    industryLabel: industry.label,
    industryHref: industry.href,
    headline,
    dek,
    citations,
    heat,
  }
}

function industryForRow(row: PulseRow): { label: string; href: string } {
  const slug = canonicalizeIndustrySlug(row.scope_value)
  const industry = getIndustryPage(slug)
  if (industry) return { label: industry.label, href: `/industries/${industry.slug}` }
  const label = labelScope(row.scope_value ?? 'Industry')
  return { label, href: '/industries' }
}

function mergeIndustry(items: TopicSummary['industries'], label: string, href: string): TopicSummary['industries'] {
  const existing = items.find((item) => item.href === href)
  if (existing) {
    existing.count += 1
    return items
  }
  return [...items, { label, href, count: 1 }]
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
    .replace(/\s+/g, ' ')
    .trim()
}

function firstSentence(text: string): string {
  const protectedText = cleanSection(text)
    .replace(/U\.S\./g, 'U§S§')
    .replace(/([A-Z])\.([A-Z])\./g, '$1§$2§')
    .replace(/(\d)\.(\d)/g, '$1§$2')
  const sentence = protectedText.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/)?.[0] ?? ''
  return sentence.replace(/§/g, '.').trim()
}

function labelScope(raw: string): string {
  const spaced = raw.replace(/^industry:/, '').replace(/[-_]+/g, ' ').trim()
  if (!spaced) return 'Industry'
  if (spaced.toLowerCase() === 'tech saas') return 'Tech & SaaS'
  return spaced.replace(/\b\w/g, (m) => m.toUpperCase()).replace(/\bAi\b/g, 'AI').replace(/\bSaas\b/g, 'SaaS')
}

function briefHeatScore(row: PulseRow, citationCount: number): number {
  const ageHours = Math.max(0, (Date.now() - new Date(row.created_at).getTime()) / 3600000)
  const freshness = 30 * Math.exp(-ageHours / 48)
  const citationSignal = Math.min(30, Math.log1p(citationCount) * 12)
  const summaryDepth = Math.min(14, Math.sqrt((row.summary ?? '').length / 3200) * 14)
  const movement = movementSignal(row.summary)
  return clampRound(8 + freshness + citationSignal + summaryDepth + movement, 8, 96)
}

function scoreTopics(topics: TopicSummary[]): TopicSummary[] {
  const rawScores = topics.map((topic) => topicMomentumScore(topic))
  const min = Math.min(...rawScores)
  const max = Math.max(...rawScores)

  if (!Number.isFinite(min) || !Number.isFinite(max)) return topics
  if (max - min < 1) {
    return topics.map((topic, index) => ({
      ...topic,
      heat: clampRound(58 + Math.min(topic.count, 8) * 3 - index, 15, 92),
    }))
  }

  return topics.map((topic, index) => {
    const relative = (rawScores[index] - min) / (max - min)
    const rankBoost = topics.length > 1 ? (1 - index / (topics.length - 1)) * 8 : 0
    return {
      ...topic,
      heat: clampRound(24 + relative * 67 + rankBoost, 12, 99),
    }
  })
}

function topicMomentumScore(topic: TopicSummary): number {
  const topBriefs = topic.briefs.slice(0, 3)
  const topBriefHeat = average(topBriefs.map((brief) => brief.heat)) || 0
  const overallBriefHeat = average(topic.briefs.map((brief) => brief.heat)) || topBriefHeat
  const activity = Math.log1p(topic.count) * 18
  const evidence = Math.log1p(topic.citations) * 15
  const breadth = Math.log1p(topic.industries.length) * 14
  const freshness = freshnessScore(topic.freshest)

  return topBriefHeat * 0.42 + overallBriefHeat * 0.18 + activity + evidence + breadth + freshness * 0.28
}

function freshnessScore(createdAt: string): number {
  const ageHours = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 3600000)
  return 40 * Math.exp(-ageHours / 72)
}

function movementSignal(summary: string | null): number {
  const text = summary ?? ''
  const matches = text.match(/\b(new|launch|launched|release|released|surge|spike|breakthrough|risk|warning|pushback|dissent|negative|positive|mixed|debate|shift|trend|gaining|accelerate|scrutiny)\b/gi)
  return Math.min(matches?.length ?? 0, 10)
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function clampRound(value: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, value)))
}

function newerDate(a: string, b: string): string {
  return new Date(b).getTime() > new Date(a).getTime() ? b : a
}

function summarizeTopics(topics: TopicSummary[]) {
  return {
    tags: topics.length,
    briefs: topics.reduce((sum, topic) => sum + topic.count, 0),
    citations: topics.reduce((sum, topic) => sum + topic.citations, 0),
  }
}

function searchUrl(topic: TopicSummary): string {
  const query = `${topic.label} across X industry conversations. Include recent posts, industry differences, dissent, and citations.`
  return cleanseekHref({ query, latest: true, preset: 'web', autorun: true })
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

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <div className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-500">{eyebrow}</div>
      <h2 className="mt-1 text-2xl font-black tracking-tight text-neutral-950 sm:text-3xl">{title}</h2>
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
