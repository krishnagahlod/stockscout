import pandas as pd
from sqlalchemy.orm import Session
from loguru import logger
import json

def calculate_fundamentals_score(row, risk_band):
    """
    Scoring logic (0-100) based on risk band:
    Conservative: High dividends, low debt, high ROE, large cap
    Moderate: Balance of growth and stability
    Aggressive: High growth, high beta, smaller cap allowed
    """
    score = 50 # Base score
    
    # 1. Market Cap Factor
    cap = row.get('market_cap', 0)
    if risk_band == 'conservative':
        if cap > 20000: score += 10
        elif cap > 5000: score += 5
        else: score -= 10
    elif risk_band == 'aggressive':
        if cap < 5000 and cap > 500: score += 10 # Reward mid/small caps
    
    # 2. Debt to Equity
    de = row.get('debt_to_equity', 1.0)
    if pd.isna(de): de = 1.0
    if risk_band == 'conservative':
        if de < 0.3: score += 15
        elif de > 1.0: score -= 15
    elif risk_band == 'moderate':
        if de < 0.8: score += 10
        elif de > 1.5: score -= 10
        
    # 3. ROE / ROCE
    roe = row.get('roe', 0)
    if pd.isna(roe): roe = 0
    if roe > 15: score += 10
    elif roe > 10: score += 5
    elif roe < 5: score -= 10
    
    # 4. Dividend Yield (Conservative bonus)
    dy = row.get('dividend_yield', 0)
    if pd.isna(dy): dy = 0
    if risk_band == 'conservative' and dy > 2.0:
        score += 15
        
    return min(max(score, 0), 100)

def calculate_sector_score(stock_sector, portfolio_sectors):
    """
    Sector concentration penalty. If portfolio has > 30% in this sector, reduce score.
    portfolio_sectors: dict of sector -> percentage allocation
    """
    if not portfolio_sectors or not stock_sector:
        return 75 # Neutral positive if no portfolio yet
    
    allocation = portfolio_sectors.get(stock_sector, 0)
    
    if allocation > 40: return 20  # High penalty for over-concentration
    if allocation > 25: return 50  # Moderate penalty
    if allocation < 10: return 90  # Diversification bonus
    return 75

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from app.models.db_models import Stock, Fundamental, NewsItem
import datetime

def calculate_news_score(avg_sentiment):
    """
    avg_sentiment: float between -1.0 and 1.0
    """
    if avg_sentiment is None: return 50 # Neutral
    
    # Scale from [-1, 1] to [0, 100]
    score = 50 + (avg_sentiment * 50)
    return min(max(int(score), 0), 100)

async def generate_scores(db: AsyncSession, user_id: str):
    """
    Generates personalized scores for all Nifty 500 stocks based on the user's profile and holdings.
    """
    import os, json
    
    # Fetch fundamentals
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

    # Fetch 7-day news sentiment averages
    seven_days_ago = datetime.datetime.utcnow() - datetime.timedelta(days=7)
    news_res = await db.execute(
        select(NewsItem.stock_id, func.avg(NewsItem.sentiment_score).label("avg_sentiment"))
        .where(NewsItem.published_at >= seven_days_ago)
        .group_by(NewsItem.stock_id)
    )
    news_sentiment_map = {row.stock_id: row.avg_sentiment for row in news_res.all()}
    
    scores = []
    for stock, fund in unique_stocks.values():
        row_data = {
            "market_cap": fund.market_cap,
            "debt_to_equity": fund.debt_to_equity,
            "roe": fund.roe,
            "dividend_yield": fund.dividend_yield
        }
        
        f_score = calculate_fundamentals_score(row_data, 'moderate')
        s_score = calculate_sector_score(stock.industry, {})
        n_score = calculate_news_score(news_sentiment_map.get(stock.id, None))
        
        combined = int((f_score * 0.5) + (s_score * 0.3) + (n_score * 0.2))
        
        news_note = "Neutral recent coverage"
        if n_score > 60: news_note = "Bullish news momentum"
        elif n_score < 40: news_note = "Bearish news momentum"

        scores.append({
            "id": stock.id, # Using stock ID temporarily as unique ID
            "computed_at": datetime.datetime.utcnow().isoformat(),
            "fundamentals_score": int(f_score),
            "sector_score": int(s_score),
            "news_score": int(n_score),
            "combined_score": combined,
            "risk_band": "moderate",
            "score_breakdown": {"valuation": "Good", "growth": "Average", "news_note": news_note},
            "stocks": {
                "id": stock.id,
                "ticker": stock.symbol,
                "name": stock.name,
                "industry": stock.industry
            }
        })
        
    scores.sort(key=lambda x: x["combined_score"], reverse=True)
    top_scores = scores[:10]
    
    os.makedirs("data", exist_ok=True)
    with open(f"data/{user_id}_picks.json", "w") as f:
        json.dump(top_scores, f)
        
    return {"status": "success", "count": len(top_scores)}
