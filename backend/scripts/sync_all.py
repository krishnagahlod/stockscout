import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import async_session
from app.services.data_service import _run_price_sync
from app.services.fundamental_service import sync_all_fundamentals
from app.services.feature_service import recompute_all_features
from loguru import logger

async def sync_everything():
    logger.info("Starting FULL database synchronization for all stocks...")
    
    async with async_session() as db:
        try:
            # NSE's official files first; the Yahoo step below then only fills days NSE didn't publish or we couldn't fetch
            from app.services.nse_service import sync_nse
            logger.info(f"Step 1a: Prices, delivery % and index values from NSE: {await sync_nse(db)}")
        except Exception as e:
            logger.error(f"Error during NSE sync: {e}")
            await db.rollback()

    try:
        logger.info("Step 1: Syncing all prices from Yahoo (fallback)...")
        await _run_price_sync(limit=None, start_date=None)
        logger.info(f"Successfully synced prices.")
    except Exception as e:
        logger.error(f"Error during price sync: {e}")

    async with async_session() as db:
        try:
            # Yahoo leaves some splits unadjusted and has occasional bad ticks; repair before indicators are computed
            from app.services.price_cleaning import clean_prices
            logger.info(f"Step 1b: Cleaning prices: {await clean_prices(db)}")
        except Exception as e:
            logger.error(f"Error during price cleaning: {e}")
            await db.rollback()

        if os.getenv("SKIP_FUNDAMENTALS", "").lower() == "true":
            logger.info("Step 2: Skipping fundamentals (SKIP_FUNDAMENTALS=true; they refresh weekly).")
        else:
            try:
                logger.info("Step 2: Syncing all fundamentals...")
                fund_count = await sync_all_fundamentals(db)
                logger.info(f"Successfully synced fundamentals for {fund_count} stocks.")
            except Exception as e:
                logger.error(f"Error during fundamental sync: {e}")
            try:
                from app.services.events_service import sync_events
                logger.info(f"Step 2b: Company events (results dates, dividends, splits): {await sync_events(db)} rows")
            except Exception as e:
                logger.error(f"Error during events sync: {e}")
                await db.rollback()
            try:
                from app.services.financials_service import sync_financials
                logger.info(f"Step 2c: Results and ownership: {await sync_financials(db)}")
            except Exception as e:
                logger.error(f"Error during financials sync: {e}")
                await db.rollback()
            
        try:
            logger.info("Step 3: Recomputing technical features...")
            feat_count = await recompute_all_features(db)
            logger.info(f"Successfully recomputed features for {feat_count} stocks.")
        except Exception as e:
            logger.error(f"Error during feature recompute: {e}")
            
        try:
            from app.services.fund_service import sync_funds
            logger.info(f"Step 3b: Mutual funds from AMFI: {await sync_funds(db)}")
        except Exception as e:
            logger.error(f"Error during fund sync: {e}")
            await db.rollback()

        try:
            from app.services.news_service import sync_all_news
            logger.info("Step 4: Syncing news...")
            news_count = await sync_all_news(db)
            logger.info(f"Successfully synced {news_count} news items.")
        except Exception as e:
            logger.error(f"Error during news sync: {e}")
            
        try:
            from app.services.alert_service import evaluate_all_strategies
            logger.info("Step 5: Evaluating alerts for strategies...")
            await evaluate_all_strategies(db)
            logger.info("Successfully evaluated alerts.")
        except Exception as e:
            logger.error(f"Error during alert evaluation: {e}")

        if db.bind.dialect.name == "postgresql":
            # the web app reads this one-row-per-stock view (supabase/migrations/*_stock_snapshot.sql)
            from sqlalchemy import text
            await db.execute(text("refresh materialized view concurrently public.stock_snapshot"))
            await db.commit()
            logger.info("Step 6: Refreshed stock_snapshot.")

        if os.getenv("SKIP_FUNDAMENTALS", "").lower() != "true":  # the weekly (Saturday) run
            try:
                from app.services.email_service import send_weekly
                logger.info(f"Step 7: Weekly emails sent: {await send_weekly(db)}")
            except Exception as e:
                logger.error(f"Error sending weekly emails: {e}")

    logger.info("Full synchronization complete! All data is now up-to-date.")

if __name__ == "__main__":
    # Ensure Windows asyncio loop policy is compatible
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(sync_everything())
