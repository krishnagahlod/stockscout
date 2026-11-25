-- NSE index valuations by day (close, P/E, P/B, dividend yield), from ind_close_all files. Public market data.
create table if not exists public.market_daily (
  index_name text not null,
  date date not null,
  close double precision,
  pe double precision,
  pb double precision,
  div_yield double precision,
  primary key (index_name, date)
);
alter table public.market_daily enable row level security;
create policy "Index values are readable by everyone" on public.market_daily for select using (true);
grant select on public.market_daily to anon, authenticated;
-- price rows say where they came from: 'nse' (official file, from 25 Nov 2026), 'yahoo'; older rows are Yahoo too
alter table public.daily_prices alter column source set default 'yahoo';
