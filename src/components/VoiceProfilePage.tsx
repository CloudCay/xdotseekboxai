import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react'
import { Activity, AlertTriangle, ExternalLink, Hash, Search, TrendingUp, UserRound } from 'lucide-react'
import { cleanseekHref } from '../lib/cleanseekUrl'
import { canonicalizeIndustrySlug, getIndustryPage } from '../lib/industryCatalog'
import {
  extractHandleFromSocialUrl,
  extractHandlesFromText,
  normalizeXHandle,
  rankPulseVoices,
  sortPulseVoiceRankings,
  type PulseVoiceRanking,
} from '../lib/pulseVoiceRankings'
import { openSourcePopup } from '../lib/sourcePopup'
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

type VoiceAppearance = {
  row: PulseRow
  industryLabel: string
  industryHref: string
  headline: string
  context: string
  citations: PulseCitation[]
  isSeed: boolean
  summaryMentioned: boolean
}

type VoiceIndustry = {
  label: string
  href: string
  count: number
  citations: number
}

type VoiceProfile = {
  handle: string
  displayHandle: string
  xUrl: string
  source: PulseVoiceRanking['source']
  rankScore: number
  heatScore: number
  noveltyScore: number
  seenCount: number
  seedCount: number
  citationCount: number
  summaryMentionCount: number
  firstSeenAt: string
  lastSeenAt: string
  appearances: VoiceAppearance[]
  industries: VoiceIndustry[]
  sampleUrls: string[]
}

