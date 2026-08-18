"""Deterministic rule engine: applies JSON strategy filters to the stock universe."""

import operator
from typing import Optional

from loguru import logger
from sqlalchemy import select, and_, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import Stock, TechnicalFeature, Fundamental
from app.models.strategy_schemas import (
    StrategyRules,
    FilterCondition,
    StockScore,
    ScoredUniverse,
    MetricInfo,
)

# Operator mapping
OPS = {
    ">": operator.gt,
    "<": operator.lt,
    ">=": operator.ge,
    "<=": operator.le,
    "==": operator.eq,
}

# Maps user-facing metric names to (source_table, column_name)
# source_table: "stock", "technical", "fundamental"
METRIC_MAP: dict[str, tuple[str, str]] = {
    # Valuation
    "trailing_pe": ("fundamental", "pe"),
    "price_to_book": ("fundamental", "pb"),
    "dividend_yield": ("fundamental", "dividend_yield"),
    # Fundamental quality
    "roe": ("fundamental", "roe"),
    "roce": ("fundamental", "roce"),
    "debt_to_equity": ("fundamental", "debt_to_equity"),
    "gross_margin": ("fundamental", "gross_margin"),
    "operating_margin": ("fundamental", "operating_margin"),
    "net_margin": ("fundamental", "net_margin"),
    "revenue": ("fundamental", "revenue"),
    "eps": ("fundamental", "eps"),
    # Technical
    "rsi_14": ("technical", "rsi_14"),
    "sma_50": ("technical", "sma_50"),
    "sma_200": ("technical", "sma_200"),
    "momentum_12m": ("technical", "momentum_12m"),
    "volatility_30d": ("technical", "volatility_30d"),
    "volatility_90d": ("technical", "volatility_90d"),
    "max_drawdown_1y": ("technical", "max_drawdown_1y"),
    "sharpe_trailing": ("technical", "sharpe_trailing"),
    "atr_14": ("technical", "atr_14"),
    # Risk/other from fundamental
    "beta": ("fundamental", "beta"),
    "avg_volume_20d": ("fundamental", "avg_volume_20d"),
# Stock-level
    "market_cap": ("fundamental", "market_cap"),
}

# Metrics where a lower value is considered better for standard ranking
LOWER_IS_BETTER_METRICS = {
    "trailing_pe",
    "price_to_book",
    "debt_to_equity",
    "volatility_30d",
    "volatility_90d",
    "beta"
}

# Human-readable metric info for the UI
METRIC_INFO: list[MetricInfo] = [
    MetricInfo(name="dividend_yield", label="Dividend Yield", category="valuation", description="Annual dividend yield (enter 3 for 3%)"),
    MetricInfo(name="trailing_pe", label="Trailing P/E", category="valuation", description="Trailing price-to-earnings ratio"),
    MetricInfo(name="price_to_book", label="Price to Book", category="valuation", description="Price to book value ratio"),
    MetricInfo(name="roe", label="ROE", category="fundamental", description="Return on equity (enter 15 for 15%)"),
    MetricInfo(name="roce", label="ROCE", category="fundamental", description="Return on capital employed"),
    MetricInfo(name="debt_to_equity", label="Debt/Equity", category="fundamental", description="Debt to equity ratio"),
    MetricInfo(name="gross_margin", label="Gross Margin", category="fundamental", description="Gross profit margin (enter 30 for 30%)"),
    MetricInfo(name="operating_margin", label="Operating Margin", category="fundamental", description="Operating profit margin (enter 20 for 20%)"),
    MetricInfo(name="net_margin", label="Net Margin", category="fundamental", description="Net profit margin (enter 10 for 10%)"),
    MetricInfo(name="eps", label="EPS", category="fundamental", description="Earnings per share"),
    MetricInfo(name="revenue_cagr_3y", label="Revenue CAGR 3Y", category="fundamental", description="3-year revenue compound annual growth rate"),
    MetricInfo(name="rsi_14", label="RSI (14)", category="technical", description="14-day relative strength index (0-100)"),
    MetricInfo(name="momentum_12m", label="Momentum 12M", category="technical", description="12-month price momentum (enter 20 for 20%)"),
    MetricInfo(name="volatility_90d", label="Volatility 90D", category="risk", description="90-day annualized volatility (enter 30 for 30%)"),
    MetricInfo(name="volatility_30d", label="Volatility 30D", category="risk", description="30-day annualized volatility (enter 25 for 25%)"),
    MetricInfo(name="beta", label="Beta", category="risk", description="Beta vs Nifty 50 (1.0 = market)"),
    MetricInfo(name="max_drawdown_1y", label="Max Drawdown 1Y", category="risk", description="Max drawdown trailing 1Y (enter -20 for -20%)"),
    MetricInfo(name="sharpe_trailing", label="Sharpe Ratio", category="risk", description="Trailing 252-day Sharpe ratio"),
    MetricInfo(name="market_cap", label="Market Cap (Cr)", category="fundamental", description="Market capitalization in crores"),
]


