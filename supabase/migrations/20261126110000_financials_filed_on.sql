-- The day a result was filed. A split or bonus before this day is already reflected in the filed EPS;
-- only later ones need adjusting.
alter table public.stock_financials add column if not exists filed_on date;
