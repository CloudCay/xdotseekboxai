import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { getClientId } from '../lib/clientId'
import { Mic, Search } from 'lucide-react'
import { isSupabaseConfigured } from '../lib/supabase'

export const Route = createFileRoute('/cleanseek-x')({
  component: CleanSeekLite,
})

const RECENCY_INSTRUCTION =
  ' [LIVE MODE: Prioritize information from the past 7 days. If you have live web or X (Twitter) access, format your response with the sections below. If you do not have live X access, write the literal text \"No live X signals available\" at the top, then answer normally.\n\n**Live pulse:** one sentence summarizing the current state.\n\n**Top X posts:** quote 2-3 recent posts in the format `> @handle - timestamp: post text` (only real posts, never fabricate).\n\n**Sentiment:** one word — Positive, Negative, Mixed, or Neutral.\n\n**Trending:** 1-3 hashtags or short phrases dominating the conversation.\n\nAfter those sections, answer the user\'s question normally.]'

type PresetId = 'quick' | 'research' | 'web' | 'allin'
type Preset = { id: PresetId; label: string; emoji: string; engineIds: string[] }

const PRESETS: Preset[] = [
  { id: 'quick', label: 'Quick', emoji: '⚡', engineIds: ['chatgpt'] },
  { id: 'research', label: 'Research', emoji: '🔬', engineIds: ['claude', 'chatgpt', 'gemini'] },
  { id: 'web', label: 'Web', emoji: '🌐', engineIds: ['tavily', 'chatgptsearch', 'brave', 'groksearch'] },
  { id: 'allin', label: 'All In', emoji: '🚀', engineIds: [] }, // backend interprets [] as "use defaults" (if supported)
]

type EngineResult = {
  provider: string
  providerName?: string
  content: string
  status: 'loading' | 'success' | 'error'
}

type LiveXContext = {
  hasNoSignal: boolean
  livePulse: string | null
  topPosts: string[]
  sentiment: string | null
  trending: string | null
}

function parseLiveXContext(raw: string): LiveXContext {
  const hasNoSignal = /No live X signals available/i.test(raw)

  const section = (label: string) => {
    const m = raw.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\n\\*\\*|\\n\\*\\*|$)`, 'i'))
    return m?.[1]?.trim() ?? null
  }

  const livePulse = section('Live pulse')
  const topPostsRaw = section('Top X posts')
  const sentiment = section('Sentiment')?.split('\n')[0]?.trim() ?? null
  const trending = section('Trending')?.split('\n')[0]?.trim() ?? null

  const topPosts = (topPostsRaw ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 6)

  return { hasNoSignal, livePulse, topPosts, sentiment, trending }
}

function normalizeBaseUrl(raw: string | undefined): string {
  const v = (raw ?? '').trim().replace(/\/$/, '')
  if (!v) throw new Error('EXPO_PUBLIC_BACKEND_URL environment variable is not set')
  if (!/^https?:\/\//i.test(v)) throw new Error(`EXPO_PUBLIC_BACKEND_URL must include https:// (got: ${v})`)
  return v
}

