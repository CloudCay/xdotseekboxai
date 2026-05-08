-- Ticker dashboard tables (admin-managed public stock metadata + per-user personalization)
-- Run in Supabase SQL editor.

-- 1) Admin-managed public stock metadata (not user-specific)
create table if not exists public.public_stocks (
  symbol text primary key,
  name text,
  exchange text,
  sector text,
  industry text,
  description text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists public_stocks_sector_industry
  on public.public_stocks (sector, industry);

-- 2) Watchlist (per user)
create table if not exists public.ticker_watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  label text,
  created_at timestamptz not null default now(),
  unique (user_id, symbol)
);

create index if not exists ticker_watchlist_user_created
  on public.ticker_watchlist (user_id, created_at desc);

-- 3) Portfolio holdings (per user)
create table if not exists public.ticker_holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  shares numeric not null default 0,
  avg_cost numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, symbol)
);

create index if not exists ticker_holdings_user_created
  on public.ticker_holdings (user_id, created_at desc);

-- updated_at helper (shared with xmarks sql if already created)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ticker_holdings_updated_at on public.ticker_holdings;
create trigger trg_ticker_holdings_updated_at
before update on public.ticker_holdings
for each row execute function public.set_updated_at();

-- RLS
alter table public.public_stocks enable row level security;
alter table public.ticker_watchlist enable row level security;
alter table public.ticker_holdings enable row level security;

-- public_stocks: readable by anyone; writes are dashboard/service-role only.
drop policy if exists "public_stocks_select" on public.public_stocks;
create policy "public_stocks_select"
on public.public_stocks
for select
to public
using (true);

-- ticker_watchlist: user can CRUD their own.
drop policy if exists "ticker_watchlist_select_own" on public.ticker_watchlist;
create policy "ticker_watchlist_select_own"
on public.ticker_watchlist
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "ticker_watchlist_insert_own" on public.ticker_watchlist;
create policy "ticker_watchlist_insert_own"
on public.ticker_watchlist
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "ticker_watchlist_delete_own" on public.ticker_watchlist;
create policy "ticker_watchlist_delete_own"
on public.ticker_watchlist
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "ticker_watchlist_update_own" on public.ticker_watchlist;
create policy "ticker_watchlist_update_own"
on public.ticker_watchlist
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- ticker_holdings: user can CRUD their own.
drop policy if exists "ticker_holdings_select_own" on public.ticker_holdings;
create policy "ticker_holdings_select_own"
on public.ticker_holdings
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "ticker_holdings_insert_own" on public.ticker_holdings;
create policy "ticker_holdings_insert_own"
on public.ticker_holdings
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "ticker_holdings_delete_own" on public.ticker_holdings;
create policy "ticker_holdings_delete_own"
on public.ticker_holdings
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "ticker_holdings_update_own" on public.ticker_holdings;
create policy "ticker_holdings_update_own"
on public.ticker_holdings
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

