-- SeekBox core candidate ranking contract.
--
-- Inspired by xAI's open x-algorithm pipeline shape: candidate sources,
-- hydration, filters, scoring, selection, and side effects. Store compact,
-- public-safe candidate summaries and scores here; keep provider payloads,
-- prompts, tool traces, and raw bulk X data in private run logs only.

create table if not exists public.ranking_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  user_id uuid,
  mode text not null default 'search',
  query text,
  scope_type text,
  scope_value text,
  pipeline_version text not null default 'seekbox-candidate-v1',
  request_context jsonb not null default '{}'::jsonb,
  status text not null default 'completed',
  candidate_count integer not null default 0,
  result_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ranking_runs_status_check check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  constraint ranking_runs_mode_check check (mode ~ '^[a-z0-9_.:-]{1,64}$')
);

create table if not exists public.candidate_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.ranking_runs(id) on delete cascade,
  tenant_id uuid,
  source_kind text not null,
  source_name text,
  source_id text,
  entity_type text not null,
  voice_class text,
  scope_type text,
  scope_value text,
  title text not null,
  summary text,
  source_url text,
  canonical_key text not null,
  occurred_at timestamptz,
  tags text[] not null default array[]::text[],
  safe_public boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint candidate_items_source_kind_check check (source_kind ~ '^[a-z0-9_.:-]{1,64}$'),
  constraint candidate_items_entity_type_check check (entity_type ~ '^[a-z0-9_.:-]{1,64}$'),
  constraint candidate_items_voice_class_check check (voice_class is null or voice_class ~ '^[a-z0-9_.:-]{1,64}$'),
  constraint candidate_items_run_key_unique unique (run_id, canonical_key)
);

create table if not exists public.candidate_features (
  candidate_id uuid primary key references public.candidate_items(id) on delete cascade,
  relevance_score numeric not null default 50,
  credibility_score numeric not null default 50,
  recency_score numeric not null default 50,
  velocity_score numeric not null default 0,
  engagement_score numeric not null default 0,
  personalization_score numeric not null default 0,
  source_quality_score numeric not null default 50,
  sentiment_score numeric not null default 50,
  geo_fit_score numeric not null default 0,
  novelty_score numeric not null default 0,
  safety_penalty numeric not null default 0,
  diversity_penalty numeric not null default 0,
  features jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint candidate_features_range_check check (
    relevance_score between 0 and 100 and
    credibility_score between 0 and 100 and
    recency_score between 0 and 100 and
    velocity_score between 0 and 100 and
    engagement_score between 0 and 100 and
    personalization_score between 0 and 100 and
    source_quality_score between 0 and 100 and
    sentiment_score between 0 and 100 and
    geo_fit_score between 0 and 100 and
    novelty_score between 0 and 100 and
    safety_penalty between 0 and 100 and
    diversity_penalty between 0 and 100
  )
);

create table if not exists public.ranked_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.ranking_runs(id) on delete cascade,
  candidate_id uuid not null references public.candidate_items(id) on delete cascade,
  rank integer not null,
  final_score numeric not null,
  score_breakdown jsonb not null default '{}'::jsonb,
  explanation text[] not null default array[]::text[],
  selected boolean not null default true,
  created_at timestamptz not null default now(),
  constraint ranked_results_rank_check check (rank > 0),
  constraint ranked_results_score_check check (final_score between 0 and 100),
  constraint ranked_results_run_rank_unique unique (run_id, rank),
  constraint ranked_results_run_candidate_unique unique (run_id, candidate_id)
);

create index if not exists ranking_runs_scope_created
  on public.ranking_runs(scope_type, scope_value, created_at desc);

create index if not exists candidate_items_run_rank_source
  on public.candidate_items(run_id, source_kind, entity_type);

create index if not exists candidate_items_canonical_key
  on public.candidate_items(canonical_key);

create index if not exists ranked_results_run_score
  on public.ranked_results(run_id, final_score desc, rank asc);

create or replace view public.public_ranked_results as
select
  rr.run_id,
  rr.rank,
  round(rr.final_score)::int as final_score,
  rr.explanation,
  ci.source_kind,
  ci.source_name,
  ci.entity_type,
  ci.voice_class,
  ci.scope_type,
  ci.scope_value,
  ci.title,
  ci.summary,
  ci.source_url,
  ci.tags,
  ci.occurred_at,
  rr.created_at
from public.ranked_results rr
join public.candidate_items ci on ci.id = rr.candidate_id
join public.ranking_runs r on r.id = rr.run_id
where rr.selected = true
  and ci.safe_public = true
  and r.status = 'completed';

alter table public.ranking_runs enable row level security;
alter table public.candidate_items enable row level security;
alter table public.candidate_features enable row level security;
alter table public.ranked_results enable row level security;

drop policy if exists ranking_runs_owner_select on public.ranking_runs;
create policy ranking_runs_owner_select
  on public.ranking_runs
  for select
  to authenticated
  using (user_id = auth.uid());

grant select on public.public_ranked_results to anon, authenticated;

comment on table public.ranking_runs is
  'One SeekBox ranking pipeline run. Request context must stay compact and public-safe.';
comment on table public.candidate_items is
  'Public-safe candidate summaries from X, web, pulse, music, market data, or internal seeds.';
comment on table public.candidate_features is
  'Normalized 0-100 feature scores used by the core ranker.';
comment on table public.ranked_results is
  'Selected ranked output with score breakdown and short explanation.';
comment on view public.public_ranked_results is
  'Public-safe ranked result feed; excludes raw provider payloads and unsafe candidates.';
