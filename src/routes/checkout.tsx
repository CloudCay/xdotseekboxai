import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { ensureAccount } from '../lib/ensureAccount'
import { createCheckoutSession } from '../server/stripe.functions'

// Stripe TEST MODE — SeekBoxAi Power with Grok X Live (monthly)
// NOTE: Test-mode price IDs have changed more than once. This site defaults
// to the legacy test price so checkout works with sk_test keys; override with
// VITE_STRIPE_PRICESET=test_current when the backend/test catalog is updated.
const GROKX_PRICE_BY_SET: Record<'test_legacy' | 'test_current', string> = {
  test_legacy: 'price_1TTf7OAghz6CNDMAjyhVsGkZ',
  test_current: 'price_1TTWUTAghz6CNDMATSskXYmY',
}
const STRIPE_PRICE_GROK_X_MONTHLY =
  GROKX_PRICE_BY_SET[((import.meta as any).env?.VITE_STRIPE_PRICESET as 'test_legacy' | 'test_current') ?? 'test_legacy'] ??
  GROKX_PRICE_BY_SET.test_legacy

export const Route = createFileRoute('/checkout')({
  component: CheckoutPage,
})

function CheckoutPage() {
  const [status, setStatus] = useState<'loading' | 'starting' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  const origin = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return window.location.origin
  }, [])

  useEffect(() => {
    const sb = isSupabaseConfigured ? supabase : null
    if (!sb) {
      setStatus('error')
      setError('Sign-in isn’t enabled on this site yet.')
      return
    }
    let cancelled = false
    ;(async () => {
      setStatus('loading')
      setError(null)

      const { data } = await sb.auth.getSession()
      const session = data.session
      const user = session?.user ?? null
      const email = user?.email ?? null
      const userId = user?.id ?? null

      if (!userId || !email) {
        if (!cancelled) {
          setStatus('error')
          setError('Please sign in first.')
        }
        return
      }

      try {
        setStatus('starting')
        // Ensure an `accounts` row exists BEFORE Stripe (via Supabase RPC).
        await ensureAccount(user as any)
        const { url } = await createCheckoutSession({
          data: {
            userId,
            email,
            priceId: STRIPE_PRICE_GROK_X_MONTHLY,
            // Include the Stripe substitution token so the backend can pass it
            // through to Stripe and we can confirm status on return.
            successUrl: `${origin}/account?upgraded=1&session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${origin}/cleanseek-x`,
          },
        } as any)
        if (cancelled) return
        if (typeof window !== 'undefined') window.location.href = url
      } catch (e) {
        if (!cancelled) {
          setStatus('error')
          setError(e instanceof Error ? e.message : 'Checkout failed.')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [origin])

  return (
    <div className="min-h-screen bg-[#050B14] text-slate-50 flex items-center justify-center px-6">
      <div className="max-w-lg w-full rounded-3xl border border-slate-700/60 bg-[#0A1128]/70 backdrop-blur-2xl p-8">
        <div className="text-2xl font-black tracking-tight">Checkout</div>
        {status === 'loading' || status === 'starting' ? (
          <div className="mt-4 text-slate-300">
            {status === 'loading' ? 'Loading…' : 'Starting Stripe checkout…'}
          </div>
        ) : (
          <>
            <div className="mt-4 text-red-300">{error ?? 'Something went wrong.'}</div>
            <div className="mt-6 flex gap-3">
              <a
                href="/signin?returnTo=/checkout"
                className="inline-flex items-center justify-center rounded-2xl bg-cyan-500 text-[#050B14] font-black px-5 py-3"
              >
                Sign in
              </a>
              <Link
                to="/"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/40 text-white font-bold px-5 py-3"
              >
                Back
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

