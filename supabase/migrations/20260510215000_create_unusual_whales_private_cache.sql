-- SeekBox Whales Edition private cache.
-- License posture: do not store raw Unusual Whales payloads here. These tables
-- are for private, user-owned research snapshots with TTL and RLS.

create extension if not exists pgcrypto;

create table if not exists public.uw_symbols (
  symbol text primary key,
  display_name text not null,
  profile text not null,
  default_min_premium integer not null default 250000,
  default_include jsonb not null default '{}'::jsonb,
  notes text,
  is_seeded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uw_symbols_symbol_format check (symbol ~ '^[A-Z][A-Z0-9.-]{0,11}$')
);

alter table public.uw_symbols enable row level security;

drop policy if exists "uw_symbols_public_read" on public.uw_symbols;
create policy "uw_symbols_public_read"
  on public.uw_symbols for select
  using (true);

insert into public.uw_symbols (symbol, display_name, profile, default_min_premium, default_include, notes, is_seeded)
values
  ('OKE', 'ONEOK', 'Energy midstream flow', 100000, '{"recentFlow":true,"flowAlerts":true,"darkpool":true,"marketTide":false}', 'Seeded personal-dev board symbol.', true),
  ('AAPL', 'Apple', 'Mega-cap single name', 500000, '{"recentFlow":true,"flowAlerts":true,"darkpool":true,"marketTide":false}', 'Seeded personal-dev board symbol.', true),
  ('SPY', 'SPY', 'Index ETF tape', 1000000, '{"recentFlow":true,"flowAlerts":true,"darkpool":true,"marketTide":true}', 'Seeded personal-dev board symbol.', true),
  ('VIX', 'VIX', 'Volatility regime', 250000, '{"recentFlow":false,"flowAlerts":true,"darkpool":false,"marketTide":true}', 'Index/volatility endpoints may return partial data.', true)
on conflict (symbol) do update set
  display_name = excluded.display_name,
  profile = excluded.profile,
  default_min_premium = excluded.default_min_premium,
  default_include = excluded.default_include,
  notes = excluded.notes,
  is_seeded = excluded.is_seeded,
  updated_at = now();

create table if not exists public.uw_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null references public.uw_symbols(symbol) on update cascade,
  provider text not null default 'unusual_whales',
  key_source text not null check (key_source in ('user', 'server')),
  min_premium integer not null default 250000,
  include jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  prompt text,
  fetched_at timestamptz not null,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now()
);

create index if not exists uw_snapshots_user_symbol_created_idx
  on public.uw_snapshots (user_id, symbol, created_at desc);

create index if not exists uw_snapshots_expires_idx
  on public.uw_snapshots (expires_at);

alter table public.uw_snapshots enable row level security;

drop policy if exists "uw_snapshots_select_own" on public.uw_snapshots;
create policy "uw_snapshots_select_own"
  on public.uw_snapshots for select
  using (auth.uid() = user_id);

drop policy if exists "uw_snapshots_insert_own" on public.uw_snapshots;
create policy "uw_snapshots_insert_own"
  on public.uw_snapshots for insert
  with check (auth.uid() = user_id);

drop policy if exists "uw_snapshots_delete_own" on public.uw_snapshots;
create policy "uw_snapshots_delete_own"
  on public.uw_snapshots for delete
  using (auth.uid() = user_id);

create table if not exists public.uw_snapshot_items (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.uw_snapshots(id) on delete cascade,
  item_type text not null check (item_type in ('flow_alert', 'darkpool', 'market_tide', 'recent_flow')),
  ordinal integer not null default 0,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists uw_snapshot_items_snapshot_idx
  on public.uw_snapshot_items (snapshot_id, item_type, ordinal);

alter table public.uw_snapshot_items enable row level security;

drop policy if exists "uw_snapshot_items_select_own" on public.uw_snapshot_items;
create policy "uw_snapshot_items_select_own"
  on public.uw_snapshot_items for select
  using (
    exists (
      select 1
      from public.uw_snapshots s
      where s.id = snapshot_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "uw_snapshot_items_insert_own" on public.uw_snapshot_items;
create policy "uw_snapshot_items_insert_own"
  on public.uw_snapshot_items for insert
  with check (
    exists (
      select 1
      from public.uw_snapshots s
      where s.id = snapshot_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "uw_snapshot_items_delete_own" on public.uw_snapshot_items;
create policy "uw_snapshot_items_delete_own"
  on public.uw_snapshot_items for delete
  using (
    exists (
      select 1
      from public.uw_snapshots s
      where s.id = snapshot_id
        and s.user_id = auth.uid()
    )
  );

create or replace function public.delete_expired_uw_snapshots()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.uw_snapshots
  where expires_at < now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