export function VoiceProfilePage({ handle }: { handle: string }) {
  const [rows, setRows] = useState<PulseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const normalizedHandle = normalizeXHandle(handle)

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
          setError(e instanceof Error ? e.message : 'Voice profile rows could not load.')
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

  const profile = useMemo(() => (normalizedHandle ? buildVoiceProfile(rows, normalizedHandle) : null), [rows, normalizedHandle])

  if (!normalizedHandle) {
    return (
      <main className="min-h-screen bg-[#f7f8f4] text-neutral-950">
        <XSiteHeader active="none" title="X.SeekBoxAI Pulse" eyebrow="voice profile" />
        <EmptyProfile title="Invalid voice" body="That handle does not look like a valid X account handle." />
      </main>
    )
  }

  if (!profile && !loading) {
    return (
      <main className="min-h-screen bg-[#f7f8f4] text-neutral-950">
        <XSiteHeader active="none" title="X.SeekBoxAI Pulse" eyebrow="voice profile" />
        <EmptyProfile
          title={`@${normalizedHandle} is not in the cached pulse yet.`}
          body="The profile appears after the account is seen in tracked handles, summary text, or X citation URLs."
        />
      </main>
    )
  }

  const displayHandle = profile?.displayHandle ?? normalizedHandle

  return (
    <main className="min-h-screen bg-[#f7f8f4] text-neutral-950">
      <XSiteHeader active="none" title="X.SeekBoxAI Pulse" eyebrow="voice profile" />

      <section className="border-b border-neutral-300 bg-[#fbfbf7]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-neutral-600">
              <span className={`h-2 w-2 rounded-full ${loading ? 'bg-amber-400' : 'bg-emerald-500'}`} />
              {loading ? 'LOADING CACHE' : 'VOICE PROFILE'}
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">@{displayHandle}</h1>
            <p className="mt-5 max-w-3xl text-base font-medium leading-7 text-neutral-600">
              A cache-first view of where this account appears in X.SeekBoxAI pulse rows, which industries carry it,
              and which citations point back to X.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <a
                href={profile?.xUrl ?? `https://x.com/${displayHandle}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-neutral-950 px-4 py-2 text-sm font-black text-white"
              >
                Open X profile
                <ExternalLink className="h-4 w-4" />
              </a>
              <a
                href={voiceSearchUrl(displayHandle)}
                className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-black text-neutral-800 hover:border-neutral-950"
              >
                Search this voice
                <Search className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="border-l-4 border-neutral-950 bg-white p-5 shadow-[6px_6px_0_rgba(0,0,0,0.08)]">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-500">Cache read</div>
            <p className="mt-3 text-base font-black leading-7">
              {profile
                ? `${profile.appearances.length} cached runs mention @${displayHandle}; ${profile.citationCount} source links point to this account.`
                : 'Gathering cached pulse rows for this voice.'}
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <MiniMetric label="Score" value={profile?.rankScore ?? '-'} />
              <MiniMetric label="Cites" value={profile?.citationCount ?? '-'} />
              <MiniMetric label="Industries" value={profile?.industries.length ?? '-'} />
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

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-4 lg:px-8">
        <StatCard icon={<Activity className="h-5 w-5" />} label="Seen Runs" value={String(profile?.seenCount ?? 0)} />
        <StatCard icon={<ExternalLink className="h-5 w-5" />} label="Citations" value={String(profile?.citationCount ?? 0)} />
        <StatCard icon={<Hash className="h-5 w-5" />} label="Mentions" value={String(profile?.summaryMentionCount ?? 0)} />
        <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Last Seen" value={profile ? formatAge(profile.lastSeenAt) : '-'} />
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <div>
          <SectionHeader eyebrow="Source trail" title="Cached appearances" />
          <div className="grid gap-4 2xl:grid-cols-2">
            {profile?.appearances.length ? (
              profile.appearances.slice(0, 16).map((appearance) => (
                <AppearanceCard key={`${appearance.row.id}-${appearance.industryHref}`} appearance={appearance} />
              ))
            ) : (
              <EmptyPanel title={loading ? 'Building profile' : 'No appearances'} body="The profile fills from completed industry pulse rows." />
            )}
          </div>
        </div>

        <aside className="space-y-5">
          <ChartPanel title="Industries carrying it" icon={<UserRound className="h-5 w-5" />}>
            <div className="space-y-3">
              {(profile?.industries ?? []).slice(0, 10).map((industry) => (
                <a key={industry.href} href={industry.href} className="block group">
                  <div className="mb-1 flex items-center justify-between gap-3 text-xs font-black">
                    <span className="truncate text-neutral-700 group-hover:text-neutral-950">{industry.label}</span>
                    <span className="text-neutral-500">{industry.count}</span>
                  </div>
                  <div className="h-2 bg-neutral-100">
                    <div className="h-full bg-neutral-950" style={{ width: `${Math.min(100, industry.count * 18 + industry.citations * 6)}%` }} />
                  </div>
                </a>
              ))}
            </div>
          </ChartPanel>

          <ChartPanel title="Profile evidence" icon={<Activity className="h-5 w-5" />}>
            <div className="space-y-3 text-sm font-semibold leading-6 text-neutral-600">
              <EvidenceRow label="Source" value={profile?.source ?? 'pending'} />
              <EvidenceRow label="Seed hits" value={String(profile?.seedCount ?? 0)} />
              <EvidenceRow label="First seen" value={profile ? formatDate(profile.firstSeenAt) : '-'} />
              <EvidenceRow label="Novelty" value={String(profile?.noveltyScore ?? 0)} />
            </div>
          </ChartPanel>

          <ChartPanel title="Sample X links" icon={<ExternalLink className="h-5 w-5" />}>
            <div className="space-y-2">
              {(profile?.sampleUrls ?? []).slice(0, 6).map((url, index) => (
                <a
                  key={url}
                  href={url}
                  onClick={(event) => sourceClick(event, url)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-3 border border-neutral-200 bg-[#f7f8f4] px-3 py-2 text-xs font-black text-neutral-700 hover:border-neutral-950"
                >
                  Source [{index + 1}]
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ))}
            </div>
          </ChartPanel>
        </aside>
      </section>
    </main>
  )
}

async function loadRowsFromApi(): Promise<PulseRow[]> {
  const res = await fetch('/api/pulse-runs?limit=500&scope_type=industry')
  if (!res.ok) throw new Error(`pulse API failed: ${res.status}`)
  const json = (await res.json()) as { rows?: PulseRow[] }
  return (json.rows ?? []).filter((row) => row.summary && row.status !== 'error' && row.scope_type === 'industry')
}

function buildVoiceProfile(rows: PulseRow[], rawHandle: string): VoiceProfile | null {
  const handle = normalizeXHandle(rawHandle)?.toLowerCase()
  if (!handle) return null

  const rankings = sortPulseVoiceRankings(rankPulseVoices(rows, 500).filter((voice) => voice.handle === handle), 500)
  const appearances = rows
    .map((row) => appearanceForRow(row, handle))
    .filter((item): item is VoiceAppearance => Boolean(item))
    .sort((a, b) => new Date(b.row.created_at).getTime() - new Date(a.row.created_at).getTime())

  if (!rankings.length && !appearances.length) return null

  const displayHandle = rankings[0]?.displayHandle ?? appearances[0]?.citations.map((citation) => extractHandleFromSocialUrl(citation.url)).find(Boolean) ?? rawHandle
  const industries = aggregateIndustries(appearances)
  const sampleUrls = uniqueStrings([
    ...rankings.flatMap((ranking) => ranking.sampleUrls),
    ...appearances.flatMap((appearance) => appearance.citations.map((citation) => citation.url ?? '')),
  ]).slice(0, 12)
  const source = sourceFromRankings(rankings)
  const firstSeenAt = oldestDate(rankings.map((ranking) => ranking.firstSeenAt).concat(appearances.map((item) => item.row.created_at)))
  const lastSeenAt = newestDate(rankings.map((ranking) => ranking.lastSeenAt).concat(appearances.map((item) => item.row.created_at)))

  return {
    handle,
    displayHandle,
    xUrl: `https://x.com/${displayHandle}`,
    source,
    rankScore: sum(rankings.map((ranking) => ranking.rankScore)),
    heatScore: Math.max(0, ...rankings.map((ranking) => ranking.heatScore)),
    noveltyScore: Math.max(0, ...rankings.map((ranking) => ranking.noveltyScore)),
    seenCount: Math.max(appearances.length, sum(rankings.map((ranking) => ranking.seenCount))),
    seedCount: sum(rankings.map((ranking) => ranking.seedCount)),
    citationCount: appearances.reduce((total, item) => total + item.citations.length, 0) || sum(rankings.map((ranking) => ranking.citationCount)),
    summaryMentionCount: sum(rankings.map((ranking) => ranking.summaryMentionCount)),
    firstSeenAt,
    lastSeenAt,
    appearances,
    industries,
    sampleUrls,
  }
}

function appearanceForRow(row: PulseRow, targetHandle: string): VoiceAppearance | null {
  const summary = row.summary ?? ''
  const seeded = (row.handles ?? []).map((item) => normalizeXHandle(item)?.toLowerCase()).includes(targetHandle)
  const mentioned = extractHandlesFromText(summary).some((item) => item.toLowerCase() === targetHandle)
  const citations = (row.citations ?? []).filter((citation) => extractHandleFromSocialUrl(citation.url)?.toLowerCase() === targetHandle)

  if (!seeded && !mentioned && !citations.length) return null

  const industry = industryForRow(row)
  const sections = splitSections(summary)
  return {
    row,
    industryLabel: industry.label,
    industryHref: industry.href,
    headline: firstSentence(sections[0] ?? summary) || `${industry.label} pulse mentions @${targetHandle}`,
    context: contextForHandle(summary, targetHandle) || firstSentence(sections[1] ?? sections[0] ?? summary) || 'Mentioned in this cached pulse row.',
    citations,
    isSeed: seeded,
    summaryMentioned: mentioned,
  }
}

function aggregateIndustries(appearances: VoiceAppearance[]): VoiceIndustry[] {
  const items = new Map<string, VoiceIndustry>()
  for (const appearance of appearances) {
    const existing =
      items.get(appearance.industryHref) ??
      ({
        label: appearance.industryLabel,
        href: appearance.industryHref,
        count: 0,
        citations: 0,
      } satisfies VoiceIndustry)
    existing.count += 1
    existing.citations += appearance.citations.length
    items.set(appearance.industryHref, existing)
  }
  return Array.from(items.values()).sort((a, b) => b.citations - a.citations || b.count - a.count || a.label.localeCompare(b.label))
}

function industryForRow(row: PulseRow): { label: string; href: string } {
  const slug = canonicalizeIndustrySlug(row.scope_value)
  const industry = getIndustryPage(slug)
  if (industry) return { label: industry.label, href: `/industries/${industry.slug}` }
  const label = labelScope(row.scope_value ?? 'Industry')
  return { label, href: '/industries' }
}

function AppearanceCard({ appearance }: { appearance: VoiceAppearance }) {
  return (
    <article className="border border-neutral-300 bg-white p-5 shadow-[4px_4px_0_rgba(0,0,0,0.05)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <a href={appearance.industryHref} className="text-[11px] font-black uppercase tracking-[0.16em] text-neutral-500 hover:text-neutral-950">
          {appearance.industryLabel}
        </a>
        <span className="text-xs font-bold text-neutral-500">{formatAge(appearance.row.created_at)}</span>
      </div>
      <h2 className="mt-4 text-xl font-black leading-tight">{appearance.headline}</h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-neutral-600">{appearance.context}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {appearance.isSeed ? <Badge>tracked</Badge> : null}
        {appearance.summaryMentioned ? <Badge>summary</Badge> : null}
        {appearance.citations.length ? <Badge>{appearance.citations.length} citations</Badge> : null}
      </div>
      <CitationRefs citations={appearance.citations} />
    </article>
  )
}

function CitationRefs({ citations }: { citations: PulseCitation[] }) {
  if (!citations.length) return null
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-3">
      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">Sources</span>
      {citations.slice(0, 6).map((citation, index) => (
        <PulseCitationLink key={`${citation.url ?? index}`} citation={citation} index={index} showProfile={false} />
      ))}
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border border-neutral-300 bg-[#f7f8f4] px-3 py-3">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">{label}</div>
      <div className="mt-1 text-xl font-black text-neutral-950">{value}</div>
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

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-5">
      <div className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-500">{eyebrow}</div>
      <h2 className="mt-1 text-3xl font-black tracking-tight">{title}</h2>
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

function EvidenceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-neutral-100 pb-2">
      <span className="text-neutral-500">{label}</span>
      <span className="font-black text-neutral-900">{value}</span>
    </div>
  )
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-neutral-300 bg-neutral-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-neutral-600">{children}</span>
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-dashed border-neutral-300 bg-white px-5 py-10 text-center">
      <div className="text-lg font-black">{title}</div>
      <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-6 text-neutral-500">{body}</p>
    </div>
  )
}

