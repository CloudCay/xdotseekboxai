import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ArrowUpRight, BookmarkPlus, MapPin, Music, Radio, Search, Tags, Trash2, UsersRound } from 'lucide-react'
import { XSiteHeader } from '../components/XSiteHeader'
import { cleanseekHref } from '../lib/cleanseekUrl'
import {
  publicSeedCollections,
  seedPrimaryQuery,
  seedDiscoveryQuery,
  seedUserSearchQuery,
  type SeedCollection,
  type SeedCollectionKind,
  type SeedOutputView,
} from '../lib/seedCollections'

export const Route = createFileRoute('/seeds')({
  head: () => ({
    meta: [{ title: 'Seed Library - X.SeekBoxAI' }],
  }),
  component: SeedsRoute,
})

const KIND_LABELS: Record<SeedCollectionKind | 'all', string> = {
  all: 'All',
  local_scene: 'Local scenes',
  brand: 'Brands',
  city: 'Cities',
  culture: 'Culture',
  music: 'Music',
}

type SearchWhen = 'today' | 'weekend' | '7d' | '30d'
type SearchOutput = 'pulse' | 'voices' | 'events' | 'arena' | 'brief' | 'compare'

type CustomSearchState = {
  what: string
  where: string
  when: SearchWhen
  output: SearchOutput
}

type WatchlistItem = CustomSearchState & {
  id: string
  createdAt: string
}

const WATCHLIST_STORAGE_KEY = 'seekbox_seed_watchlist_v1'

const WHEN_OPTIONS: Array<{ id: SearchWhen; label: string; prompt: string }> = [
  { id: 'today', label: 'Today', prompt: 'today' },
  { id: 'weekend', label: 'This weekend', prompt: 'this weekend' },
  { id: '7d', label: '7 days', prompt: 'the past 7 days' },
  { id: '30d', label: '30 days', prompt: 'the past 30 days where available' },
]

const OUTPUT_OPTIONS: Array<{ id: SearchOutput; label: string; prompt: string }> = [
  {
    id: 'pulse',
    label: 'Pulse',
    prompt: 'Return the current pulse, key posts or sources, sentiment, dissent, and what to watch next.',
  },
  {
    id: 'voices',
    label: 'Top voices',
    prompt: 'Return ranked people, accounts, publishers, and venues driving the conversation with source links.',
  },
  {
    id: 'events',
    label: 'Events',
    prompt: 'Return upcoming events, venues, dates when available, source links, and audience momentum.',
  },
  {
    id: 'arena',
    label: 'Arena',
    prompt: 'Compare Grok-style X pulse, grounded analysis, sentiment, velocity, voices, and model divergence.',
  },
  {
    id: 'brief',
    label: 'Brief',
    prompt: 'Return a concise brief with the most important signal, supporting sources, and uncertainty.',
  },
  {
    id: 'compare',
    label: 'Compare',
    prompt: 'Compare the strongest viewpoints, winners and losers, repeated claims, and missing evidence.',
  },
]

const SEARCH_EXAMPLES: CustomSearchState[] = [
  { what: 'live music', where: 'Tulsa, OK', when: '7d', output: 'pulse' },
  { what: 'songwriter rounds', where: 'Nashville, TN', when: 'weekend', output: 'events' },
  { what: 'Porsche 911 GT3 allocations', where: '', when: '7d', output: 'voices' },
  { what: 'restaurant openings', where: 'Charleston, SC', when: '30d', output: 'pulse' },
]