class RuleEngine:
    """Apply JSON strategy rules to filter and rank stocks."""

    async def run(self, rules: StrategyRules, db: AsyncSession) -> ScoredUniverse:
        """Full pipeline: load universe -> filter -> rank -> select top N."""
        if getattr(rules, 'strategy_type', None) == 'custom':
            return await self._run_custom(rules, db)

        # 1. Load all stocks with their latest features
        universe = await self._load_universe(db)
        total_count = len(universe)

        # 2. Apply filters
        filtered = self._apply_filters(universe, rules.filters)

        # 3. Rank
        if rules.ranking:
            if rules.ranking.weights:
                filtered = self._rank_by_weights(filtered, rules.ranking.weights)
            elif rules.ranking.metric:
                filtered = self._rank(filtered, rules.ranking.metric, rules.ranking.order)
                # Assign a simple fallback score for basic ranking
                for i, row in enumerate(filtered):
                    row["_composite_score"] = round(100 - (i / max(len(filtered), 1) * 100), 1)

        # 4. Select top N with 40% Sector Diversification Limit
        top_n = rules.selection.top_n if rules.selection else 30
        max_per_sector = max(1, int(top_n * 0.4))
        
        selected = []
        sector_counts = {}
        for row in filtered:
            if len(selected) >= top_n:
                break
                
            sector = row.get("sector")
            if sector:
                if sector_counts.get(sector, 0) >= max_per_sector:
                    continue  # Skip, sector limit reached
                sector_counts[sector] = sector_counts.get(sector, 0) + 1
            
            selected.append(row)

        # 5. Position Sizing
        position_sizing = getattr(rules, "position_sizing", "equal")
        weights_map = {}
        if position_sizing == "inverse_volatility":
            inv_vols = {}
            for row in selected:
                # use 90d vol if available, fallback to 30d, fallback to 0.30 (30% annualized)
                vol = row.get("volatility_90d") or row.get("volatility_30d")
                if not vol or vol <= 0:
                    vol = 0.30
                inv_vols[row["symbol"]] = 1.0 / vol
            
            total_inv_vol = sum(inv_vols.values())
            for symbol, iv in inv_vols.items():
                weights_map[symbol] = round(iv / total_inv_vol, 4) if total_inv_vol > 0 else (1.0 / len(selected))
        elif position_sizing == "risk_parity":
            inv_risks = {}
            for row in selected:
                vol = row.get("volatility_90d") or row.get("volatility_30d") or 0.30
                beta = row.get("beta") if row.get("beta") is not None else 1.0
                if vol <= 0:
                    vol = 0.30
                # Risk contribution estimate combining volatility and market sensitivity (beta)
                risk_factor = vol * max(0.5, (0.7 + 0.3 * abs(beta)))
                inv_risks[row["symbol"]] = 1.0 / risk_factor
            
            total_inv_risk = sum(inv_risks.values())
            for symbol, ir in inv_risks.items():
                weights_map[symbol] = round(ir / total_inv_risk, 4) if total_inv_risk > 0 else (1.0 / len(selected))
        else:
            # equal weight
            for row in selected:
                weights_map[row["symbol"]] = round(1.0 / len(selected), 4) if len(selected) > 0 else 0

        # 6. Build scored output — collect unique metric names from filters and weights
        filter_metrics = list(dict.fromkeys(c.metric for c in rules.filters))
        if rules.ranking and rules.ranking.weights:
            filter_metrics.extend([w.metric for w in rules.ranking.weights if w.metric not in filter_metrics])
            
        stocks = []
        for i, row in enumerate(selected):
            stocks.append(StockScore(
                symbol=row["symbol"],
                name=row["name"],
                sector=row.get("sector"),
                composite_score=row.get("_composite_score", round(100 - (i / max(len(selected), 1) * 100), 1)),
                position_weight=weights_map.get(row["symbol"], 0),
                metric_values={m: row.get(m) for m in filter_metrics},
            ))

        return ScoredUniverse(
            strategy_name=rules.name,
            total_universe=total_count,
            filtered_count=len(filtered),
            stocks=stocks,
        )

    async def _run_custom(self, rules: StrategyRules, db: AsyncSession) -> ScoredUniverse:
        """For custom portfolios, bypass filter/rank and directly return the selected stocks."""
        stocks_list = getattr(rules, 'stocks', [])
        symbols = [s.symbol for s in stocks_list]
        if not symbols:
            return ScoredUniverse(
                strategy_name=rules.name,
                total_universe=0,
                filtered_count=0,
                stocks=[],
            )

        # Load these specific stocks
        result = await db.execute(select(Stock).where(Stock.symbol.in_(symbols)))
        stock_models = result.scalars().all()
        stock_map = {s.symbol: s for s in stock_models}

        # Position Sizing
        position_sizing = getattr(rules, "position_sizing", "equal")
        weights_map = {}
        if position_sizing == "custom":
            for s in stocks_list:
                weights_map[s.symbol] = s.weight if getattr(s, 'weight', None) is not None else (1.0 / len(symbols))
        else:
            for sym in symbols:
                weights_map[sym] = 1.0 / len(symbols)

        stocks = []
        for sym in symbols:
            st = stock_map.get(sym)
            if not st:
                continue
            stocks.append(StockScore(
                symbol=st.symbol,
                name=st.name,
                sector=st.sector,
                composite_score=100.0,
                position_weight=weights_map.get(sym, 0),
                metric_values={},
            ))

        return ScoredUniverse(
            strategy_name=rules.name,
            total_universe=len(symbols),
            filtered_count=len(symbols),
            stocks=stocks,
        )

    async def _load_universe(self, db: AsyncSession) -> list[dict]:
        """Load all stocks with their latest technical and fundamental data."""
        # Get all Nifty 500 stocks
        result = await db.execute(select(Stock).where(Stock.is_nifty500 == True))
        stocks = result.scalars().all()
        stock_ids = [s.id for s in stocks]

        if not stock_ids:
            return []

        from sqlalchemy import func, and_

        # Get latest technical features using max date subquery
        tech_subq = (
            select(TechnicalFeature.stock_id, func.max(TechnicalFeature.date).label("max_date"))
            .where(TechnicalFeature.stock_id.in_(stock_ids))
            .group_by(TechnicalFeature.stock_id)
            .subquery()
        )
        tech_result = await db.execute(
            select(TechnicalFeature)
            .join(tech_subq, and_(TechnicalFeature.stock_id == tech_subq.c.stock_id, TechnicalFeature.date == tech_subq.c.max_date))
        )
        techs = {t.stock_id: t for t in tech_result.scalars().all()}

        # Latest fundamentals using max date subquery
        fund_subq = (
            select(Fundamental.stock_id, func.max(Fundamental.as_of_date).label("max_date"))
            .where(Fundamental.stock_id.in_(stock_ids))
            .group_by(Fundamental.stock_id)
            .subquery()
        )
        fund_result = await db.execute(
            select(Fundamental)
            .join(fund_subq, and_(Fundamental.stock_id == fund_subq.c.stock_id, Fundamental.as_of_date == fund_subq.c.max_date))
        )
        funds = {f.stock_id: f for f in fund_result.scalars().all()}

        universe = []
        for stock in stocks:
            row: dict = {
                "symbol": stock.symbol,
                "name": stock.name,
                "sector": stock.sector,
                "industry": stock.industry,
            }

            tech = techs.get(stock.id)
            if tech:
                for ui_col, (source, db_col) in METRIC_MAP.items():
                    if source == "technical":
                        row[ui_col] = getattr(tech, db_col, None)

            fund = funds.get(stock.id)
            if fund:
                for ui_col, (source, db_col) in METRIC_MAP.items():
                    if source == "fundamental":
                        row[ui_col] = getattr(fund, db_col, None)
                        
            universe.append(row)

        return universe

    def _apply_filters(
        self, universe: list[dict], filters: list[FilterCondition]
    ) -> list[dict]:
        """Apply all filter conditions. Stocks with None for a filtered metric are excluded."""
        result = []
        for row in universe:
            passes = True
            for condition in filters:
                value = row.get(condition.metric)
                if value is None:
                    passes = False
                    break

                if condition.op == "between":
                    if not isinstance(condition.value, list) or len(condition.value) != 2:
                        passes = False
                        break
                    if not (condition.value[0] <= value <= condition.value[1]):
                        passes = False
                        break
                else:
                    op_fn = OPS.get(condition.op)
                    if op_fn is None:
                        logger.warning(f"Unknown operator: {condition.op}")
                        passes = False
                        break
                    if not op_fn(value, condition.value):
                        passes = False
                        break

            if passes:
                result.append(row)

        return result

    def _rank(self, stocks: list[dict], metric: str, order: str = "desc") -> list[dict]:
        """Sort stocks by a metric. Stocks with None for the metric go to the end."""
        reverse = order == "desc"
        return sorted(
            stocks,
            key=lambda s: (s.get(metric) is None, s.get(metric) if not reverse else -(s.get(metric) or 0)),
        )

    def _rank_by_weights(self, stocks: list[dict], weights: list) -> list[dict]:
        """Rank stocks using a weighted composite score of Min-Max normalized metrics."""
        if not stocks:
            return stocks
            
        # Calculate min and max for each metric to normalize
        metrics_stats = {}
        for w in weights:
            metric = w.metric if hasattr(w, "metric") else w["metric"]
            values = [s.get(metric) for s in stocks if s.get(metric) is not None]
            if values:
                metrics_stats[metric] = {"min": min(values), "max": max(values)}
            else:
                metrics_stats[metric] = None

        for row in stocks:
            score = 0.0
            total_weight = 0.0
            for w in weights:
                metric = w.metric if hasattr(w, "metric") else w["metric"]
                weight_val = w.weight if hasattr(w, "weight") else w["weight"]
                
                val = row.get(metric)
                stats = metrics_stats.get(metric)
                
                if val is not None and stats and stats["max"] > stats["min"]:
                    # Min-Max Normalization
                    norm_val = (val - stats["min"]) / (stats["max"] - stats["min"])
                    
                    if metric in LOWER_IS_BETTER_METRICS:
                        norm_val = 1.0 - norm_val
                        
                    score += norm_val * weight_val
                else:
                    # Missing data: Neutral Imputation (0.5 score)
                    score += 0.5 * weight_val
                
                total_weight += weight_val
            
            # Normalize to 0-100 scale based on weights applied
            if total_weight > 0:
                row["_composite_score"] = round((score / total_weight) * 100, 1)
            else:
                row["_composite_score"] = 0.0
                
        return sorted(stocks, key=lambda s: s.get("_composite_score", 0), reverse=True)


# Singleton
rule_engine = RuleEngine()
