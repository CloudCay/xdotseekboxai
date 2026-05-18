import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  Activity,
  BarChart3,
  ExternalLink,
  Flame,
  LineChart,
  Radio,
  Search,
  Sparkles,
  TrendingUp,
  UsersRound,
  Zap,
} from 'lucide-react'
import { XSiteHeader } from '../components/XSiteHeader'
import { cleanseekHref } from '../lib/cleanseekUrl'
import { extractHandleFromSocialUrl, voiceProfileHref, type PulseVoiceRanking } from '../lib/pulseVoiceRankings'
import { getArenaPulseData, type ArenaPulseRow } from '../server/arenaPulse.functions'

export const Route = createFileRoute('/arena')({
  head: () => ({
    meta: [{ title: 'X Pulse Arena - X.SeekBoxAI' }],
  }),
  loader: async () => getArenaPulseData({ data: { scopeType: 'industry', limit: 500, voiceLimit: 50 } }),
  component: XPulseArenaRoute,
})

type PulseRow = ArenaPulseRow

type ArenaTone = 'clean' | 'witty' | 'spicy'
type Mood = 'optimistic' | 'mixed' | 'critical' | 'neutral'

type ArenaInput = {
  topic: string
  where: string
  tone: ArenaTone
}

type ScopeSummary = {
  id: string
  label: string
  rows: PulseRow[]
  latest: PulseRow | null
  heat: number
  citations: number
  velocity: number
}

type MomentumSummary = {
  hasPrevious: boolean
  latestLabel: string
  previousLabel: string
  heatDelta: number
  citationDelta: number
  voiceDelta: number
  tagDelta: number
  newTags: string[]
  newHandles: string[]
}

const ARENA_CACHE_KEY = 'x.seekboxai:arena-input:v1'
const TONE_OPTIONS: Array<{ id: ArenaTone; label: string; prompt: string }> = [
  { id: 'clean', label: 'Clean', prompt: 'Keep the tone direct, precise, and professional.' },
  { id: 'witty', label: 'Witty', prompt: 'Use a sharp, witty tone without being cruel or sloppy.' },
  { id: 'spicy', label: 'Spicy', prompt: 'Use a sharper culture-read tone, but avoid personal attacks or slurs.' },
]

