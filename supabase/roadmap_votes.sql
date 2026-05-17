-- Public roadmap voting contract.
--
-- The app writes one vote per anonymous client id per feature. The browser only
-- reads aggregate counts through public.roadmap_vote_counts; raw client ids are
-- not selected back into the public UI.

create table if not exists public.roadmap_votes (
  feature_id text not null,
  client_id text not null,
  source_path text,
  created_at timestamptz not null default now(),
  constraint roadmap_votes_pk primary key (feature_id, client_id),
  constraint roadmap_votes_feature_id_check check (feature_id ~ '^[A-Za-z0-9_.:-]{1,64}$'),
  constraint roadmap_votes_client_id_check check (client_id ~ '^[A-Za-z0-9_.:-]{1,80}$'),
  constraint roadmap_votes_source_path_check check (
    source_path is null
    or (source_path ~ '^/[A-Za-z0-9/_?.=&%#+:-]{0,159}$' and source_path !~ '^//')
  )
);

create index if not exists roadmap_votes_feature_created_idx
  on public.roadmap_votes (feature_id, created_at desc);

alter table public.roadmap_votes enable row level security;

drop policy if exists "roadmap_votes_insert_public" on public.roadmap_votes;
create policy "roadmap_votes_insert_public"
on public.roadmap_votes
for insert
to anon, authenticated
with check (
  feature_id ~ '^[A-Za-z0-9_.:-]{1,64}$'
  and client_id ~ '^[A-Za-z0-9_.:-]{1,80}$'
  and (
    source_path is null
    or (source_path ~ '^/[A-Za-z0-9/_?.=&%#+:-]{0,159}$' and source_path !~ '^//')
  )
);

-- Keep direct table access narrow. The app should not expose raw client ids.
revoke all on public.roadmap_votes from anon, authenticated;
grant insert on public.roadmap_votes to anon, authenticated;

create or replace view public.roadmap_vote_counts as
select
  feature_id,
  count(*)::integer as vote_count
from public.roadmap_votes
group by feature_id;

grant select on public.roadmap_vote_counts to anon, authenticated;
