-- Institutional money flows. Public market data.
-- fund_flows: daily buying and selling in shares by foreign (fii) and Indian (dii) institutions, Rs crore,
--   NSE's provisional figures for NSE + BSE + MSEI, from 25 Nov 2026 (NSE shows only the latest day).
-- fpi_monthly: foreign investors' net investment in Indian shares by month, Rs crore, from NSDL since 2002.
create table if not exists public.fund_flows (
  date date not null,
  category text not null check (category in ('fii', 'dii')),
  buy double precision,
  sell double precision,
  net double precision,
  primary key (date, category)
);
create table if not exists public.fpi_monthly (
  month date primary key,
  equity double precision not null
);
alter table public.fund_flows enable row level security;
alter table public.fpi_monthly enable row level security;
create policy "Fund flows are readable by everyone" on public.fund_flows for select using (true);
create policy "FPI months are readable by everyone" on public.fpi_monthly for select using (true);
grant select on public.fund_flows, public.fpi_monthly to anon, authenticated;
