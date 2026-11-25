-- Company events from Yahoo, refreshed weekly: expected results dates, dividends (ex-date, amount per share), splits.
create table if not exists public.stock_events (
  stock_id bigint not null references public.stocks(id) on delete cascade,
  kind text not null check (kind in ('results', 'dividend', 'split')),
  event_date date not null,
  amount numeric,            -- dividend per share in rupees, or split ratio (10 = 1 share became 10)
  updated_at timestamptz not null default now(),
  primary key (stock_id, kind, event_date)
);
create index if not exists stock_events_date_idx on public.stock_events (event_date);

alter table public.stock_events enable row level security;
drop policy if exists "Signed-in users read events" on public.stock_events;
create policy "Signed-in users read events" on public.stock_events for select to authenticated using (true);
revoke all on public.stock_events from anon;
grant select on public.stock_events to authenticated;
