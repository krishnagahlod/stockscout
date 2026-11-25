// Two-minute lessons. Each one: a one-line answer, a few short paragraphs, one example, and where to go deeper.
import type { MetricKey } from "./metrics";

export type Lesson = { slug: string; group: string; title: string; oneLine: string; body: string[]; example?: string; deeper?: { label: string; href: string } };

const VARSITY = {
  basics: { label: "Zerodha Varsity: Introduction to Stock Markets", href: "https://zerodha.com/varsity/module/introduction-to-stock-markets/" },
  fundamentals: { label: "Zerodha Varsity: Fundamental Analysis", href: "https://zerodha.com/varsity/module/fundamental-analysis/" },
  funds: { label: "Zerodha Varsity: Personal Finance and Mutual Funds", href: "https://zerodha.com/varsity/module/personalfinance/" },
  tax: { label: "Zerodha Varsity: Markets and Taxation", href: "https://zerodha.com/varsity/module/markets-and-taxation/" },
};

export const LESSONS: Lesson[] = [
  {
    slug: "first-money", group: "Getting started", title: "Your first ₹1,000: where it should go",
    oneLine: "Emergency money first, then the whole market, then single companies.",
    body: [
      "Before shares, keep a small cushion in a savings account or FD, so a surprise bill never forces you to sell at a bad moment.",
      "Money you need within about three years doesn't belong in shares: prices can fall 30% or more in a few months and take a year or two to recover.",
      "For long-term money, an index fund or ETF that follows the Nifty 50 is a common first step. It owns 50 large companies at once, so no single company can sink you.",
      "Single companies come later, once you can explain why you're buying each one, and keep each to a small part of your money.",
    ],
    example: "The Nifty 50 fell about 38% between January and March 2020, then took about 8 months to get back to its old high. Someone who had to sell in March locked in the loss.",
    deeper: VARSITY.funds,
  },
  {
    slug: "demat", group: "Getting started", title: "Opening a demat account, step by step",
    oneLine: "You need PAN, Aadhaar linked to your mobile, and a bank account; it's done online in a day or two.",
    body: [
      "A demat account holds your shares and units electronically; a trading account (usually opened together) lets you buy and sell. Brokers like Zerodha, Groww, Upstox and Angel One, and most banks, offer both.",
      "You'll need your PAN card, Aadhaar linked to your mobile number (for e-signing), a bank account in your name, and a photo of your signature. Verification is usually a short video call or selfie check. If you're under 18, a parent or guardian opens a minor's account for you.",
      "Costs to compare: account opening (often free), a yearly maintenance charge (₹0 to about ₹300+), brokerage per order (₹0 to ₹20 at discount brokers for delivery trades, more at full-service ones), and a DP charge of roughly ₹13 to ₹20 each day you sell a company's shares.",
      "On every delivery trade there are also government charges: 0.1% securities transaction tax when you buy and when you sell, and 0.015% stamp duty when you buy, plus GST on the broker's fees.",
      "For mutual funds you don't strictly need a demat account: you can invest through the fund house's site or a mutual fund app using just KYC.",
    ],
    example: "Buying ₹5,000 of a share and selling it later for ₹5,500 at a zero-brokerage broker costs roughly ₹5 + ₹0.75 in tax and stamp duty on the buy, and ₹5.50 tax plus about ₹15 DP charge on the sell.",
  },
  {
    slug: "shares", group: "Getting started", title: "What a share actually is",
    oneLine: "A tiny slice of a company: you own part of its profits and its future.",
    body: [
      "A company with 100 crore shares that you own 10 of: you own 10 of those 100 crore slices. If profits grow, your slice is usually worth more; if the business struggles, it's worth less.",
      "Some companies pay part of their profit to shareholders as a dividend. Others keep it to grow.",
      "The share price moves every day with what buyers and sellers think the company will earn in future. Over short periods that can have little to do with the business itself.",
    ],
    deeper: VARSITY.basics,
  },
  {
    slug: "index-funds", group: "Getting started", title: "Index funds and ETFs",
    oneLine: "Buy the whole list instead of guessing which company wins.",
    body: [
      "An index is a list of companies chosen by a rule, like the Nifty 50: India's 50 largest listed companies, weighted by size.",
      "An index fund or ETF buys every company on that list in the same proportions. Because nobody is picking stocks, the yearly fee (expense ratio) is usually low.",
      "ETFs trade like shares in your broker app during market hours. Index mutual funds are bought from the fund house at the day's price and allow SIPs of any amount above the minimum.",
      "Funds following the same index hold the same companies. What differs is the fee and how closely they track the index.",
    ],
    deeper: VARSITY.funds,
  },
  {
    slug: "mutual-funds", group: "Getting started", title: "Mutual funds: Direct, Regular and SIPs",
    oneLine: "Same fund, two prices: Direct plans skip the distributor's commission.",
    body: [
      "Every mutual fund has a Direct plan and a Regular plan. They hold the same investments; the Regular plan pays a commission to whoever sold it to you, often 0.5% to 1% a year more in fees.",
      "Growth option means profits stay invested and the NAV (the price of one unit) grows. IDCW means some money is paid out from time to time.",
      "A SIP puts a fixed amount in every month. You buy more units when prices are low and fewer when they're high, and you never have to pick a moment.",
      "Check the expense ratio and exit load (a fee for selling within a set time) on the fund's factsheet before you invest.",
    ],
    deeper: VARSITY.funds,
  },
  {
    slug: "pe", group: "Reading a company", title: "P/E: what you pay for ₹1 of profit",
    oneLine: "P/E of 20 means you pay ₹20 for every ₹1 the company earns in a year.",
    body: [
      "P/E is the share price divided by yearly profit per share. A low P/E can be a bargain, or a sign that investors expect profits to fall. A high P/E means investors expect fast growth.",
      "Compare a company's P/E with similar companies, not with companies in other industries: banks, software firms and miners are valued very differently.",
      "A company making a loss has no meaningful P/E.",
    ],
    example: "If a share costs ₹400 and earns ₹20 per share a year, its P/E is 20. If profits double and the price stays the same, the P/E falls to 10.",
    deeper: VARSITY.fundamentals,
  },
  {
    slug: "roe", group: "Reading a company", title: "Return on equity: how well owners' money is used",
    oneLine: "ROE of 20% means the company made ₹20 of profit for every ₹100 its owners have in it.",
    body: [
      "Equity is the owners' money in the business. ROE shows how much profit the company squeezes out of it each year.",
      "Consistently high ROE (say 15% or more) is a sign of a good business. But a company can push ROE up by borrowing heavily, so look at debt alongside it.",
    ],
    deeper: VARSITY.fundamentals,
  },
  {
    slug: "debt", group: "Reading a company", title: "Debt: when borrowing becomes a risk",
    oneLine: "Debt-to-equity of 2 means the company owes ₹2 for every ₹1 its owners have in it.",
    body: [
      "Borrowing helps companies grow, but interest has to be paid in bad years too. Heavily indebted companies are the ones that get into trouble when business slows or interest rates rise.",
      "Under 0.5 is usually comfortable; above 1.5 deserves a closer look. Banks and lenders are different: borrowing is their business, so this number doesn't apply to them in the same way.",
    ],
    deeper: VARSITY.fundamentals,
  },
  {
    slug: "falls", group: "Staying safe", title: "How much do prices fall, and is that normal?",
    oneLine: "Falls of 10% to 20% happen most years; 30% or more happen every few years.",
    body: [
      "Even India's largest companies, as a group, have fallen more than 30% at times, as in early 2020. Single companies, especially small ones, can fall 50% or more and never come back.",
      "StockScout shows the worst fall for every stock and fund so you can ask yourself: could I sit through that without selling?",
      "Spreading money across many companies, and only investing money you won't need for years, are what make falls survivable.",
    ],
  },
  {
    slug: "tips", group: "Staying safe", title: "Tips, pump-and-dumps and SEBI registration",
    oneLine: "If someone you don't know is excited about a small stock, ask who gains when you buy.",
    body: [
      "In a pump-and-dump, a group buys a small, thinly traded stock, then spreads excited messages to push the price up, and sells to the people who believe them. SEBI has acted against several such networks on Telegram, WhatsApp and X.",
      "Warning signs: 'sure shot', 'multibagger', targets with dates, a sudden jump in a small company, and pressure to act today.",
      "In India, anyone who gives buy or sell recommendations for money must be registered with SEBI as a research analyst or investment adviser. Ask for the registration number and check it on SEBI's website.",
    ],
  },
  {
    slug: "tax", group: "Staying safe", title: "Tax when you sell",
    oneLine: "Held for a year or less: 20% on the gain. Longer: 12.5% on gains above ₹1.25 lakh a year.",
    body: [
      "These are the rates for listed shares and equity mutual funds since the July 2024 budget. A 4% cess is added on top, and you pay only when you sell.",
      "Losses can reduce your taxable gains, and unused losses can be carried forward if you file your return on time.",
      "Debt funds are taxed differently, generally at your income tax rate. Rules change in budgets, so check the current ones before you file.",
    ],
    deeper: VARSITY.tax,
  },
  {
    slug: "fno", group: "Staying safe", title: "Futures and options: why most people lose",
    oneLine: "SEBI's own studies found about 9 in 10 individual F&O traders lost money.",
    body: [
      "Futures and options are short-term bets on price moves, with borrowed exposure that magnifies both gains and losses. Many expire worthless within days.",
      "Professional traders with faster systems are on the other side of most retail trades. Transaction costs add up quickly.",
      "StockScout is built for buying and holding, so it doesn't show F&O data.",
    ],
  },
];

export const lessonBySlug = (slug: string) => LESSONS.find((l) => l.slug === slug);

/** The lesson that explains a number, shown beside that number. */
export const METRIC_LESSON: Partial<Record<MetricKey, string>> = {
  pe: "pe", roe: "roe", debt_to_equity: "debt", max_drawdown_1y: "falls", volatility_30d: "falls",
};
