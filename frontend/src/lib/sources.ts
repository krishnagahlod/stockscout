// Where each kind of number comes from. Shown under data panels and in full on /sources.
export type SourceId = "nse" | "nseIndex" | "nseFilings" | "yahooPrices" | "yahooCompany" | "amfi" | "mfapi" | "own";

export const SOURCES: Record<SourceId, { name: string; short: string; url: string; what: string; when: string; limits: string }> = {
  nse: {
    name: "NSE end-of-day file",
    short: "prices and delivery",
    url: "https://www.nseindia.com/all-reports",
    what: "Closing, opening, high and low prices, volume and delivery % for every NSE share and ETF",
    when: "Every weekday night, after NSE publishes it (about 6 pm)",
    limits: "Our main price source from 25 Nov 2026. Prices are as traded: when a company splits its shares we adjust older prices ourselves.",
  },
  nseIndex: {
    name: "NSE index file",
    short: "index values",
    url: "https://www.niftyindices.com/reports/historical-data",
    what: "Closing values of the Nifty indices, with their P/E, P/B and dividend yield, and India VIX",
    when: "Every weekday night; history since 2016",
    limits: "In April 2021 NSE began using group (consolidated) profits for P/E. Earlier values used single-company profits, so they read a little higher.",
  },
  nseFilings: {
    name: "Company filings on NSE",
    short: "results, owners and ratios",
    url: "https://www.nseindia.com/companies-listing/corporate-filings-financial-results",
    what: "Quarterly and yearly results (sales, profit, EPS, cash from the business, debt, equity) and the quarterly shareholding pattern, including pledged shares, read from the XBRL files companies submit to NSE. P/E, P/B, ROE, profit margin and debt to equity are worked out from them.",
    when: "Every Saturday; five years of history",
    limits: "Numbers are exactly as the company filed them. We use group (consolidated) results when a company files them, and skip a period rather than mix in single-company numbers. EPS is adjusted for later splits and bonus issues so years compare fairly. P/E uses the last four quarters' profit without one-off items.",
  },
  yahooPrices: {
    name: "Yahoo Finance",
    short: "prices before 25 Nov 2026",
    url: "https://finance.yahoo.com",
    what: "Price history before 25 Nov 2026, and any day the NSE file is missing",
    when: "Nightly, only as a fallback",
    limits: "Sometimes misses days or leaves splits unadjusted. We check every night: we adjust splits, drop one-day spikes and skip gaps rather than guess.",
  },
  yahooCompany: {
    name: "Yahoo Finance",
    short: "results dates, dividends and splits",
    url: "https://finance.yahoo.com",
    what: "Expected results dates, dividends, splits, dividend yield and beta, and ratios and results for companies whose filings we can't use yet",
    when: "Every Saturday",
    limits: "A summary of the company's filings, not the filings themselves; it can lag a quarter. Where we have the filing itself, the filing wins.",
  },
  amfi: {
    name: "AMFI daily NAV file",
    short: "fund NAVs",
    url: "https://www.amfiindia.com/net-asset-value",
    what: "Today's NAV (price per unit) for every mutual fund in India",
    when: "Every night",
    limits: "The official source. Funds publish NAVs late in the evening; a few publish the next morning.",
  },
  mfapi: {
    name: "mfapi.in",
    short: "older fund NAVs",
    url: "https://www.mfapi.in",
    what: "Mutual fund NAV history since 2019, a free copy of AMFI's records",
    when: "Loaded once; AMFI keeps it current",
    limits: "We keep one NAV a week for anything older than a month, which is enough for returns and worst falls.",
  },
  own: {
    name: "StockScout's own maths",
    short: "ranks, averages and returns",
    url: "/sources#how",
    what: "Ranks, averages, worst falls, returns a year, sector moves and the tax estimate",
    when: "Every night, from the sources above",
    limits: "Worked out from the numbers above, so any error in them carries through.",
  },
};

