# Pulse Run Metrics

Every cron pulse should try to answer one plain operational question:

> For this topic or industry in this run window, how many posts, replies, and views did we observe?

## Count Basis

Store a `metric_basis` on `pulse_runs` so charts do not confuse estimates with measured counts.

- `x_recent_counts`: post count came from X's recent counts endpoint for the query/window.
- `x_recent_sample`: totals came from the posts returned and inspected by a Recent Search sample.
- `grok_reported`: Grok reported the number from its live-search context, but the app did not independently inspect post metrics.
- `mixed`: post count came from counts, while replies/views came from a sampled set or Grok.
- `cache_derived`: count is derived from SeekBox cache artifacts such as citations or seen runs.
- `unknown`: metric source is not trustworthy enough to chart.

## Recommended Cron Flow

1. Build one canonical X query for the industry/topic and time window.
2. Call X Recent Post Counts for `matched_post_count` when API access allows it.
3. Call X Recent Search for a bounded sample and sum public post metrics:
   - `sample_post_count`: number of posts inspected.
   - `observed_reply_count`: sum of `public_metrics.reply_count`.
   - `observed_view_count`: sum of `public_metrics.impression_count`.
   - `observed_like_count`, `observed_repost_count`, `observed_quote_count`: optional engagement totals.
4. Ask Grok for synthesis and for a fallback metric block. Use Grok metrics only when the API did not return structured counts.
5. Store only public-safe metrics, citations, source IDs, URLs, and summary text in public-facing tables.

## Grok Metric Block

When Grok is doing the heavy lift, ask for a tiny structured footer in addition to the brief:

```text
SIGNAL_METRICS:
BASIS: grok_reported
MATCHED_POST_COUNT: integer or UNKNOWN
SAMPLE_POST_COUNT: integer or UNKNOWN
REPLY_COUNT: integer or UNKNOWN
VIEW_COUNT: integer or UNKNOWN
CONFIDENCE: high / medium / low
NOTES: one short sentence about whether this is observed, sampled, or estimated
```

If the cron also uses X API counts, overwrite `BASIS` with `x_recent_counts`, `x_recent_sample`, or `mixed` before writing to Supabase.

## Public Contract

`public_pulse_runs.metrics` exposes only:

- `basis`
- `matchedPostCount`
- `samplePostCount`
- `replyCount`
- `viewCount`
- `likeCount`
- `repostCount`
- `quoteCount`
- `confidence`
- `notes`
- `generatedAt`

Do not expose raw provider payloads, prompts, tool traces, private account metadata, or bulk post text.
