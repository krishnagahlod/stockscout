-- Practice mode: pretend-money trades at real closing prices. Positions and cash are derived from these rows
-- (src/lib/practice.ts), so real holdings are never touched. Trades are immutable; "start over" deletes them.
create table if not exists public.practice_trades (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  stock_id bigint not null references public.stocks(id) on delete cascade,
  quantity integer not null check (quantity <> 0),  -- positive = buy, negative = sell
  price numeric not null check (price > 0),
  traded_at timestamptz not null default now()
);
create index if not exists practice_trades_user_idx on public.practice_trades (user_id, traded_at);

alter table public.practice_trades enable row level security;
drop policy if exists "Read own practice trades" on public.practice_trades;
drop policy if exists "Add own practice trades" on public.practice_trades;
drop policy if exists "Delete own practice trades" on public.practice_trades;
create policy "Read own practice trades" on public.practice_trades for select to authenticated using (auth.uid() = user_id);
create policy "Add own practice trades" on public.practice_trades for insert to authenticated with check (auth.uid() = user_id);
create policy "Delete own practice trades" on public.practice_trades for delete to authenticated using (auth.uid() = user_id);
revoke all on public.practice_trades from anon;
grant select, insert, delete on public.practice_trades to authenticated;
