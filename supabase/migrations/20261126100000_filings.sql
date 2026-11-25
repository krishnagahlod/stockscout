-- Company results and shareholding parsed from NSE XBRL filings (filings_service.py). Yahoo rows stay as a fallback.
create table if not exists public.filings (
  url text primary key,
  stock_id bigint not null references public.stocks(id) on delete cascade,
  kind text not null check (kind in ('results', 'shareholding')),
  period_end date not null,
  basis text,                  -- consolidated / standalone (results only)
  status text not null,        -- ok, empty (nothing usable), error (retried next run)
  parsed_at timestamptz not null default now()
);
create index if not exists filings_stock_idx on public.filings (stock_id, kind, period_end);
alter table public.filings enable row level security;  -- backend only; no policies

alter table public.stock_financials
  add column if not exists source text not null default 'yahoo',
  add column if not exists basis text,
  add column if not exists pbt numeric,          -- profit before tax
  add column if not exists exceptional numeric;  -- one-off items before tax, as filed

alter table public.stock_ownership
  add column if not exists source text not null default 'yahoo',
  add column if not exists promoter numeric,     -- shares as a fraction of all shares
  add column if not exists fii numeric,          -- foreign institutions (FPIs and foreign direct investors)
  add column if not exists dii numeric,          -- Indian institutions (mutual funds, insurers, banks, pension funds)
  add column if not exists mutual_funds numeric,
  add column if not exists retail numeric,       -- resident individuals
  add column if not exists government numeric,
  add column if not exists pledged numeric;      -- fraction of the promoter's own shares pledged
