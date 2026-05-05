import React, { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { upsertAccount } from '../server/accounts.functions'

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
  role_id?: string | number | null
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
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
    if (!isSupabaseConfigured || !supabase) {
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
        const { data } = await supabase.auth.getSession()
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
        const subRes = await supabase
          .from('user_subscriptions')
          .select('plan,status,created_at')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (subRes.error) throw subRes.error
        if (!cancelled) setSubscription((subRes.data as any) ?? null)

        // Pull account role info (owner_user_id pattern like SeekBox)
        try {
          const acctRes = await supabase
            .from('accounts')
            .select('id,role_id,stripe_customer_id,stripe_subscription_id')
            .eq('owner_user_id', uid)
            .maybeSingle()

          if (acctRes.error) throw acctRes.error
          if (!cancelled) setAccount((acctRes.data as any) ?? null)
        } catch (e) {
          // Non-fatal: subscription can still be shown even if accounts table
          // is missing or blocked by RLS.
          if (!cancelled) {
            setAccount(null)
            setAccountLoadError(e instanceof Error ? e.message : 'accounts lookup failed')
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
    if (!email) return
    setIsSyncingAccount(true)
    try {
      await upsertAccount({
        google_id: 'supabase',
        email,
        name: 'SeekBox User',
      })
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
            <div className="mt-2 text-lg font-black">{account?.role_id ?? '—'}</div>
            <div className="mt-1 text-xs text-slate-400">
              Stripe customer: {account?.stripe_customer_id ? `${String(account.stripe_customer_id).slice(0, 10)}…` : '—'}
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
            disabled={!email || isSyncingAccount}
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

