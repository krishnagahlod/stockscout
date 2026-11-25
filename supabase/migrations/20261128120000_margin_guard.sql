-- Margins are left empty when the year's profit or loss is more than five times its sales (MMTC: almost no sales,
-- so -6,235% and +7,287%). Up to that they stay: Ola Electric's loss really is bigger than its sales, and Bajaj
-- Holdings' profit (with its share of Bajaj Finance) really is bigger than its own sales.
-- Otherwise the snapshot is unchanged from 20261127120000.
begin;
drop materialized view if exists public.stock_snapshot;

create materialized view public.stock_snapshot as
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
),
q as (
  select sf.*, row_number() over (partition by sf.stock_id order by sf.period_end desc) as rn
  from public.stock_financials sf
  where sf.source = 'nse' and sf.freq = 'quarterly'
),
ttm as (
  select q.stock_id, sum(revenue - coalesce(excise, 0)) as rev,
    case when count(op_profit) = 4 then sum(op_profit - case when st.sector = 'Financial Services' then coalesce(finance_costs, 0) else 0 end) end as op,
    sum(net_income - coalesce(exceptional, 0) * coalesce(least(greatest(net_income / nullif(pbt, 0), 0), 1), 1)) as ni
  from q join public.stocks st on st.id = q.stock_id
  where rn <= 4
  group by q.stock_id
  having count(*) = 4 and count(revenue) = 4 and count(net_income) = 4
     and max(period_end) - min(period_end) between 270 and 280
     and max(period_end) >= current_date - 200
),
sh as (
  select q.stock_id, (q.net_income / q.eps) * coalesce(sp.factor, 1) as shares
  from q
  left join lateral (
    select exp(sum(ln(e.amount))) as factor from public.stock_events e
    where e.stock_id = q.stock_id and e.kind = 'split' and e.amount > 0
      and e.event_date > coalesce(q.filed_on, q.period_end + 45)
  ) sp on true
  where q.rn = 1 and q.eps is not null and abs(q.eps) >= 0.01 and q.net_income / q.eps > 0
),
bs as (
  select distinct on (stock_id) stock_id, equity, total_debt
  from public.stock_financials
  where source = 'nse' and freq = 'annual' and equity > 0 and period_end >= current_date - 600
  order by stock_id, period_end desc
),
dv as (
  select stock_id, coalesce(sum(amount) filter (where event_date > current_date - 365 and event_date <= current_date), 0) as paid
  from public.stock_events where kind = 'dividend'
  group by stock_id
),
fil as (
  select ttm.stock_id,
    lp.close * sh.shares as mcap,
    ttm.ni, ttm.rev, ttm.op, sh.shares, bs.equity, bs.total_debt
  from ttm
  join sh on sh.stock_id = ttm.stock_id
  join lp on lp.stock_id = ttm.stock_id
  left join f on f.stock_id = ttm.stock_id
  left join bs on bs.stock_id = ttm.stock_id
  where f.market_cap is null or f.market_cap <= 0
     or (lp.close * sh.shares / 1e7) / f.market_cap between 0.67 and 1.5
)
select
  s.id as stock_id,
  s.ticker,
  s.name,
  coalesce(s.sector, 'Other') as sector,
  s.industry,
  s.is_index_member,
  coalesce(fil.mcap / 1e7, f.market_cap, s.market_cap_cr)::float8 as market_cap_cr,
  lp.price_date,
  lp.close::float8 as price,
  pp.prev_close::float8 as prev_close,
  yp.close_1y_ago::float8 as close_1y_ago,
  f.as_of_date as fundamentals_date,
  case when fil.stock_id is null then f.pe when fil.ni > 0 then fil.mcap / fil.ni end::float8 as pe,
  coalesce(fil.mcap / nullif(fil.equity, 0), f.pb)::float8 as pb,
  coalesce(fil.ni / nullif(fil.equity, 0), f.roe)::float8 as roe,
  coalesce(fil.total_debt / nullif(fil.equity, 0), f.debt_to_equity)::float8 as debt_to_equity,
  case when dv.stock_id is not null and lp.close > 0 then dv.paid / lp.close else f.dividend_yield end::float8 as dividend_yield,
  coalesce(fil.ni / nullif(fil.shares, 0), f.eps)::float8 as eps,
  case when fil.rev > 0 and fil.ni is not null then case when abs(fil.ni) <= 5 * fil.rev then fil.ni / fil.rev end else f.net_margin end::float8 as net_margin,
  case when fil.rev > 0 and fil.op is not null then case when abs(fil.op) <= 5 * fil.rev then fil.op / fil.rev end else f.operating_margin end::float8 as operating_margin,
  f.beta::float8 as beta,
  f.week_52_high::float8 as week_52_high,
  f.week_52_low::float8 as week_52_low,
  t.date as technicals_date,
  t.rsi_14::float8 as rsi_14,
  t.sma_200::float8 as sma_200,
  t.volatility_30d::float8 as volatility_30d,
  t.max_drawdown_1y::float8 as max_drawdown_1y,
  t.momentum_12m::float8 as momentum_12m,
  case when fil.stock_id is not null then 'filings' when f.stock_id is not null then 'yahoo' end as ratios_source
from public.stocks s
left join lp on lp.stock_id = s.id
left join pp on pp.stock_id = s.id
left join yp on yp.stock_id = s.id
left join f on f.stock_id = s.id
left join t on t.stock_id = s.id
left join fil on fil.stock_id = s.id
left join dv on dv.stock_id = s.id;

create unique index if not exists stock_snapshot_stock_id on public.stock_snapshot (stock_id);
create index if not exists stock_snapshot_ticker on public.stock_snapshot (ticker);

-- market data, the same for everyone (cached by the app with the anon key)
grant select on public.stock_snapshot to anon, authenticated;
commit;
