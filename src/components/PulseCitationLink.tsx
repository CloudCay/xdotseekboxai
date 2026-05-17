import type { MouseEvent } from 'react'
import { ExternalLink } from 'lucide-react'
import { extractHandleFromSocialUrl, voiceProfileHref } from '../lib/pulseVoiceRankings'
import { openSourcePopup } from '../lib/sourcePopup'

type PulseCitation = {
  index?: number | string | null
  url?: string | null
}

type PulseCitationLinkProps = {
  citation: PulseCitation
  index: number
  tone?: 'light' | 'dark'
  layout?: 'chip' | 'card'
  showProfile?: boolean
}

export function PulseCitationLink({
  citation,
  index,
  tone = 'light',
  layout = 'chip',
  showProfile = true,
}: PulseCitationLinkProps) {
  const handle = extractHandleFromSocialUrl(citation.url)
  const host = citation.url ? safeHost(citation.url) : null
  const sourceNumber = citation.index ?? index + 1
  const sourceLabel = handle ? `@${handle}` : host ?? 'Source'
  const href = citation.url ?? '#'
  const sourceText = `Source ${sourceNumber}`

  const baseChip =
    tone === 'dark'
      ? 'border-slate-700 bg-slate-950/50 text-slate-200 hover:border-cyan-400/50 hover:text-cyan-100'
      : 'border-neutral-300 bg-[#fbfbf7] text-neutral-800 hover:border-neutral-950'
  const numberClass =
    tone === 'dark'
      ? 'border-cyan-400/25 bg-cyan-400/10 text-cyan-100'
      : 'border-neutral-300 bg-white text-neutral-500'

  if (layout === 'card') {
    return (
      <a
        href={href}
        onClick={(event) => sourceClick(event, citation.url)}
        target="_blank"
        rel="noreferrer"
        title={citation.url ?? undefined}
        className={`flex min-w-0 items-center justify-between gap-3 border px-4 py-3 text-sm font-black ${baseChip}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${numberClass}`}>
            {sourceText}
          </span>
          <span className="truncate">{sourceLabel}</span>
        </span>
        <ExternalLink className="h-4 w-4 shrink-0" />
      </a>
    )
  }

  return (
    <span className="inline-flex max-w-full items-center gap-1">
      <a
        href={href}
        onClick={(event) => sourceClick(event, citation.url)}
        target="_blank"
        rel="noreferrer"
        title={citation.url ?? undefined}
        className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black ${baseChip}`}
      >
        <span className={`rounded-full border px-1.5 py-0.5 font-mono text-[9px] ${numberClass}`}>
          {sourceNumber}
        </span>
        <span className="max-w-[150px] truncate">{sourceLabel}</span>
        <ExternalLink className="h-3 w-3 shrink-0" />
      </a>
      {showProfile && handle ? (
        <a
          href={voiceProfileHref(handle)}
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black ${
            tone === 'dark'
              ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100 hover:border-emerald-300/50'
              : 'border-neutral-300 bg-white text-neutral-600 hover:border-neutral-950 hover:text-neutral-950'
          }`}
        >
          Profile
        </a>
      ) : null}
    </span>
  )
}

function sourceClick(event: MouseEvent<HTMLAnchorElement>, url: string | null | undefined) {
  if (openSourcePopup(url)) {
    event.preventDefault()
  }
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}
