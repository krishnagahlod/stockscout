// Mutual funds: AMFI's many category names folded into plain groups a first-time investor recognises.
export type Fund = {
  scheme_code: number; name: string; amc: string | null; category: string | null;
  nav: number | null; nav_date: string | null;
  ret_1y: number | null; ret_3y: number | null; ret_5y: number | null; worst_fall_5y: number | null;
};

export type FundGroup = { id: string; title: string; holds: string; ups: string; horizon: string; test: (c: string) => boolean };

// order matters: the first match wins
export const FUND_GROUPS: FundGroup[] = [
  { id: "parking", title: "Parking money (liquid and overnight)", holds: "Very short loans to governments, banks and large companies.", ups: "Small, steady moves", horizon: "Days to months", test: (c) => /liquid|overnight|money market|ultra short/.test(c) },
  { id: "index", title: "Index funds", holds: "Every company in an index, like the Nifty 50, in the same proportions. No manager picking stocks, so fees are usually low.", ups: "Moves with the market", horizon: "5 years or more", test: (c) => /index/.test(c) && !/debt/.test(c) },
  { id: "elss", title: "Tax-saving funds (ELSS)", holds: "Shares of many companies. Money is locked in for 3 years; under the old tax regime it can reduce your taxable income.", ups: "Big ups and downs", horizon: "5 years or more", test: (c) => /elss/.test(c) },
  { id: "large", title: "Large companies", holds: "Mostly India's 100 biggest companies, picked by a fund manager.", ups: "Ups and downs", horizon: "5 years or more", test: (c) => /large cap fund/.test(c) },
  { id: "flexi", title: "Mixed sizes (flexi, multi, focused, value)", holds: "Companies of all sizes; the manager decides the mix.", ups: "Big ups and downs", horizon: "5 years or more", test: (c) => /flexi|multi cap|large & mid|focused|contra|value|dividend yield/.test(c) },
  { id: "midsmall", title: "Mid and small companies", holds: "Medium and small companies, which can grow faster and fall harder.", ups: "Very big ups and downs", horizon: "7 years or more", test: (c) => /mid cap|small cap/.test(c) },
  { id: "thematic", title: "Industry and theme funds", holds: "One industry or theme, like banks, technology or infrastructure.", ups: "Very big ups and downs", horizon: "7 years or more", test: (c) => /sectoral|thematic/.test(c) && !/debt|income/.test(c) },
  { id: "hybrid", title: "Shares and bonds together (hybrid)", holds: "A mix of shares and loans; some also hold gold.", ups: "Medium ups and downs", horizon: "3 years or more", test: (c) => /hybrid|asset allocation|balanced|equity savings|arbitrage/.test(c) },
  { id: "global", title: "International and fund-of-funds", holds: "Other funds, often investing abroad or in gold.", ups: "Depends on what they hold", horizon: "5 years or more", test: (c) => /fof|fund of funds|overseas/.test(c) },
  { id: "goal", title: "Goal-based (retirement, children)", holds: "Usually a mix of shares and loans, with a lock-in until a goal or age.", ups: "Medium ups and downs", horizon: "Until the goal", test: (c) => /children|retirement|life cycle/.test(c) },
  { id: "debt", title: "Bonds and other loans (debt)", holds: "Loans to governments and companies, for longer than parking funds.", ups: "Smaller moves, but not risk-free", horizon: "1 to 5 years", test: () => true },
];

export function groupOf(category: string | null): FundGroup {
  const c = (category ?? "").toLowerCase();
  return FUND_GROUPS.find((g) => g.test(c)) ?? FUND_GROUPS[FUND_GROUPS.length - 1];
}