function EmptyProfile({ title, body }: { title: string; body: string }) {
  return (
    <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
      <div className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-500">Voice profile</div>
      <h1 className="mt-3 text-4xl font-black">{title}</h1>
      <p className="mx-auto mt-4 max-w-xl text-sm font-semibold leading-6 text-neutral-600">{body}</p>
      <a href="/" className="mt-6 inline-flex rounded-lg bg-neutral-950 px-5 py-3 text-sm font-black text-white">
        Back to pulse
      </a>
    </section>
  )
}

function sourceClick(event: MouseEvent<HTMLAnchorElement>, url: string | null | undefined) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
  if (!url) return
  event.preventDefault()
  openSourcePopup(url)
}

function voiceSearchUrl(handle: string): string {
  const query = `@${handle} across X industry conversations. Show where this voice appears, strongest posts, dissent, and citations.`
  return cleanseekHref({ query, latest: true, preset: 'web', autorun: true })
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
    .replace(/^\s*(?:[-+*]\s*)+/, '')
    .replace(/^\s*#{1,6}\s*/, '')
    .replace(/^\s*(?:\d+[.)]\s*)+/, '')
    .replace(/^["']+|["']+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function firstSentence(text: string): string {
  const protectedText = cleanSection(text)
    .replace(/U\.S\./g, 'U<S>S<S>')
    .replace(/([A-Z])\.([A-Z])\./g, '$1<S>$2<S>')
    .replace(/(\d)\.(\d)/g, '$1<S>$2')
  const sentence = protectedText.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/)?.[0] ?? ''
  return sentence.replace(/<S>/g, '.').trim()
}

function contextForHandle(summary: string, handle: string): string | null {
  if (!summary) return null
  const escaped = handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`[^.!?\\n]{0,120}@${escaped}[^.!?\\n]{0,180}`, 'i').exec(summary)
  return match?.[0]?.replace(/\s+/g, ' ').trim().slice(0, 320) ?? null
}