function CleanSeekLite() {
  const backendUrlOrError = useMemo(() => {
    // Vite only exposes client env vars prefixed with VITE_.
    // Prefer VITE_BACKEND_URL in the browser, fall back to EXPO_PUBLIC_BACKEND_URL
    // for server-side/edge rendering where process.env is available.
    const viteUrl =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Vite env
      (import.meta as any)?.env?.VITE_BACKEND_URL as string | undefined
    const raw = viteUrl ?? process.env.EXPO_PUBLIC_BACKEND_URL
    try {
      return { url: normalizeBaseUrl(raw), error: null as string | null }
    } catch (e) {
      return { url: null as string | null, error: e instanceof Error ? e.message : 'Backend URL not configured' }
    }
  }, [])
  const BACKEND_URL = backendUrlOrError.url
  const [query, setQuery] = useState<string>('')
  const [useLatest, setUseLatest] = useState<boolean>(true)
  const [activePreset, setActivePreset] = useState<PresetId>('web')
  const [isSearching, setIsSearching] = useState<boolean>(false)
  const [results, setResults] = useState<Record<string, EngineResult>>({})
  const [isDeepDive, setIsDeepDive] = useState<boolean>(false)
  const abortRef = useRef<AbortController | null>(null)
  const hydratedFromUrlRef = useRef<boolean>(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (hydratedFromUrlRef.current) return
    hydratedFromUrlRef.current = true
    try {
      const sp = new URLSearchParams(window.location.search)
      const q = sp.get('q')
      const latest = sp.get('latest')
      const preset = sp.get('preset') as PresetId | null
      if (q != null && q.trim()) setQuery(q.trim())
      if (latest != null) setUseLatest(latest !== '0' && latest.toLowerCase() !== 'false')
      if (preset && PRESETS.some((p) => p.id === preset)) setActivePreset(preset)
    } catch {
      // ignore
    }
  }, [])

  const finalQuery = useMemo(() => {
    const q = query.trim()
    if (!q) return ''
    return useLatest ? q + RECENCY_INSTRUCTION : q
  }, [query, useLatest])

  const run = async (opts?: { forceProvider?: string; deepDive?: boolean }) => {
    if (!BACKEND_URL) return
    const q = finalQuery
    if (!q || isSearching) return

    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    setIsSearching(true)
    setResults({})
    setIsDeepDive(Boolean(opts?.deepDive))

    const preset = PRESETS.find((p) => p.id === activePreset) ?? PRESETS[0]
    let enabledProviders = preset.engineIds.length ? preset.engineIds : []
    if (opts?.forceProvider) enabledProviders = [opts.forceProvider]
    if (useLatest && enabledProviders.length && !enabledProviders.includes('groksearch')) {
      enabledProviders = [...enabledProviders, 'groksearch']
    }

    // Pre-create loading cards
    if (enabledProviders.length) {
      const init: Record<string, EngineResult> = {}
      for (const p of enabledProviders) {
        init[p] = { provider: p, providerName: p, content: '', status: 'loading' }
      }
      setResults(init)
    }

    const clientId = getClientId()

    const res = await fetch(`${BACKEND_URL}/api/search/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ac.signal,
      body: JSON.stringify({
        query:
          opts?.deepDive && useLatest
            ? `${q}\n\n[LIVE MODE: Deep Live Dive. Expand Top X posts to 6-10, include handles, timestamps, and a 3-bullet \"What it means\" summary. Never fabricate posts. If no X access, write \"No live X signals available\".]\n`
            : q,
        useLocation: false,
        enabledProviders: enabledProviders.length ? enabledProviders : undefined,
        sessionId: clientId,
        clientId,
        userId: clientId,
        searchSource: 'xdot_cleanseek',
        platform: 'web',
        promptCharacterCount: q.length,
        enabledEngineCount: enabledProviders.length || undefined,
        liveDataMode: useLatest,
        grokLive: useLatest,
      }),
    })

    if (!res.ok || !res.body) {
      setIsSearching(false)
      throw new Error(`HTTP ${res.status}`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    let evt = ''

    const append = (provider: string, delta: string) => {
      setResults((prev) => {
        const cur = prev[provider] ?? { provider, providerName: provider, content: '', status: 'loading' as const }
        return { ...prev, [provider]: { ...cur, content: (cur.content ?? '') + delta, status: 'loading' } }
      })
    }

    const done = (provider: string, content: string) => {
      setResults((prev) => {
        const cur = prev[provider] ?? { provider, providerName: provider, content: '', status: 'loading' as const }
        return { ...prev, [provider]: { ...cur, content: content || cur.content, status: 'success' } }
      })
    }

    const error = (provider: string, msg: string) => {
      setResults((prev) => {
        const cur = prev[provider] ?? { provider, providerName: provider, content: '', status: 'loading' as const }
        return { ...prev, [provider]: { ...cur, content: msg, status: 'error' } }
      })
    }

    try {
      while (true) {
        const { done: isDone, value } = await reader.read()
        if (isDone) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            evt = line.slice(7).trim()
            continue
          }
          if (!line.startsWith('data: ')) continue
          try {
            const d = JSON.parse(line.slice(6)) as any
            const provider = String(d.provider ?? d.engine ?? d.providerId ?? 'unknown')
            if (evt === 'result-chunk') {
              append(provider, String(d.delta ?? d.content ?? ''))
            } else if (evt === 'result-done') {
              done(provider, String(d.content ?? ''))
            } else if (evt === 'result-error') {
              error(provider, `Error: ${String(d.error ?? 'failed')}`)
            }
          } catch {
            // ignore malformed
          }
        }
      }
    } finally {
      setIsSearching(false)
    }
  }

  const stop = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsSearching(false)
  }

  return (
    <div className="min-h-screen bg-[#050B14] text-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {!BACKEND_URL ? (
          <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {backendUrlOrError.error ?? 'Backend URL not configured.'} Set Netlify env var{' '}
            <span className="font-mono">VITE_BACKEND_URL</span> (for browser) and redeploy.
          </div>
        ) : null}

        {/* Top bar */}
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-3 font-black text-lg">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-500/30">
              <Search className="h-4 w-4 text-cyan-300" />
            </span>
            SeekBoxAi
          </Link>

          <div className="flex-1 flex items-center gap-2 rounded-2xl border border-slate-700/60 bg-[#0A1128]/70 px-4 py-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask once… get all answers side-by-side"
              className="w-full bg-transparent outline-none text-slate-100 placeholder-slate-500"
            />
            <button className="rounded-xl border border-slate-700 bg-slate-900/30 px-3 py-1.5 text-xs font-black text-slate-200">
              <span className="inline-flex items-center gap-2">
                <Mic className="h-3.5 w-3.5" /> Voice
              </span>
            </button>
          </div>

          <Link
            to="/cleanseek-x/history"
            className="rounded-2xl border border-slate-700 bg-slate-900/30 px-4 py-3 text-sm font-black text-slate-200 hover:border-slate-500 hover:bg-slate-800/50"
          >
            History
          </Link>

          <button
            onClick={() => setUseLatest((v) => !v)}
            className={`rounded-2xl px-5 py-3 text-sm font-black border ${
              useLatest
                ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100 shadow-[0_0_25px_rgba(16,185,129,0.15)]'
                : 'border-slate-700 bg-slate-900/30 text-slate-200'
            }`}
          >
            {useLatest ? 'Grok Live' : 'Grok Live off'}
          </button>
        </div>

        {/* Quick filters (placeholders for reskin) */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="px-3 py-1.5 rounded-full border border-slate-700 bg-slate-900/30">Response length</span>
          <span className="px-3 py-1.5 rounded-full border border-slate-700 bg-slate-900/30">Tone</span>
          <span className="px-3 py-1.5 rounded-full border border-slate-700 bg-slate-900/30">Persona</span>
          {isSupabaseConfigured ? (
            <Link
              to="/signin"
              className="ml-auto px-3 py-1.5 rounded-full border border-slate-700 bg-slate-900/30 text-slate-200 font-bold"
            >
              Sign in
            </Link>
          ) : (
            <span className="ml-auto px-3 py-1.5 rounded-full border border-slate-800 bg-slate-900/20 text-slate-500 font-bold">
              Sign in (coming soon)
            </span>
          )}
        </div>

        {/* Presets + actions */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setActivePreset(p.id)}
              className={`rounded-2xl px-4 py-2 text-sm font-black border ${
                activePreset === p.id ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-100' : 'border-slate-700 bg-slate-900/30 text-slate-200'
              }`}
            >
              {p.emoji} {p.label}
            </button>
          ))}

          <div className="ml-auto flex gap-2">
            {isSearching ? (
              <button onClick={stop} className="rounded-2xl bg-slate-800 px-5 py-2 text-sm font-black">
                Stop
              </button>
            ) : (
              <button
                onClick={() => run()}
                disabled={!BACKEND_URL}
                className="rounded-2xl bg-cyan-500 text-[#050B14] px-5 py-2 text-sm font-black disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Search
              </button>
            )}
          </div>
        </div>

        {/* Engine cards */}
        <div className="mt-8 flex gap-4 overflow-x-auto pb-4">
          {Object.keys(results).length === 0 ? (
            <div className="text-slate-400 text-sm">No results yet.</div>
          ) : (
            (() => {
              const order = useLatest
                ? ['groksearch', 'tavily', 'chatgpt', 'claude', 'gemini', 'chatgptsearch', 'brave']
                : ['tavily', 'chatgpt', 'claude', 'gemini', 'chatgptsearch', 'brave', 'groksearch']

              const items = Object.values(results)
              items.sort((a, b) => order.indexOf(a.provider) - order.indexOf(b.provider))

              return items.map((r) => {
                const isGrokLive = useLatest && r.provider === 'groksearch'
                const ctx = isGrokLive ? parseLiveXContext(r.content ?? '') : null

                return (
                  <div
                    key={r.provider}
                    className={`min-w-[340px] max-w-[340px] rounded-3xl border bg-[#0A1128]/70 backdrop-blur-2xl p-5 ${
                      isGrokLive
                        ? 'border-emerald-400/40 shadow-[0_0_35px_rgba(16,185,129,0.18)]'
                        : 'border-slate-700/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-black flex items-center gap-2">
                        {isGrokLive ? 'Grok X' : (r.providerName ?? r.provider)}
                        {isGrokLive ? (
                          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-[10px] font-black tracking-widest text-emerald-100">
                            LIVE <span className="h-2 w-2 rounded-full bg-emerald-400" />
                          </span>
                        ) : null}
                      </div>
                      <div className={`text-xs ${r.status === 'error' ? 'text-red-300' : 'text-slate-400'}`}>
                        {r.status === 'loading' ? (isDeepDive && isGrokLive ? 'deep dive…' : 'loading…') : r.status}
                      </div>
                    </div>

                    <div className={`mt-3 text-sm leading-relaxed ${isGrokLive ? 'text-slate-100' : 'text-slate-200/90'}`}>
                      <pre className="whitespace-pre-wrap">{r.content || (r.status === 'loading' ? '…' : '')}</pre>
                    </div>

                    {isGrokLive && ctx ? (
                      <div className="mt-5 rounded-2xl border border-slate-700/60 bg-black/20 p-4">
                        <div className="text-xs font-black text-slate-200">Live X Context</div>
                        {ctx.hasNoSignal ? (
                          <div className="mt-2 text-xs text-slate-400">No live X signals available.</div>
                        ) : (
                          <>
                            {ctx.livePulse ? <div className="mt-2 text-xs text-slate-300"><span className="font-black">Pulse:</span> {ctx.livePulse}</div> : null}
                            {ctx.sentiment ? (
                              <div className="mt-3 flex items-center justify-between text-[11px]">
                                <span className="text-slate-400 font-bold">Sentiment</span>
                                <span className="text-slate-200 font-black">{ctx.sentiment}</span>
                              </div>
                            ) : null}
                            {ctx.trending ? (
                              <div className="mt-2 text-[11px] text-slate-300">
                                <span className="text-slate-400 font-bold">Trending:</span> {ctx.trending}
                              </div>
                            ) : null}
                            {ctx.topPosts.length ? (
                              <div className="mt-3 space-y-2">
                                {ctx.topPosts.slice(0, 3).map((p, i) => (
                                  <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/30 p-3 text-[11px] text-slate-200">
                                    {p}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </>
                        )}

                        <button
                          onClick={() => run({ forceProvider: 'groksearch', deepDive: true })}
                          disabled={isSearching}
                          className="mt-4 w-full rounded-2xl bg-emerald-400/15 border border-emerald-400/30 text-emerald-100 font-black px-4 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          Deep Live Dive
                        </button>
                      </div>
                    ) : null}
                  </div>
                )
              })
            })()
          )}
        </div>
      </div>
    </div>
  )
}


