"""Run: python tests/test_filings.py"""
import os
import sys
from datetime import date

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.filings_service import ownership_from_xbrl, pick_results, pick_shareholding, results_from_xbrl

HEAD = '<xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:xbrldi="http://xbrl.org/2006/xbrldi" xmlns:c="http://x/in-capmkt">'


def ctx(cid, start=None, end=None, instant=None, member=None):
    period = f"<xbrli:instant>{instant}</xbrli:instant>" if instant else f"<xbrli:startDate>{start}</xbrli:startDate><xbrli:endDate>{end}</xbrli:endDate>"
    seg = f'<xbrli:segment><xbrldi:explicitMember dimension="c:CategoryOfShareholdersAxis">c:{member}</xbrldi:explicitMember></xbrli:segment>' if member else ""
    return f'<xbrli:context id="{cid}"><xbrli:entity><xbrli:identifier scheme="s">1</xbrli:identifier>{seg}</xbrli:entity><xbrli:period>{period}</xbrli:period></xbrli:context>'


def fact(name, cid, v):
    return f'<c:{name} contextRef="{cid}">{v}</c:{name}>'


# a Q4 company filing: quarter, full year, balance sheet; one-off gain from a demerged business
q4 = HEAD + ctx("OneD", "2026-01-01", "2026-03-31") + ctx("FourD", "2025-04-01", "2026-03-31") + ctx("OneI", instant="2026-03-31") + \
    ctx("Seg", "2026-01-01", "2026-03-31", member="X") + "".join([
        fact("DateOfEndOfReportingPeriod", "OneD", "2026-03-31"), fact("NatureOfReportStandaloneConsolidated", "OneD", "Consolidated"),
        fact("RevenueFromOperations", "Seg", "1"),  # a segment figure must never be read as the company's
        fact("RevenueFromOperations", "OneD", "2000"), fact("RevenueFromOperations", "FourD", "8000"),
        fact("ProfitOrLossAttributableToOwnersOfParent", "OneD", "300"), fact("ProfitLossForPeriod", "OneD", "320"),
        fact("ProfitOrLossAttributableToOwnersOfParent", "FourD", "1500"),
        fact("ProfitLossFromDiscontinuedOperationsAfterTax", "FourD", "400"), fact("ExceptionalItemsBeforeTax", "FourD", "-50"),
        fact("BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations", "OneD", "3.0"),
        fact("CashFlowsFromUsedInOperatingActivities", "FourD", "900"),
        fact("EquityAttributableToOwnersOfParent", "OneI", "5000"),
        fact("BorrowingsCurrent", "OneI", "100"), fact("BorrowingsNoncurrent", "OneI", "250"),
    ]) + "</xbrli:xbrl>"
r = results_from_xbrl(q4.encode())
assert r["period_end"] == date(2026, 3, 31) and r["basis"] == "consolidated"
assert r["quarter"] == {"revenue": 2000, "net_income": 300, "pbt": None, "exceptional": None, "eps": 3.0}, r["quarter"]
y = r["year"]
assert (y["revenue"], y["net_income"], y["exceptional"]) == (8000, 1500, 350), y
assert (y["operating_cash_flow"], y["equity"], y["total_debt"]) == (900, 5000, 350), y
assert y["eps"] is None

# a bank's half-year filing: different names, no full year, EPS worked out from the share count
bank = HEAD + ctx("OneD", "2026-07-01", "2026-09-30") + "".join([
    fact("InterestEarned", "OneD", "950"), fact("Income", "OneD", "1290"), fact("ProfitLossForThePeriod", "OneD", "207"),
    fact("PaidUpValueOfEquityShareCapital", "OneD", "100"), fact("FaceValueOfEquityShareCapital", "OneD", "1"),
]) + "</xbrli:xbrl>"
r = results_from_xbrl(bank.encode())
assert r["quarter"]["revenue"] == 950 and r["quarter"]["net_income"] == 207 and r["quarter"]["eps"] == 2.07 and r["year"] is None, r

# an older file whose facts point at contexts it never declares
broken = HEAD + "".join([
    fact("DateOfStartOfReportingPeriod", "OneD", "2021-01-01"), fact("DateOfEndOfReportingPeriod", "OneD", "2021-03-31"),
    fact("DateOfStartOfReportingPeriod", "FourD", "2020-04-01"), fact("DateOfEndOfReportingPeriod", "FourD", "2021-03-31"),
    fact("RevenueFromOperations", "OneD", "154"), fact("RevenueFromOperations", "FourD", "531"),
    fact("ProfitLossForPeriod", "FourD", "133"), fact("CashFlowsFromUsedInOperatingActivities", "OneD", "125"),
]) + "</xbrli:xbrl>"
r = results_from_xbrl(broken.encode())
assert r["quarter"]["revenue"] == 154 and r["year"]["revenue"] == 531 and r["year"]["operating_cash_flow"] == 125, r
# ...and one that declares the full-year context with the quarter's dates
mislabelled = broken.replace(HEAD, HEAD + ctx("FourD", "2021-01-01", "2021-03-31"))
r = results_from_xbrl(mislabelled.encode())
assert r["year"] and r["year"]["revenue"] == 531, r

