import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/pricing')({
  component: PricingPage,
})

function PricingPage() {
  return (
    <div className="min-h-screen bg-[#050B14] text-slate-50 flex items-center justify-center px-6">
      <div className="max-w-lg w-full rounded-3xl border border-slate-700/60 bg-[#0A1128]/70 backdrop-blur-2xl p-8">
        <div className="text-2xl font-black tracking-tight">Checkout cancelled</div>
        <div className="mt-2 text-slate-300">
          No worries — you weren’t charged. You can try again whenever you’re ready.
        </div>
        <div className="mt-6 flex gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-2xl bg-cyan-500 text-[#050B14] font-black px-5 py-3"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}

