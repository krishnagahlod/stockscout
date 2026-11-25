-- Where an event came from: 'nse' (the company's board-meeting notice to NSE, nightly) or 'yahoo' (weekly estimate).
-- A results date announced on NSE replaces Yahoo's estimate.
alter table public.stock_events add column if not exists source text not null default 'yahoo';
