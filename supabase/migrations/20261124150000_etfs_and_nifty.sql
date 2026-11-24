-- Nifty 50 index (for comparisons) and a few broad ETFs (for "Start here").
-- They are not index members, so ideas, ranks and the tip checker never treat them as companies.
-- The nightly price sync picks up rows whose sector is 'ETF' or 'Index'.
insert into public.stocks (ticker, exchange, name, sector, industry, is_index_member)
select v.ticker, 'NSE', v.name, v.sector, v.industry, false
from (values
  ('^NSEI',         'Nifty 50',                                   'Index', 'Large companies'),
  ('NIFTYBEES.NS',  'Nippon India ETF Nifty 50 BeES',             'ETF',   'Nifty 50'),
  ('BSLNIFTY.NS',   'Aditya Birla Sun Life Nifty 50 ETF',         'ETF',   'Nifty 50'),
  ('NIFTY1.NS',     'Kotak Nifty 50 ETF',                         'ETF',   'Nifty 50'),
  ('JUNIORBEES.NS', 'Nippon India ETF Nifty Next 50 Junior BeES', 'ETF',   'Nifty Next 50'),
  ('MIDCAP.NS',     'Kotak Nifty Midcap 50 ETF',                  'ETF',   'Nifty Midcap 50'),
  ('GOLDBEES.NS',   'Nippon India ETF Gold BeES',                 'ETF',   'Gold')
) as v(ticker, name, sector, industry)
where not exists (select 1 from public.stocks s where s.ticker = v.ticker);
