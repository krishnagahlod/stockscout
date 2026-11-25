# StockScout UI and navigation plan

*Draft for review, 25 Nov 2026. Nothing here is built yet.*

The goal from the v2 plan: simple on top, depth for those who want it. Every screen opens with one sentence a beginner can read, then a few explained cards, and the full detail only behind "Go deeper".

## What's wrong today (checked on an iPhone-sized screen)

| Page | Length on a phone | Problem |
| --- | --- | --- |
| Market today | 8 screens | Seven full panels in a row. The one-line summary is there, but everything after it has equal weight. |
| Stock page | 8 screens | No one-line answer at the top; every number, results, owners, peers and news on one long scroll. |
| Mutual funds | 4 screens | A long list before any guidance. |
| Sources | 6 screens | Fine for a reference page, but reached only from a small footer link. |
| Home | under 2 screens | Two cards, but no clear "what can I do here" for the three kinds of student. |

Navigation:

- Nine items in one flat list, hidden behind a ☰ menu on phones. Compare isn't in the menu at all.
- On phones, the disclaimer bar and the header take about a fifth of the screen on every page.
- Sign out sits in the header next to search, one tap from an accident.

## Proposed navigation

**Phones: a bottom tab bar with four tabs plus More** (what most Indian finance apps use, reachable with a thumb):

```
┌────────────────────────────────────┐
│  StockScout              🔍        │  slim header: name and search only
│                                    │
│            (page)                  │
│                                    │
├──────┬────────┬───────┬──────┬─────┤
│ Home │ Market │ Check │ Mine │ More│
└──────┴────────┴───────┴──────┴─────┘
```

- **Home:** where to begin, and what changed for you.
- **Market:** Market today, mutual funds and Compare, as tabs at the top of the page.
- **Check:** Check a tip, and search any company.
- **Mine:** Portfolio and Practice, as two tabs.
- **More:** Ideas, Learn, Start here, Where our numbers come from, Install the app, Sign out.

**Desktop: the same five groups in the sidebar**, with sub-items under each instead of nine equal items.

The disclaimer bar shows once. After it's closed, it becomes a one-line note in the More menu and at the foot of each page.

## Page by page

Each page gets the same three layers. Layer 3 is always a single "Go deeper" section at the bottom, closed by default.

### Home

1. **Glance:** "Nifty 50 rose 0.6% on 23 Nov. Your holdings are worth ₹42,300." With no holdings, the second sentence is left out.
2. **Three doors**, one per kind of student, as three equal cards:
   - "New to this? Start here."
   - "Got a tip? Check it."
   - "Have an idea? Describe it."
3. **For you:** results or dividends coming up for what you own, and your saved ideas. This only appears when there's something to show.

### Market today

1. **Glance:** today's sentence (exists).
2. **Three cards:** the main indices; industries best to worst; and "what the market costs" (one line with its chart).
3. **Go deeper:** big investors' buying and selling, biggest movers, results due this week, breadth, VIX and gold.

On a phone this goes from about 8 screens to about 3.

### Stock page

1. **Glance:** one plain sentence built from the numbers, e.g. "Profitable, borrows little, priced near its own 5-year middle." Then the price with its 1-day and 1-year moves.
2. **Three cards:**
   - Business, price and trend, each with its word label (exists).
   - The 1-year chart and 52-week range.
   - The worst-case line.
3. **Tabs instead of one long scroll:** Overview, Results, Owners, All numbers, News.

The AI "explain this company in 3 lines" would sit under the glance sentence once built.

### Funds

1. **Glance:** "Most people start with an index fund. Here are the three cheapest that track the Nifty 50."
2. **Plain groups as cards:** index funds, large-company funds, gold and short-term (exist).
3. The full searchable list moves below the cards.

### Portfolio and Practice

One page with two tabs, "Real" and "Practice", since they're the same idea. Practice gets a clear "pretend money" badge so the two are never confused.

## Look and feel

- **Keep what works:** the indigo brand, the rounded cards, the green and red with ▲ ▼ arrows, and the plain-English labels.
- **Fewer cards per screen:** one primary card per layer instead of a stack of equal ones.
- **One type scale:**
  - Page sentence large.
  - Card titles medium.
  - Everything else body size.
- **Numbers line up:** tabular figures, ₹ and Cr written the same way everywhere, and the data date in one place per page.
- **Touch targets** of at least 44 px, visible keyboard focus, and no information carried by colour alone (already true for changes).

## Build order (about 3 to 4 days)

1. Navigation: bottom tabs on phones, grouped sidebar on desktop, slimmer header and disclaimer.
2. Home: glance, three doors, "for you".
3. Market today: three layers.
4. Stock page: glance sentence and tabs.
5. Funds, and Portfolio with Practice merged.
6. A last pass over every page at phone width and desktop.

## Decisions for you

1. Bottom tab bar on phones (recommended), or keep the ☰ menu but shorter?
2. Merge Practice into Portfolio as a tab, or keep it separate?
3. Anything from the earlier ideas we discussed that this misses?