function SeedsRoute() {
  const seeds = useMemo(() => publicSeedCollections(), [])
  const [kind, setKind] = useState<SeedCollectionKind | 'all'>('all')
  const [customSearch, setCustomSearch] = useState<CustomSearchState>(SEARCH_EXAMPLES[0])
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const filtered = kind === 'all' ? seeds : seeds.filter((seed) => seed.kind === kind)
  const kinds = useMemo(
    () => Array.from(new Set<SeedCollectionKind>(seeds.map((seed) => seed.kind))),
    [seeds],
  )
  const liveHref = cleanseekHref({
    query: buildCustomSearchQuery(customSearch),
    latest: true,
    preset: customSearch.output === 'brief' ? 'quick' : 'web',
    autorun: false,
    path: '/cleanseek-x',
  })
  const voicesHref = cleanseekHref({
    query: buildVoiceSearchQuery(customSearch),
    latest: true,
    preset: 'web',
    autorun: false,
    path: '/cleanseek-x',
  })
  const arenaHref = arenaHrefFromSearch(customSearch)

  useEffect(() => {
    setWatchlist(loadWatchlist())
  }, [])

  const saveWatchlist = (next: WatchlistItem[]) => {
    setWatchlist(next)
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(next.slice(0, 24)))
    } catch {
      /* noop */
    }
  }

  const addWatchlistItem = (item: CustomSearchState) => {
    const cleaned = cleanCustomSearch(item)
    if (!cleaned.what) return
    const key = watchlistKey(cleaned)
    const existing = watchlist.filter((saved) => watchlistKey(saved) !== key)
    saveWatchlist([{ ...cleaned, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: new Date().toISOString() }, ...existing])
  }

  const removeWatchlistItem = (id: string) => {
    saveWatchlist(watchlist.filter((item) => item.id !== id))
  }

  return (
    <main className="min-h-screen bg-[#f7f8f4] text-neutral-950">
      <XSiteHeader active="seeds" title="X.SeekBoxAI Seeds" eyebrow="curated search starts" />

      <section className="border-b border-neutral-300 bg-[#fbfbf7]">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-7 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div className="border-l-4 border-neutral-950 bg-white p-5 shadow-[6px_6px_0_rgba(0,0,0,0.08)]">
            <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-neutral-500">
              <Tags className="h-4 w-4" />
              seed library
            </div>
            <h1 className="mt-3 text-3xl font-black leading-[1.05] tracking-tight sm:text-5xl">
              Scenes, brands, and culture threads with a head start.
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-neutral-600">
              Curated starting points for live search, local scenes, voice discovery, and future pulse pages.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile label="Seeds" value={String(seeds.length)} />
            <StatTile label="Local" value={String(seeds.filter((seed) => seed.locations.length).length)} />
            <StatTile label="Handles" value={String(seeds.reduce((sum, seed) => sum + seed.handles.length, 0))} />
          </div>
        </div>
      </section>

      <section className="border-b border-neutral-300 bg-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:px-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] xl:px-8">
          <div className="border border-neutral-300 bg-[#fbfbf7] p-4 shadow-[4px_4px_0_rgba(0,0,0,0.05)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.24em] text-neutral-500">Live intelligence search</div>
                <h2 className="mt-1 text-2xl font-black tracking-tight">Ask by scene, place, window, and output.</h2>
              </div>
              <span className="border border-neutral-300 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">
                User view
              </span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">What</span>
                <input
                  value={customSearch.what}
                  onChange={(e) => setCustomSearch((current) => ({ ...current, what: e.target.value }))}
                  placeholder="live music, Porsche GT cars, restaurant openings"
                  className="mt-2 h-12 w-full border border-neutral-300 bg-white px-3 text-sm font-bold text-neutral-950 outline-none focus:border-neutral-950"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Where</span>
                <input
                  value={customSearch.where}
                  onChange={(e) => setCustomSearch((current) => ({ ...current, where: e.target.value }))}
                  placeholder="Tulsa, OK or global"
                  className="mt-2 h-12 w-full border border-neutral-300 bg-white px-3 text-sm font-bold text-neutral-950 outline-none focus:border-neutral-950"
                />
              </label>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <ControlGroup
                label="When"
                options={WHEN_OPTIONS}
                value={customSearch.when}
                onChange={(when) => setCustomSearch((current) => ({ ...current, when }))}
              />
              <ControlGroup
                label="Output"
                options={OUTPUT_OPTIONS}
                value={customSearch.output}
                onChange={(output) => setCustomSearch((current) => ({ ...current, output }))}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {SEARCH_EXAMPLES.map((example) => (
                <button
                  key={`${example.what}-${example.where}-${example.output}`}
                  type="button"
                  onClick={() => setCustomSearch(example)}
                  className="border border-neutral-300 bg-white px-3 py-2 text-left text-xs font-black text-neutral-700 hover:border-neutral-950"
                >
                  {example.where ? `${example.where}: ` : ''}
                  {example.what}
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <a href={liveHref} className="inline-flex min-h-12 items-center justify-center gap-2 border border-neutral-950 bg-neutral-950 px-4 py-3 text-sm font-black text-white hover:bg-neutral-800">
                <Search className="h-4 w-4" />
                Search live
              </a>
              <a href={voicesHref} className="inline-flex min-h-12 items-center justify-center gap-2 border border-neutral-300 bg-white px-4 py-3 text-sm font-black text-neutral-900 hover:border-neutral-950">
                <UsersRound className="h-4 w-4" />
                Find voices
              </a>
              <a href={arenaHref} className="inline-flex min-h-12 items-center justify-center gap-2 border border-red-300 bg-red-50 px-4 py-3 text-sm font-black text-red-950 hover:border-red-700">
                <Radio className="h-4 w-4" />
                Open arena
              </a>
              <button
                type="button"
                onClick={() => addWatchlistItem(customSearch)}
                className="inline-flex min-h-12 items-center justify-center gap-2 border border-cyan-800 bg-cyan-50 px-4 py-3 text-sm font-black text-cyan-950 hover:bg-cyan-100"
              >
                <BookmarkPlus className="h-4 w-4" />
                Build watchlist
              </button>
            </div>
          </div>

          <WatchlistPanel items={watchlist} onRemove={removeWatchlistItem} />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setKind('all')}
            className={filterClass(kind === 'all')}
          >
            {KIND_LABELS.all}
          </button>
          {kinds.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setKind(item)}
              className={filterClass(kind === item)}
            >
              {KIND_LABELS[item]}
            </button>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((seed) => (
            <SeedCard key={seed.id} seed={seed} onWatch={() => addWatchlistItem(customSearchFromSeed(seed))} />
          ))}
        </div>
      </section>
    </main>
  )
}

