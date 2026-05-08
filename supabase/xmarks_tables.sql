-- XMarks presets + user picks (admin-editable defaults)
-- Run in Supabase SQL editor.

-- 1) Defaults / global presets (admin managed)
create table if not exists public.xmarks_presets (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('topic', 'person', 'industry')),
  label text not null,
  query text not null,
  is_default boolean not null default true,
  sort_order int not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists xmarks_presets_default_kind_sort
  on public.xmarks_presets (is_default, kind, sort_order, created_at desc);

-- Optional: keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_xmarks_presets_updated_at on public.xmarks_presets;
create trigger trg_xmarks_presets_updated_at
before update on public.xmarks_presets
for each row execute function public.set_updated_at();

-- 2) Per-user picks
create table if not exists public.xmarks_user_picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('topic', 'person', 'industry')),
  label text not null,
  query text not null,
  created_at timestamptz not null default now()
);

create index if not exists xmarks_user_picks_user_kind_created
  on public.xmarks_user_picks (user_id, kind, created_at desc);

-- RLS
alter table public.xmarks_presets enable row level security;
alter table public.xmarks_user_picks enable row level security;

-- xmarks_presets: readable by anyone signed in (or anon if you prefer).
drop policy if exists "xmarks_presets_select" on public.xmarks_presets;
create policy "xmarks_presets_select"
on public.xmarks_presets
for select
to public
using (true);

-- Only service role / dashboard edits (no client-side writes).
-- If you want role-based admin edits from the app later, add a policy keyed off a custom JWT claim.

-- xmarks_user_picks: user can CRUD their own.
drop policy if exists "xmarks_user_picks_select_own" on public.xmarks_user_picks;
create policy "xmarks_user_picks_select_own"
on public.xmarks_user_picks
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "xmarks_user_picks_insert_own" on public.xmarks_user_picks;
create policy "xmarks_user_picks_insert_own"
on public.xmarks_user_picks
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "xmarks_user_picks_delete_own" on public.xmarks_user_picks;
create policy "xmarks_user_picks_delete_own"
on public.xmarks_user_picks
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "xmarks_user_picks_update_own" on public.xmarks_user_picks;
create policy "xmarks_user_picks_update_own"
on public.xmarks_user_picks
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