function labelScope(raw: string): string {
  const spaced = raw.replace(/^industry:/, '').replace(/[-_]+/g, ' ').trim()
  if (!spaced) return 'Industry'
  if (spaced.toLowerCase() === 'tech saas') return 'Tech & SaaS'
  return spaced.replace(/\b\w/g, (m) => m.toUpperCase()).replace(/\bAi\b/g, 'AI').replace(/\bSaas\b/g, 'SaaS')
}

function sourceFromRankings(rankings: PulseVoiceRanking[]): PulseVoiceRanking['source'] {
  if (rankings.some((ranking) => ranking.source === 'mixed')) return 'mixed'
  if (rankings.some((ranking) => ranking.source === 'discovered')) return 'discovered'
  return rankings[0]?.source ?? 'discovered'
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function oldestDate(values: string[]): string {
  const valid = values.filter(Boolean)
  return valid.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ?? new Date().toISOString()
}

function newestDate(values: string[]): string {
  const valid = values.filter(Boolean)
  return valid.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? new Date().toISOString()
}

function formatAge(createdAt: string): string {
  const timestamp = new Date(createdAt).getTime()
  if (!Number.isFinite(timestamp)) return 'just now'
  const mins = Math.max(0, Math.floor((Date.now() - timestamp) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '-'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
