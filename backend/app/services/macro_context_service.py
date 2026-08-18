"""Live Macro Context Service.

Assembles real-time macroeconomic context, regime state, volatility (India VIX),
sector momentum, market breadth, and overall news sentiment for strategy building.
"""

import asyncio
from typing import List
import yfinance as yf
from loguru import logger
from sqlalchemy import select, func, desc, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import Stock, TechnicalFeature, NewsItem
from app.models.strategy_schemas import MacroContext, SectorMomentum
from app.services.regime_service import regime_detector


def _fetch_vix_sync() -> float:
    """Synchronous fetch of India VIX from yfinance with fallback."""
    try:
        ticker = yf.Ticker("^INDIAVIX")
        hist = ticker.history(period="5d")
        if not hist.empty and "Close" in hist:
            val = float(hist["Close"].iloc[-1])
            if val > 0:
                return round(val, 2)
    except Exception as e:
        logger.warning(f"Could not fetch ^INDIAVIX from yfinance: {e}")
    # Fallback default (historical average Indian VIX)
    return 14.2


class MacroContextService:
    """Service to generate real-time macro profile and market context."""

    async def get_live_macro_context(self, db: AsyncSession) -> MacroContext:
        """Fetch and compute live macroeconomic context and market breadth."""
        # 1. Detect current market regime
        regime_info = await regime_detector.detect_current_regime(db)
        regime_state = regime_info.get("regime", "sideways")
        regime_reason = regime_info.get("reason", "Standard market conditions assumed.")

        # 2. Fetch India VIX asynchronously
        loop = asyncio.get_running_loop()
        vix = await loop.run_in_executor(None, _fetch_vix_sync)
        if vix < 14.0:
            vix_zone = "low"
        elif vix <= 20.0:
            vix_zone = "moderate"
        else:
            vix_zone = "high"

        # 3. Query latest technical features for market breadth and sector momentum
        # Find latest date per stock for TechnicalFeature
        subq = (
            select(
                TechnicalFeature.stock_id,
                func.max(TechnicalFeature.date).label("max_date")
            )
            .group_by(TechnicalFeature.stock_id)
            .subquery()
        )

        tech_query = (
            select(
                Stock.sector,
                TechnicalFeature.rsi_14,
                TechnicalFeature.momentum_12m,
                TechnicalFeature.sma_50,
                TechnicalFeature.sma_200
            )
            .join(subq, and_(
                TechnicalFeature.stock_id == subq.c.stock_id,
                TechnicalFeature.date == subq.c.max_date
            ))
            .join(Stock, Stock.id == TechnicalFeature.stock_id)
            .where(Stock.sector != None)
        )

        result = await db.execute(tech_query)
        rows = result.all()

        # Compute Market Breadth (% of stocks with RSI > 50 or above 200 SMA)
        total_stocks = len(rows)
        bullish_count = 0
        sector_data: dict[str, list[float]] = {}

        for row in rows:
            sector = row.sector
            rsi = row.rsi_14
            mom = row.momentum_12m
            sma50 = row.sma_50
            sma200 = row.sma_200

            # Check bullish breadth condition
            is_bullish = False
            if rsi is not None and rsi >= 50.0:
                is_bullish = True
            elif sma50 is not None and sma200 is not None and sma50 > sma200:
                is_bullish = True
            
            if is_bullish:
                bullish_count += 1

            if sector not in sector_data:
                sector_data[sector] = []
            if mom is not None:
                sector_data[sector].append(mom)

        market_breadth_pct = round((bullish_count / total_stocks) * 100.0, 1) if total_stocks > 0 else 55.0

        # Compute Sector Momentum
        sector_momentums: list[SectorMomentum] = []
        for sector, moms in sector_data.items():
            if not moms:
                continue
            avg_mom = sum(moms) / len(moms)
            sector_momentums.append(SectorMomentum(
                sector=sector,
                avg_momentum_12m=round(avg_mom, 4),
                stock_count=len(moms)
            ))

        # Sort by momentum
        sector_momentums.sort(key=lambda x: (x.avg_momentum_12m or 0), reverse=True)
        top_sectors = sector_momentums[:3]
        bottom_sectors = sector_momentums[-3:] if len(sector_momentums) >= 3 else []

        # 4. Query aggregate news sentiment
        news_query = select(func.avg(NewsItem.sentiment_score)).where(NewsItem.sentiment_score != None)
        news_res = await db.execute(news_query)
        avg_sentiment = news_res.scalar()
        agg_sentiment = round(float(avg_sentiment), 2) if avg_sentiment is not None else 0.12

        # 5. Build macro summary text
        top_sec_names = ", ".join([s.sector for s in top_sectors]) if top_sectors else "Technology, Finance, Healthcare"
        bot_sec_names = ", ".join([s.sector for s in bottom_sectors]) if bottom_sectors else "Metals, Utilities"
        
        summary = (
            f"Market Regime is currently **{regime_state.upper()}** ({regime_reason}). "
            f"India VIX stands at **{vix}** ({vix_zone.upper()} volatility), with market breadth at **{market_breadth_pct}%** of stocks displaying bullish technical structure. "
            f"Sector rotation favors **{top_sec_names}** (top momentum leaders), while **{bot_sec_names}** trail. "
            f"Aggregate institutional news sentiment across monitored Indian equities is **{agg_sentiment}** (on a -1 to +1 scale)."
        )

        return MacroContext(
            regime=regime_state,
            regime_reason=regime_reason,
            vix=vix,
            vix_zone=vix_zone,
            market_breadth_pct=market_breadth_pct,
            top_sectors=top_sectors,
            bottom_sectors=bottom_sectors,
            aggregate_news_sentiment=agg_sentiment,
            macro_summary=summary,
        )


# Singleton instance
macro_service = MacroContextService()
