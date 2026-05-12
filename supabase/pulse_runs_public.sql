-- Public Pulse feed contract.
--
-- Keep public.pulse_runs as the internal source of truth. It can retain
-- query_used, tool_calls, metadata, costs, latency, errors, token counts, and
-- job/deploy diagnostics. Public readers should use this view instead.

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
