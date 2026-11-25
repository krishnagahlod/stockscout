// Company events (results dates, dividends, splits) summarised for display.
export type StockEvent = { stock_id: number; kind: "results" | "dividend" | "split"; event_date: string; amount: number | null };

const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

export function eventSummary(events: StockEvent[], today: string) {
  const yearAgo = addDays(today, -365);
  const divs = events.filter((e) => e.kind === "dividend" && e.event_date > yearAgo && e.event_date <= today);
  const upcoming = events.filter((e) => e.event_date >= today).sort((a, b) => a.event_date.localeCompare(b.event_date));
  return {
    nextResults: upcoming.find((e) => e.kind === "results") ?? null,
    nextDividend: upcoming.find((e) => e.kind === "dividend") ?? null,
    paid12m: divs.reduce((a, e) => a + Number(e.amount ?? 0), 0),
    payments12m: divs.length,
    lastDividend: events.filter((e) => e.kind === "dividend" && e.event_date <= today).sort((a, b) => b.event_date.localeCompare(a.event_date))[0] ?? null,
    splits: events.filter((e) => e.kind === "split").sort((a, b) => b.event_date.localeCompare(a.event_date)),
  };
}

/** Upcoming events within `days`, soonest first. */
export function upcoming(events: StockEvent[], today: string, days: number): StockEvent[] {
  const end = addDays(today, days);
  return events.filter((e) => e.event_date >= today && e.event_date <= end).sort((a, b) => a.event_date.localeCompare(b.event_date));
}
