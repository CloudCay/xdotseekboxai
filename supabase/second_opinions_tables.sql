-- SeekBox Second Opinions bookmarks.
-- Run in Supabase SQL editor when you are ready to persist signed-in extension reads.

create table if not exists public.seekbox_second_opinions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  canonical_url text,
  title text,
  source_domain text,
  selected_text text,
  page_excerpt text,
  question text,
  mode text not null default 'quick' check (mode in ('quick', 'compare')),
  route_used jsonb not null default '{}'::jsonb,
  opinions jsonb not null default '[]'::jsonb,
  summary text,
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

create index if not exists seekbox_second_opinions_user_created_idx
  on public.seekbox_second_opinions (user_id, created_at desc);

create index if not exists seekbox_second_opinions_user_domain_idx
  on public.seekbox_second_opinions (user_id, source_domain, created_at desc);

alter table public.seekbox_second_opinions enable row level security;

drop policy if exists "seekbox_second_opinions_select_own" on public.seekbox_second_opinions;
create policy "seekbox_second_opinions_select_own"
on public.seekbox_second_opinions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "seekbox_second_opinions_insert_own" on public.seekbox_second_opinions;
create policy "seekbox_second_opinions_insert_own"
on public.seekbox_second_opinions
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "seekbox_second_opinions_delete_own" on public.seekbox_second_opinions;
create policy "seekbox_second_opinions_delete_own"
on public.seekbox_second_opinions
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "seekbox_second_opinions_update_own" on public.seekbox_second_opinions;
create policy "seekbox_second_opinions_update_own"
on public.seekbox_second_opinions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
