import React, { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { upsertAccount } from '../server/accounts.functions'
import { createCheckoutSession } from '../server/stripe.functions'

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
    if (!isSupabaseConfigured || !supabase) {
      setStatus('error')
      setError('Sign-in isn’t enabled on this site yet.')
      return
    }
    let cancelled = false
    ;(async () => {
      setStatus('loading')
      setError(null)

      const { data } = await supabase.auth.getSession()
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
        // Ensure an `accounts` row exists so the Stripe webhook can update role_id.
        // (Some flows only create a Supabase Auth user; they don't create `accounts`.)
        try {
          await upsertAccount({
            data: {
              google_id: 'supabase',
              email,
              name: (user?.user_metadata?.full_name as string | undefined) ?? 'SeekBox User',
            },
          })
        } catch {
          // Non-fatal: checkout can still proceed; webhook may or may not create it.
        }
        const { url } = await createCheckoutSession({
          data: {
            userId,
            email,
            priceId: 'price_1TTf7OAghz6CNDMAjyhVsGkZ',
            // Include the Stripe substitution token so the backend can pass it
            // through to Stripe and we can confirm status on return.
            successUrl: `${origin}/account?upgraded=1&session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${origin}/cleanseek-x`,
          },
        })
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
              <Link
                to="/signin"
                className="inline-flex items-center justify-center rounded-2xl bg-cyan-500 text-[#050B14] font-black px-5 py-3"
              >
                Sign in
              </Link>
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