function SeedCard({ seed, onWatch }: { seed: SeedCollection; onWatch: () => void }) {
  const searchHref = cleanseekHref({
    query: seedUserSearchQuery(seed),
    latest: true,
    preset: 'web',
    autorun: false,
    path: '/cleanseek-x',
  })
  const voicesHref = cleanseekHref({
    query: seedDiscoveryQuery(seed),
    latest: true,
    preset: 'web',
    autorun: false,
    path: '/cleanseek-x',
  })
  const arenaHref = arenaHrefFromSearch(customSearchFromSeed(seed))

  return (
    <article className="border border-neutral-300 bg-white p-5 shadow-[4px_4px_0_rgba(0,0,0,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">{KIND_LABELS[seed.kind]}</div>
          <h2 className="mt-1 text-2xl font-black tracking-tight">{seed.label}</h2>
        </div>
        <span className="border border-neutral-300 bg-[#fbfbf7] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-600">
          {seed.outputDefaults.view}
        </span>
      </div>

      <p className="mt-3 text-sm font-semibold leading-6 text-neutral-600">{seed.summary}</p>

      {seed.locations.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {seed.locations.map((location) => (
            <span key={location.label} className="inline-flex items-center gap-1 border border-neutral-300 bg-[#fbfbf7] px-2.5 py-1 text-xs font-black text-neutral-700">
              <MapPin className="h-3.5 w-3.5" />
              {location.label} · {location.radius}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {seed.tags.slice(0, 6).map((tag) => (
          <span key={tag} className="border border-neutral-200 bg-[#fbfbf7] px-2 py-1 text-[11px] font-black text-neutral-500">
            #{tag}
          </span>
        ))}
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <a href={searchHref} className="inline-flex items-center justify-center gap-2 border border-neutral-950 bg-neutral-950 px-4 py-3 text-sm font-black text-white hover:bg-neutral-800">
          <Search className="h-4 w-4" />
          Search live
        </a>
        <a href={voicesHref} className="inline-flex items-center justify-center gap-2 border border-neutral-300 bg-[#fbfbf7] px-4 py-3 text-sm font-black text-neutral-900 hover:border-neutral-950">
          <Music className="h-4 w-4" />
          Find voices
          <ArrowUpRight className="h-4 w-4" />
        </a>
        <a href={arenaHref} className="inline-flex items-center justify-center gap-2 border border-red-300 bg-red-50 px-4 py-3 text-sm font-black text-red-950 hover:border-red-700">
          <Radio className="h-4 w-4" />
          Arena
        </a>
        <button
          type="button"
          onClick={onWatch}
          className="inline-flex items-center justify-center gap-2 border border-neutral-300 bg-[#fbfbf7] px-4 py-3 text-sm font-black text-neutral-900 hover:border-neutral-950"
        >
          <BookmarkPlus className="h-4 w-4" />
          Watch
        </button>
      </div>
    </article>
  )
}

function WatchlistPanel({ items, onRemove }: { items: WatchlistItem[]; onRemove: (id: string) => void }) {
  return (
    <aside className="border border-neutral-300 bg-[#fbfbf7] p-4 shadow-[4px_4px_0_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-neutral-500">Watchlist</div>
          <h2 className="mt-1 text-2xl font-black tracking-tight">{items.length ? `${items.length} saved` : 'No saved searches'}</h2>
        </div>
        <BookmarkPlus className="h-5 w-5 text-neutral-500" />
      </div>

      <div className="mt-4 grid gap-3">
        {items.length ? (
          items.map((item) => {
            const liveHref = cleanseekHref({ query: buildCustomSearchQuery(item), latest: true, preset: 'web', path: '/cleanseek-x' })
            const voicesHref = cleanseekHref({ query: buildVoiceSearchQuery(item), latest: true, preset: 'web', path: '/cleanseek-x' })
            return (
              <div key={item.id} className="border border-neutral-300 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="break-words text-sm font-black text-neutral-950">{item.what}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
                      {item.where ? <span>{item.where}</span> : <span>Global</span>}
                      <span>{optionLabel(WHEN_OPTIONS, item.when)}</span>
                      <span>{optionLabel(OUTPUT_OPTIONS, item.output)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    aria-label={`Remove ${item.what}`}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-neutral-300 text-neutral-500 hover:border-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <a href={liveHref} className="inline-flex items-center justify-center gap-2 border border-neutral-950 bg-neutral-950 px-3 py-2 text-xs font-black text-white hover:bg-neutral-800">
                    <Search className="h-3.5 w-3.5" />
                    Search
                  </a>
                  <a href={voicesHref} className="inline-flex items-center justify-center gap-2 border border-neutral-300 bg-[#fbfbf7] px-3 py-2 text-xs font-black text-neutral-900 hover:border-neutral-950">
                    <UsersRound className="h-3.5 w-3.5" />
                    Voices
                  </a>
                </div>
              </div>
            )
          })
        ) : (
          <div className="border border-dashed border-neutral-300 bg-white p-5 text-sm font-semibold leading-6 text-neutral-500">
            Saved searches appear here in this browser.
          </div>
        )}
      </div>
    </aside>
  )
}

function ControlGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: Array<{ id: T; label: string }>
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">{label}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={filterClass(value === option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-neutral-300 bg-white p-4 shadow-[4px_4px_0_rgba(0,0,0,0.05)]">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">{label}</div>
      <div className="mt-2 text-3xl font-black tracking-tight">{value}</div>
    </div>
  )
}

function filterClass(active: boolean): string {
  return active
    ? 'border border-neutral-950 bg-neutral-950 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-white'
    : 'border border-neutral-300 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-neutral-700 hover:border-neutral-950'
}

function buildCustomSearchQuery(search: CustomSearchState): string {
  const cleaned = cleanCustomSearch(search)
  const output = OUTPUT_OPTIONS.find((option) => option.id === cleaned.output) ?? OUTPUT_OPTIONS[0]
  return [
    `${output.label}: ${cleaned.what}`,
    cleaned.where ? `Location focus: ${cleaned.where}.` : 'Location focus: global or source-defined.',
    `Time focus: ${whenPrompt(cleaned.when)}.`,
    output.prompt,
  ].join(' ')
}

function buildVoiceSearchQuery(search: CustomSearchState): string {
  const cleaned = cleanCustomSearch(search)
  return [
    `Find the top X/Twitter voices, posters, venues, publishers, and sources for ${cleaned.what}.`,
    cleaned.where ? `Location focus: ${cleaned.where}.` : 'Location focus: global or source-defined.',
    `Time focus: ${whenPrompt(cleaned.when)}.`,
    'Return ranked names or handles, why each matters, recent source links, evidence quality, and caveats.',
  ].join(' ')
}

function customSearchFromSeed(seed: SeedCollection): CustomSearchState {
  const output = seedOutputToSearchOutput(seed.outputDefaults.view)
  return {
    what: seedPrimaryQuery(seed),
    where: seed.locations[0]?.label ?? '',
    when: '7d',
    output,
  }
}

function seedOutputToSearchOutput(output: SeedOutputView): SearchOutput {
  if (output === 'leaderboard') return 'voices'
  if (output === 'calendar') return 'events'
  if (output === 'brief') return 'brief'
  return 'pulse'
}

function cleanCustomSearch(search: CustomSearchState): CustomSearchState {
  return {
    what: cleanField(search.what, 120),
    where: cleanField(search.where, 80),
    when: WHEN_OPTIONS.some((option) => option.id === search.when) ? search.when : '7d',
    output: OUTPUT_OPTIONS.some((option) => option.id === search.output) ? search.output : 'pulse',
  }
}

function cleanField(value: string, max: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max)
}

function whenPrompt(value: SearchWhen): string {
  return WHEN_OPTIONS.find((option) => option.id === value)?.prompt ?? 'the past 7 days'
}

function optionLabel<T extends string>(options: Array<{ id: T; label: string }>, value: T): string {
  return options.find((option) => option.id === value)?.label ?? value
}

function watchlistKey(search: CustomSearchState): string {
  const cleaned = cleanCustomSearch(search)
  return [cleaned.what, cleaned.where, cleaned.when, cleaned.output].join('|').toLowerCase()
}

function arenaHrefFromSearch(search: CustomSearchState): string {
  const cleaned = cleanCustomSearch(search)
  const params = new URLSearchParams()
  if (cleaned.what) params.set('topic', cleaned.what)
  if (cleaned.where) params.set('where', cleaned.where)
  params.set('tone', cleaned.output === 'brief' ? 'clean' : 'witty')
  const qs = params.toString()
  return qs ? `/arena?${qs}` : '/arena'
}

function loadWatchlist(): WatchlistItem[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(WATCHLIST_STORAGE_KEY) ?? '[]') as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item): WatchlistItem | null => {
        if (!item || typeof item !== 'object') return null
        const raw = item as Partial<WatchlistItem>
        if (typeof raw.what !== 'string' || typeof raw.where !== 'string') return null
        const cleaned = cleanCustomSearch({
          what: raw.what,
          where: raw.where,
          when: raw.when ?? '7d',
          output: raw.output ?? 'pulse',
        })
        if (!cleaned.what) return null
        return {
          ...cleaned,
          id: typeof raw.id === 'string' ? raw.id : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
        }
      })
      .filter((item): item is WatchlistItem => Boolean(item))
      .slice(0, 24)
  } catch {
    return []
  }
}
