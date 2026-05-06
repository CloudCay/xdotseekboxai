import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { ensureAccount } from '../lib/ensureAccount'

export const Route = createFileRoute('/account')({
  component: AccountPage,
})

type SubscriptionRow = {
  plan?: string | null
  status?: string | null
  created_at?: string | null
}

type AccountRow = {
  id?: string | null
  role?: string | null
  granted_role?: string | null
  trial_ends_at?: string | null
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
}

function stringifyErr(e: unknown): string {
  if (e && typeof e === 'object') {
    const anyE = e as any
    const parts: string[] = []
    if (typeof anyE.message === 'string' && anyE.message.trim()) parts.push(anyE.message.trim())
    if (typeof anyE.details === 'string' && anyE.details.trim()) parts.push(anyE.details.trim())
    if (typeof anyE.hint === 'string' && anyE.hint.trim()) parts.push(anyE.hint.trim())
    if (typeof anyE.code === 'string' && anyE.code.trim()) parts.push(`code=${anyE.code.trim()}`)
    if (parts.length) return parts.join(' · ')
    try {
      return JSON.stringify(e)
    } catch {
      return String(e)
    }
  }
  return e instanceof Error ? e.message : String(e)
}

function AccountPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'confirming' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [accountLoadError, setAccountLoadError] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null)
  const [account, setAccount] = useState<AccountRow | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)
  const [isSyncingAccount, setIsSyncingAccount] = useState(false)

  const fromStripe = useMemo(() => {
    if (typeof window === 'undefined') return false
    const sp = new URLSearchParams(window.location.search)
    return sp.has('session_id') || sp.get('upgraded') === '1'
  }, [])

  useEffect(() => {
    const sb = isSupabaseConfigured ? supabase : null
    if (!sb) {
      setStatus('error')
      setError('Supabase is not configured on this site yet.')
      return
    }

    let cancelled = false
    const loadOnce = async () => {
      setStatus(fromStripe ? 'confirming' : 'loading')
      setError(null)
      setAccountLoadError(null)
      try {
        const { data } = await sb.auth.getSession()
        const session = data.session
        const u = session?.user ?? null
        const uid = u?.id ?? null
        const em = u?.email ?? null

        if (!uid) {
          if (!cancelled) {
            setStatus('error')
            setError('Not signed in.')
          }
          return
        }

        if (!cancelled) {
          setUserId(uid)
          setEmail(em)
        }

        // Pull latest subscription row (active/trialing preferred)
        const subRes = await sb
          .from('user_subscriptions')
          .select('plan,status,created_at')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (subRes.error) throw subRes.error
        if (!cancelled) setSubscription((subRes.data as any) ?? null)

        // Pull account role info.
        // DB schemas vary: some use `owner_user_id`, others use `user_id`, or even `id = auth.uid()`.
        try {
          const selectCandidates = [
            // "full" set (some DBs)
            'id,role,granted_role,trial_ends_at,stripe_customer_id,stripe_subscription_id',
            // no stripe_subscription_id
            'id,role,granted_role,trial_ends_at,stripe_customer_id',
            // minimal role/trial
            'id,role,granted_role,trial_ends_at',
            // absolute minimal
            'id,role,granted_role',
            'id,role',
            'id',
          ] as const

          const tryBy = async (col: 'owner_user_id' | 'user_id' | 'id') => {
            let lastErr: unknown = null
            for (const cols of selectCandidates) {
              const res = await sb.from('accounts').select(cols).eq(col, uid).maybeSingle()
              if (!res.error) return res
              lastErr = res.error
              const msg = stringifyErr(res.error)
              // If a selected column doesn't exist, try a reduced column set.
              if (/does not exist/i.test(msg) || /column/i.test(msg) || /42703/.test(msg) || /PGRST/i.test(msg)) {
                continue
              }
              // Otherwise, stop (likely RLS / permission / table missing).
              return res
            }
            return { data: null, error: lastErr } as any
          }

          const first = await tryBy('owner_user_id')
          if (!first.error) {
            if (!cancelled) setAccount((first.data as any) ?? null)
          } else {
            const msg = stringifyErr(first.error)
            // If the column doesn't exist (or schema differs), try fallbacks.
            const shouldFallback =
              /owner_user_id/i.test(msg) ||
              /column/i.test(msg) ||
              /does not exist/i.test(msg) ||
              /schema/i.test(msg) ||
              /PGRST/i.test(msg)

            if (!shouldFallback) throw first.error

            const second = await tryBy('user_id')
            if (!second.error) {
              if (!cancelled) setAccount((second.data as any) ?? null)
            } else {
              const third = await tryBy('id')
              if (third.error) throw third.error
              if (!cancelled) setAccount((third.data as any) ?? null)
            }
          }
        } catch (e) {
          // Non-fatal: subscription can still be shown even if accounts table
          // is missing or blocked by RLS.
          if (!cancelled) {
            setAccount(null)
            setAccountLoadError(stringifyErr(e))
          }
        }

        if (!cancelled) setStatus('idle')
      } catch (e) {
        if (!cancelled) {
          setStatus('error')
          setError(e instanceof Error ? e.message : 'Failed to load account.')
        }
      }
    }

    loadOnce()

    // Post-Stripe: poll for up to ~30s so webhook has time to land.
    if (fromStripe) {
      let attempts = 0
      const iv = setInterval(() => {
        attempts += 1
        setRefreshTick((t) => t + 1)
        if (attempts >= 10) clearInterval(iv)
      }, 3000)

      // Strip params so refresh doesn't loop forever.
      try {
        window.history.replaceState({}, '', window.location.pathname)
      } catch {
        /* ignore */
      }

      return () => {
        cancelled = true
        clearInterval(iv)
      }
    }

    return () => {
      cancelled = true
    }
  }, [fromStripe, refreshTick])

  const isPaid =
    (subscription?.status === 'active' || subscription?.status === 'trialing') && Boolean(subscription?.plan)

  const syncAccountRow = async () => {
    const sb = isSupabaseConfigured ? supabase : null
    if (!email || !userId || !sb) return
    setIsSyncingAccount(true)
    try {
      const { data } = await sb.auth.getSession()
      const u = data.session?.user ?? null
      if (!u) throw new Error('Not signed in.')
      await ensureAccount(u as any)
      setRefreshTick((t) => t + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to sync account row.')
      setStatus('error')
    } finally {
      setIsSyncingAccount(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#050B14] text-slate-50 flex items-center justify-center px-6">
      <div className="max-w-2xl w-full rounded-3xl border border-slate-700/60 bg-[#0A1128]/70 backdrop-blur-2xl p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-2xl font-black tracking-tight">Account</div>
            <div className="mt-1 text-slate-400 text-sm">
              {email ? email : '—'} {userId ? <span className="font-mono opacity-70">({userId.slice(0, 8)}…)</span> : null}
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/cleanseek-x" className="rounded-xl border border-slate-700 bg-slate-900/30 px-4 py-2 text-sm font-bold">
              CleanSeek-X
            </Link>
          <Link to="/cleanseek-x/history" className="rounded-xl border border-slate-700 bg-slate-900/30 px-4 py-2 text-sm font-bold">
            History
          </Link>
            <Link to="/" className="rounded-xl border border-slate-700 bg-slate-900/30 px-4 py-2 text-sm font-bold">
              Home
            </Link>
          </div>
        </div>

        {status === 'confirming' ? (
          <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            Confirming your subscription… (waiting for Stripe webhook)
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error ?? 'Something went wrong.'}
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-700/60 bg-black/20 p-4">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Subscription</div>
            <div className="mt-2 text-lg font-black">{subscription?.plan ?? '—'}</div>
            <div className="mt-1 text-sm text-slate-300">Status: {subscription?.status ?? '—'}</div>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-black/20 p-4">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Role</div>
            <div className="mt-2 text-lg font-black">{account?.granted_role ?? account?.role ?? '—'}</div>
            <div className="mt-1 text-xs text-slate-400">
              Stripe customer: {account?.stripe_customer_id ? `${String(account.stripe_customer_id).slice(0, 10)}…` : '—'}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Trial ends: {account?.trial_ends_at ? new Date(account.trial_ends_at).toLocaleDateString() : '—'}
            </div>
            {accountLoadError ? (
              <div className="mt-3 text-[11px] text-slate-400">
                Couldn’t load <span className="font-mono">accounts</span>: {accountLoadError}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Link
            to="/checkout"
            className="inline-flex items-center justify-center rounded-2xl bg-cyan-500 text-[#050B14] font-black px-6 py-4"
          >
            {isPaid ? 'Manage / Upgrade' : 'Start checkout'}
          </Link>
          <button
            onClick={() => setRefreshTick((t) => t + 1)}
            className="inline-flex items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/30 text-white font-bold px-6 py-4"
          >
            Refresh
          </button>
          <button
            onClick={syncAccountRow}
            disabled={!email || !userId || isSyncingAccount}
            className="inline-flex items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/30 text-white font-bold px-6 py-4 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSyncingAccount ? 'Syncing…' : 'Create/Sync account row'}
          </button>
        </div>

        <div className="mt-4 text-xs text-slate-500">
          If you just completed checkout, this page will usually update within a few seconds once the Stripe webhook writes to{' '}
          <span className="font-mono">user_subscriptions</span> and updates <span className="font-mono">accounts.role_id</span>.
        </div>
      </div>
    </div>
  )
}

