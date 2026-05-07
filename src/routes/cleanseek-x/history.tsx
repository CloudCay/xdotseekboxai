import { useCallback, useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Link2, Play, RefreshCw, Trash2 } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { ensureAccount } from '../../lib/ensureAccount'

export const Route = createFileRoute('/cleanseek-x/history')({
  component: CleanSeekXHistoryPage,
})

type SessionRow = {
  id: string
  query: string | null
  created_at: string
  search_mode?: string | null
}

type EngineRow = {
  id: string
  engine: string | null
  result_text: string | null
  is_error: boolean | null
  created_at?: string
}

function fmtWhen(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function CleanSeekXHistoryPage() {
  const navigate = useNavigate()
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)

  const [loading, setLoading] = useState<boolean>(true)
  const [rows, setRows] = useState<SessionRow[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [engineRowsBySession, setEngineRowsBySession] = useState<Record<string, EngineRow[]>>({})
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null)

  useEffect(() => {
    const sb = isSupabaseConfigured ? supabase : null
    if (!sb) {
      setLoading(false)
      setErr('Supabase is not configured on this site yet.')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await sb.auth.getSession()
        const u = data.session?.user ?? null
        if (cancelled) return
        setUserId(u?.id ?? null)
        setEmail(u?.email ?? null)
        if (u) {
          try {
            await ensureAccount(u as any)
          } catch {
            // non-fatal
          }
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to read session.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const load = useCallback(async () => {
    const sb = isSupabaseConfigured ? supabase : null
    if (!sb) return
    if (!userId) {
      setRows([])
      return
    }
    setErr(null)
    setLoading(true)
    try {
      const { data, error } = await sb
        .from('search_sessions')
        .select('id, query, created_at, search_mode')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      setRows((data as any) ?? [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load history.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase()
    if (!f) return rows
    return rows.filter((r) => (r.query ?? '').toLowerCase().includes(f))
  }, [rows, filter])

  const emptyState = useMemo(() => {
    if (!isSupabaseConfigured) return 'History is not available until Supabase is configured.'
    if (!userId) return 'Sign in to see your history.'
    if (!loading && rows.length === 0) return 'No saved searches yet. Run a search first.'
    return null
  }, [userId, loading, rows.length])

  const onDelete = async (id: string) => {
    const sb = isSupabaseConfigured ? supabase : null
    if (!sb || !userId) return
    setDeletingId(id)
    setErr(null)
    try {
      const { error } = await sb.from('search_sessions').delete().eq('id', id).eq('user_id', userId)
      if (error) throw error
      setRows((prev) => prev.filter((r) => r.id !== id))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed.')
    } finally {
      setDeletingId(null)
    }
  }

  const loadEngineRows = useCallback(
    async (sessionId: string) => {
      const sb = isSupabaseConfigured ? supabase : null
      if (!sb || !userId) return
      if (engineRowsBySession[sessionId]) return
      setLoadingSessionId(sessionId)
      try {
        const { data, error } = await sb
          .from('engine_results')
          .select('id, engine, result_text, is_error, created_at')
          .eq('search_session_id', sessionId)
          .order('created_at', { ascending: true })
          .limit(50)
        if (error) throw error
        setEngineRowsBySession((prev) => ({ ...prev, [sessionId]: ((data as any) ?? []) as EngineRow[] }))
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load results.')
      } finally {
        setLoadingSessionId(null)
      }
    },
    [engineRowsBySession, userId],
  )

  return (
    <div className="min-h-screen bg-[#050B14] text-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3">
          <button
            data-testid="history-back-button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/cleanseek-x'
                return
              }
              navigate({ to: '/cleanseek-x' })
            }}
            className="inline-flex items-center justify-center h-10 w-10 rounded-2xl border border-slate-700 bg-slate-900/30 hover:bg-slate-800/50"
          >
            <ArrowLeft className="h-4 w-4 text-slate-200" />
          </button>

          <div className="flex-1 min-w-0">
            <div data-testid="history-title" className="text-2xl font-black tracking-tight">
              CleanSeek X · History
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {email ? email : userId ? `User ${userId.slice(0, 8)}…` : '—'} · last 100 sessions
            </div>
          </div>

          <button
            data-testid="history-refresh-button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/30 px-4 py-2 text-sm font-black text-slate-200 hover:bg-slate-800/50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {!isSupabaseConfigured ? (
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            Supabase is not configured on this site yet.
          </div>
        ) : null}

        {!userId && isSupabaseConfigured ? (
          <div className="mt-6 rounded-2xl border border-slate-700/60 bg-[#0A1128]/70 px-4 py-3 text-sm text-slate-200">
            You’re not signed in.{' '}
            <Link to="/signin" className="underline underline-offset-4 text-cyan-300">
              Sign in
            </Link>{' '}
            to see your saved searches.
          </div>
        ) : null}

        <div className="mt-6 rounded-3xl border border-slate-700/60 bg-[#0A1128]/70 backdrop-blur-2xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <input
              data-testid="history-filter-input"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter searches…"
              className="w-full rounded-2xl border border-slate-700 bg-slate-900/30 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500/50"
            />
            <a
              href="/cleanseek-x"
              className="inline-flex items-center justify-center rounded-2xl bg-cyan-500 text-[#050B14] px-5 py-3 text-sm font-black"
            >
              New search
            </a>
          </div>

          {err ? (
            <div data-testid="history-error" className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {err}
            </div>
          ) : null}

          {loading ? (
            <div data-testid="history-loading-indicator" className="mt-6 text-sm text-slate-400">
              Loading…
            </div>
          ) : emptyState ? (
            <div data-testid="history-empty" className="mt-6 text-sm text-slate-400">
              {emptyState}
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {filtered.map((r) => {
                const q = (r.query ?? '').trim()
                const to = q ? `/cleanseek-x?q=${encodeURIComponent(q)}&latest=1` : '/cleanseek-x?latest=1'
                const runTo = q
                  ? `/cleanseek-x?q=${encodeURIComponent(q)}&latest=1&autorun=1`
                  : '/cleanseek-x?latest=1'

                return (
                  <div
                    key={r.id}
                    data-testid={`history-row-${r.id}`}
                    className="rounded-3xl border border-slate-700/60 bg-black/20 p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-base font-black text-slate-100 break-words">
                          {q || '—'}
                        </div>
                        <div className="mt-2 text-xs text-slate-400">
                          {fmtWhen(r.created_at)}{r.search_mode ? ` · ${r.search_mode}` : ''}
                        </div>
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">{r.id.slice(0, 8)}…</div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <a
                        data-testid={`history-open-${r.id}`}
                        href={to}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/30 px-4 py-2 text-sm font-black text-slate-200 hover:bg-slate-800/50"
                      >
                        <Play className="h-4 w-4" />
                        Open
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          const next = expandedId === r.id ? null : r.id
                          setExpandedId(next)
                          if (next) void loadEngineRows(r.id)
                        }}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/30 px-4 py-2 text-sm font-black text-slate-200 hover:bg-slate-800/50"
                      >
                        View results
                      </button>

                      <a
                        data-testid={`history-run-${r.id}`}
                        href={runTo}
                        className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 text-[#050B14] px-4 py-2 text-sm font-black hover:opacity-95"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Run again
                      </a>

                      <button
                        data-testid={`history-share-${r.id}`}
                        onClick={async () => {
                          try {
                            if (typeof window === 'undefined') return
                            await window.navigator.clipboard.writeText(window.location.origin + to)
                          } catch {
                            // ignore
                          }
                        }}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/30 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-slate-800/50"
                      >
                        <Link2 className="h-4 w-4" />
                        Copy link
                      </button>

                      <button
                        data-testid={`history-delete-${r.id}`}
                        disabled={deletingId === r.id}
                        onClick={() => void onDelete(r.id)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-black text-red-200 hover:bg-red-500/15 disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                        {deletingId === r.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>

                    {expandedId === r.id ? (
                      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
                        {loadingSessionId === r.id ? (
                          <div className="text-sm text-slate-400">Loading results…</div>
                        ) : (engineRowsBySession[r.id]?.length ?? 0) === 0 ? (
                          <div className="text-sm text-slate-400">No saved results for this session yet.</div>
                        ) : (
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {engineRowsBySession[r.id]!.map((er) => (
                              <div
                                key={er.id}
                                className={`rounded-2xl border p-4 ${
                                  er.is_error
                                    ? 'border-red-500/30 bg-red-500/[0.06]'
                                    : 'border-slate-700/60 bg-black/20'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-xs font-black text-slate-200">{er.engine ?? 'engine'}</div>
                                  <div className={`text-[11px] font-bold ${er.is_error ? 'text-red-200' : 'text-slate-500'}`}>
                                    {er.is_error ? 'error' : 'ok'}
                                  </div>
                                </div>
                                <pre className="mt-3 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-200/90 max-h-[220px] overflow-auto">
{(er.result_text ?? '').trim() || '—'}
                                </pre>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

