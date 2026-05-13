import { useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  ExternalLink,
  Loader2,
  MessageSquare,
  Radar,
  Search,
  ShieldAlert,
  Swords,
  Zap,
} from 'lucide-react'
import { getClientId } from '../../lib/clientId'
import { antiEcho, postRoom, xBattle } from '../../lib/xIntel/client'
import { X_BATTLE_WINDOW_LABEL } from '../../lib/xIntel/types'
import type { AntiEchoResult, BattleWindow, PostRoomResult, XBattleResponse, XBattleSide } from '../../lib/xIntel/types'
import { Matrix, MatrixDemo, type MatrixEngine } from './Matrix'
import { SeekBoxLogo } from '../SeekBoxLogo'

const SAMPLE_PAIRS: Array<{ a: string; b: string; window: BattleWindow }> = [
  { a: 'sama', b: 'elonmusk', window: '7d' },
  { a: 'AnthropicAI', b: 'OpenAI', window: '7d' },
  { a: 'tim_cook', b: 'sundarpichai', window: '30d' },
  { a: 'pmarca', b: 'reidhoffman', window: '7d' },
]

const SAMPLE_CLAIMS = [
  'Apple Intelligence is years behind Google and OpenAI.',
  'Self-driving cars are essentially solved at this point.',
  'AI coding tools will mostly replace junior engineers within 18 months.',
  'The creator economy is healthier now than it was two years ago.',
]

const SAMPLE_ROOMS = [
  'https://x.com/sama',
  'NVDA earnings reaction on X',
  'AI agents replacing search this week',
  'creator economy optimism versus burnout',
]

type LabKey = 'overview' | 'post-room' | 'x-battle' | 'anti-echo' | 'matrix'

export function XIntelShell({
  active,
  title,
  eyebrow,
  description,
  children,
}: {
  active: LabKey
  title: string
  eyebrow: string
  description: string
  children: React.ReactNode
}) {
  return (
    <main className="min-h-screen bg-[#f7f8f4] text-neutral-950">
      <section className="border-b border-neutral-300 bg-[#fbfbf7]">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <a href="/" className="flex items-center gap-3">
              <SeekBoxLogo tone="light" size="lg" />
              <div>
                <div className="text-2xl font-black tracking-tight">X.SeekBoxAI Intel</div>
                <div className="text-[11px] font-black uppercase tracking-[0.24em] text-neutral-500">
                  live X workbench
                </div>
              </div>
            </a>
            <nav className="flex flex-wrap gap-2 text-sm font-black">
              <TopNav href="/pulse" active={false}>Reader</TopNav>
              <TopNav href="/industries" active={false}>Industries</TopNav>
              <TopNav href="/labs" active={active === 'overview'}>Intel</TopNav>
              <TopNav href="/labs/post-room" active={active === 'post-room'}>Post Room</TopNav>
              <TopNav href="/labs/x-battle" active={active === 'x-battle'}>X Battle</TopNav>
              <TopNav href="/labs/anti-echo" active={active === 'anti-echo'}>Anti-Echo</TopNav>
              <TopNav href="/labs/matrix" active={active === 'matrix'}>Matrix</TopNav>
            </nav>
          </header>
          <div className="max-w-4xl border-l-4 border-neutral-950 bg-white p-5 shadow-[6px_6px_0_rgba(0,0,0,0.08)]">
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-neutral-500">{eyebrow}</div>
            <h1 className="mt-3 text-3xl font-black leading-[1.05] tracking-tight sm:text-5xl">{title}</h1>
            <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-neutral-600">{description}</p>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</section>
    </main>
  )
}

