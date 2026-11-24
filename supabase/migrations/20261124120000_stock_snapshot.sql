-- One row per stock with the latest price, fundamentals and technicals.
-- Read by the Next.js app (screens never scan daily_prices). Refreshed by the nightly sync job:
--   refresh materialized view concurrently public.stock_snapshot;

create materialized view if not exists public.stock_snapshot as
with lp as (
  select distinct on (stock_id) stock_id, date as price_date, close
  from public.daily_prices
  order by stock_id, date desc
),
pp as (
  select distinct on (d.stock_id) d.stock_id, d.close as prev_close
  from public.daily_prices d
  join lp on lp.stock_id = d.stock_id and d.date < lp.price_date
  order by d.stock_id, d.date desc
),
yp as (
  select distinct on (d.stock_id) d.stock_id, d.close as close_1y_ago
  from public.daily_prices d
  join lp on lp.stock_id = d.stock_id and d.date <= lp.price_date - interval '365 days'
  order by d.stock_id, d.date desc
),
f as (
  select distinct on (stock_id) *
  from public.stock_fundamentals
  order by stock_id, as_of_date desc
),
t as (
  select distinct on (stock_id) *
  from public.technical_features
  order by stock_id, date desc
)
select
  s.id as stock_id,
  s.ticker,
  s.name,
  coalesce(s.sector, 'Other') as sector,
  s.industry,
  s.is_index_member,
  coalesce(f.market_cap, s.market_cap_cr)::float8 as market_cap_cr,
  lp.price_date,
  lp.close::float8 as price,
  pp.prev_close::float8 as prev_close,
  yp.close_1y_ago::float8 as close_1y_ago,
  f.as_of_date as fundamentals_date,
  f.pe::float8 as pe,
  f.pb::float8 as pb,
  f.roe::float8 as roe,
  f.debt_to_equity::float8 as debt_to_equity,
  f.dividend_yield::float8 as dividend_yield,
  f.eps::float8 as eps,
  f.net_margin::float8 as net_margin,
  f.operating_margin::float8 as operating_margin,
  f.beta::float8 as beta,
  f.week_52_high::float8 as week_52_high,
  f.week_52_low::float8 as week_52_low,
  t.date as technicals_date,
  t.rsi_14::float8 as rsi_14,
  t.sma_200::float8 as sma_200,
  t.volatility_30d::float8 as volatility_30d,
  t.max_drawdown_1y::float8 as max_drawdown_1y,
  t.momentum_12m::float8 as momentum_12m
from public.stocks s
left join lp on lp.stock_id = s.id
left join pp on pp.stock_id = s.id
left join yp on yp.stock_id = s.id
left join f on f.stock_id = s.id
left join t on t.stock_id = s.id;

create unique index if not exists stock_snapshot_stock_id on public.stock_snapshot (stock_id);
create index if not exists stock_snapshot_ticker on public.stock_snapshot (ticker);

-- Market data only; signed-in users may read it.
revoke all on public.stock_snapshot from anon;
grant select on public.stock_snapshot to authenticated;
