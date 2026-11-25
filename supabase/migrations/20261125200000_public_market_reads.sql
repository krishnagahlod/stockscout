-- Market data is the same for every visitor, so the app caches it with a cookie-less (anon) client.
-- Nothing per-user here: daily_prices and stocks were already public.
grant select on public.stock_snapshot to anon;
create policy "Funds are readable by everyone" on public.funds for select to anon using (true);
create policy "Fund NAVs are readable by everyone" on public.fund_nav for select to anon using (true);
grant select on public.funds, public.fund_nav to anon;
