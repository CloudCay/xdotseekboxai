import type { BattleWindow } from './types'

const WINDOW_PHRASE: Record<BattleWindow, string> = {
  '24h': 'in the last 24 hours',
  '7d': 'in the last 7 days',
  '30d': 'in the last 30 days',
}

const PUNDIT_BLOCKLIST = [
  'elonmusk',
  'realDonaldTrump',
  'JoeBiden',
  'AOC',
  'MattWalshBlog',
  'benshapiro',
  'tuckercarlson',
  'seanhannity',
  'piersmorgan',
]

export function normalizeHandle(handle: string): string {
  const trimmed = handle.trim().replace(/^@+/, '')
  return `@${trimmed}`
}

export function buildXBattlePrompt(handle: string, window: BattleWindow): string {
  const at = normalizeHandle(handle)
  return `Search X only. For ${at} ${WINDOW_PHRASE[window]}, return exactly 4 short lines:
POST_COUNT: rough observed count
SENTIMENT: POSITIVE / NEGATIVE / MIXED / NEUTRAL plus 3-8 word rationale
THEMES: 3 short phrases separated by semicolons
TOP_POSTS: 2 paraphrases with real x.com URLs separated by semicolons

Be terse. Never fabricate URLs. Do not include any other sections.`
}

export function buildAntiEchoPrompt(claim: string, blocklist: string[] = PUNDIT_BLOCKLIST): string {
  return `A user has made this claim:

"${claim.trim()}"

Search X for posts that push back on, disagree with, or offer counter-evidence to this claim. We want substantive dissent, not flame wars.

Deprioritize these high-amplification accounts unless absolutely necessary:
${blocklist.map((handle) => `@${handle}`).join(', ')}

Return exactly 3 short sections:
SUMMARY: 2 sentence strongest counter-case
STRONGEST_COUNTERS: 3 bullets or semicolon-separated counters
DISSENTING_POSTS: 3 posts as @handle: paraphrase with real x.com URL; separated by semicolons

Be terse. Never fabricate URLs. If there is no substantive pushback, say that in SUMMARY.`
}

export function buildPostRoomPrompt(input: string): string {
  return `Search X for the public conversation around this post, URL, handle, ticker, or topic:

"${input.trim()}"

Return exactly 5 short sections:
ROOM_SUMMARY: 2 sentences on what the room is saying
WHY_IT_MATTERS: 1 sentence on why this is worth a deeper look
POSITIONS: 3 bullets or semicolon-separated camps
RELATED_POSTS: 3 posts as @handle: paraphrase with real x.com URL; separated by semicolons
DISSENT: 1 sentence on the best counter-signal or disagreement

Be terse. Never fabricate URLs. If the input is a URL, treat it as context and search the surrounding conversation.`
}
