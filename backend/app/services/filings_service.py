"""
Company results and shareholding from NSE's XBRL filings, parsed ourselves (weekly, Saturday run).

Listings come from NSE's website API, which needs a browser-like client (curl_cffi); the XBRL files themselves are
plain downloads from nsearchives. Results since Mar 2025 are "Integrated Filing- Financials"; older quarters are in
the corporates-financial-results feed. Each period uses the consolidated filing when there is one, else standalone.
Facts are matched by their period dates, not context names, so old and new formats, banks, NBFCs and insurers all work.
"""
import asyncio
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta
from decimal import Decimal

import httpx
from loguru import logger
from sqlalchemy import text

XI = "{http://www.xbrl.org/2003/instance}"
XDI = "{http://xbrl.org/2006/xbrldi}"
API = "https://www.nseindia.com/api/"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; StockScout/1.0)"}

# first name present wins; covers companies, banks (InterestEarned, ProfitLossForThePeriod), insurers and NBFCs
DURATION = {
    "revenue": ["RevenueFromOperations", "InterestEarned", "GrossPremiumIncome", "Income"],
    "net_income": ["ProfitOrLossAttributableToOwnersOfParent", "ProfitLossAfterTaxesMinorityInterestAndShareOfProfitLossOfAssociates",
                   "ProfitLossForPeriod", "ProfitLossForThePeriod", "ProfitLossAfterTaxAndExtraordinaryItems", "NetProfitLossForThePeriod"],
    "pbt": ["ProfitBeforeTax", "ProfitLossFromOrdinaryActivitiesBeforeTax", "ProfitLossBeforeTax"],
    "exceptional": ["ExceptionalItemsBeforeTax", "ExceptionalItems"],
    "discontinued": ["ProfitLossFromDiscontinuedOperationsAfterTax"],
    "pbt_pre": ["ProfitBeforeExceptionalItemsAndTax"],
    "finance_costs": ["FinanceCosts"],
    "other_income": ["OtherIncome"],
    "eps": ["BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations", "BasicEarningsPerShareAfterExtraordinaryItems",
            "BasicEarningsLossPerShareFromContinuingOperations", "BasicEarningsPerShare",
            "BasicAndDilutedEPSAfterExtraordinaryItemsNetOfTaxExpenseForThePeriodNotToBeAnnualized"],
}
INSTANT = {
    "equity": ["EquityAttributableToOwnersOfParent", "Equity", "ShareholdersFunds"],
}


def _num(s):
    try:
        x = float(s)
        return x if x == x else None
    except (TypeError, ValueError):
        return None


