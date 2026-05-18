import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ArrowUpRight, MapPin, Play, ShieldCheck } from 'lucide-react'
import { XSiteHeader } from '../components/XSiteHeader'
import { cleanseekHref } from '../lib/cleanseekUrl'
import { ensureAccount } from '../lib/ensureAccount'
import {
  getAccountProfileSummary,
  getLocalAccountProfileSummary,
  type AccountProfileSummary,
} from '../lib/accountProfileSummary'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import {
  SEED_COLLECTIONS,
  seedDiscoveryQuery,
  seedUserSearchQuery,
  type SeedCollection,
} from '../lib/seedCollections'

export const Route = createFileRoute('/seed-lab')({
  head: () => ({
    meta: [{ title: 'Seed Lab - X.SeekBoxAI' }],
  }),
  component: SeedLabRoute,
})

type GateState =
  | { status: 'loading'; email: null; summary: null; reason: null }
  | { status: 'signed-out'; email: null; summary: null; reason: string }
  | { status: 'denied'; email: string | null; summary: AccountProfileSummary | null; reason: string }
  | { status: 'allowed'; email: string | null; summary: AccountProfileSummary; reason: string }

type ProbeState =
  | { status: 'idle'; payload: null; error: null }
  | { status: 'loading'; payload: null; error: null }
  | { status: 'done'; payload: unknown; error: null }
  | { status: 'error'; payload: unknown | null; error: string }

const SUPERADMIN_ROLE = 'superadmin'