# shareholding: stakes by group, pledge as a share of the promoter's own holding
I = "2026-09-30"
shp = HEAD + "".join(ctx(m, instant=I, member=m) for m in [
    "ShareholdingPatternMember", "ShareholdingOfPromoterAndPromoterGroupMember", "InstitutionsForeignMember",
    "InstitutionsDomesticMember", "MutualFundsOrUTIMember",
    "ResidentIndividualShareholdersHoldingNominalShareCapitalUpToRsTwoLakhMember",
    "ResidentIndividualShareholdersHoldingNominalShareCapitalInExcessOfRsTwoLakhMember"]) + "".join([
    fact("ShareholdingAsAPercentageOfTotalNumberOfShares", "ShareholdingPatternMember", "1"),
    fact("ShareholdingAsAPercentageOfTotalNumberOfShares", "ShareholdingOfPromoterAndPromoterGroupMember", "0.443"),
    fact("ShareholdingAsAPercentageOfTotalNumberOfShares", "InstitutionsForeignMember", "0.2623"),
    fact("ShareholdingAsAPercentageOfTotalNumberOfShares", "InstitutionsDomesticMember", "0.1134"),
    fact("ShareholdingAsAPercentageOfTotalNumberOfShares", "MutualFundsOrUTIMember", "0.0589"),
    fact("ShareholdingAsAPercentageOfTotalNumberOfShares", "ResidentIndividualShareholdersHoldingNominalShareCapitalUpToRsTwoLakhMember", "0.0347"),
    fact("ShareholdingAsAPercentageOfTotalNumberOfShares", "ResidentIndividualShareholdersHoldingNominalShareCapitalInExcessOfRsTwoLakhMember", "0.036"),
    fact("NumberOfShares", "ShareholdingOfPromoterAndPromoterGroupMember", "1000"),
    fact("NumberOfSharesEncumberedUnderPledged", "ShareholdingOfPromoterAndPromoterGroupMember", "125"),
]) + "</xbrli:xbrl>"
o = ownership_from_xbrl(shp.encode())
assert o == {"promoter": 0.443, "fii": 0.2623, "dii": 0.1134, "mutual_funds": 0.0589, "government": None, "retail": 0.0707, "pledged": 0.125}, o
# percentages filed out of 100, and a company with no promoter group
o = ownership_from_xbrl(shp.replace(">1<", ">100<").replace(">0.2623<", ">26.23<").replace(
    'contextRef="ShareholdingOfPromoterAndPromoterGroupMember">0.443', 'contextRef="Nobody">0').encode())
assert o["fii"] == 0.2623 and o["promoter"] == 0.0, o

# choosing filings: consolidated beats standalone, a later revision beats the original, old periods are skipped
integrated = [
    {"type": "Integrated Filing- Financials", "qe_Date": "30-SEP-2026", "consolidated": "Standalone", "broadcast_Date": "02-Nov-2026 18:55:59", "xbrl": "s.xml"},
    {"type": "Integrated Filing- Financials", "qe_Date": "30-SEP-2026", "consolidated": "Consolidated", "broadcast_Date": "02-Nov-2026 18:55:59", "xbrl": "c.xml"},
    {"type": "Integrated Filing- Financials", "qe_Date": "30-SEP-2026", "consolidated": "Consolidated", "broadcast_Date": "09-Nov-2026 10:00:00", "xbrl": "c2.xml"},
    {"type": "Integrated Filing- Governance", "qe_Date": "30-SEP-2026", "xbrl": "g.xml"},
]
old = [{"toDate": "31-Dec-2024", "consolidated": "Non-Consolidated", "broadCastDate": "06-Feb-2025 19:20:20", "xbrl": "https://a/old.xml"},
       {"toDate": "31-Dec-2015", "consolidated": "Consolidated", "broadCastDate": "06-Feb-2016 19:20:20", "xbrl": "https://a/ancient.xml"}]
picks = pick_results(integrated, old, date(2021, 1, 1))
# the company files consolidated results, so Dec 2024 (standalone only on NSE) is skipped, not mixed in
assert [(p["period_end"], p["basis"], p["url"]) for p in picks] == [(date(2026, 9, 30), "consolidated", "c2.xml")], picks
# a standalone-only company keeps its standalone filings; the annual feed adds a separate full-year entry
solo = pick_results([], [{"toDate": "31-Mar-2024", "consolidated": "Non-Consolidated", "broadCastDate": "06-May-2024 19:20:20", "xbrl": "https://a/q4.xml"}],
                    date(2021, 1, 1), [{"toDate": "31-Mar-2024", "consolidated": "Non-Consolidated", "broadCastDate": "06-May-2024 19:20:20", "xbrl": "https://a/fy.xml"}])
assert [(p["period_end"], p["basis"], p["url"]) for p in solo] == [
    (date(2024, 3, 31), "standalone", "https://a/fy.xml"), (date(2024, 3, 31), "standalone", "https://a/q4.xml")], solo
shps = pick_shareholding([{"date": "30-SEP-2026", "xbrl": "https://a/1.xml", "broadcastDate": "13-OCT-2026 17:01:44"},
                          {"date": "30-JUN-2020", "xbrl": "https://a/0.xml"}, {"date": "30-JUN-2026", "xbrl": None}], date(2021, 1, 1))
assert shps == [{"period_end": date(2026, 9, 30), "url": "https://a/1.xml"}], shps
print("filings: ok")
