import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ShieldCheck } from 'lucide-react'
import { XSiteHeader } from '../components/XSiteHeader'
import { ensureAccount } from '../lib/ensureAccount'
import {
  getAccountProfileSummary,
  getLocalAccountProfileSummary,
  type AccountProfileSummary,
} from '../lib/accountProfileSummary'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { CleanSeekLite } from './cleanseek-x'

export const Route = createFileRoute('/xraw')({
  head: () => ({
    meta: [{ title: 'Raw X Playground — X.SeekBoxAI' }],
  }),
  component: RawXPlaygroundRoute,
})

type GateState =
  | { status: 'loading'; email: null; summary: null; reason: null }
  | { status: 'no-supabase'; email: null; summary: null; reason: string }
  | { status: 'signed-out'; email: null; summary: null; reason: string }
  | { status: 'denied'; email: string | null; summary: AccountProfileSummary | null; reason: string }
  | { status: 'allowed'; email: string | null; summary: AccountProfileSummary; reason: string }

const RAW_PLAYGROUND_ROLE = 'superadmin'

function isLocalDevRawBypass(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false
  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
}

function RawXPlaygroundRoute() {
  const [gate, setGate] = useState<GateState>({ status: 'loading', email: null, summary: null, reason: null })

  const signInHref = useMemo(() => `/signin?returnTo=${encodeURIComponent('/xraw')}`, [])

  useEffect(() => {
    let cancelled = false
    if (isLocalDevRawBypass()) {
      setGate({
        status: 'allowed',
        email: null,
        summary: getLocalAccountProfileSummary({ activeRole: RAW_PLAYGROUND_ROLE }),
        reason: 'Allowed by local development bypass.',
      })
      return
    }

    const sb = isSupabaseConfigured ? supabase : null
    if (!sb) {
      setGate({
        status: 'no-supabase',
        email: null,
        summary: null,
        reason: 'Supabase auth is not configured on this deployment.',
      })
      return
    }

    ;(async () => {
      try {
        const { data } = await sb.auth.getSession()
        const user = data.session?.user ?? null
        if (!user?.id) {
          if (!cancelled) {
            setGate({ status: 'signed-out', email: null, summary: null, reason: 'Sign in to open the raw playground.' })
          }
          return
        }

        try {
          await ensureAccount(user as any)
        } catch {
          // Non-fatal. The gate can still evaluate the session and local fallback summary.
        }

        const summary = await getAccountProfileSummary({ supabase: sb, user: user as any })
        const email = (user.email ?? summary.email ?? '').trim().toLowerCase() || null
        const decision = rawPlaygroundAccessDecision({ roleId: summary.roleId })
        if (cancelled) return

        if (decision.allowed) {
          setGate({ status: 'allowed', email, summary, reason: decision.reason })
        } else {
          setGate({ status: 'denied', email, summary, reason: decision.reason })
        }
      } catch (e) {
        if (cancelled) return
        setGate({
          status: 'denied',
          email: null,
          summary: null,
          reason: e instanceof Error ? e.message : 'Could not verify raw playground access.',
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  if (gate.status !== 'allowed') {
    return (
      <RawGateShell>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-widest text-slate-600">
            <ShieldCheck className="h-3.5 w-3.5" />
            Internal gate
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">Raw X Playground</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            This page is intentionally not a public product surface. It is for checking what the current X/search providers appear
            able to return before we decide what belongs in XMarks, Pulse, or paid tools.
          </p>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
            {gate.reason ?? 'Checking access...'}
            {gate.email ? (
              <div className="mt-2 text-xs font-bold text-slate-500">
                Signed in as <span className="font-mono">{gate.email}</span>
                {gate.summary ? ` · role ${gate.summary.roleId}` : ''}
              </div>
            ) : null}
          </div>

          {gate.status === 'signed-out' ? (
            <a
              href={signInHref}
              className="mt-5 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-slate-800"
            >
              Sign in
            </a>
          ) : null}
        </div>
      </RawGateShell>
    )
  }

  return (
    <CleanSeekLite
      variant="desktop"
      layout="xmarks"
      rawPlayground
      defaultUseLatest={false}
      defaultPreset="allin"
      defaultEnginePickMode="custom"
      defaultEnabledEngineIds={['grokx']}
      storageKeys={{
        enabledEnginesKey: 'seekbox_xraw_enabled_engines_v1',
        enginePickModeKey: 'seekbox_xraw_engine_pick_mode_v1',
        promptModsKey: 'seekbox_xraw_prompt_modifiers_v1',
      }}
    />
  )
}

function RawGateShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f7f8f4] text-neutral-950">
      <XSiteHeader active="xmarks" title="Raw X Playground" eyebrow="internal access gate" />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </div>
    </main>
  )
}

function rawPlaygroundAccessDecision(args: { roleId: string }): { allowed: boolean; reason: string } {
  const roleId = args.roleId.trim().toLowerCase()
  if (roleId === RAW_PLAYGROUND_ROLE) return { allowed: true, reason: `Allowed by role: ${roleId}.` }

  return {
    allowed: false,
    reason: 'The raw playground is restricted to superadmin accounts.',
  }
}
