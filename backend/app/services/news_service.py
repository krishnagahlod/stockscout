import asyncio
from datetime import datetime
from typing import List, Optional
import yfinance as yf
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from app.models.db_models import Stock, NewsItem

# Initialize VADER sentiment analyzer
analyzer = SentimentIntensityAnalyzer()


async def sync_news_for_stock(db: AsyncSession, stock: Stock) -> int:
    """Fetch news for a stock from yfinance, score it, and upsert."""
    try:
        ticker = yf.Ticker(stock.symbol)
        news = ticker.news
        if not news:
            return 0
    except Exception as e:
        logger.error(f"Failed to fetch news for {stock.symbol}: {e}")
        return 0

    count = 0
    for raw_item in news:
        try:
            item = raw_item.get("content", raw_item)
            
            # yfinance returns pubDate or providerPublishTime, try to extract timestamp
            pub_date = item.get("pubDate") or item.get("providerPublishTime")
            if not pub_date:
                continue

            # Try to parse string ISO format to datetime object
            if isinstance(pub_date, str):
                try:
                    pub_date_dt = datetime.fromisoformat(pub_date.replace("Z", "+00:00")).replace(tzinfo=None)
                except ValueError:
                    logger.warning(f"Could not parse pubDate: {pub_date}")
                    continue
            else:
                # If it's a timestamp
                pub_date_dt = datetime.utcfromtimestamp(pub_date)

            title = item.get("title", "")
            summary = item.get("summary", "")
            url = ""
            
            # Extract URL correctly
            click_through = item.get("clickThroughUrl")
            if isinstance(click_through, dict):
                url = click_through.get("url", "")
            if not url:
                canonical = item.get("canonicalUrl")
                if isinstance(canonical, dict):
                    url = canonical.get("url", "")
            if not url:
                url = item.get("link", "") # Fallback

            if not url or not title:
                continue

            source = "Yahoo Finance"
            provider = item.get("provider")
            if isinstance(provider, dict) and provider.get("displayName"):
                source = provider.get("displayName")
            elif item.get("publisher"):
                source = item.get("publisher")

            # Check if this URL already exists for this stock
            existing = await db.execute(
                select(NewsItem).where(NewsItem.stock_id == stock.id, NewsItem.url == url)
            )
            if existing.scalar_one_or_none():
                continue

            # Calculate Sentiment using VADER (-1 to 1)
            # Combine title and summary for better context
            text_to_analyze = f"{title}. {summary}"
            sentiment_scores = analyzer.polarity_scores(text_to_analyze)
            compound_score = sentiment_scores.get("compound", 0.0)

            news_item = NewsItem(
                stock_id=stock.id,
                title=title,
                summary=summary,
                source=source,
                url=url,
                sentiment_score=compound_score,
                published_at=pub_date_dt
            )
            db.add(news_item)
            count += 1
            
        except Exception as e:
            logger.error(f"Error processing news item for {stock.symbol}: {e}")

    if count > 0:
        await db.commit()
    return count


async def sync_all_news(db: AsyncSession, limit: Optional[int] = None) -> int:
    """Sync news for all Nifty500 stocks."""
    result = await db.execute(select(Stock).where(Stock.is_nifty500 == True))
    stocks = result.scalars().all()
    if limit:
        stocks = stocks[:limit]

    total = 0
    for i, stock in enumerate(stocks):
        logger.info(f"[{i+1}/{len(stocks)}] Fetching news for {stock.symbol}")
        count = await sync_news_for_stock(db, stock)
        total += count

    return total