function XPulseArenaRoute() {
  const pulseData = Route.useLoaderData()
  const [input, setInput] = useState<ArenaInput>({ topic: 'AI agents', where: '', tone: 'witty' })
  const [selectedScope, setSelectedScope] = useState('')
  const rows = useMemo(() => cleanRows(pulseData.rows ?? []), [pulseData.rows])
  const voices = useMemo(() => pulseData.voices ?? [], [pulseData.voices])
  const error = pulseData.error

  useEffect(() => {
    const initial = readArenaInput()
    if (initial) setInput(initial)
  }, [])

  useEffect(() => {
    writeArenaInput(input)
  }, [input])

  const scopes = useMemo(() => buildScopeSummaries(rows), [rows])
  const activeScopeId = scopes.some((scope) => scope.id === selectedScope) ? selectedScope : scopes[0]?.id ?? ''
  const activeScope = scopes.find((scope) => scope.id === activeScopeId) ?? null
  const activeRows = activeScope?.rows ?? []
  const scopeVoices = useMemo(
    () => voices.filter((voice) => scopeId(voice.scopeValue) === activeScopeId).slice(0, 8),
    [activeScopeId, voices],
  )
  const arenaStats = useMemo(() => summarizeArena(rows, scopes, voices), [rows, scopes, voices])
  const heatValues = activeRows.map((row) => heatScore(row))
  const citationValues = activeRows.map((row) => citationCount(row))
  const noveltyValues = activeRows.map((row) => noveltyScore(row))
  const dissentValues = activeRows.map((row) => dissentScore(row))
  const voiceValues = activeRows.map((row) => rowVoiceCount(row))
  const moodCounts = countMoods(activeRows)
  const sourceCounts = countVoiceSources(scopeVoices)
  const tagBars = topTags(activeRows)
  const momentum = useMemo(() => buildMomentum(activeRows), [activeRows])
  const scopeMovers = useMemo(() => scopesByMovement(scopes), [scopes])
  const evidenceDepth = useMemo(() => scopesByEvidence(scopes), [scopes])
  const latestSummary = cleanSummary(activeScope?.latest?.summary ?? '')
  const promptSubject = [input.topic.trim(), input.where.trim()].filter(Boolean).join(' in ') || activeScope?.label || 'the current X conversation'
  const grokHref = cleanseekHref({
    path: '/cleanseek-x',
    latest: true,
    preset: 'allin',
    autorun: false,
    query: buildArenaPrompt('grok', promptSubject, input.tone),
  })
  const groundedHref = cleanseekHref({
    path: '/cleanseek-x',
    latest: true,
    preset: 'web',
    autorun: false,
    query: buildArenaPrompt('grounded', promptSubject, input.tone),
  })
  const divergenceHref = cleanseekHref({
    path: '/cleanseek-x',
    latest: true,
    preset: 'allin',
    autorun: false,
    query: buildArenaPrompt('divergence', promptSubject, input.tone),
  })

  return (
    <main className="min-h-screen bg-[#f7f8f4] text-neutral-950">
      <XSiteHeader active="arena" title="X.SeekBoxAI Arena" eyebrow="x pulse arena" />

      <section className="border-b border-neutral-300 bg-[#fbfbf7]">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-8">
          <div className="border-l-4 border-neutral-950 bg-white p-5 shadow-[6px_6px_0_rgba(0,0,0,0.08)]">
            <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-neutral-500">
              <Radio className="h-4 w-4" />
              live social intelligence
            </div>
            <h1 className="mt-3 text-3xl font-black leading-[1.05] tracking-tight sm:text-5xl">
              Grok pulse, grounded read, divergence map.
            </h1>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-neutral-600">
              The arena uses cached Pulse rows for trend context, then routes fresh questions into multi-engine live search.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <MetricTile label="Cached rows" value={String(arenaStats.rows)} icon={<Activity className="h-5 w-5" />} />
            <MetricTile label="Citations" value={String(arenaStats.citations)} icon={<ExternalLink className="h-5 w-5" />} />
            <MetricTile label="Scopes" value={String(arenaStats.scopes)} icon={<BarChart3 className="h-5 w-5" />} />
            <MetricTile label="Voices" value={String(arenaStats.voices)} icon={<UsersRound className="h-5 w-5" />} />
          </div>
        </div>
      </section>

      <section className="border-b border-neutral-300 bg-white">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 xl:grid-cols-[380px_minmax(0,1fr)] xl:px-8">
          <ArenaComposer input={input} onChange={setInput} />

          <div className="grid gap-4 lg:grid-cols-3">
            <ArenaActionCard
              tone="red"
              icon={<Zap className="h-5 w-5" />}
              label="Grok Pulse"
              title="Raw social read"
              body="Trend sensing, culture read, sentiment clusters, and the fastest available X context."
              href={grokHref}
            />
            <ArenaActionCard
              tone="neutral"
              icon={<Search className="h-5 w-5" />}
              label="Grounded Read"
              title="Clean synthesis"
              body="A calmer answer with source trails, caveats, context, and less heat in the language."
              href={groundedHref}
            />
            <ArenaActionCard
              tone="cyan"
              icon={<Sparkles className="h-5 w-5" />}
              label="Divergence"
              title="Where models split"
              body="Compare Grok's pulse with the other engines and call out disagreements, gaps, and overconfidence."
              href={divergenceHref}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 xl:grid-cols-[280px_minmax(0,1fr)] xl:px-8">
        <aside className="space-y-3">
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-neutral-500">Tracked scopes</div>
          <div className="grid gap-2">
            {scopes.slice(0, 24).map((scope) => (
              <button
                key={scope.id}
                type="button"
                onClick={() => setSelectedScope(scope.id)}
                className={`border px-3 py-3 text-left ${
                  scope.id === activeScopeId
                    ? 'border-neutral-950 bg-neutral-950 text-white'
                    : 'border-neutral-300 bg-white text-neutral-900 hover:border-neutral-950'
                }`}
              >
                <span className="block text-sm font-black">{scope.label}</span>
                <span className="mt-1 block text-[10px] font-black uppercase tracking-[0.14em] opacity-70">
                  {scope.rows.length} rows · {scope.citations} cites · {scope.velocity >= 0 ? '+' : ''}
                  {scope.velocity}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <div className="min-w-0 space-y-5">
          {error ? (
            <div className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">{error}</div>
          ) : null}
          <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="border border-neutral-300 bg-white p-5 shadow-[4px_4px_0_rgba(0,0,0,0.05)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.24em] text-neutral-500">Arena brief</div>
                  <h2 className="mt-1 text-3xl font-black tracking-tight">{activeScope?.label ?? 'Waiting for Pulse data'}</h2>
                </div>
                <span className="border border-neutral-300 bg-[#fbfbf7] px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-neutral-600">
                  {activeScope ? 'Cached pulse' : 'No rows'}
                </span>
              </div>
              <p className="mt-4 text-sm font-semibold leading-6 text-neutral-600">
                {latestSummary || 'Pulse rows will populate this brief when the public cache returns data.'}
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                <MiniMetric label="Heat" value={activeScope?.heat ?? 0} />
                <MiniMetric label="Citations" value={activeScope?.citations ?? 0} />
                <MiniMetric label="Voices" value={scopeVoices.length} />
                <MiniMetric label="Velocity" value={activeScope ? `${activeScope.velocity >= 0 ? '+' : ''}${activeScope.velocity}` : '-'} />
              </div>
            </div>

            <ChartPanel title="Voice mix" icon={<UsersRound className="h-5 w-5" />}>
              <SourceMix counts={sourceCounts} />
              <div className="mt-5 grid gap-3">
                {scopeVoices.length ? (
                  scopeVoices.map((voice) => <VoiceRow key={`${voice.scopeKey}-${voice.handle}`} voice={voice} max={scopeVoices[0]?.rankScore ?? 1} />)
                ) : (
                  <EmptyChart label="No voices ranked for this scope yet" />
                )}
              </div>
            </ChartPanel>
          </section>

          <section className="grid gap-4 lg:grid-cols-4">
            <DeltaTile label="Heat change" value={momentum.heatDelta} />
            <DeltaTile label="Citation change" value={momentum.citationDelta} />
            <DeltaTile label="Voice change" value={momentum.voiceDelta} />
            <DeltaTile label="Tag change" value={momentum.tagDelta} />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <ChartPanel title="Heat trend" icon={<LineChart className="h-5 w-5" />}>
              <Sparkline values={heatValues} />
              <TrendScale values={heatValues} />
            </ChartPanel>
            <ChartPanel title="Citation volume" icon={<TrendingUp className="h-5 w-5" />}>
              <Sparkline values={citationValues} />
              <TrendScale values={citationValues} />
            </ChartPanel>
            <ChartPanel title="Novelty signal" icon={<Sparkles className="h-5 w-5" />}>
              <Sparkline values={noveltyValues} />
              <TrendScale values={noveltyValues} />
            </ChartPanel>
            <ChartPanel title="Dissent signal" icon={<Flame className="h-5 w-5" />}>
              <Sparkline values={dissentValues} />
              <TrendScale values={dissentValues} />
            </ChartPanel>
            <ChartPanel title="Voice count" icon={<UsersRound className="h-5 w-5" />}>
              <Sparkline values={voiceValues} />
              <TrendScale values={voiceValues} />
            </ChartPanel>
            <ChartPanel title="Mood distribution" icon={<Flame className="h-5 w-5" />}>
              <MoodStack counts={moodCounts} />
            </ChartPanel>
            <ChartPanel title="Topic signals" icon={<BarChart3 className="h-5 w-5" />}>
              <div className="space-y-3">
                {tagBars.length ? tagBars.map((tag) => <ScoreBar key={tag.label} label={tag.label} value={tag.value} max={tagBars[0]?.value ?? 1} />) : <EmptyChart label="No tags for this scope" />}
              </div>
            </ChartPanel>
            <ChartPanel title="What changed" icon={<Activity className="h-5 w-5" />}>
              <WhatChangedPanel momentum={momentum} />
            </ChartPanel>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <ChartPanel title="Scope rank movement" icon={<TrendingUp className="h-5 w-5" />}>
              <div className="space-y-3">
                {scopeMovers.map((scope) => <MoverRow key={scope.id} scope={scope} max={Math.max(...scopeMovers.map((item) => Math.abs(item.velocity)), 1)} />)}
              </div>
            </ChartPanel>
            <ChartPanel title="Evidence depth" icon={<ExternalLink className="h-5 w-5" />}>
              <div className="space-y-3">
                {evidenceDepth.map((scope) => <ScoreBar key={scope.id} label={scope.label} value={scope.citations} max={evidenceDepth[0]?.citations ?? 1} />)}
              </div>
            </ChartPanel>
          </section>
        </div>
      </section>
    </main>
  )
}

function ArenaComposer({ input, onChange }: { input: ArenaInput; onChange: (input: ArenaInput) => void }) {
  return (
    <section className="border border-neutral-300 bg-[#fbfbf7] p-4 shadow-[4px_4px_0_rgba(0,0,0,0.05)]">
      <div className="text-[11px] font-black uppercase tracking-[0.24em] text-neutral-500">Arena prompt</div>
      <div className="mt-4 grid gap-3">
        <label>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Topic</span>
          <input
            value={input.topic}
            onChange={(event) => onChange({ ...input, topic: event.target.value })}
            className="mt-2 h-12 w-full border border-neutral-300 bg-white px-3 text-sm font-bold text-neutral-950 outline-none focus:border-neutral-950"
            placeholder="AI agents, Nashville live music, Porsche GT cars"
          />
        </label>
        <label>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Where</span>
          <input
            value={input.where}
            onChange={(event) => onChange({ ...input, where: event.target.value })}
            className="mt-2 h-12 w-full border border-neutral-300 bg-white px-3 text-sm font-bold text-neutral-950 outline-none focus:border-neutral-950"
            placeholder="Global, Tulsa, OK, Nashville, TN"
          />
        </label>
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Tone</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {TONE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onChange({ ...input, tone: option.id })}
                className={pillClass(input.tone === option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function ArenaActionCard({
  tone,
  icon,
  label,
  title,
  body,
  href,
}: {
  tone: 'red' | 'cyan' | 'neutral'
  icon: ReactNode
  label: string
  title: string
  body: string
  href: string
}) {
  const toneClass =
    tone === 'red'
      ? 'border-red-300 bg-red-50 text-red-950'
      : tone === 'cyan'
        ? 'border-cyan-300 bg-cyan-50 text-cyan-950'
        : 'border-neutral-300 bg-[#fbfbf7] text-neutral-950'
  return (
    <a href={href} className={`flex min-h-[220px] flex-col border p-5 shadow-[4px_4px_0_rgba(0,0,0,0.05)] hover:border-neutral-950 ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="grid h-10 w-10 place-items-center border border-current bg-white/70">{icon}</span>
        <span className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">{label}</span>
      </div>
      <h3 className="mt-5 text-2xl font-black tracking-tight">{title}</h3>
      <p className="mt-3 text-sm font-semibold leading-6 opacity-75">{body}</p>
      <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-black">
        Run pass
        <ExternalLink className="h-4 w-4" />
      </span>
    </a>
  )
}

function MetricTile({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
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

function ChartPanel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="border border-neutral-300 bg-white p-5 shadow-[4px_4px_0_rgba(0,0,0,0.05)]">
      <div className="mb-4 flex items-center gap-2 text-sm font-black">
        <span className="grid h-8 w-8 place-items-center border border-neutral-300 bg-[#f7f8f4] text-neutral-700">{icon}</span>
        {title}
      </div>
      {children}
    </section>
  )
}

function MiniMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-neutral-300 bg-[#fbfbf7] px-3 py-3">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-black">{value}</div>
    </div>
  )
}

function DeltaTile({ label, value }: { label: string; value: number }) {
  const positive = value > 0
  const negative = value < 0
  const tone = positive
    ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
    : negative
      ? 'border-rose-300 bg-rose-50 text-rose-950'
      : 'border-neutral-300 bg-white text-neutral-950'
  return (
    <div className={`border px-4 py-4 shadow-[3px_3px_0_rgba(0,0,0,0.05)] ${tone}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.16em] opacity-70">{label}</div>
      <div className="mt-2 text-3xl font-black">{formatDelta(value)}</div>
      <div className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] opacity-60">latest vs previous run</div>
    </div>
  )
}

function VoiceRow({ voice, max }: { voice: PulseVoiceRanking; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((voice.rankScore / max) * 100)) : 0
  return (
    <a href={voiceProfileHref(voice.handle)} className="group block">
      <div className="mb-1 flex items-center justify-between gap-3 text-xs font-black">
        <span className="truncate group-hover:underline">@{voice.displayHandle}</span>
        <span className="text-neutral-500">{voice.rankScore}</span>
      </div>
      <div className="h-2 bg-neutral-100">
        <div className="h-full bg-neutral-950" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
        {voice.source} · {voice.seenCount} runs · {voice.citationCount} cites
      </div>
    </a>
  )
}

function MoverRow({ scope, max }: { scope: ScopeSummary; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((Math.abs(scope.velocity) / max) * 100)) : 0
  const tone = scope.velocity > 0 ? 'bg-emerald-500' : scope.velocity < 0 ? 'bg-rose-500' : 'bg-neutral-400'
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs font-black">
        <span className="truncate text-neutral-700">{scope.label}</span>
        <span className={scope.velocity >= 0 ? 'text-emerald-700' : 'text-rose-700'}>{formatDelta(scope.velocity)}</span>
      </div>
      <div className="h-2 bg-neutral-100">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
        {scope.rows.length} runs · {scope.citations} citations
      </div>
    </div>
  )
}

function WhatChangedPanel({ momentum }: { momentum: MomentumSummary }) {
  if (!momentum.hasPrevious) {
    return <EmptyChart label="Needs at least two pulse runs" />
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="border border-neutral-200 bg-[#fbfbf7] px-3 py-2">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">Previous</div>
          <div className="mt-1 text-xs font-black text-neutral-700">{momentum.previousLabel}</div>
        </div>
        <div className="border border-neutral-200 bg-[#fbfbf7] px-3 py-2">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">Latest</div>
          <div className="mt-1 text-xs font-black text-neutral-700">{momentum.latestLabel}</div>
        </div>
      </div>
      <ChangeList title="New tags" items={momentum.newTags} empty="No new tags." />
      <ChangeList title="New voices" items={momentum.newHandles.map((handle) => `@${handle}`)} empty="No new visible handles." />
    </div>
  )
}

function ChangeList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">{title}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.length ? (
          items.slice(0, 8).map((item) => (
            <span key={item} className="border border-neutral-300 bg-[#fbfbf7] px-2.5 py-1 text-xs font-black text-neutral-700">
              {item}
            </span>
          ))
        ) : (
          <span className="text-xs font-bold text-neutral-500">{empty}</span>
        )}
      </div>
    </div>
  )
}

function SourceMix({ counts }: { counts: Record<string, number> }) {
  const total = Math.max(1, counts.seed + counts.discovered + counts.mixed)
  const items = [
    { key: 'mixed', label: 'Mixed', value: counts.mixed, color: 'bg-amber-500' },
    { key: 'discovered', label: 'Discovered', value: counts.discovered, color: 'bg-cyan-500' },
    { key: 'seed', label: 'Seed', value: counts.seed, color: 'bg-neutral-500' },
  ]
  return (
    <div>
      <div className="flex h-4 overflow-hidden bg-neutral-100">
        {items.map((item) => (
          <div key={item.key} className={item.color} style={{ width: `${(item.value / total) * 100}%` }} />
        ))}
      </div>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between text-xs font-black text-neutral-600">
            <span>{item.label}</span>
            <span>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MoodStack({ counts }: { counts: Record<Mood, number> }) {
  const moods: Array<{ mood: Mood; color: string }> = [
    { mood: 'optimistic', color: 'bg-emerald-500' },
    { mood: 'mixed', color: 'bg-amber-500' },
    { mood: 'critical', color: 'bg-rose-500' },
    { mood: 'neutral', color: 'bg-neutral-400' },
  ]
  const total = Math.max(1, Object.values(counts).reduce((sum, count) => sum + count, 0))
  return (
    <div>
      <div className="flex h-4 overflow-hidden bg-neutral-100">
        {moods.map((item) => (
          <div key={item.mood} className={item.color} style={{ width: `${(counts[item.mood] / total) * 100}%` }} />
        ))}
      </div>
      <div className="mt-4 grid gap-2">
        {moods.map((item) => (
          <div key={item.mood} className="flex items-center justify-between text-xs font-black text-neutral-600">
            <span>{item.mood}</span>
            <span>{counts[item.mood]}</span>
          </div>
        ))}
      </div>
    </div>
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
  const safe = values.length > 1 ? values : [values[0] ?? 0, values[0] ?? 0]
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
    <svg viewBox="0 0 100 48" className="h-32 w-full" role="img" aria-label="Trend line">
      <polyline points="0,42 100,42" fill="none" stroke="#e5e5e5" strokeWidth="2" />
      <polyline points={points} fill="none" stroke="#111111" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {safe.map((value, index) => {
        const x = (index / Math.max(1, safe.length - 1)) * 100
        const y = 42 - ((value - min) / spread) * 34
        return <circle key={`${value}-${index}`} cx={x} cy={y} r="3" fill="#111111" />
      })}
    </svg>
  )
}

function TrendScale({ values }: { values: number[] }) {
  if (!values.length) return <div className="mt-3 text-xs font-bold text-neutral-500">No trend points yet.</div>
  return (
    <div className="mt-3 flex items-center justify-between text-xs font-black text-neutral-500">
      <span>{values[0]}</span>
      <span>{values.length} points</span>
      <span>{values[values.length - 1]}</span>
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

function buildScopeSummaries(rows: PulseRow[]): ScopeSummary[] {
  const groups = new Map<string, PulseRow[]>()
  for (const row of rows) {
    const id = scopeId(row.scope_value)
    const list = groups.get(id) ?? []
    list.push(row)
    groups.set(id, list)
  }
  return Array.from(groups.entries())
    .map(([id, group]) => {
      const ordered = [...group].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      const latest = ordered[ordered.length - 1] ?? null
      const values = ordered.map((row) => heatScore(row))
      const velocity = values.length > 1 ? values[values.length - 1] - values[0] : 0
      return {
        id,
        label: labelScope(id),
        rows: ordered,
        latest,
        heat: latest ? heatScore(latest) : 0,
        citations: ordered.reduce((sum, row) => sum + citationCount(row), 0),
        velocity,
      }
    })
    .sort((a, b) => b.heat - a.heat || b.citations - a.citations || a.label.localeCompare(b.label))
}

function summarizeArena(rows: PulseRow[], scopes: ScopeSummary[], voices: PulseVoiceRanking[]) {
  return {
    rows: rows.length,
    scopes: scopes.length,
    citations: rows.reduce((sum, row) => sum + citationCount(row), 0),
    voices: voices.length,
  }
}

function buildMomentum(rows: PulseRow[]): MomentumSummary {
  const latest = rows[rows.length - 1] ?? null
  const previous = rows[rows.length - 2] ?? null
  if (!latest || !previous) {
    return {
      hasPrevious: false,
      latestLabel: latest ? runLabel(latest) : 'No latest run',
      previousLabel: 'No previous run',
      heatDelta: 0,
      citationDelta: 0,
      voiceDelta: 0,
      tagDelta: 0,
      newTags: [],
      newHandles: [],
    }
  }

  const latestTags = rowTags(latest)
  const previousTags = new Set(rowTags(previous).map((tag) => tag.toLowerCase()))
  const latestHandles = rowHandles(latest)
  const previousHandles = new Set(rowHandles(previous).map((handle) => handle.toLowerCase()))

  return {
    hasPrevious: true,
    latestLabel: runLabel(latest),
    previousLabel: runLabel(previous),
    heatDelta: heatScore(latest) - heatScore(previous),
    citationDelta: citationCount(latest) - citationCount(previous),
    voiceDelta: rowVoiceCount(latest) - rowVoiceCount(previous),
    tagDelta: latestTags.length - rowTags(previous).length,
    newTags: latestTags.filter((tag) => !previousTags.has(tag.toLowerCase())).slice(0, 8),
    newHandles: latestHandles.filter((handle) => !previousHandles.has(handle.toLowerCase())).slice(0, 8),
  }
}

function scopesByMovement(scopes: ScopeSummary[]): ScopeSummary[] {
  return [...scopes].sort((a, b) => Math.abs(b.velocity) - Math.abs(a.velocity) || b.heat - a.heat).slice(0, 10)
}

function scopesByEvidence(scopes: ScopeSummary[]): ScopeSummary[] {
  return [...scopes].sort((a, b) => b.citations - a.citations || b.rows.length - a.rows.length).slice(0, 10)
}

function cleanRows(rows: PulseRow[]): PulseRow[] {
  return rows
    .filter((row) => row.summary && row.scope_type === 'industry')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

function citationCount(row: PulseRow): number {
  return Array.isArray(row.citations) ? row.citations.filter((citation) => citation.url).length : 0
}

function heatScore(row: PulseRow): number {
  const ageHours = Math.max(0, (Date.now() - new Date(row.created_at).getTime()) / 3600000)
  const freshness = Math.max(0, 18 - ageHours * 0.6)
  const citations = Math.min(Math.log2(citationCount(row) + 1) * 12, 34)
  const summary = row.summary ?? ''
  const novelty = noveltyScore(row) * 0.2
  const dissent = dissentScore(row) * 0.12
  return clamp(18 + freshness + citations + novelty + dissent + Math.min(summary.length / 420, 14), 5, 99)
}

function noveltyScore(row: PulseRow): number {
  const summary = (row.summary ?? '').toLowerCase()
  const hits = countWords(summary, ['new', 'emerging', 'launch', 'launched', 'shift', 'breakthrough', 'trend', 'first', 'rising', 'momentum'])
  const tagBoost = Math.min(rowTags(row).length * 3, 18)
  return clamp(22 + hits * 9 + tagBoost, 5, 99)
}

function dissentScore(row: PulseRow): number {
  const summary = (row.summary ?? '').toLowerCase()
  const hits = countWords(summary, ['risk', 'warning', 'dissent', 'pushback', 'critical', 'concern', 'skeptic', 'backlash', 'controversy', 'counter'])
  return clamp(14 + hits * 11, 0, 99)
}

function rowVoiceCount(row: PulseRow): number {
  return rowHandles(row).length
}

function rowHandles(row: PulseRow): string[] {
  const found = new Map<string, string>()
  for (const raw of row.handles ?? []) addHandle(found, raw)
  for (const match of (row.summary ?? '').matchAll(/@([A-Za-z0-9_]{2,15})\b/g)) addHandle(found, match[1])
  for (const citation of row.citations ?? []) addHandle(found, extractHandleFromSocialUrl(citation.url))
  return Array.from(found.values()).slice(0, 24)
}

function addHandle(found: Map<string, string>, raw: string | null | undefined) {
  const clean = raw?.replace(/^@+/, '').trim()
  if (!clean || !/^[A-Za-z0-9_]{2,15}$/.test(clean)) return
  found.set(clean.toLowerCase(), clean)
}

function rowTags(row: PulseRow): string[] {
  const found = new Map<string, string>()
  for (const tag of row.tags ?? []) {
    const clean = tag.replace(/^industry:/, '').replace(/^cron:/, '').replace(/[-_]+/g, ' ').trim()
    if (!clean || clean.toLowerCase() === 'daily') continue
    found.set(clean.toLowerCase(), labelScope(clean))
  }
  return Array.from(found.values()).slice(0, 16)
}

function countMoods(rows: PulseRow[]): Record<Mood, number> {
  const counts: Record<Mood, number> = { optimistic: 0, mixed: 0, critical: 0, neutral: 0 }
  for (const row of rows) counts[detectMood(row.summary ?? '')] += 1
  return counts
}

function detectMood(summary: string): Mood {
  const s = summary.toLowerCase()
  const positive = countWords(s, ['optimistic', 'positive', 'bullish', 'growth', 'breakthrough', 'opportunity', 'surge', 'upbeat'])
  const negative = countWords(s, ['negative', 'risk', 'concern', 'warning', 'dissent', 'critical', 'problem', 'constraint'])
  if (positive >= 2 && negative >= 2) return 'mixed'
  if (positive > negative) return 'optimistic'
  if (negative > positive) return 'critical'
  return 'neutral'
}

function countVoiceSources(voices: PulseVoiceRanking[]): Record<string, number> {
  return voices.reduce(
    (counts, voice) => {
      counts[voice.source] = (counts[voice.source] ?? 0) + 1
      return counts
    },
    { seed: 0, discovered: 0, mixed: 0 } as Record<string, number>,
  )
}

function topTags(rows: PulseRow[]): Array<{ label: string; value: number }> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    for (const tag of row.tags ?? []) {
      const clean = tag.replace(/^industry:/, '').replace(/^cron:/, '').replace(/[-_]+/g, ' ').trim()
      if (!clean || clean === 'daily') continue
      counts.set(labelScope(clean), (counts.get(labelScope(clean)) ?? 0) + 1)
    }
  }
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, 8)
}

function cleanSummary(summary: string): string {
  return summary
    .replace(/\s+/g, ' ')
    .replace(/^\s*(?:\d+[.)]\s*)+/, '')
    .trim()
    .slice(0, 420)
}

function runLabel(row: PulseRow): string {
  const window = row.window_label ? `${row.window_label} window` : 'pulse run'
  const timestamp = new Date(row.created_at).getTime()
  const stamp = Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(5, 16).replace('T', ' ') : 'unknown time'
  return `${stamp} · ${window}`
}

function formatDelta(value: number): string {
  if (value > 0) return `+${value}`
  return String(value)
}

function buildArenaPrompt(kind: 'grok' | 'grounded' | 'divergence', subject: string, tone: ArenaTone): string {
  const tonePrompt = TONE_OPTIONS.find((option) => option.id === tone)?.prompt ?? TONE_OPTIONS[1].prompt
  if (kind === 'grok') {
    return `X Pulse Arena: analyze ${subject} with the freshest X/social pulse available. Include sentiment distribution, top voices, viral or controversy signals, meme velocity, and what changed. Grok/live-X pass should be maximally truthful and fast. ${tonePrompt} If live X is unavailable, say that clearly.`
  }
  if (kind === 'grounded') {
    return `Grounded read for ${subject}. Use live web/search context where available. Include source-backed summary, evidence links, uncertainty, dissent, and what to watch next. ${tonePrompt}`
  }
  return `X Pulse Arena divergence map for ${subject}. Compare Grok/live-X style conclusions against other engines' grounded analysis. Identify where they agree, where they diverge, what each may be missing, sentiment split, top voices, and best next questions. ${tonePrompt}`
}

function readArenaInput(): ArenaInput | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const fromParams = {
    topic: cleanField(params.get('topic') ?? ''),
    where: cleanField(params.get('where') ?? ''),
    tone: cleanTone(params.get('tone')),
  }
  if (fromParams.topic || fromParams.where) return { topic: fromParams.topic || 'AI agents', where: fromParams.where, tone: fromParams.tone }
  try {
    const raw = JSON.parse(window.localStorage.getItem(ARENA_CACHE_KEY) ?? 'null') as Partial<ArenaInput> | null
    if (!raw || typeof raw !== 'object') return null
    return {
      topic: cleanField(raw.topic) || 'AI agents',
      where: cleanField(raw.where),
      tone: cleanTone(raw.tone),
    }
  } catch {
    return null
  }
}

function writeArenaInput(input: ArenaInput) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ARENA_CACHE_KEY, JSON.stringify({ topic: cleanField(input.topic), where: cleanField(input.where), tone: cleanTone(input.tone) }))
  } catch {
    /* noop */
  }
}

function cleanTone(value: unknown): ArenaTone {
  return value === 'clean' || value === 'spicy' || value === 'witty' ? value : 'witty'
}

function cleanField(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 120) : ''
}

function scopeId(value: string | null | undefined): string {
  return (value || 'global').toLowerCase().replace(/^industry:/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'global'
}

function labelScope(raw: string): string {
  const clean = raw.replace(/^industry:/, '').replace(/[-_]+/g, ' ').trim()
  if (!clean) return 'Pulse'
  if (clean.toLowerCase() === 'tech saas') return 'Tech & SaaS'
  return clean.replace(/\b\w/g, (match) => match.toUpperCase()).replace(/\bAi\b/g, 'AI').replace(/\bSaas\b/g, 'SaaS')
}

function countWords(text: string, words: string[]): number {
  return words.reduce((sum, word) => sum + (text.includes(word) ? 1 : 0), 0)
}

function clamp(value: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, value)))
}

function pillClass(active: boolean): string {
  return active
    ? 'border border-neutral-950 bg-neutral-950 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-white'
    : 'border border-neutral-300 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-neutral-700 hover:border-neutral-950'
}
