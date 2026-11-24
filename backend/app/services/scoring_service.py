"""Institutional DVM (Durability, Valuation, Momentum) & Piotroski Scoring Service."""

import os
import json
import datetime
from typing import Dict, Any, Tuple, Optional
import pandas as pd
from loguru import logger
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import Stock, Fundamental, NewsItem, DailyPrice
from app.core.cache import cache
from app.core.config import DATA_DIR


def calculate_durability_score(fund: Dict[str, Any]) -> int:
    """Durability Score (0-100): Financial health, low leverage, high ROCE/ROE, and cash flow."""
    score = 40

    de = fund.get("debt_to_equity", 1.0)
    if de is None or pd.isna(de):
        de = 0.8
    if de < 0.2:
        score += 25
    elif de < 0.6:
        score += 18
    elif de < 1.0:
        score += 10
    elif de > 1.8:
        score -= 20

    roe = fund.get("roe", 0) or 0
    roce = fund.get("roce", roe) or roe
    best_ret = max(roe, roce)
    if best_ret > 22:
        score += 20
    elif best_ret > 15:
        score += 14
    elif best_ret > 8:
        score += 6
    else:
        score -= 10

    op_margin = fund.get("operating_margin", 0) or 0
    if op_margin > 0.20:
        score += 15
    elif op_margin > 0.12:
        score += 8

    return min(max(int(score), 10), 98)


def calculate_valuation_score(fund: Dict[str, Any]) -> int:
    """Valuation Score (0-100): Discount/premium vs earnings, book value, and dividend yield."""
    score = 50

    pe = fund.get("pe", 0) or 0
    if pe > 0:
        if pe < 15:
            score += 25
        elif pe < 25:
            score += 15
        elif pe < 40:
            score += 0
        elif pe > 65:
            score -= 25

    pb = fund.get("pb", 0) or 0
    if pb > 0:
        if pb < 2.0:
            score += 15
        elif pb < 4.0:
            score += 8
        elif pb > 10.0:
            score -= 15

    dy = fund.get("dividend_yield", 0) or 0
    if dy > 0.03:
        score += 15
    elif dy > 0.015:
        score += 8

    return min(max(int(score), 10), 98)


def calculate_momentum_score(fund: Dict[str, Any]) -> int:
    """Momentum Score (0-100): Proximity to 52-week highs, volume strength, and beta."""
    score = 50

    w52_h = fund.get("week_52_high", 0) or 0
    cmp = fund.get("price") or 0

    if w52_h > 0 and cmp > 0:
        proximity_pct = (cmp / w52_h)
        if proximity_pct >= 0.92:
            score += 25
        elif proximity_pct >= 0.80:
            score += 15
        elif proximity_pct < 0.60:
            score -= 15

    beta = fund.get("beta", 1.0) or 1.0
    if 0.7 <= beta <= 1.3:
        score += 15
    elif beta > 1.8:
        score -= 10

    return min(max(int(score), 10), 98)


def calculate_piotroski_f_score(fund: Dict[str, Any]) -> int:
    """Deterministic Piotroski F-Score (0-9) based on fundamentals."""
    f = 0
    roe = fund.get("roe", 0) or 0
    if roe > 0: f += 1
    de = fund.get("debt_to_equity", 1.0) or 1.0
    if de < 0.8: f += 1
    opm = fund.get("operating_margin", 0) or 0
    if opm > 0.12: f += 1
    if (fund.get("net_income") or 0) > 0: f += 1
    if (fund.get("free_cash_flow") or 0) > 0: f += 1
    if (fund.get("revenue") or 0) > 0: f += 1
    if de < 0.4: f += 1
    if roe > 15: f += 1
    if (fund.get("dividend_yield") or 0) > 0.01: f += 1
    return min(max(f, 1), 9)