export function XIntelOverview() {
  const labs = [
    {
      href: '/labs/post-room',
      icon: <Radar className="h-5 w-5" />,
      title: 'Post Room',
      text: 'Paste a post URL, handle, ticker, or topic and get the surrounding conversation, camps, related posts, and dissent.',
      meta: 'About one live call',
    },
    {
      href: '/labs/x-battle',
      icon: <Swords className="h-5 w-5" />,
      title: 'X Battle',
      text: 'Run two handles through the same live window and compare volume, sentiment, themes, and representative posts.',
      meta: 'About two live calls',
    },
    {
      href: '/labs/anti-echo',
      icon: <ShieldAlert className="h-5 w-5" />,
      title: 'Anti-Echo',
      text: 'Drop a claim and surface the strongest substantive pushback from X without over-weighting the loudest accounts.',
      meta: 'About one live call',
    },
    {
      href: '/labs/matrix',
      icon: <Zap className="h-5 w-5" />,
      title: 'Matrix',
      text: 'Controlled multi-engine loading state for Rabbit Hole-style fan-out flows. It is visual only and has no API cost.',
      meta: 'UI only',
    },
  ]

  return (
    <XIntelShell
      active="overview"
      eyebrow="Three portable lab primitives"
      title="Battle, dissent, and parallel thinking for the xdot site."
      description="These are now native xdot surfaces: server-proxied live X calls where needed, and a reusable Matrix loading state for production flows."
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {labs.map((lab) => (
          <a key={lab.href} href={lab.href} className="group flex min-h-[260px] flex-col justify-between border border-neutral-300 bg-white p-5 shadow-[4px_4px_0_rgba(0,0,0,0.05)] transition hover:-translate-y-0.5 hover:shadow-[7px_7px_0_rgba(0,0,0,0.08)]">
            <div>
              <div className="mb-5 inline-flex rounded-lg bg-neutral-950 p-3 text-white">{lab.icon}</div>
              <div className="text-xl font-black tracking-tight">{lab.title}</div>
              <p className="mt-3 text-sm font-semibold leading-6 text-neutral-600">{lab.text}</p>
            </div>
            <div className="mt-8 flex items-center justify-between border-t border-neutral-200 pt-4 text-xs font-black uppercase tracking-[0.18em] text-neutral-500">
              <span>{lab.meta}</span>
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </div>
          </a>
        ))}
      </div>
    </XIntelShell>
  )
}

export function PostRoomTool() {
  const [input, setInput] = useState(() => initialRoomParam() ?? SAMPLE_ROOMS[0])
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<PostRoomResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const matrixEngines = useMemo<MatrixEngine[]>(() => [
    { id: 'room', name: 'Room', model: 'scan', color: '#0ea5e9', highlight: '#7dd3fc', status: running ? 'thinking' : result?.ok ? 'done' : 'idle' },
    { id: 'camps', name: 'Camps', model: 'cluster', color: '#f97316', highlight: '#fdba74', status: running ? 'thinking' : result?.ok ? 'done' : 'idle' },
    { id: 'sources', name: 'Sources', model: 'links', color: '#14b8a6', highlight: '#5eead4', status: running ? 'thinking' : result?.ok ? 'done' : 'idle' },
  ], [result, running])

  const run = async (nextInput = input) => {
    if (running) return
    setInput(nextInput)
    setRunning(true)
    setResult(null)
    setError(null)
    try {
      setResult(await postRoom({ input: nextInput, clientId: getClientId() }))
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Post Room failed.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <XIntelShell
      active="post-room"
      eyebrow="Explain the room"
      title="Paste a post, handle, ticker, or topic and see the surrounding conversation."
      description="This is the quick read before a deeper search: what the room is saying, the camps forming, related source links, and the best dissent."
    >
      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="border border-neutral-300 bg-white p-5 shadow-[4px_4px_0_rgba(0,0,0,0.05)]">
          <div className="mb-5 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-neutral-500">
            <Radar className="h-4 w-4" />
            Input
          </div>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value.slice(0, 500))}
            rows={5}
            className="w-full resize-y rounded-lg border border-neutral-300 bg-white p-3 text-sm font-semibold leading-6 text-neutral-900 outline-none focus:border-neutral-950"
            placeholder="Paste an X URL, handle, ticker, or topic."
          />
          <div className="mt-2 flex items-center justify-between gap-3 text-xs font-semibold text-neutral-500">
            <span>URLs, handles, tickers, and plain-language topics all work.</span>
            <span>{input.trim().length}/500</span>
          </div>
          <button
            type="button"
            onClick={() => run()}
            disabled={running || input.trim().length < 4}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-950 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {running ? 'Reading the room' : 'Read the room'}
          </button>
          <div className="mt-6">
            <div className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Planted starts</div>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_ROOMS.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  disabled={running}
                  onClick={() => run(sample)}
                  className="rounded-lg border border-neutral-300 bg-[#fbfbf7] px-3 py-2 text-left text-xs font-black text-neutral-700 disabled:opacity-50"
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <Matrix engines={matrixEngines} height={220} doneMessage="Room read ready." />
          {error ? <ErrorCard message={error} /> : null}
          {result ? <PostRoomResultPanel result={result} /> : <EmptyPanel title="Ready for a room read" text="The result will summarize the room, camps, related posts, dissent, timing, and cost." />}
        </div>
      </div>
    </XIntelShell>
  )
}

