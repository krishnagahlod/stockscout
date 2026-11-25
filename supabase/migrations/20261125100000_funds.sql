-- Mutual funds from AMFI's daily NAV file: one row per open-ended fund, Direct plan, Growth option.
-- Filled by backend/app/services/fund_service.py (nightly). History is weekly older than 30 days, daily after.
create table if not exists public.funds (
  scheme_code integer primary key,
  isin text,
  name text not null,
  amc text,
  category text,
  nav numeric,
  nav_date date,
  ret_1y numeric,          -- simple return
  ret_3y numeric,          -- per year (compounded)
  ret_5y numeric,          -- per year (compounded)
  worst_fall_5y numeric,   -- e.g. -0.32
  updated_at timestamptz not null default now()
);
create index if not exists funds_category_idx on public.funds (category);

create table if not exists public.fund_nav (
  scheme_code integer not null references public.funds(scheme_code) on delete cascade,
  date date not null,
  nav numeric not null,
  primary key (scheme_code, date)
);

alter table public.funds enable row level security;
alter table public.fund_nav enable row level security;
drop policy if exists "Signed-in users read funds" on public.funds;
drop policy if exists "Signed-in users read fund NAVs" on public.fund_nav;
create policy "Signed-in users read funds" on public.funds for select to authenticated using (true);
create policy "Signed-in users read fund NAVs" on public.fund_nav for select to authenticated using (true);
revoke all on public.funds, public.fund_nav from anon;
grant select on public.funds, public.fund_nav to authenticated;