def _date(s):
    for fmt in ("%Y-%m-%d", "%d-%b-%Y", "%d-%B-%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(s.strip().title() if "-" in s and not s[:4].isdigit() else s.strip(), fmt).date()
        except (ValueError, AttributeError):
            continue
    return None


def _read(xml: bytes):
    """(contexts {id: (start, end, has_dims, members)}, facts {name: [(context id, text)]})."""
    root = ET.fromstring(xml)
    ctx = {}
    for c in root.iter(XI + "context"):
        p = c.find(XI + "period")
        if p is None:
            continue
        inst, start, end = p.find(XI + "instant"), p.find(XI + "startDate"), p.find(XI + "endDate")
        members = [(m.text or "").split(":")[-1] for m in c.iter(XDI + "explicitMember")]
        s = _date(start.text) if start is not None else None
        e = _date((inst if inst is not None else end).text) if (inst is not None or end is not None) else None
        ctx[c.get("id")] = (s, e, bool(members) or c.find(f".//{XDI}typedMember") is not None, members)
    facts = {}
    for el in root:
        cid = el.get("contextRef")
        if cid:
            facts.setdefault(el.tag.split("}")[-1], []).append((cid, (el.text or "").strip()))
    # Older NSE files get contexts wrong: some point facts at contexts (OneD, FourD, OneI) they never declare, others
    # declare the full-year context with the quarter's dates. The reporting-period dates each file states under the
    # same context names are right, so they win; an undeclared ...I context is the period-end instant.
    starts = {cid: _date(v) for cid, v in facts.get("DateOfStartOfReportingPeriod", [])}
    ends = {cid: _date(v) for cid, v in facts.get("DateOfEndOfReportingPeriod", [])}
    last = max((d for d in ends.values() if d), default=None)
    for cid in {c for vals in facts.values() for c, _ in vals}:
        if starts.get(cid) and ends.get(cid):
            ctx[cid] = (starts[cid], ends[cid], *(ctx[cid][2:] if cid in ctx else (False, [])))
        elif cid not in ctx and cid.endswith("I") and last:
            ctx[cid] = (None, last, False, [])
    return ctx, facts


def _first(facts, ctx, names, want, skip_zero=False):
    """First value among `names` in a matching context without dimensions. With skip_zero, a 0 only counts when
    no later name has a real value (some companies file 0 in the owners' line and the profit in the next one)."""
    zero = None
    for n in names:
        for cid, v in facts.get(n, []):
            c = ctx.get(cid)
            if c and not c[2] and want(c) and _num(v) is not None:
                if skip_zero and _num(v) == 0:
                    zero = 0.0
                    continue
                return _num(v)
    return zero


def _excise(facts, ctx, test):
    """Excise duty, filed as an 'other expenses' line described "Excise Duty" (ITC, Reliance). Line contexts are
    named after their period (OneExpenses1D, FourOperatingExpenses01D), so the period's own context gives the dates."""
    desc = {cid for cid, v in facts.get("DescriptionOfOtherExpenses", []) if "excise" in v.lower()}
    total = None
    for cid, v in facts.get("OtherExpenses", []):
        base = "OneD" if cid.startswith("One") else "FourD" if cid.startswith("Four") else cid
        c = ctx.get(base) or ctx.get(cid)
        if cid in desc and c and test(c) and _num(v) is not None:
            total = (total or 0) + _num(v)
    return total


def results_from_xbrl(xml: bytes) -> dict | None:
    """{period_end, basis, quarter: {...}, year: {...} or None} from one results filing."""
    ctx, facts = _read(xml)
    ends = [_date(v) for _, v in facts.get("DateOfEndOfReportingPeriod", [])]
    end = next((d for d in ends if d), None) or max((c[1] for c in ctx.values() if c[1]), default=None)
    if not end:
        return None
    span = lambda lo, hi: (lambda c: c[0] is not None and c[1] == end and lo <= (c[1] - c[0]).days <= hi)
    at_end = lambda c: c[0] is None and c[1] == end

    paid = _first(facts, ctx, ["PaidUpValueOfEquityShareCapital", "PaidUpEquityShareCapital"], lambda c: True)
    face = _first(facts, ctx, ["FaceValueOfEquityShareCapital"], lambda c: True)
    shares = paid / face if paid and face else None

    def period(test):
        row = {k: _first(facts, ctx, names, test, skip_zero=k in ("revenue", "net_income")) for k, names in DURATION.items()}
        if shares and row["eps"]:
            # some companies file a wrong number (or sign) in one profit line; EPS x shares says which line is right
            cands = [v for n in DURATION["net_income"] for v in [_first(facts, ctx, [n], test)] if v]
            if cands:
                row["net_income"] = min(cands, key=lambda v: abs(v - row["eps"] * shares))
        # one-off items: exceptional items plus profit from businesses sold or spun off (e.g. ITC Hotels in 2025)
        disc = row.pop("discontinued")
        if disc:
            row["exceptional"] = (row["exceptional"] or 0) + disc
        if row["eps"] is None and row["net_income"] is not None and shares:
            row["eps"] = round(row["net_income"] / shares, 2)
        # operating profit: before one-offs and tax, interest added back, other income taken out (lenders: see stock_snapshot)
        pre, other = row.pop("pbt_pre"), row.pop("other_income")
        row["op_profit"] = pre + (row["finance_costs"] or 0) - (other or 0) if pre is not None else None
        row["excise"] = _excise(facts, ctx, test)
        return row if row["revenue"] is not None or row["net_income"] is not None else None

    quarter, year = period(span(80, 100)), period(span(350, 380))
    if year:
        # older files tag the full-year cash flow under the quarter context; a 12-month filing has no other reading
        year["operating_cash_flow"] = _first(facts, ctx, ["CashFlowsFromUsedInOperatingActivities"], span(350, 380))             or _first(facts, ctx, ["CashFlowsFromUsedInOperatingActivities"], span(80, 100))
        year["equity"] = _first(facts, ctx, INSTANT["equity"], at_end)
        if year["equity"] is None:  # banks: capital + reserves
            cap, res = _first(facts, ctx, ["Capital", "ShareCapital", "EquityShareCapital"], at_end), _first(facts, ctx, ["ReservesAndSurplus", "OtherEquity"], at_end)
            year["equity"] = cap + res if cap is not None and res is not None else None
        borrow = _first(facts, ctx, ["Borrowings"], at_end)
        if _first(facts, ctx, ["DebtSecurities"], at_end) is not None:
            # finance-company format: debt is spread over borrowings, bonds, subordinated debt and public deposits
            # (banks file differently and their deposits are the business, not borrowing)
            parts = [_first(facts, ctx, [n], at_end) for n in ("Borrowings", "DebtSecurities", "SubordinatedLiabilities", "Deposits")]
            borrow = sum(x for x in parts if x is not None)
        if borrow is None:
            parts = [_first(facts, ctx, [n], at_end) for n in ("BorrowingsCurrent", "BorrowingsNoncurrent")]
            borrow = sum(p for p in parts if p is not None) if any(p is not None for p in parts) else None
        year["total_debt"] = borrow
    if not quarter and not year:
        return None
    basis = next((v.lower() for _, v in facts.get("NatureOfReportStandaloneConsolidated", []) if v), None)
    return {"period_end": end, "basis": basis, "quarter": quarter, "year": year}


SHP_MEMBERS = {
    "promoter": ["ShareholdingOfPromoterAndPromoterGroupMember"],
    "fii": ["InstitutionsForeignMember"],
    "dii": ["InstitutionsDomesticMember"],
    "mutual_funds": ["MutualFundsOrUTIMember"],
    "government": ["GovernmentsMember"],
    "retail": ["ResidentIndividualShareholdersHoldingNominalShareCapitalUpToRsTwoLakhMember",
               "ResidentIndividualShareholdersHoldingNominalShareCapitalInExcessOfRsTwoLakhMember"],
}


def ownership_from_xbrl(xml: bytes) -> dict | None:
    """Stakes as fractions of all shares, and the fraction of the promoter's own shares that is pledged."""
    ctx, facts = _read(xml)

    def by_member(name):
        out = {}
        for cid, v in facts.get(name, []):
            c = ctx.get(cid)
            if c and len(c[3]) == 1 and _num(v) is not None:
                out.setdefault(c[3][0], _num(v))
        return out

    pct = by_member("ShareholdingAsAPercentageOfTotalNumberOfShares")
    total = pct.get("ShareholdingPatternMember")
    if not total:
        return None
    scale = 100.0 if total > 1.5 else 1.0  # some filings use 100, most use 1
    row = {}
    for k, members in SHP_MEMBERS.items():
        vals = [pct[m] for m in members if m in pct]
        row[k] = round(sum(vals) / scale, 6) if vals else None
    if row["promoter"] is None and row["fii"] is None:
        return None
    row["promoter"] = row["promoter"] or 0.0  # no promoter group filed (ITC, some banks): it owns nothing
    shares, pledged = by_member("NumberOfShares"), by_member("NumberOfSharesEncumberedUnderPledged")
    p_shares = shares.get("ShareholdingOfPromoterAndPromoterGroupMember")
    p_pledged = pledged.get("ShareholdingOfPromoterAndPromoterGroupMember")
    row["pledged"] = round(p_pledged / p_shares, 6) if p_shares and p_pledged is not None else (0.0 if p_shares else None)
    return row


def pick_results(integrated: list, old: list, since: date, annual: list = ()) -> list[dict]:
    """
    One filing per period (quarter, and separately the full year from the annual feed): the latest broadcast wins
    (revisions). A company that files consolidated results only ever uses consolidated ones; a period where NSE has
    only its standalone filing is skipped rather than mixed in, since the two aren't comparable.
    """
    cands = []
    for x in integrated:
        if (x.get("type") or "").endswith("Financials") and x.get("xbrl"):
            cands.append(("Q", _date(x.get("qe_Date") or ""), (x.get("consolidated") or "").lower(), x.get("broadcast_Date") or "", x["xbrl"]))
    for kind, feed in (("Q", old), ("A", annual)):
        for x in feed:
            if x.get("xbrl") and str(x["xbrl"]).startswith("http"):
                cands.append((kind, _date(x.get("toDate") or ""), (x.get("consolidated") or "").lower(), x.get("broadCastDate") or "", x["xbrl"]))
    cands = [c for c in cands if c[1] and c[1] >= since]
    any_cons = any(c[2].startswith("consolidated") for c in cands)
    best = {}
    for kind, end, basis, when, url in cands:
        cons = basis.startswith("consolidated")
        if any_cons and not cons:
            continue
        filed = _date(when.split(" ")[0])
        key = (filed or date.min, when)
        if (kind, end) not in best or key > best[(kind, end)][0]:
            best[(kind, end)] = (key, {"period_end": end, "basis": "consolidated" if cons else "standalone", "url": url, "filed_on": filed})
    return [best[k][1] for k in sorted(best, key=lambda k: (k[1], k[0]))]


def pick_shareholding(listing: list, since: date) -> list[dict]:
    best = {}
    for x in listing:
        d, url = _date(x.get("date") or ""), x.get("xbrl")
        if not d or d < since or not url or not str(url).startswith("http"):
            continue
        when = x.get("broadcastDate") or ""
        if d not in best or when > best[d][0]:
            best[d] = (when, {"period_end": d, "url": url})
    return [best[k][1] for k in sorted(best)]


class Nse:
    """NSE website API through a browser-like client; re-opens the session when NSE drops it."""

    def __init__(self):
        from curl_cffi.requests import AsyncSession
        self._new = lambda: AsyncSession(impersonate="chrome", timeout=30)
        self.s = None

    async def _warm(self):
        if self.s:
            await self.s.close()
        self.s = self._new()
        await self.s.get("https://www.nseindia.com/")

    async def get(self, path: str):
        for attempt in range(3):
            if self.s is None or attempt:
                await self._warm()
                await asyncio.sleep(1 + attempt * 2)
            try:
                r = await self.s.get(API + path, headers={"Referer": "https://www.nseindia.com/"})
                if r.status_code == 200 and r.text[:1] in "[{":
                    return r.json()
            except Exception as e:
                logger.debug(f"nse api {path}: {e}")
        raise RuntimeError(f"NSE API unavailable: {path}")

    async def close(self):
        if self.s:
            await self.s.close()


def _dec(v):
    """Floats as exact decimals (92.81 stays 92.81 in a numeric column)."""
    return Decimal(repr(v)) if isinstance(v, float) else v


def _result_rows(sid: int, parsed: dict) -> list[dict]:
    rows = []
    for freq, part in (("quarterly", parsed["quarter"]), ("annual", parsed["year"])):
        if part:
            rows.append({"s": sid, "freq": freq, "pe": parsed["period_end"], "basis": parsed["basis"], "filed": parsed.get("filed_on"), "operating_cash_flow": None,
                         "op_profit": None, "finance_costs": None, "excise": None, "total_debt": None, "equity": None, **{k: _dec(v) for k, v in part.items()}})
    return rows


INSERT_RESULTS = text("""
        insert into stock_financials (stock_id, freq, period_end, revenue, net_income, eps, pbt, exceptional, operating_cash_flow,
          op_profit, finance_costs, excise, total_debt, equity, basis, filed_on, source, updated_at)
        values (:s, :freq, :pe, :revenue, :net_income, :eps, :pbt, :exceptional, :operating_cash_flow, :op_profit, :finance_costs, :excise, :total_debt, :equity, :basis, :filed, 'nse', now())
        on conflict (stock_id, freq, period_end) do update set revenue = excluded.revenue, net_income = excluded.net_income,
          eps = excluded.eps, pbt = excluded.pbt, exceptional = excluded.exceptional,
          op_profit = coalesce(excluded.op_profit, stock_financials.op_profit),
          finance_costs = coalesce(excluded.finance_costs, stock_financials.finance_costs), excise = coalesce(excluded.excise, stock_financials.excise),
          operating_cash_flow = coalesce(excluded.operating_cash_flow, stock_financials.operating_cash_flow),
          total_debt = coalesce(excluded.total_debt, stock_financials.total_debt),
          equity = coalesce(excluded.equity, stock_financials.equity), filed_on = excluded.filed_on, basis = excluded.basis, source = 'nse', updated_at = now()""")

INSERT_OWNERSHIP = text("""
        insert into stock_ownership (stock_id, as_of, insiders, institutions, promoter, fii, dii, mutual_funds, retail, government, pledged, source)
        values (:s, :d, :promoter, :inst, :promoter, :fii, :dii, :mutual_funds, :retail, :government, :pledged, 'nse')
        on conflict (stock_id, as_of) do update set insiders = excluded.insiders, institutions = excluded.institutions,
          promoter = excluded.promoter, fii = excluded.fii, dii = excluded.dii, mutual_funds = excluded.mutual_funds,
          retail = excluded.retail, government = excluded.government, pledged = excluded.pledged, source = 'nse'""")


def _ownership_row(sid: int, as_of: date, row: dict) -> dict:
    inst = round((row["fii"] or 0) + (row["dii"] or 0), 6) if row["fii"] is not None or row["dii"] is not None else None
    return {"s": sid, "d": as_of, "inst": _dec(inst), **{k: _dec(v) for k, v in row.items()}}


async def _download(http: httpx.AsyncClient, sem: asyncio.Semaphore, url: str):
    """File bytes, None when NSE lists a file it never uploaded (404), or the exception."""
    async with sem:
        try:
            r = await http.get(url)
            if r.status_code == 404:
                return None
            r.raise_for_status()
            return r.content
        except Exception as e:
            return e


# Profit / EPS gives the share count, which within a company only moves with splits (adjusted here) and small issues
# or buybacks. Compared with the company's latest four quarters:
#  - off by 20x or more, or profit and EPS of opposite sign: the amounts were filed wrongly (Coromandel's Mar 2026
#    quarter was filed 100x too small). The row becomes 'nse_unusual': kept, but left out of tables and ratios.
#  - off by 5x to 20x: the amounts are fine but the EPS can't be lined up with today's shares (usually a split or
#    bonus our events list misses, e.g. Bajaj Finance 2025), so only that EPS is cleared.
# A revised filing arrives under a new URL, is stored as 'nse' again and is re-checked.
CHECK_SHARES = """
    with sp as (
      select f.stock_id, f.freq, f.period_end,
             f.net_income / (f.eps / coalesce((
               select exp(sum(ln(e.amount))) from stock_events e
               where e.stock_id = f.stock_id and e.kind = 'split' and e.amount > 0
                 and e.event_date > coalesce(f.filed_on, f.period_end + 45)), 1)) as shares
      from stock_financials f
      where f.source = 'nse' and abs(f.eps) >= 1 and f.net_income <> 0
    ),
    recent as (
      select stock_id, shares, row_number() over (partition by stock_id order by period_end desc) as rn
      from sp where freq = 'quarterly'
    ),
    ref as (
      select stock_id, percentile_cont(0.5) within group (order by shares) as m
      from recent where rn <= 4 and shares > 0 group by stock_id having count(*) >= 2
    ),
    bad as (
      select sp.*, sp.shares / ref.m as ratio from sp join ref on ref.stock_id = sp.stock_id
    )
"""
FLAG_UNUSUAL = text(CHECK_SHARES + """
    update stock_financials f set source = 'nse_unusual' from bad
    where f.stock_id = bad.stock_id and f.freq = bad.freq and f.period_end = bad.period_end and f.source = 'nse'
      and (bad.ratio <= 0 or bad.ratio not between 0.05 and 20)""")
CLEAR_EPS = text(CHECK_SHARES + """
    update stock_financials f set eps = null from bad
    where f.stock_id = bad.stock_id and f.freq = bad.freq and f.period_end = bad.period_end and f.source = 'nse'
      and bad.ratio between 0.05 and 20 and bad.ratio not between 0.2 and 5""")


async def sync_filings(db, years: int = 5, limit: int | None = None, pause: float = 0.4) -> dict:
    """List each Nifty 500 company's filings, parse the ones we haven't yet, store results and shareholding."""
    stocks = (await db.execute(text("select id, ticker from stocks where is_index_member and ticker like '%.NS' order by id"))).all()
    if limit:
        stocks = stocks[:limit]
    done = {u for (u,) in (await db.execute(text("select url from filings where status in ('ok', 'empty')"))).all()}
    since = date.today() - timedelta(days=365 * years + 100)
    sem = asyncio.Semaphore(8)  # parallel downloads from nsearchives (a plain file server)
    nse, stats = Nse(), {"companies": 0, "results": 0, "shareholding": 0, "errors": 0, "listing_failed": 0}
    async with httpx.AsyncClient(timeout=60, headers=HEADERS, follow_redirects=True) as http:
        try:
            for i, (sid, ticker) in enumerate(stocks):
                sym = ticker.removesuffix(".NS").replace("&", "%26")
                try:
                    integrated = (await nse.get(f"integrated-filing-results?index=equities&symbol={sym}&size=100")).get("data") or []
                    await asyncio.sleep(pause)
                    old = await nse.get(f"corporates-financial-results?index=equities&symbol={sym}&period=Quarterly")
                    await asyncio.sleep(pause)
                    shp = await nse.get(f"corporate-share-holdings-master?index=equities&symbol={sym}")
                    await asyncio.sleep(pause)
                    # 2023 to early 2025: full-year numbers sit in a separate annual feed, not in the March quarter file
                    annual = await nse.get(f"corporates-financial-results?index=equities&symbol={sym}&period=Annual")
                    await asyncio.sleep(pause)
                except Exception as e:
                    logger.warning(f"filings {ticker}: {e}")
                    stats["listing_failed"] += 1
                    continue
                todo = [("results", f) for f in pick_results(integrated, old if isinstance(old, list) else [], since, annual if isinstance(annual, list) else [])] + \
                       [("shareholding", f) for f in pick_shareholding(shp if isinstance(shp, list) else [], since)]
                todo = [(k, f) for k, f in todo if f["url"] not in done]
                bodies = await asyncio.gather(*(_download(http, sem, f["url"]) for _, f in todo))
                results, owners, marks = [], [], []
                for (kind, f), body in zip(todo, bodies):
                    status = "empty"  # listed but never uploaded (404) or nothing usable: not retried
                    try:
                        if isinstance(body, Exception):
                            raise body
                        if body is not None and kind == "results":
                            parsed = results_from_xbrl(body)
                            if parsed:
                                results += _result_rows(sid, {**parsed, "period_end": parsed["period_end"] or f["period_end"],
                                                              "basis": parsed["basis"] or f["basis"], "filed_on": f.get("filed_on")})
                                status, stats["results"] = "ok", stats["results"] + 1
                        elif body is not None:
                            row = ownership_from_xbrl(body)
                            if row:
                                owners.append(_ownership_row(sid, f["period_end"], row))
                                status, stats["shareholding"] = "ok", stats["shareholding"] + 1
                    except Exception as e:
                        logger.warning(f"filing {ticker} {f['url']}: {e}")
                        status, stats["errors"] = "error", stats["errors"] + 1
                    marks.append({"u": f["url"], "s": sid, "k": kind, "d": f["period_end"], "b": f.get("basis"), "st": status})
                # one batch per company, oldest first so later filings win; if it fails nothing is marked done
                try:
                    if results:
                        await db.execute(INSERT_RESULTS, results)
                    if owners:
                        await db.execute(INSERT_OWNERSHIP, owners)
                    if marks:
                        await db.execute(text("""
                            insert into filings (url, stock_id, kind, period_end, basis, status) values (:u, :s, :k, :d, :b, :st)
                            on conflict (url) do update set status = excluded.status, parsed_at = now()"""), marks)
                    await db.commit()
                except Exception as e:
                    logger.warning(f"filings {ticker}: could not store: {e}")
                    await db.rollback()
                    stats["errors"] += 1
                stats["companies"] += 1
                if i % 50 == 0:
                    logger.info(f"filings: {i}/{len(stocks)} {stats}")
        finally:
            await nse.close()
    stats["unusual"] = (await db.execute(FLAG_UNUSUAL)).rowcount
    stats["eps_cleared"] = (await db.execute(CLEAR_EPS)).rowcount
    await db.commit()
    return stats
