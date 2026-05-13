-- Pulse voice ranking contract.
--
-- public.pulse_runs remains the internal run log. This table is the durable
-- "who is emerging over time" layer the pulse writer can upsert after each run.
-- It stores ranked handles, counts, and small evidence samples without exposing
-- raw provider payloads, prompts, costs, latency, or tool diagnostics.

create table if not exists public.pulse_voice_rankings (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null,
  scope_value text not null,
  handle text not null,
  display_handle text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  seen_count integer not null default 0,
  seed_count integer not null default 0,
  citation_count integer not null default 0,
  summary_mention_count integer not null default 0,
  novelty_score numeric not null default 0,
  heat_score numeric not null default 0,
  rank_score numeric not null default 0,
  sample_urls jsonb not null default '[]'::jsonb,
  sample_contexts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pulse_voice_rankings_handle_check check (handle ~ '^[a-z0-9_]{2,15}$'),
  constraint pulse_voice_rankings_scope_unique unique (scope_type, scope_value, handle)
);

create index if not exists pulse_voice_rankings_scope_rank
  on public.pulse_voice_rankings (scope_type, scope_value, rank_score desc, last_seen_at desc);

create index if not exists pulse_voice_rankings_handle
  on public.pulse_voice_rankings (handle);

create or replace view public.public_pulse_voice_rankings as
select
  scope_type,
  scope_value,
  handle,
  coalesce(display_handle, handle) as display_handle,
  case
    when seed_count > 0 and (citation_count > 0 or summary_mention_count > 0) then 'mixed'
    when seed_count > 0 then 'seed'
    else 'discovered'
  end as source,
  round(rank_score)::int as rank_score,
  round(heat_score)::int as heat_score,
  round(novelty_score)::int as novelty_score,
  seen_count,
  seed_count,
  citation_count,
  summary_mention_count,
  first_seen_at,
  last_seen_at,
  coalesce(sample_urls, '[]'::jsonb) as sample_urls
from public.pulse_voice_rankings;

grant select on public.public_pulse_voice_rankings to anon, authenticated;

create or replace function public.upsert_pulse_voice_ranking(
  p_scope_type text,
  p_scope_value text,
  p_handle text,
  p_display_handle text default null,
  p_seen_delta integer default 1,
  p_seed_delta integer default 0,
  p_citation_delta integer default 0,
  p_summary_mention_delta integer default 0,
  p_novelty_score numeric default 0,
  p_heat_score numeric default 0,
  p_rank_score numeric default 0,
  p_sample_url text default null,
  p_sample_context text default null,
  p_seen_at timestamptz default now()
) returns void
language plpgsql
security definer
as $$
declare
  clean_handle text := lower(regexp_replace(coalesce(p_handle, ''), '^@+', ''));
  next_urls jsonb;
  next_contexts jsonb;
begin
  if clean_handle !~ '^[a-z0-9_]{2,15}$' then
    return;
  end if;

  next_urls :=
    case
      when p_sample_url is null or p_sample_url !~* '^https?://(www\.)?(x|twitter)\.com/' then '[]'::jsonb
      else jsonb_build_array(p_sample_url)
    end;

  next_contexts :=
    case
      when nullif(p_sample_context, '') is null then '[]'::jsonb
      else jsonb_build_array(left(p_sample_context, 280))
    end;

  insert into public.pulse_voice_rankings (
    scope_type,
    scope_value,
    handle,
    display_handle,
    first_seen_at,
    last_seen_at,
    seen_count,
    seed_count,
    citation_count,
    summary_mention_count,
    novelty_score,
    heat_score,
    rank_score,
    sample_urls,
    sample_contexts
  ) values (
    p_scope_type,
    p_scope_value,
    clean_handle,
    coalesce(nullif(p_display_handle, ''), clean_handle),
    p_seen_at,
    p_seen_at,
    greatest(p_seen_delta, 0),
    greatest(p_seed_delta, 0),
    greatest(p_citation_delta, 0),
    greatest(p_summary_mention_delta, 0),
    greatest(p_novelty_score, 0),
    greatest(p_heat_score, 0),
    greatest(p_rank_score, 0),
    next_urls,
    next_contexts
  )
  on conflict (scope_type, scope_value, handle)
  do update set
    display_handle = coalesce(excluded.display_handle, public.pulse_voice_rankings.display_handle),
    first_seen_at = least(public.pulse_voice_rankings.first_seen_at, excluded.first_seen_at),
    last_seen_at = greatest(public.pulse_voice_rankings.last_seen_at, excluded.last_seen_at),
    seen_count = public.pulse_voice_rankings.seen_count + excluded.seen_count,
    seed_count = public.pulse_voice_rankings.seed_count + excluded.seed_count,
    citation_count = public.pulse_voice_rankings.citation_count + excluded.citation_count,
    summary_mention_count = public.pulse_voice_rankings.summary_mention_count + excluded.summary_mention_count,
    novelty_score = greatest(public.pulse_voice_rankings.novelty_score * 0.92, excluded.novelty_score),
    heat_score = greatest(public.pulse_voice_rankings.heat_score * 0.92, excluded.heat_score),
    rank_score = greatest(public.pulse_voice_rankings.rank_score * 0.92, excluded.rank_score),
    sample_urls = (
      select coalesce(jsonb_agg(value), '[]'::jsonb)
      from (
        select distinct value
        from jsonb_array_elements(public.pulse_voice_rankings.sample_urls || excluded.sample_urls)
        limit 8
      ) urls
    ),
    sample_contexts = (
      select coalesce(jsonb_agg(value), '[]'::jsonb)
      from (
        select distinct value
        from jsonb_array_elements(public.pulse_voice_rankings.sample_contexts || excluded.sample_contexts)
        limit 8
      ) contexts
    ),
    updated_at = now();
end;
$$;
