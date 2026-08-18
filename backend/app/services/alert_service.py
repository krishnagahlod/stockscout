import json
import asyncio
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Any

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import Strategy, Stock, NewsItem, Alert, DailyPrice
from app.models.strategy_schemas import StrategyRules
from app.services.rule_engine import rule_engine
from app.services.llm_service import llm_service
from app.services.prompt_templates import ALERT_EVALUATION_SYSTEM, ALERT_EVALUATION_USER
from app.services.notification_service import notification_service



async def evaluate_strategy_alerts(db: AsyncSession, strategy: Strategy):
    """
    Evaluates a strategy's current portfolio for potential alerts:
    1. News Sentiment (via Gemini)
    2. Price Drop (Stop Loss)
    3. Sector Concentration
    """
    logger.info(f"Evaluating alerts for strategy: {strategy.name}")
    
    if not strategy.rules_json:
        return
    
    if isinstance(strategy.rules_json, str):
        rules = StrategyRules.model_validate_json(strategy.rules_json)
    else:
        rules = StrategyRules.model_validate(strategy.rules_json)
    
    # Get current recommended portfolio
    universe = await rule_engine.run(rules, db)
    if not universe.stocks:
        return
        
    recommended_symbols = [s.symbol for s in universe.stocks]
    
    # 1. Sector Concentration Alert
    from collections import Counter
    sector_counts = Counter(s.sector for s in universe.stocks if s.sector)
    total_stocks = len(universe.stocks)
    for sector, count in sector_counts.items():
        if total_stocks > 0:
            weight = count / total_stocks
            if weight > 0.40:  # 40% threshold
                await _create_alert_if_not_exists(
                    db=db,
                    strategy_id=strategy.id,
                    stock_id=None,
                    alert_type="sector_concentration",
                    severity="warning",
                    title=f"High {sector} Concentration",
                    message=f"The {sector} sector now makes up {weight*100:.1f}% of the recommended portfolio, exceeding the 40% recommended limit.",
                    strategy_name=strategy.name,
                )


    # Fetch stock objects
    result = await db.execute(select(Stock).where(Stock.symbol.in_(recommended_symbols)))
    stocks = result.scalars().all()
    
    now = datetime.utcnow()
    three_days_ago = now - timedelta(days=3)
    
    for stock in stocks:
        # 2. News Alert (Gemini)
        # Fetch highly negative news in last 3 days
        news_res = await db.execute(
            select(NewsItem)
            .where(NewsItem.stock_id == stock.id)
            .where(NewsItem.published_at >= three_days_ago)
            .where(NewsItem.sentiment_score < -0.2) # Filter for negative VADER sentiment
        )
        negative_news = news_res.scalars().all()
        
        if negative_news:
            formatted_news = "\n".join([
                f"- {item.title} ({item.source}): {item.summary}" 
                for item in negative_news
            ])
            
            user_msg = ALERT_EVALUATION_USER.format(
                ticker=stock.symbol,
                name=stock.name,
                news_data=formatted_news
            )
            
            try:
                # Call Gemini
                response = await llm_service._chat(
                    system=ALERT_EVALUATION_SYSTEM,
                    user=user_msg,
                    response_format={"type": "json_object"},
                    temperature=0.1
                )
                parsed = json.loads(response)
                
                if parsed.get("trigger_alert"):
                    await _create_alert_if_not_exists(
                        db=db,
                        strategy_id=strategy.id,
                        stock_id=stock.id,
                        alert_type="news_sentiment",
                        severity=parsed.get("severity", "warning"),
                        title=parsed.get("title", f"Negative News on {stock.symbol}"),
                        message=parsed.get("reasoning", "AI detected negative news."),
                        strategy_name=strategy.name,
                    )

            except Exception as e:
                logger.error(f"Failed to evaluate news alert for {stock.symbol}: {e}")

        # 3. Price Drop Alert
        # Check if max_drawdown_30d > stop_loss_pct
        if rules.stop_loss_pct:
            thirty_days_ago = now.date() - timedelta(days=30)
            prices_res = await db.execute(
                select(DailyPrice.close)
                .where(DailyPrice.stock_id == stock.id)
                .where(DailyPrice.date >= thirty_days_ago)
                .order_by(DailyPrice.date.desc())
            )
            prices = prices_res.scalars().all()
            if prices:
                current_price = prices[0]
                max_price = max(prices)
                if max_price > 0:
                    drawdown = (max_price - current_price) / max_price
                    if drawdown > rules.stop_loss_pct:
                        await _create_alert_if_not_exists(
                            db=db,
                            strategy_id=strategy.id,
                            stock_id=stock.id,
                            alert_type="price_action",
                            severity="critical",
                            title=f"Stop Loss Triggered: {stock.symbol}",
                            message=f"{stock.symbol} has dropped {drawdown*100:.1f}% from its 30-day high of {max_price:.2f}, breaching your {rules.stop_loss_pct*100:.1f}% stop-loss threshold.",
                            strategy_name=strategy.name,
                        )



async def _create_alert_if_not_exists(
    db: AsyncSession,
    strategy_id: int,
    stock_id: int | None,
    alert_type: str,
    severity: str,
    title: str,
    message: str,
    strategy_name: str | None = None,
):
    """Creates an alert if one with the exact same title hasn't been created in the last 24 hours."""
    yesterday = datetime.utcnow() - timedelta(days=1)
    
    query = select(Alert).where(
        Alert.strategy_id == strategy_id,
        Alert.title == title,
        Alert.triggered_at >= yesterday
    )
    if stock_id:
        query = query.where(Alert.stock_id == stock_id)
        
    existing = await db.execute(query)
    if existing.scalar_one_or_none():
        return # Already alerted recently
        
    new_alert = Alert(
        strategy_id=strategy_id,
        stock_id=stock_id,
        alert_type=alert_type,
        severity=severity,
        title=title,
        message=message,
        is_read=False
    )
    db.add(new_alert)
    await db.commit()

    # Dispatch via multi-channel notification service
    try:
        await notification_service.send_alert(
            title=title,
            message=message,
            severity=severity,
            strategy_name=strategy_name
        )
    except Exception as e:
        logger.error(f"Failed to dispatch alert notifications: {e}")



async def evaluate_all_strategies(db: AsyncSession):
    """Runs alert evaluation for all active strategies."""
    result = await db.execute(select(Strategy))
    strategies = result.scalars().all()
    
    for strategy in strategies:
        try:
            await evaluate_strategy_alerts(db, strategy)
        except Exception as e:
            logger.error(f"Error evaluating alerts for {strategy.name}: {e}")
