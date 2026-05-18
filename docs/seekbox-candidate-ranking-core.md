# SeekBox Candidate Ranking Core

Use the `xai-org/x-algorithm` repo as an architecture reference, not as a direct dependency. The useful pattern is the feed pipeline:

1. Candidate sources
2. Hydration
3. Filters
4. Scoring
5. Selection
6. Side effects

## SeekBox Translation

| xAI idea | SeekBox core equivalent |
| --- | --- |
| Home Mixer | `rankSeekBoxCandidates()` orchestration |
| Thunder | followed handles, tenant topics, saved seeds, user history |
| Phoenix | related voices/topics outside the followed graph |
| Candidate source | X, web/news, Pulse cache, Soundcharts/tour, market data, internal seeds |
| Hydrator | add author stats, recency, geo, sentiment, source credibility, tenant fit |
| Filter | privacy, dedupe, spam/unsafe, stale, blocked source, low confidence |
| Scorer | blended feature score with transparent explanation |
| Selector | diversified result set across industry, media, real people, source type |
| Side effect | persist `ranking_runs`, `candidate_items`, `candidate_features`, `ranked_results` |

## First Core Contract

- `src/lib/rankingPipeline.ts` owns in-app scoring and selection.
- `supabase/core_candidate_ranking.sql` owns durable run/result tables.
- Public readers should use `public_ranked_results`; private tools can read full run tables with service-role or owner-scoped access.

## Feature Scores

All feature scores normalize to `0-100`.

- `relevance`: semantic/topic fit.
- `credibility`: source or author trust.
- `recency`: freshness for the task.
- `velocity`: acceleration or trend movement.
- `engagement`: attention signal, normalized per source.
- `personalization`: user/tenant fit.
- `sourceQuality`: source reliability and parse confidence.
- `sentiment`: sentiment signal strength or clarity, not necessarily positivity.
- `geoFit`: location fit for local/market workflows.
- `novelty`: newly discovered or non-seed signal value.
- `safetyPenalty`: privacy, policy, spam, or low-confidence penalty.
- `diversityPenalty`: repetition penalty during selection.

## Near-Term Wiring

1. `/api/x-discover`: convert returned posts/authors into `SeekBoxCandidate[]`, then use `rankSeekBoxCandidates()` instead of only `rankAuthors()`.
2. `/v1/pulse`: persist public-safe ranked citations and voices into the new core tables after each run.
3. CleanSeek UI: show score explanations and source mix for saved searches.
4. Atlas/Tour app: map market, venue, artist, and signal cards into the same candidate shape.

## Public Safety

Do not store raw bulk X post payloads in the public ranking tables. Store source IDs, URLs, small excerpts or summaries, normalized features, and score explanations. Full prompts, provider responses, tool traces, costs, latency, and raw payloads belong only in private run logs with short retention.