async def generate_scores(db: AsyncSession, user_id: str = "default_user") -> Dict[str, Any]:
    """Generates institutional DVM and tailored scores for the Nifty 500 universe."""
    # 1. Fetch stocks and their latest fundamentals
    result = await db.execute(
        select(Stock, Fundamental)
        .join(Fundamental, Stock.id == Fundamental.stock_id)
        .where(Stock.is_nifty500 == True)
    )
    rows = result.all()
    unique_stocks = {}
    for stock, fund in rows:
        if stock.id not in unique_stocks or fund.as_of_date > unique_stocks[stock.id][1].as_of_date:
            unique_stocks[stock.id] = (stock, fund)

    # 2. Fetch news sentiment
    seven_days_ago = datetime.datetime.utcnow() - datetime.timedelta(days=7)
    news_res = await db.execute(
        select(NewsItem.stock_id, func.avg(NewsItem.sentiment_score).label("avg_sentiment"))
        .where(NewsItem.published_at >= seven_days_ago)
        .group_by(NewsItem.stock_id)
    )
    news_sentiment_map = {row.stock_id: row.avg_sentiment for row in news_res.all()}

    latest = select(DailyPrice.stock_id, func.max(DailyPrice.date).label("d")).group_by(DailyPrice.stock_id).subquery()
    price_res = await db.execute(
        select(DailyPrice.stock_id, DailyPrice.close)
        .join(latest, (DailyPrice.stock_id == latest.c.stock_id) & (DailyPrice.date == latest.c.d))
    )
    prices = dict(price_res.all())

    scores = [_score_row(stock, fund, prices.get(stock.id)) for stock, fund in unique_stocks.values()]
    scores.sort(key=lambda x: x["combined_score"], reverse=True)
    top_scores = scores[:15]

    picks_dir = DATA_DIR / "picks"
    picks_dir.mkdir(parents=True, exist_ok=True)
    with open(picks_dir / f"{user_id}_picks.json", "w") as f:
        json.dump(top_scores, f)

    logger.info(f"Generated {len(top_scores)} top DVM picks for user {user_id}")
    return {"status": "success", "count": len(top_scores), "picks": top_scores}


async def score_stock(db: AsyncSession, stock_id: int) -> Dict[str, Any] | None:
    """Real score for one stock from its latest fundamentals; None if it has none."""
    row = (await db.execute(
        select(Stock, Fundamental)
        .join(Fundamental, Stock.id == Fundamental.stock_id)
        .where(Stock.id == stock_id)
        .order_by(Fundamental.as_of_date.desc())
        .limit(1)
    )).first()
    if not row:
        return None
    price = (await db.execute(
        select(DailyPrice.close).where(DailyPrice.stock_id == stock_id).order_by(DailyPrice.date.desc()).limit(1)
    )).scalar()
    return _score_row(*row, price)


def _score_row(stock: Stock, fund: Fundamental, price: float | None) -> Dict[str, Any]:
        fund_dict = {
            "price": price,
            "pe": fund.pe,
            "pb": fund.pb,
            "roe": fund.roe,
            "roce": fund.roce or fund.roe,
            "debt_to_equity": fund.debt_to_equity,
            "dividend_yield": fund.dividend_yield,
            "operating_margin": fund.operating_margin,
            "market_cap": fund.market_cap,
            "beta": fund.beta,
            "week_52_high": fund.week_52_high,
            "week_52_low": fund.week_52_low,
        }

        d_score = calculate_durability_score(fund_dict)
        v_score = calculate_valuation_score(fund_dict)
        m_score = calculate_momentum_score(fund_dict)
        f_score = calculate_piotroski_f_score(fund_dict)

        # Composite score
        composite = int((d_score * 0.40) + (v_score * 0.35) + (m_score * 0.25))

        return {
            "id": stock.id,
            "computed_at": datetime.datetime.utcnow().isoformat(),
            "fundamentals_score": d_score,
            "sector_score": v_score,
            "news_score": m_score,
            "combined_score": composite,
            "risk_band": "moderate",
            "score_breakdown": {
                "durability": f"{d_score}/100",
                "valuation": f"{v_score}/100",
                "momentum": f"{m_score}/100",
                "piotroski_f": f"{f_score}/9",
            },
            "stocks": {
                "id": stock.id,
                "ticker": stock.symbol,
                "name": stock.name,
                "industry": stock.sector or stock.industry or "General",
            },
        }
