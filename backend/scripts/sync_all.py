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
    
    try:
        logger.info("Step 1: Syncing all prices...")
        await _run_price_sync(limit=None, start_date=None)
        logger.info(f"Successfully synced prices.")
    except Exception as e:
        logger.error(f"Error during price sync: {e}")

    async with async_session() as db:
        try:
            logger.info("Step 2: Syncing all fundamentals...")
            fund_count = await sync_all_fundamentals(db)
            logger.info(f"Successfully synced fundamentals for {fund_count} stocks.")
        except Exception as e:
            logger.error(f"Error during fundamental sync: {e}")
            
        try:
            logger.info("Step 3: Recomputing technical features...")
            feat_count = await recompute_all_features(db)
            logger.info(f"Successfully recomputed features for {feat_count} stocks.")
        except Exception as e:
            logger.error(f"Error during feature recompute: {e}")
            
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

    logger.info("Full synchronization complete! All data is now up-to-date.")

if __name__ == "__main__":
    # Ensure Windows asyncio loop policy is compatible
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(sync_everything())