export function XBattleTool() {
  const initial = initialBattleParams()
  const [handleA, setHandleA] = useState(initial.a)
  const [handleB, setHandleB] = useState(initial.b)
  const [window, setWindow] = useState<BattleWindow>(initial.window)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<XBattleResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const matrixEngines = useMemo<MatrixEngine[]>(() => [
    { id: 'a', name: cleanAt(handleA) || 'Side A', model: 'handle scan', color: '#0ea5e9', highlight: '#7dd3fc', status: running ? 'thinking' : result?.ok ? 'done' : 'idle' },
    { id: 'b', name: cleanAt(handleB) || 'Side B', model: 'handle scan', color: '#a78bfa', highlight: '#ddd6fe', status: running ? 'thinking' : result?.ok ? 'done' : 'idle' },
  ], [handleA, handleB, result, running])

  const run = async (preset?: { a: string; b: string; window: BattleWindow }) => {
    const nextA = preset?.a ?? handleA
    const nextB = preset?.b ?? handleB
    const nextWindow = preset?.window ?? window
    if (running) return
    setHandleA(nextA)
    setHandleB(nextB)
    setWindow(nextWindow)
    setRunning(true)
    setResult(null)
    setError(null)
    try {
      setResult(await xBattle({ handleA: nextA, handleB: nextB, window: nextWindow, clientId: getClientId() }))
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'X Battle failed.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <XIntelShell
      active="x-battle"
      eyebrow="Head to head"
      title="Compare two X handles over the same window."
      description="Each side runs independently on the server, then returns only the parsed comparison data the page needs."
    >
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="border border-neutral-300 bg-white p-5 shadow-[4px_4px_0_rgba(0,0,0,0.05)]">
          <div className="mb-5 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-neutral-500">
            <Swords className="h-4 w-4" />
            Inputs
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
            <HandleField label="Handle A" value={handleA} onChange={setHandleA} onSubmit={() => run()} />
            <div className="hidden pb-3 text-center text-xs font-black text-neutral-400 sm:block">VS</div>
            <HandleField label="Handle B" value={handleB} onChange={setHandleB} onSubmit={() => run()} />
          </div>
          <div className="mt-5">
            <div className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Window</div>
            <div className="flex flex-wrap gap-2">
              {(['24h', '7d', '30d'] as BattleWindow[]).map((choice) => (
                <button
                  key={choice}
                  type="button"
                  onClick={() => setWindow(choice)}
                  className={`rounded-lg border px-3 py-2 text-sm font-black ${choice === window ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-300 bg-white text-neutral-700'}`}
                >
                  {X_BATTLE_WINDOW_LABEL[choice]}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => run()}
            disabled={running || !handleA.trim() || !handleB.trim()}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-950 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {running ? 'Running comparison' : 'Start battle'}
          </button>
          <div className="mt-6">
            <div className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Planted starts</div>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_PAIRS.map((sample) => (
                <button
                  key={`${sample.a}-${sample.b}-${sample.window}`}
                  type="button"
                  disabled={running}
                  onClick={() => run(sample)}
                  className="rounded-lg border border-neutral-300 bg-[#fbfbf7] px-3 py-2 text-left text-xs font-black text-neutral-700 disabled:opacity-50"
                >
                  @{sample.a} / @{sample.b}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <Matrix engines={matrixEngines} height={220} doneMessage="Comparison ready." />
          {error ? <ErrorCard message={error} /> : null}
          {result ? <BattleResult result={result} /> : <EmptyPanel title="Ready when you are" text="Run a pair to see volume, sentiment, themes, post links, timing, and cost." />}
        </div>
      </div>
    </XIntelShell>
  )
}

export function AntiEchoTool() {
  const [claim, setClaim] = useState(() => initialClaimParam() ?? SAMPLE_CLAIMS[0])
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<AntiEchoResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const matrixEngines = useMemo<MatrixEngine[]>(() => [
    { id: 'claim', name: 'Claim', model: 'read', color: '#14b8a6', highlight: '#5eead4', status: running ? 'thinking' : result?.ok ? 'done' : 'idle' },
    { id: 'dissent', name: 'Dissent', model: 'countercase', color: '#f97316', highlight: '#fdba74', status: running ? 'thinking' : result?.ok ? 'done' : 'idle' },
    { id: 'posts', name: 'Posts', model: 'sources', color: '#8b5cf6', highlight: '#ddd6fe', status: running ? 'thinking' : result?.ok ? 'done' : 'idle' },
  ], [result, running])

  const run = async (nextClaim = claim) => {
    if (running) return
    setClaim(nextClaim)
    setRunning(true)
    setResult(null)
    setError(null)
    try {
      setResult(await antiEcho({ claim: nextClaim, clientId: getClientId() }))
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Anti-Echo failed.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <XIntelShell
      active="anti-echo"
      eyebrow="Counter-signal"
      title="Find the strongest dissent before the room hardens."
      description="Drop a claim and let the server pull back the best counter-case, strongest counters, and source trails."
    >
      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="border border-neutral-300 bg-white p-5 shadow-[4px_4px_0_rgba(0,0,0,0.05)]">
          <div className="mb-5 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-neutral-500">
            <ShieldAlert className="h-4 w-4" />
            Claim
          </div>
          <textarea
            value={claim}
            onChange={(event) => setClaim(event.target.value.slice(0, 600))}
            rows={6}
            className="w-full resize-y rounded-lg border border-neutral-300 bg-white p-3 text-sm font-semibold leading-6 text-neutral-900 outline-none focus:border-neutral-950"
            placeholder="Type a claim to challenge."
          />
          <div className="mt-2 flex items-center justify-between gap-3 text-xs font-semibold text-neutral-500">
            <span>Minimum 8 characters.</span>
            <span>{claim.trim().length}/600</span>
          </div>
          <button
            type="button"
            onClick={() => run()}
            disabled={running || claim.trim().length < 8}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-950 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {running ? 'Finding dissent' : 'Find dissent'}
          </button>
          <div className="mt-6">
            <div className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Planted starts</div>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_CLAIMS.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  disabled={running}
                  onClick={() => run(sample)}
                  className="rounded-lg border border-neutral-300 bg-[#fbfbf7] px-3 py-2 text-left text-xs font-black text-neutral-700 disabled:opacity-50"
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <Matrix engines={matrixEngines} height={220} doneMessage="Dissent ready." />
          {error ? <ErrorCard message={error} /> : null}
          {result ? <AntiEchoResultPanel result={result} /> : <EmptyPanel title="Ready for a claim" text="The result will separate summary, strongest counters, cited posts, timing, and cost." />}
        </div>
      </div>
    </XIntelShell>
  )
}

export function MatrixLab() {
  const [controlledEngines, setControlledEngines] = useState<MatrixEngine[]>(() => [
    { id: 'retrieve', name: 'Retrieve', model: 'sources', color: '#0ea5e9', highlight: '#7dd3fc', status: 'idle' },
    { id: 'compare', name: 'Compare', model: 'parallel', color: '#a78bfa', highlight: '#ddd6fe', status: 'idle' },
    { id: 'synthesize', name: 'Synthesize', model: 'brief', color: '#10b981', highlight: '#86efac', status: 'idle' },
  ])

  const simulate = () => {
    setControlledEngines((prev) => prev.map((engine) => ({ ...engine, status: 'thinking' })))
    controlledEngines.forEach((_, index) => {
      window.setTimeout(() => {
        setControlledEngines((prev) => prev.map((engine, idx) => (idx === index ? { ...engine, status: 'done' } : engine)))
      }, 900 + index * 900)
    })
  }

  return (
    <XIntelShell
      active="matrix"
      eyebrow="Pure UI"
      title="A controlled loading state for parallel work."
      description="Matrix does not call an API. It renders the engine states you pass in, so production code can connect it to real fan-out request state."
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="border border-neutral-300 bg-white p-5 shadow-[4px_4px_0_rgba(0,0,0,0.05)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.22em] text-neutral-500">Controlled</div>
              <h2 className="mt-2 text-2xl font-black tracking-tight">Production shape</h2>
            </div>
            <button type="button" onClick={simulate} className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-black text-white">
              Simulate run
            </button>
          </div>
          <Matrix engines={controlledEngines} height={360} doneMessage="Production handoff ready." />
        </div>
        <div className="border border-neutral-300 bg-white p-5 shadow-[4px_4px_0_rgba(0,0,0,0.05)]">
          <div className="mb-4">
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-neutral-500">Demo wrapper</div>
            <h2 className="mt-2 text-2xl font-black tracking-tight">Random timing preview</h2>
          </div>
          <MatrixDemo height={360} />
        </div>
      </div>
    </XIntelShell>
  )
}

function TopNav({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <a href={href} className={`rounded-lg px-4 py-2 ${active ? 'bg-neutral-950 text-white' : 'border border-neutral-300 bg-white text-neutral-800'}`}>
      {children}
    </a>
  )
}

function HandleField({ label, value, onChange, onSubmit }: {
  label: string
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">{label}</span>
      <span className="flex items-center rounded-lg border border-neutral-300 bg-white focus-within:border-neutral-950">
        <span className="pl-3 text-base font-black text-neutral-400">@</span>
        <input
          value={value.replace(/^@/, '')}
          onChange={(event) => onChange(event.target.value.replace(/^@/, ''))}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onSubmit()
          }}
          className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm font-black text-neutral-900 outline-none"
          placeholder="handle"
        />
      </span>
    </label>
  )
}

function BattleResult({ result }: { result: XBattleResponse }) {
  return (
      <div className="flex flex-col gap-4">
      <SourceAttribution />
      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-black uppercase tracking-[0.18em] text-neutral-500">
        <span>Battle / {(result.totalDurationMs / 1000).toFixed(1)}s / {formatCost(result.totalCostUsd)}</span>
        <span>{X_BATTLE_WINDOW_LABEL[result.window]}</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <SideCard side={result.sides.a} accent="border-sky-500" />
        <SideCard side={result.sides.b} accent="border-violet-500" />
      </div>
    </div>
  )
}

function SideCard({ side, accent }: { side: XBattleSide; accent: string }) {
  return (
    <article className={`border border-l-4 border-neutral-300 ${accent} bg-white p-5 shadow-[3px_3px_0_rgba(0,0,0,0.05)]`}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-black tracking-tight">{side.handle}</div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Live X search</div>
        </div>
        <MessageSquare className="h-5 w-5 text-neutral-500" />
      </header>
      {side.status === 'error' ? (
        <ErrorCard message={side.error ?? 'This side failed.'} compact />
      ) : (
        <div className="flex flex-col gap-4">
          {side.postCount ? <FieldBlock label="Volume" value={side.postCount} /> : null}
          {side.sentiment ? <FieldBlock label="Sentiment" value={side.sentiment} /> : null}
          {side.themes.length ? <ListBlock label="Themes" items={side.themes} /> : null}
          {side.excerpts.length ? <ExcerptBlock items={side.excerpts} /> : null}
          <div className="border-t border-neutral-200 pt-3 text-[11px] font-black uppercase tracking-[0.16em] text-neutral-500">
            {(side.durationMs / 1000).toFixed(1)}s / {formatCost(side.costUsd)}
          </div>
        </div>
      )}
    </article>
  )
}

function AntiEchoResultPanel({ result }: { result: AntiEchoResult }) {
  if (result.status === 'error') return <ErrorCard message={result.error ?? 'Could not find dissent.'} />

  return (
    <article className="border border-neutral-300 bg-white p-5 shadow-[4px_4px_0_rgba(0,0,0,0.05)]">
      <div className="mb-5 text-[11px] font-black uppercase tracking-[0.18em] text-neutral-500">
        Dissent / {(result.durationMs / 1000).toFixed(1)}s / {formatCost(result.costUsd)}
      </div>
      <SourceAttribution />
      <div className="flex flex-col gap-5">
        {result.summary ? <FieldBlock label="Summary" value={result.summary} /> : null}
        {result.strongestCounters.length ? <ListBlock label="Strongest counters" items={result.strongestCounters} /> : null}
        {result.posts.length ? (
          <section>
            <SectionLabel>Dissenting posts</SectionLabel>
            <ul className="mt-2 flex flex-col gap-3">
              {result.posts.map((post, index) => (
                <li key={`${post.handle ?? 'post'}-${index}`} className="border-l-2 border-neutral-300 pl-3 text-sm font-semibold leading-6 text-neutral-700">
                  {post.handle ? <span className="mr-1 font-black text-neutral-950">{post.handle}</span> : null}
                  {post.text}
                  {post.url ? (
                    <a href={post.url} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex align-middle text-neutral-500 hover:text-neutral-950">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </article>
  )
}

function PostRoomResultPanel({ result }: { result: PostRoomResult }) {
  if (result.status === 'error') return <ErrorCard message={result.error ?? 'Could not read the room.'} />

  return (
    <article className="border border-neutral-300 bg-white p-5 shadow-[4px_4px_0_rgba(0,0,0,0.05)]">
      <div className="mb-5 text-[11px] font-black uppercase tracking-[0.18em] text-neutral-500">
        Room read / {(result.durationMs / 1000).toFixed(1)}s / {formatCost(result.costUsd)}
      </div>
      <SourceAttribution />
      <div className="flex flex-col gap-5">
        {result.roomSummary ? <FieldBlock label="Room summary" value={result.roomSummary} /> : null}
        {result.whyItMatters ? <FieldBlock label="Why it matters" value={result.whyItMatters} /> : null}
        {result.positions.length ? <ListBlock label="Positions" items={result.positions} /> : null}
        {result.relatedPosts.length ? (
          <section>
            <SectionLabel>Related posts</SectionLabel>
            <ul className="mt-2 flex flex-col gap-3">
              {result.relatedPosts.map((post, index) => (
                <li key={`${post.handle ?? 'post'}-${index}`} className="border-l-2 border-neutral-300 pl-3 text-sm font-semibold leading-6 text-neutral-700">
                  {post.handle ? <span className="mr-1 font-black text-neutral-950">{post.handle}</span> : null}
                  {post.text}
                  {post.url ? (
                    <a href={post.url} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex align-middle text-neutral-500 hover:text-neutral-950">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {result.dissent ? <FieldBlock label="Dissent" value={result.dissent} /> : null}
      </div>
    </article>
  )
}

function FieldBlock({ label, value }: { label: string; value: string }) {
  return (
    <section>
      <SectionLabel>{label}</SectionLabel>
      <p className="mt-1 text-sm font-semibold leading-6 text-neutral-700">{value}</p>
    </section>
  )
}

function ListBlock({ label, items }: { label: string; items: string[] }) {
  return (
    <section>
      <SectionLabel>{label}</SectionLabel>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-semibold leading-6 text-neutral-700">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  )
}

function ExcerptBlock({ items }: { items: Array<{ text: string; url?: string }> }) {
  return (
    <section>
      <SectionLabel>Representative posts</SectionLabel>
      <ul className="mt-2 flex flex-col gap-2 text-sm font-semibold leading-6 text-neutral-700">
        {items.map((item, index) => (
          <li key={`${item.text}-${index}`}>
            {item.url ? (
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-baseline gap-1 hover:text-neutral-950">
                {item.text}
                <ExternalLink className="h-3 w-3 shrink-0 text-neutral-500" />
              </a>
            ) : item.text}
          </li>
        ))}
      </ul>
    </section>
  )
}

function SourceAttribution() {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-300 bg-[#fbfbf7] px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-neutral-500">
      <span>Data from X</span>
      <span className="text-neutral-300">/</span>
      <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-neutral-800 hover:underline">
        View originals on X
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">{children}</div>
}

function ErrorCard({ message, compact = false }: { message: string; compact?: boolean }) {
  return (
    <div className={`flex items-start gap-3 border border-rose-300 bg-rose-50 ${compact ? 'p-3' : 'p-5'} text-rose-900`}>
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="text-sm font-bold leading-6">{message}</div>
    </div>
  )
}

function EmptyPanel({ title, text }: { title: string; text: string }) {
  return (
    <div className="border border-dashed border-neutral-300 bg-white p-5 text-neutral-600">
      <div className="text-lg font-black text-neutral-950">{title}</div>
      <p className="mt-2 text-sm font-semibold leading-6">{text}</p>
    </div>
  )
}

function cleanAt(value: string): string {
  const handle = value.trim().replace(/^@+/, '')
  return handle ? `@${handle}` : ''
}

function initialClaimParam(): string | null {
  if (typeof window === 'undefined') return null
  const claim = new URLSearchParams(window.location.search).get('claim')?.trim()
  return claim && claim.length >= 8 ? claim.slice(0, 600) : null
}

function initialRoomParam(): string | null {
  if (typeof window === 'undefined') return null
  const input = new URLSearchParams(window.location.search).get('input')?.trim()
  return input && input.length >= 4 ? input.slice(0, 500) : null
}

function initialBattleParams(): { a: string; b: string; window: BattleWindow } {
  if (typeof window === 'undefined') return { a: 'sama', b: 'elonmusk', window: '7d' }
  const params = new URLSearchParams(window.location.search)
  const a = params.get('a')?.replace(/^@+/, '').trim() || 'sama'
  const b = params.get('b')?.replace(/^@+/, '').trim() || 'elonmusk'
  const rawWindow = params.get('window')
  const nextWindow: BattleWindow = rawWindow === '24h' || rawWindow === '30d' || rawWindow === '7d' ? rawWindow : '7d'
  return { a: a.slice(0, 32), b: b.slice(0, 32), window: nextWindow }
}

function formatCost(value: number): string {
  return `$${value.toFixed(4)}`
}
