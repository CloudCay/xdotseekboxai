# Pulse Voice Ranking

The industry catalog is a seed list, not the whole product. Pulse should start from those handles, then learn which people keep showing up in summaries, citations, and post URLs over time.

## Runtime Shape

- `pulse_runs` remains the private run log: prompts, model metadata, cost, latency, tool details, errors, and full provider payloads stay there.
- `public_pulse_runs` is the public-safe reader feed.
- `pulse_voice_rankings` is the durable ranking layer for discovered X handles.
- `public_pulse_voice_rankings` exposes only handle, scope, counts, scores, first/last seen, and safe X/Twitter URLs.
- `/api/pulse-voices` reads the ranking view when installed and falls back to deriving rankings from `public_pulse_runs`.

## What Counts As A Voice Signal

- Seed signal: the handle was part of the industry catalog for that run.
- Summary signal: the summary mentions `@handle`.
- Citation signal: an X/Twitter citation URL includes the handle.
- Discovered signal: any non-seed handle found in summary or citations.

## Writer Responsibility

After each completed pulse run, the Worker should extract voice candidates and call `upsert_pulse_voice_ranking` once per handle/scope. The browser should never receive raw provider metadata just to build the leaderboard.

Recommended scoring inputs:

- `seen_delta`: 1 per run where the handle appears.
- `seed_delta`: 1 when the handle came from the configured seed list.
- `citation_delta`: count of cited post URLs owned by that handle.
- `summary_mention_delta`: count of summary mentions.
- `novelty_score`: higher for newly discovered, non-seed voices.
- `heat_score`: recent citation/mention strength.
- `rank_score`: combined score used for leaderboard sorting.

## Public Safety

Do not expose prompt text, raw post dumps, provider responses, cost, latency, tool calls, or account/user metadata through the public voice endpoint. Keep full post storage short-lived and deletion-aware; public pages can show summaries, handle links, score history, and source links.
