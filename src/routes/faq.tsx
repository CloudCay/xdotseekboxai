import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { SeekBoxLogo } from '../components/SeekBoxLogo'

export const Route = createFileRoute('/faq')({
  component: FAQ,
})

const faqs = [
  {
    question: 'What is SeekBoxAi?',
    answer:
      'SeekBoxAi is a multi-engine AI search UI that runs several models and web-search engines side-by-side. You ask once, then compare answers, sources, and perspectives in one place.',
  },
  {
    question: 'What is CleanSeek‑X?',
    answer:
      'CleanSeek‑X is the main multi-engine search experience: streaming answers, engine selection, presets, prompt modifiers, and optional “Live X” behavior for recency-focused queries.',
  },
  {
    question: 'What is XMarks?',
    answer:
      'XMarks is a consumption-first dashboard with curated, pre-built searches (Topics / People / Industry) plus your own saved picks. It’s designed for quick “tap → run → read” workflows.',
  },
  {
    question: 'What is the Ticker page?',
    answer:
      'Ticker is a stock-focused dashboard that pairs a symbol list (your watchlist/portfolio) with a Pulse run (X + web engines) and a factual context panel (Twelve Data quote + RSS + Wikipedia).',
  },
  {
    question: 'How does streaming work?',
    answer:
      'Search results stream token-by-token using Server-Sent Events (SSE). This lets you see partial answers quickly while the rest continues to generate.',
  },
  {
    question: 'Which engines can run?',
    answer:
      'CleanSeek‑X includes a mix of model engines (e.g. ChatGPT, Claude, Gemini, xAI) and web engines (e.g. Tavily, Brave, GPT Search, Live Web). You can choose which engines run per query.',
  },
  {
    question: 'What’s the difference between presets and “My picks only”?',
    answer:
      'Presets are fast, opinionated bundles (Quick / Research / Web). “My picks only” runs exactly the engines you toggle — what you see is what you get.',
  },
  {
    question: 'How do I confirm which engines will run?',
    answer:
      'The UI shows a “Next request” line listing the exact provider ids that will be sent on your next search.',
  },
  {
    question: 'What does “Live X” do?',
    answer:
      'It adds a recency-focused instruction so results prioritize the last ~7 days when possible. It’s designed for fast-changing topics like markets, news, and launches.',
  },
  {
    question: 'Does Live X override response length?',
    answer:
      'Yes — Live mode disables the response-length cap so engines have room to include fresh context and citations.',
  },
  {
    question: 'What are prompt modifiers?',
    answer:
      'Prompt modifiers are optional controls that append short instruction suffixes to your query (response length target, tone, persona, comprehension level, reasoning style, and formatting flags).',
  },
  {
    question: 'Are prompt modifiers saved?',
    answer:
      'Yes. They persist locally in your browser (localStorage) so preferences stick across reloads on the same device.',
  },
  {
    question: 'What is RabbitHoleX?',
    answer:
      'RabbitHoleX opens a dedicated results-only view that auto-runs the current query and prints all engine outputs on a single page.',
  },
  {
    question: 'What does History store?',
    answer:
      'History stores the search session and the per-engine outputs so you can expand an entry and read prior results, re-run, or delete it.',
  },
  {
    question: 'Do I need to sign in for History?',
    answer:
      'Yes. History is backed by Supabase tables keyed to your user id, so you need an authenticated session to save and browse entries.',
  },
  {
    question: 'Where do XMarks defaults and picks live?',
    answer:
      'Defaults are admin-editable in Supabase. Your personal picks save to Supabase when signed in, with a local fallback if the DB write is blocked or not configured.',
  },
  {
    question: 'What is the Ticker “Context” panel?',
    answer:
      'It pulls factual context from public APIs: Twelve Data quotes, RSS headlines, and a Wikipedia snippet. It’s fast grounding for a symbol.',
  },
  {
    question: 'Does Ticker news match my symbol?',
    answer:
      'Yes. The page surfaces RSS headlines that mention the symbol ($TSLA / TSLA) and, when available, the company name from the public stock metadata table.',
  },
  {
    question: 'Is there direct Twitter/X API integration?',
    answer:
      'Not on this site. “X pull” is achieved through engines that have X/web access and the Pulse prompt — not by calling the X REST API directly.',
  },
  {
    question: 'What data is stored locally vs in Supabase?',
    answer:
      'Local: theme, font size, engine selections, prompt modifiers. Supabase: signed-in history sessions/results, XMarks presets/picks (when enabled), and ticker watchlist symbols (when enabled).',
  },
  {
    question: 'How do themes work?',
    answer:
      'Themes are applied via <html data-theme="…">. Dark also toggles the Tailwind “dark” class so existing dark-mode styles keep working.',
  },
  {
    question: 'What is the “Paper” theme?',
    answer:
      'Paper is a greyscale, newsprint-inspired theme designed for reading: serif typography, high contrast, and minimal color distraction.',
  },
  {
    question: 'What is the “SeekBox” theme?',
    answer:
      'SeekBox uses the official brand palette (cool white background, navy text, cobalt links, signal-red accents) and Inter typography.',
  },
  {
    question: 'What do I need configured for full functionality?',
    answer:
      'You need a backend URL for streaming search. Supabase env vars enable sign-in + history + personalization tables. Twelve Data quotes require TWELVE_API_KEY server-side.',
  },
]

function FAQ() {
  return (
    <div className="min-h-screen bg-[#050B14] text-slate-50 py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-4">
          <a href="/" className="inline-flex items-center gap-3 font-black text-lg tracking-tight">
            <SeekBoxLogo tone="dark" size="sm" />
            SeekBoxAi
          </a>
          <div className="flex gap-2">
            <a
              href="/cleanseek-x"
              className="rounded-xl border border-slate-700 bg-slate-900/30 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-slate-800/50"
            >
              Open CleanSeek‑X
            </a>
            <a
              href="/account"
              className="rounded-xl border border-slate-700 bg-slate-900/30 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-slate-800/50"
            >
              Account
            </a>
          </div>
        </div>

        <h1 className="mt-10 text-3xl md:text-4xl font-black tracking-tight">Frequently Asked Questions</h1>
        <p className="mt-2 text-slate-400 max-w-2xl">
          Product + platform FAQs for CleanSeek‑X, XMarks, and Ticker. If something feels off, it’s usually a missing env var or a Supabase table/RLS policy.
        </p>

        <div className="mt-10 space-y-3">
          {faqs.map((faq, i) => (
            <Accordion key={i} question={faq.question} answer={faq.answer} />
          ))}
        </div>
      </div>
    </div>
  )
}

function Accordion({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-[#0A1128]/70 backdrop-blur-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-white/[0.03] transition-colors"
      >
        <span className="font-black text-base sm:text-lg text-slate-100">{question}</span>
        <ChevronDown
          size={20}
          className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-5 pb-5 text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">{answer}</div>
      )}
    </div>
  )
}
