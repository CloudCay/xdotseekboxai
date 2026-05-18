import { createFileRoute, Link } from '@tanstack/react-router'
import { Check, Zap } from 'lucide-react'
import { XSiteHeader } from '../components/XSiteHeader'
import { POWER_LIVE_X_MONTHLY_PLAN } from '../lib/pricingCatalog'

export const Route = createFileRoute('/plans')({
  component: PlansPage,
})

function PlansPage() {
  const plan = POWER_LIVE_X_MONTHLY_PLAN
  return (
    <main className="min-h-screen bg-[#f7f8f4] text-neutral-950">
      <XSiteHeader title="X.SeekBoxAI Plans" eyebrow="plans and billing" />
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-2 border border-neutral-300 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-neutral-600">
              <Zap className="h-3.5 w-3.5" /> Live X · Multi-model search
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-neutral-950 md:text-5xl">
              One plan. All models. Live X context.
            </h1>
            <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-neutral-600">
              Compare answers side-by-side across top AI models and web search. Turn on Live X mode for recency-first results and
              live-context formatting.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              {[
                ...plan.features,
                'Magic link and Google sign-in',
                'Turnstile captcha support',
              ].map((t) => (
                <div key={t} className="flex items-start gap-2 border border-neutral-300 bg-white px-4 py-3">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-neutral-950" />
                  <div className="font-semibold text-neutral-700">{t}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-neutral-300 bg-white p-7 shadow-[6px_6px_0_rgba(0,0,0,0.08)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-neutral-500">{plan.tier}</div>
                <div className="mt-1 text-2xl font-black text-neutral-950">{plan.title}</div>
              </div>
              <div className="border border-neutral-950 bg-neutral-950 px-3 py-2 text-xs font-black text-white">
                {plan.badge}
              </div>
            </div>

            <div className="mt-6 flex items-end gap-2">
              {plan.listAmount ? (
                <div className="pb-2 text-xl font-black text-neutral-400 line-through">{plan.listAmount}</div>
              ) : null}
              <div className="text-5xl font-black text-neutral-950">{plan.displayAmount}</div>
              <div className="pb-2 font-bold text-neutral-500">/ {plan.interval}</div>
            </div>
            {plan.discountAmount ? (
              <div className="mt-2 inline-flex border border-neutral-300 bg-[#f7f8f4] px-3 py-1 text-xs font-black text-neutral-700">
                {plan.discountAmount} coupon applied at checkout
              </div>
            ) : null}

            <div className="mt-4 text-sm font-semibold leading-6 text-neutral-600">
              {plan.subtitle} You’ll be asked to sign in before checkout. After payment, your account page will confirm subscription status.
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/checkout"
                search={{ plan: plan.id }}
                className="inline-flex items-center justify-center bg-neutral-950 px-6 py-4 font-black text-white hover:bg-neutral-800"
              >
                Start checkout
              </Link>
              <Link
                to="/account"
                className="inline-flex items-center justify-center border border-neutral-300 bg-white px-6 py-4 font-bold text-neutral-950 hover:border-neutral-950"
              >
                View account
              </Link>
            </div>

            <div className="mt-6 text-xs font-semibold text-neutral-500">
              Note: Search requires <span className="font-mono">VITE_BACKEND_URL</span>. Sign-in requires Supabase env vars.
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
