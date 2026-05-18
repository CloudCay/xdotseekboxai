-- Public Pulse feed contract.
--
-- Keep public.pulse_runs as the internal source of truth. It can retain
-- query_used, tool_calls, metadata, costs, latency, errors, token counts, and
-- job/deploy diagnostics. Public readers should use this view instead.

alter table public.pulse_runs add column if not exists metric_basis text;
alter table public.pulse_runs add column if not exists matched_post_count integer;
alter table public.pulse_runs add column if not exists sample_post_count integer;
alter table public.pulse_runs add column if not exists observed_reply_count integer;
alter table public.pulse_runs add column if not exists observed_view_count bigint;
alter table public.pulse_runs add column if not exists observed_like_count integer;
alter table public.pulse_runs add column if not exists observed_repost_count integer;
alter table public.pulse_runs add column if not exists observed_quote_count integer;
alter table public.pulse_runs add column if not exists metric_confidence text;
alter table public.pulse_runs add column if not exists metric_notes text;
alter table public.pulse_runs add column if not exists metric_generated_at timestamptz;

create or replace view public.public_pulse_runs as
select
  id,
  scope_type,
  scope_value,
  window_label,
  from_date,
  to_date,
  handles,
  summary,
  coalesce(
    (
      select jsonb_agg(
        jsonb_strip_nulls(
          jsonb_build_object(
            'index',
              case
                when (citation.value ->> 'index') ~ '^[0-9]+$' then (citation.value ->> 'index')::int
                else citation.ordinality::int
              end,
            'url', citation.value ->> 'url'
          )
        )
        order by citation.ordinality
      )
      from jsonb_array_elements(
        case
          when jsonb_typeof(citations::jsonb) = 'array' then citations::jsonb
          else '[]'::jsonb
        end
      ) with ordinality as citation(value, ordinality)
      where (citation.value ->> 'url') ~* '^https?://'
    ),
    '[]'::jsonb
  ) as citations,
  jsonb_strip_nulls(
    jsonb_build_object(
      'basis', nullif(metric_basis, ''),
      'matchedPostCount', greatest(matched_post_count, 0),
      'samplePostCount', greatest(sample_post_count, 0),
      'replyCount', greatest(observed_reply_count, 0),
      'viewCount', greatest(observed_view_count, 0),
      'likeCount', greatest(observed_like_count, 0),
      'repostCount', greatest(observed_repost_count, 0),
      'quoteCount', greatest(observed_quote_count, 0),
      'confidence', nullif(metric_confidence, ''),
      'notes', nullif(metric_notes, ''),
      'generatedAt', metric_generated_at
    )
  ) as metrics,
  tags,
  status,
  created_at
from public.pulse_runs
where nullif(summary, '') is not null
  and coalesce(lower(status), 'completed') not in (
    'error',
    'failed',
    'failure',
    'cancelled',
    'canceled',
    'running',
    'pending',
    'queued',
    'in_progress'
  );

grant select on public.public_pulse_runs to anon, authenticated;

-- Do not revoke public.pulse_runs yet: the main seekboxai.com industries page
-- still reads that raw table directly. After the main site is switched to
-- public.public_pulse_runs, close direct browser reads with:
--
--   revoke all on public.pulse_runs from anon, authenticated;

comment on column public.pulse_runs.metric_basis is
  'Public-safe metric basis: x_recent_counts, x_recent_sample, grok_reported, cache_derived, mixed, or unknown.';
comment on column public.pulse_runs.matched_post_count is
  'Count returned by an X counts endpoint for the run query/window when available.';
comment on column public.pulse_runs.sample_post_count is
  'Number of posts actually inspected or returned in the run sample.';
comment on column public.pulse_runs.observed_reply_count is
  'Sum of reply_count metrics across sampled posts, or model-reported reply volume when basis is grok_reported.';
comment on column public.pulse_runs.observed_view_count is
  'Sum of impression/view metrics across sampled posts, or model-reported view volume when basis is grok_reported.';
