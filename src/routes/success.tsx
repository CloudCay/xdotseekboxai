import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/success')({
  component: SuccessPage,
})

function SuccessPage() {
  return (
    <div className="min-h-screen bg-[#050B14] text-slate-50 flex items-center justify-center px-6">
      <div className="max-w-lg w-full rounded-3xl border border-slate-700/60 bg-[#0A1128]/70 backdrop-blur-2xl p-8">
        <div className="text-2xl font-black tracking-tight">Payment successful</div>
        <div className="mt-2 text-slate-300">
          Thanks — you’re all set. It can take a few seconds for the subscription to show up while Stripe finishes processing.
        </div>
        <div className="mt-6 flex gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-2xl bg-cyan-500 text-[#050B14] font-black px-5 py-3"
          >
            Back to home
          </Link>
          <a
            href="https://www.seekboxai.com/account"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/40 text-white font-bold px-5 py-3"
          >
            Open SeekBox account
          </a>
        </div>
      </div>
    </div>
  )
}

