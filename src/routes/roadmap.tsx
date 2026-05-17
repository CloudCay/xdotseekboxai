import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ArrowUpRight, Check, ClipboardList, ExternalLink, ThumbsUp } from 'lucide-react'
import { XSiteHeader } from '../components/XSiteHeader'
import { getClientId } from '../lib/clientId'
import { cleanseekHref } from '../lib/cleanseekUrl'
import {
  ROADMAP_ACCESS_LANES,
  ROADMAP_BIG_OPPORTUNITY,
  ROADMAP_INTEGRATION_PLATFORMS,
  LIVE_X_ROADMAP_NOTE,
  ROADMAP_FEATURES,
  ROADMAP_PROMPT_SECTIONS,
  ROADMAP_SEARCH_MODES,
  ROADMAP_USE_CASE_PLAYS,
  type RoadmapAccess,
  type RoadmapFeature,
  type RoadmapStage,
} from '../lib/roadmapCatalog'

const VOTE_STORAGE_KEY = 'seekbox_x_roadmap_votes_v1'

export const Route = createFileRoute('/roadmap')({
  component: RoadmapPage,
})

function RoadmapPage() {
  const [votes, setVotes] = useState<Record<string, true>>({})
  const [syncState, setSyncState] = useState<Record<string, 'idle' | 'syncing' | 'saved' | 'local'>>({})
  const [remoteCounts, setRemoteCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const parsed = JSON.parse(window.localStorage.getItem(VOTE_STORAGE_KEY) ?? '{}') as Record<string, true>
      setVotes(parsed && typeof parsed === 'object' ? parsed : {})
    } catch {
      setVotes({})
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/roadmap-votes')
      .then((response) => response.json())
      .then((json: { counts?: Record<string, number> }) => {
        if (!cancelled && json.counts && typeof json.counts === 'object') setRemoteCounts(json.counts)
      })
      .catch(() => {
        if (!cancelled) setRemoteCounts({})
      })
    return () => {
      cancelled = true
    }
  }, [])

  const grouped = useMemo(() => {
    const order: RoadmapStage[] = ['live', 'building', 'planned', 'exploring']
    return order.map((stage) => ({
      stage,
      items: ROADMAP_FEATURES.filter((feature) => feature.stage === stage),
    }))
  }, [])

  const accessLanes = useMemo(
    () =>
      ROADMAP_ACCESS_LANES.map((lane) => ({
        ...lane,
        items: ROADMAP_FEATURES.filter((feature) => feature.access === lane.id),
      })),
    [],
  )

  const voteFor = async (feature: RoadmapFeature) => {
    if (votes[feature.id]) return
    const next = { ...votes, [feature.id]: true as const }
    setVotes(next)
    setSyncState((prev) => ({ ...prev, [feature.id]: 'syncing' }))
    try {
      window.localStorage.setItem(VOTE_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Local storage can be unavailable in private windows.
    }

    try {
      const response = await fetch('/api/roadmap-votes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          featureId: feature.id,
          clientId: getClientId(),
          sourcePath: typeof window !== 'undefined' ? window.location.pathname : '/roadmap',
        }),
      })
      const json = (await response.json()) as { persisted?: boolean; duplicate?: boolean }
      if (json.persisted && !json.duplicate) {
        setRemoteCounts((prev) => ({ ...prev, [feature.id]: (prev[feature.id] ?? 0) + 1 }))
      }
      setSyncState((prev) => ({ ...prev, [feature.id]: json.persisted ? 'saved' : 'local' }))
    } catch {
      setSyncState((prev) => ({ ...prev, [feature.id]: 'local' }))
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8f4] text-neutral-950">
      <XSiteHeader active="roadmap" title="X.SeekBoxAI Roadmap" eyebrow="public product direction" logoSize="lg" />

      <section className="border-b border-neutral-300 bg-[#fbfbf7]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
          <div className="border-l-4 border-neutral-950 bg-white p-5 shadow-[6px_6px_0_rgba(0,0,0,0.08)]">
            <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-neutral-500">
              <ClipboardList className="h-4 w-4" />
              roadmap and feature voting
            </div>
            <h1 className="mt-3 max-w-4xl text-3xl font-black leading-[1.05] tracking-tight sm:text-5xl">
              The demo drawer becomes the product roadmap.
            </h1>
            <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-neutral-600">
              Curated prompt starts, feature ideas, and next bets live here now. Every product page links back here so
              users can vote on what should become real workflow next.
            </p>
          </div>

          <div className="border border-neutral-300 bg-white p-5 shadow-[4px_4px_0_rgba(0,0,0,0.05)]">
            <div className="text-sm font-black">{ROADMAP_BIG_OPPORTUNITY.headline}</div>
            <p className="mt-2 text-sm font-semibold leading-6 text-neutral-600">{ROADMAP_BIG_OPPORTUNITY.sub}</p>
            <div className="mt-4 border-t border-neutral-200 pt-4 text-sm font-black">{LIVE_X_ROADMAP_NOTE.headline}</div>
            <p className="mt-2 text-sm font-semibold leading-6 text-neutral-600">{LIVE_X_ROADMAP_NOTE.sub}</p>
            <ul className="mt-4 space-y-2 text-sm font-semibold leading-6 text-neutral-700">
              {LIVE_X_ROADMAP_NOTE.bullets.map((item) => (
                <li key={item} className="flex gap-2">
                  <Check className="mt-1 h-4 w-4 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-b border-neutral-300 bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
          <div>
            <div className="mb-4">
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-neutral-500">Business model lanes</div>
              <h2 className="mt-1 text-2xl font-black tracking-tight">What stays free, and what can become paid?</h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-neutral-600">
                Public surfaces should build trust and reach. Paid surfaces should charge for SeekBox synthesis,
                workflow, limits, and team utility.
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {accessLanes.map((lane) => (
                <article key={lane.id} className="border border-neutral-300 bg-[#fbfbf7] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <AccessPill access={lane.id} />
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">
                      {lane.items.length} ideas
                    </span>
                  </div>
                  <h3 className="mt-3 text-lg font-black leading-tight">{lane.headline}</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-neutral-600">{lane.summary}</p>
                  <div className="mt-4 grid gap-2">
                    {lane.items.slice(0, 10).map((feature) => (
                      <a
                        key={feature.id}
                        href={`#roadmap-${feature.id}`}
                        className="group flex items-center justify-between gap-3 border border-neutral-300 bg-white px-3 py-2 text-xs font-black text-neutral-800 hover:border-neutral-950"
                      >
                        <span className="min-w-0 truncate">{feature.title}</span>
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-neutral-400 group-hover:text-neutral-950" />
                      </a>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="border border-neutral-300 bg-[#fbfbf7] p-5">
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-neutral-500">What users can shape</div>
            <h2 className="mt-2 text-xl font-black tracking-tight">The next useful surface should be obvious.</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-neutral-600">
              Votes help prioritize which cached reads, drilldowns, alerts, and workbench flows deserve the next build
              pass.
            </p>
            <div className="mt-4 grid gap-2 text-sm font-semibold leading-6 text-neutral-700">
              <a href="#roadmap-pulse-voice-ranking" className="border border-neutral-300 bg-white px-3 py-2 hover:border-neutral-950">
                Make rising voices useful over time
              </a>
              <a href="#roadmap-topic-drilldowns" className="border border-neutral-300 bg-white px-3 py-2 hover:border-neutral-950">
                Turn topics into full drilldown pages
              </a>
              <a href="#roadmap-pro-cleanseek-x" className="border border-neutral-300 bg-white px-3 py-2 hover:border-neutral-950">
                Shape the paid research workbench
              </a>
            </div>
          </aside>
        </div>
      </section>

      <section className="border-b border-neutral-300 bg-[#fbfbf7]">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-neutral-500">Integration map</div>
              <h2 className="mt-1 max-w-3xl text-2xl font-black tracking-tight">
                Multi-signal context around every X narrative.
              </h2>
              <p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-neutral-600">
                These APIs make Pulse richer: X is the narrative layer, while other sources add entity, event, music,
                video, and demand context.
              </p>
            </div>
            <a
              href="#roadmap-signal-fusion-briefs"
              className="inline-flex items-center gap-2 border border-neutral-950 bg-neutral-950 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white hover:bg-neutral-800"
            >
              Vote on fusion <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-5">
            {ROADMAP_INTEGRATION_PLATFORMS.map((platform) => (
              <article key={platform.id} className="flex min-h-[440px] flex-col border border-neutral-300 bg-white p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-500">{platform.signal}</div>
                <h3 className="mt-3 text-xl font-black leading-tight">{platform.name}</h3>
                <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-neutral-500">{platform.bestFor}</p>

                <div className="mt-4 grid gap-4">
                  <div>
                    <AccessPill access="core" compact />
                    <ul className="mt-2 space-y-2 text-xs font-semibold leading-5 text-neutral-700">
                      {platform.coreIdeas.map((idea) => (
                        <li key={idea} className="border-l-2 border-emerald-600/30 pl-2">
                          {idea}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <AccessPill access="premium" compact />
                    <ul className="mt-2 space-y-2 text-xs font-semibold leading-5 text-neutral-700">
                      {platform.premiumIdeas.map((idea) => (
                        <li key={idea} className="border-l-2 border-neutral-950/25 pl-2">
                          {idea}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-auto pt-4 text-[11px] font-black uppercase tracking-[0.16em] text-neutral-400">
                  Public context layer
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-neutral-500">Vote queue</div>
            <h2 className="mt-1 text-2xl font-black tracking-tight">What should become product?</h2>
          </div>
          <div className="text-xs font-bold text-neutral-500">
            Votes save locally now and sync when the public vote table is ready.
          </div>
        </div>

        <div className="space-y-8">
          {grouped.map(({ stage, items }) => (
            <section key={stage}>
              <div className="mb-3 flex items-center gap-3">
                <StagePill stage={stage} />
                <div className="h-px flex-1 bg-neutral-300" />
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {items.map((feature) => (
                  <FeatureCard
                    key={feature.id}
                    feature={feature}
                    voted={Boolean(votes[feature.id])}
                    remoteVotes={remoteCounts[feature.id] ?? 0}
                    syncState={syncState[feature.id] ?? 'idle'}
                    onVote={() => void voteFor(feature)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className="border-y border-neutral-300 bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-neutral-500">Modes</div>
            <h2 className="mt-2 text-2xl font-black tracking-tight">Prompt demos become roadmap candidates.</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-neutral-600">
              These are no longer tucked into CleanSeek. They are visible product directions: some are live, some are
              planned, and some need votes before they deserve more build time.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {ROADMAP_SEARCH_MODES.map((mode) => (
              <a
                key={mode.id}
                href={cleanseekHref({ path: '/cleanseek-x/desktop', query: mode.prompt, latest: true, preset: 'web' })}
                className="group border border-neutral-300 bg-[#fbfbf7] p-4 text-left hover:border-neutral-950"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-black">{mode.label}</div>
                  <StagePill stage={mode.stage} compact />
                </div>
                <p className="mt-2 text-xs font-semibold leading-5 text-neutral-600">{mode.prompt}</p>
                <div className="mt-4 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-neutral-500 group-hover:text-neutral-950">
                  Try in CleanSeek <ArrowUpRight className="h-3.5 w-3.5" />
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-neutral-500">Use-case plays</div>
            <div className="mt-3 space-y-3">
              {ROADMAP_USE_CASE_PLAYS.map((play) => (
                <div key={play.title} className="border border-neutral-300 bg-white p-4">
                  <div className="text-sm font-black">{play.title}</div>
                  <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-500">{play.audience}</div>
                  <div className="mt-3 space-y-2">
                    {play.prompts.map((prompt) => (
                      <a
                        key={prompt}
                        href={cleanseekHref({ path: '/cleanseek-x/desktop', query: prompt, latest: true, preset: 'web' })}
                        className="block rounded-lg border border-neutral-300 bg-[#fbfbf7] px-3 py-2 text-xs font-bold leading-5 text-neutral-700 hover:border-neutral-950"
                      >
                        {prompt}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-neutral-500">Prompt library</div>
            <div className="mt-3 space-y-3">
              {ROADMAP_PROMPT_SECTIONS.map((section) => (
                <details key={section.category} className="border border-neutral-300 bg-white" open={section.category === 'Market and investing'}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-black [&::-webkit-details-marker]:hidden">
                    {section.category}
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">Open</span>
                  </summary>
                  <div className="flex flex-wrap gap-2 border-t border-neutral-200 px-4 py-4">
                    {section.prompts.map((prompt) => (
                      <a
                        key={prompt.text}
                        href={cleanseekHref({ path: '/cleanseek-x/desktop', query: prompt.text, latest: true, preset: 'web' })}
                        className="max-w-full rounded-lg border border-neutral-300 bg-[#fbfbf7] px-3 py-2 text-left text-xs font-bold leading-5 text-neutral-700 hover:border-neutral-950"
                      >
                        {prompt.text}
                        {prompt.hint ? <span className="ml-2 text-neutral-400">{prompt.hint}</span> : null}
                      </a>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function FeatureCard({
  feature,
  voted,
  remoteVotes,
  syncState,
  onVote,
}: {
  feature: RoadmapFeature
  voted: boolean
  remoteVotes: number
  syncState: 'idle' | 'syncing' | 'saved' | 'local'
  onVote: () => void
}) {
  const optimisticVote = syncState === 'syncing' || syncState === 'local' ? 1 : 0
  const votes = feature.seedVotes + remoteVotes + optimisticVote
  return (
    <article
      id={`roadmap-${feature.id}`}
      className="scroll-mt-28 flex min-h-[340px] flex-col border border-neutral-300 bg-white p-4 shadow-[4px_4px_0_rgba(0,0,0,0.05)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <StagePill stage={feature.stage} compact />
          <AccessPill access={feature.access} compact />
        </div>
        <div className="text-right text-[11px] font-black uppercase tracking-[0.16em] text-neutral-500">
          {feature.area}
        </div>
      </div>
      <h3 className="mt-4 text-lg font-black leading-tight">{feature.title}</h3>
      <p className="mt-3 flex-1 text-sm font-semibold leading-6 text-neutral-600">{feature.summary}</p>
      <div className="mt-4 border-t border-neutral-200 pt-3 text-xs font-semibold leading-5 text-neutral-500">
        <span className="font-black text-neutral-700">Next:</span> {feature.next}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-neutral-500">{feature.surface}</div>
        <button
          type="button"
          onClick={onVote}
          disabled={voted}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-black ${
            voted
              ? 'border-emerald-600/30 bg-emerald-50 text-emerald-800'
              : 'border-neutral-950 bg-neutral-950 text-white hover:bg-neutral-800'
          }`}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
          {votes}
        </button>
      </div>
      {syncState !== 'idle' ? (
        <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-400">
          {syncState === 'syncing' ? 'Syncing vote' : syncState === 'saved' ? 'Vote synced' : 'Vote saved locally'}
        </div>
      ) : null}
      {feature.relatedPrompt ? (
        <a
          href={cleanseekHref({ path: '/cleanseek-x/desktop', query: feature.relatedPrompt, latest: true, preset: 'web' })}
          className="mt-3 inline-flex items-center gap-2 text-xs font-black text-neutral-800 underline underline-offset-4"
        >
          Try related prompt <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : null}
    </article>
  )
}

function AccessPill({ access, compact = false }: { access: RoadmapAccess; compact?: boolean }) {
  const label: Record<RoadmapAccess, string> = {
    core: 'Core free',
    premium: 'Premium',
  }
  const classes: Record<RoadmapAccess, string> = {
    core: 'border-emerald-700/25 bg-emerald-50 text-emerald-800',
    premium: 'border-neutral-950/20 bg-neutral-950 text-white',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${classes[access]}`}
    >
      {compact ? (access === 'core' ? 'Free' : 'Paid') : label[access]}
    </span>
  )
}

function StagePill({ stage, compact = false }: { stage: RoadmapStage; compact?: boolean }) {
  const label: Record<RoadmapStage, string> = {
    live: 'Live',
    building: 'Building',
    planned: 'Planned',
    exploring: 'Exploring',
  }
  const classes: Record<RoadmapStage, string> = {
    live: 'border-emerald-700/25 bg-emerald-50 text-emerald-800',
    building: 'border-cyan-700/25 bg-cyan-50 text-cyan-800',
    planned: 'border-blue-700/20 bg-blue-50 text-blue-800',
    exploring: 'border-neutral-300 bg-[#fbfbf7] text-neutral-700',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${classes[stage]}`}>
      {compact ? label[stage] : `${label[stage]} now`}
    </span>
  )
}
