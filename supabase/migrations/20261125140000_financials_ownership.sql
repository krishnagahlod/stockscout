-- Weekly from Yahoo: yearly and quarterly results, and an ownership snapshot (kept over time to show the trend).
create table if not exists public.stock_financials (
  stock_id bigint not null references public.stocks(id) on delete cascade,
  freq text not null check (freq in ('annual', 'quarterly')),
  period_end date not null,
  revenue numeric,
  net_income numeric,
  eps numeric,
  operating_cash_flow numeric,  -- annual only
  total_debt numeric,           -- annual only
  equity numeric,               -- annual only
  updated_at timestamptz not null default now(),
  primary key (stock_id, freq, period_end)
);

create table if not exists public.stock_ownership (
  stock_id bigint not null references public.stocks(id) on delete cascade,
  as_of date not null,
  insiders numeric,        -- share held by insiders, mostly the promoter group for Indian companies
  institutions numeric,    -- mutual funds, insurers, foreign investors
  primary key (stock_id, as_of)
);

alter table public.stock_financials enable row level security;
alter table public.stock_ownership enable row level security;
drop policy if exists "Signed-in users read financials" on public.stock_financials;
drop policy if exists "Signed-in users read ownership" on public.stock_ownership;
create policy "Signed-in users read financials" on public.stock_financials for select to authenticated using (true);
create policy "Signed-in users read ownership" on public.stock_ownership for select to authenticated using (true);
revoke all on public.stock_financials, public.stock_ownership from anon;
grant select on public.stock_financials, public.stock_ownership to authenticated;
