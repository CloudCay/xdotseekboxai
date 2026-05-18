import type { ReactNode } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Download, ExternalLink, KeyRound, Puzzle, ShieldCheck } from 'lucide-react'
import { XSiteHeader } from '../components/XSiteHeader'

export const Route = createFileRoute('/second-opinion')({
  component: SecondOpinionRoute,
})

const EXTENSION_DOWNLOAD = '/seekbox-second-opinions.zip'
const EXTENSION_FOLDER = '/Users/cloudsherpasadmin/SeekBoxLocal/xdotseekboxai/extensions/seekbox-second-opinions'

function SecondOpinionRoute() {
  return (
    <main className="min-h-screen bg-[#f7f8f4] text-neutral-950">
      <XSiteHeader
        title="X.SeekBoxAI Extension"
        eyebrow="second opinion reader"
        href="/cleanseek-x/desktop"
        actions={
          <>
            <a
              href={EXTENSION_DOWNLOAD}
              className="inline-flex h-11 items-center gap-2 bg-neutral-950 px-3 text-xs font-black text-white hover:bg-neutral-800"
            >
              <Download className="h-4 w-4" />
              Download
            </a>
            <Link
              to="/cleanseek-x/desktop"
              className="inline-flex h-11 items-center border border-neutral-300 bg-white px-3 text-xs font-black text-neutral-900 hover:border-neutral-950"
            >
              Search
            </Link>
          </>
        }
      />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        <section className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_420px] lg:items-start">
          <div className="border border-neutral-300 bg-white p-6 shadow-[6px_6px_0_rgba(0,0,0,0.08)] sm:p-8">
            <div className="inline-flex items-center gap-2 border border-neutral-300 bg-[#f7f8f4] px-3 py-1 text-[11px] font-black uppercase tracking-widest text-neutral-600">
              <Puzzle className="h-3.5 w-3.5" />
              Chrome extension MVP
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-neutral-950 sm:text-5xl">
              Get a quiet second opinion before you trust a page.
            </h1>
            <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-neutral-600">
              Highlight text or open any normal web page, then ask SeekBox for a quick rotating read or a multi-model comparison.
              The extension sends page context to X.SeekBoxAI, not provider keys.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                ['1', 'Open any page', 'Use a normal public page, article, filing, product page, or selected text.'],
                ['2', 'Ask SeekBox', 'Run a cheap second opinion or compare several model reads side by side.'],
                ['3', 'Open in Search', 'Push the same context into CleanSeek-X when you want the full workspace.'],
              ].map(([k, title, body]) => (
                <div key={k} className="border border-neutral-300 bg-[#fbfbf7] p-4">
                  <div className="flex h-8 w-8 items-center justify-center border border-neutral-950 bg-neutral-950 text-xs font-black text-white">
                    {k}
                  </div>
                  <div className="mt-3 text-sm font-black text-neutral-950">{title}</div>
                  <p className="mt-1 text-xs font-semibold leading-5 text-neutral-600">{body}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="border border-neutral-300 bg-white p-5">
            <div className="text-[11px] font-black uppercase tracking-widest text-neutral-500">Install locally</div>
            <ol className="mt-4 space-y-3 text-sm font-semibold leading-6 text-neutral-600">
              <li className="border border-neutral-300 bg-[#fbfbf7] p-3">
                Download and unzip <span className="font-black text-neutral-950">seekbox-second-opinions.zip</span>.
              </li>
              <li className="border border-neutral-300 bg-[#fbfbf7] p-3">
                Open <span className="font-mono text-neutral-950">chrome://extensions</span> and turn on Developer mode.
              </li>
              <li className="border border-neutral-300 bg-[#fbfbf7] p-3">
                Click <span className="font-black text-neutral-950">Load unpacked</span> and choose the unzipped extension folder.
              </li>
            </ol>
            <div className="mt-4 border border-neutral-300 bg-[#fbfbf7] p-3 text-xs font-semibold leading-5 text-neutral-600">
              Local source folder:
              <div className="mt-1 break-all font-mono text-neutral-950">{EXTENSION_FOLDER}</div>
            </div>
          </aside>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <InfoCard
            icon={<ShieldCheck className="h-4 w-4" />}
            title="No bundled provider keys"
            body="The extension calls the X.SeekBoxAI route. Model choice, auth, and backend calls stay server-side."
          />
          <InfoCard
            icon={<KeyRound className="h-4 w-4" />}
            title="Optional sign-in sync"
            body="Signed-in bookmarking is explicit. Sync sign-in from an active SeekBox tab when you want reads saved."
          />
          <InfoCard
            icon={<ExternalLink className="h-4 w-4" />}
            title="API route"
            body="The extension posts to /api/second-opinion and can hand off the same page context to CleanSeek-X."
          />
        </section>
      </div>
    </main>
  )
}

function InfoCard({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <article className="border border-neutral-300 bg-white p-5">
      <div className="flex h-9 w-9 items-center justify-center border border-neutral-950 bg-neutral-950 text-white">
        {icon}
      </div>
      <h2 className="mt-4 text-base font-black text-neutral-950">{title}</h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-neutral-600">{body}</p>
    </article>
  )
}
