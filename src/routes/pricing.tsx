import { createFileRoute, Link } from '@tanstack/react-router'
import { Check, Zap } from 'lucide-react'

export const Route = createFileRoute('/pricing')({
  component: PricingPage,
})

function PricingPage() {
  return (
    <div className="min-h-screen bg-[#050B14] text-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-14">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="font-black text-lg tracking-tight">
            SeekBoxAi
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/cleanseek-x"
              className="rounded-2xl border border-slate-700 bg-slate-900/30 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-slate-800/50"
            >
              Try CleanSeek-X
            </Link>
            <a
              href="/signin?returnTo=/pricing"
              className="rounded-2xl border border-slate-700 bg-slate-900/30 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-slate-800/50"
            >
              Sign in
            </a>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-black text-cyan-200">
              <Zap className="h-3.5 w-3.5" /> Grok Live · Multi-model search
            </div>
            <h1 className="mt-5 text-4xl md:text-5xl font-black tracking-tight text-white">
              One plan. All models. Live X context.
            </h1>
            <p className="mt-4 text-slate-300 leading-relaxed">
              Compare answers side-by-side across top AI models and web engines. Turn on Grok Live mode for recency-first results and
              live-context formatting.
            </p>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {[
                '10+ model/providers in one run',
                'Grok Live mode + Deep Live Dive',
                'Search history (when signed in)',
                'Stripe checkout + role/subscription status',
                'Magic link + Google sign-in',
                'Turnstile captcha support',
              ].map((t) => (
                <div key={t} className="flex items-start gap-2 rounded-2xl border border-slate-800 bg-black/20 px-4 py-3">
                  <Check className="mt-0.5 h-4 w-4 text-emerald-400 shrink-0" />
                  <div className="text-slate-200">{t}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-700/60 bg-[#0A1128]/70 backdrop-blur-2xl p-7 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.7)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-black tracking-widest text-slate-400 uppercase">Power tier</div>
                <div className="mt-1 text-2xl font-black text-white">SeekBoxAi + Grok Live</div>
              </div>
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-100">
                Monthly
              </div>
            </div>

            <div className="mt-6 flex items-end gap-2">
              <div className="text-5xl font-black text-white">$20</div>
              <div className="pb-2 text-slate-400 font-bold">/ month</div>
            </div>

            <div className="mt-4 text-sm text-slate-400">
              You’ll be asked to sign in before checkout. After payment, your account page will confirm subscription status.
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Link
                to="/checkout"
                className="inline-flex items-center justify-center rounded-2xl bg-cyan-500 text-[#050B14] font-black px-6 py-4 hover:brightness-110"
              >
                Start checkout
              </Link>
              <Link
                to="/account"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/30 text-white font-bold px-6 py-4 hover:bg-slate-800/50"
              >
                View account
              </Link>
            </div>

            <div className="mt-6 text-xs text-slate-500">
              Note: Search requires <span className="font-mono">VITE_BACKEND_URL</span>. Sign-in requires Supabase env vars.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