function SeedLabRoute() {
  const [gate, setGate] = useState<GateState>({ status: 'loading', email: null, summary: null, reason: null })
  const [selectedId, setSelectedId] = useState(SEED_COLLECTIONS[0]?.id ?? '')
  const [probe, setProbe] = useState<ProbeState>({ status: 'idle', payload: null, error: null })
  const selectedSeed = useMemo(
    () => SEED_COLLECTIONS.find((seed) => seed.id === selectedId) ?? SEED_COLLECTIONS[0],
    [selectedId],
  )
  const signInHref = useMemo(() => `/signin?returnTo=${encodeURIComponent('/seed-lab')}`, [])

  useEffect(() => {
    let cancelled = false
    if (isLocalDevBypass()) {
      setGate({
        status: 'allowed',
        email: null,
        summary: getLocalAccountProfileSummary({ activeRole: SUPERADMIN_ROLE }),
        reason: 'Allowed by local development bypass.',
      })
      return
    }

    const sb = isSupabaseConfigured ? supabase : null
    if (!sb) {
      setGate({ status: 'denied', email: null, summary: null, reason: 'Supabase auth is required for Seed Lab.' })
      return
    }

    ;(async () => {
      try {
        const { data } = await sb.auth.getSession()
        const user = data.session?.user ?? null
        if (!user?.id) {
          if (!cancelled) setGate({ status: 'signed-out', email: null, summary: null, reason: 'Sign in as superadmin to open Seed Lab.' })
          return
        }
        try {
          await ensureAccount(user as any)
        } catch {
          // Non-fatal.
        }
        const summary = await getAccountProfileSummary({ supabase: sb, user: user as any })
        const email = (user.email ?? summary.email ?? '').trim().toLowerCase() || null
        if (cancelled) return
        if (summary.roleId.trim().toLowerCase() === SUPERADMIN_ROLE) {
          setGate({ status: 'allowed', email, summary, reason: `Allowed by role: ${summary.roleId}.` })
        } else {
          setGate({ status: 'denied', email, summary, reason: 'Seed Lab is restricted to superadmin accounts.' })
        }
      } catch (error) {
        if (!cancelled) {
          setGate({
            status: 'denied',
            email: null,
            summary: null,
            reason: error instanceof Error ? error.message : 'Could not verify Seed Lab access.',
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const runProbe = async () => {
    if (!selectedSeed) return
    setProbe({ status: 'loading', payload: null, error: null })
    const body = buildDiscoverBody(selectedSeed)
    const token = await getSupabaseAccessToken()
    try {
      const response = await fetch('/api/x-discover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      })
      const payload = (await response.json()) as unknown
      if (!response.ok) {
        setProbe({ status: 'error', payload, error: `HTTP ${response.status}` })
        return
      }
      setProbe({ status: 'done', payload, error: null })
    } catch (error) {
      setProbe({ status: 'error', payload: null, error: error instanceof Error ? error.message : 'Probe failed.' })
    }
  }

  if (gate.status !== 'allowed') {
    return (
      <SeedLabShell>
        <div className="border border-neutral-300 bg-white p-6 shadow-[6px_6px_0_rgba(0,0,0,0.08)]">
          <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-neutral-500">
            <ShieldCheck className="h-4 w-4" />
            superadmin gate
          </div>
          <h1 className="mt-3 text-3xl font-black tracking-tight">Seed Lab</h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-neutral-600">
            {gate.reason ?? 'Checking access...'}
          </p>
          {gate.email ? (
            <div className="mt-3 text-xs font-bold text-neutral-500">
              Signed in as <span className="font-mono">{gate.email}</span>
              {gate.summary ? ` · role ${gate.summary.roleId}` : ''}
            </div>
          ) : null}
          {gate.status === 'signed-out' ? (
            <a href={signInHref} className="mt-5 inline-flex border border-neutral-950 bg-neutral-950 px-5 py-3 text-sm font-black text-white">
              Sign in
            </a>
          ) : null}
        </div>
      </SeedLabShell>
    )
  }

  return (
    <SeedLabShell>
      <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="border border-neutral-300 bg-white p-4 shadow-[4px_4px_0_rgba(0,0,0,0.05)]">
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-neutral-500">Seed collections</div>
          <div className="mt-4 grid gap-2">
            {SEED_COLLECTIONS.map((seed) => (
              <button
                key={seed.id}
                type="button"
                onClick={() => {
                  setSelectedId(seed.id)
                  setProbe({ status: 'idle', payload: null, error: null })
                }}
                className={`border px-3 py-3 text-left ${
                  seed.id === selectedId
                    ? 'border-neutral-950 bg-neutral-950 text-white'
                    : 'border-neutral-300 bg-[#fbfbf7] text-neutral-900 hover:border-neutral-950'
                }`}
              >
                <span className="block text-sm font-black">{seed.label}</span>
                <span className="mt-1 block text-[11px] font-bold uppercase tracking-[0.14em] opacity-70">
                  {seed.kind} · {seed.visibility}
                </span>
              </button>
            ))}
          </div>
        </aside>

        {selectedSeed ? (
          <SeedWorkbench seed={selectedSeed} probe={probe} onProbe={() => void runProbe()} />
        ) : null}
      </section>
    </SeedLabShell>
  )
}

function SeedWorkbench({ seed, probe, onProbe }: { seed: SeedCollection; probe: ProbeState; onProbe: () => void }) {
  const userHref = cleanseekHref({ query: seedUserSearchQuery(seed), latest: true, preset: 'web', path: '/cleanseek-x' })
  const xrawHref = cleanseekHref({ query: seedDiscoveryQuery(seed), latest: false, preset: 'allin', path: '/xraw' })
  const discoverBody = buildDiscoverBody(seed)

  return (
    <div className="min-w-0 space-y-4">
      <section className="border border-neutral-300 bg-white p-5 shadow-[4px_4px_0_rgba(0,0,0,0.05)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-neutral-500">{seed.kind}</div>
            <h1 className="mt-1 text-3xl font-black tracking-tight">{seed.label}</h1>
          </div>
          <span className="border border-neutral-300 bg-[#fbfbf7] px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-neutral-600">
            {seed.outputDefaults.view}
          </span>
        </div>
        <p className="mt-3 text-sm font-semibold leading-6 text-neutral-600">{seed.summary}</p>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <LabBlock title="Queries" items={seed.queries} />
          <LabBlock title="Handles" items={seed.handles.length ? seed.handles.map((handle) => `@${handle.replace(/^@/, '')}`) : ['No seed handles yet']} />
        </div>

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

        <div className="mt-5 flex flex-wrap gap-2">
          <a href={userHref} className="inline-flex items-center gap-2 border border-neutral-950 bg-neutral-950 px-4 py-3 text-sm font-black text-white hover:bg-neutral-800">
            User search <ArrowUpRight className="h-4 w-4" />
          </a>
          <a href={xrawHref} className="inline-flex items-center gap-2 border border-neutral-300 bg-[#fbfbf7] px-4 py-3 text-sm font-black text-neutral-900 hover:border-neutral-950">
            Open in xraw <ArrowUpRight className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={onProbe}
            disabled={probe.status === 'loading'}
            className="inline-flex items-center gap-2 border border-cyan-800 bg-cyan-50 px-4 py-3 text-sm font-black text-cyan-950 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Play className="h-4 w-4" />
            {probe.status === 'loading' ? 'Probing...' : 'Probe discovery'}
          </button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="border border-neutral-300 bg-white p-4 shadow-[4px_4px_0_rgba(0,0,0,0.05)]">
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-neutral-500">Discovery payload</div>
          <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap border border-neutral-200 bg-[#fbfbf7] p-3 text-[11px] leading-5 text-neutral-800">
            {JSON.stringify(discoverBody, null, 2)}
          </pre>
        </div>
        <div className="border border-neutral-300 bg-white p-4 shadow-[4px_4px_0_rgba(0,0,0,0.05)]">
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-neutral-500">Probe result</div>
          <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap border border-neutral-200 bg-[#fbfbf7] p-3 text-[11px] leading-5 text-neutral-800">
            {probe.status === 'idle'
              ? 'No probe run yet.'
              : probe.status === 'loading'
                ? 'Running...'
                : JSON.stringify(probe.payload ?? { error: probe.error }, null, 2)}
          </pre>
        </div>
      </section>
    </div>
  )
}

function LabBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="border border-neutral-200 bg-[#fbfbf7] p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">{title}</div>
      <div className="mt-2 grid gap-1.5">
        {items.map((item) => (
          <div key={item} className="text-xs font-semibold leading-5 text-neutral-700">
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}

function SeedLabShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f7f8f4] text-neutral-950">
      <XSiteHeader active="seeds" title="X.SeekBoxAI Seed Lab" eyebrow="superadmin seed workbench" />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
    </main>
  )
}

function buildDiscoverBody(seed: SeedCollection): Record<string, unknown> {
  const location = seed.locations[0]
  return {
    query: seedDiscoveryQuery(seed),
    window_days: 7,
    max_results: seed.outputDefaults.depth === 'deep' ? 100 : 30,
    rank_authors: true,
    ...(location
      ? {
          geo: {
            type: 'point_radius',
            label: location.label,
            latitude: location.latitude,
            longitude: location.longitude,
            radius: location.radius,
          },
        }
      : {}),
  }
}

async function getSupabaseAccessToken(): Promise<string | null> {
  const sb = isSupabaseConfigured ? supabase : null
  if (!sb) return null
  try {
    const { data } = await sb.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

function isLocalDevBypass(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false
  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
}
