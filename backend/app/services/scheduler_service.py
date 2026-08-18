"""APScheduler-based job scheduling for automated data updates."""

from datetime import datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from loguru import logger
from sqlalchemy import select

from app.core.database import async_session
from app.models.db_models import SchedulerLog


scheduler = AsyncIOScheduler()


async def _log_job(job_name: str, status: str, message: str = ""):
    """Log a scheduler job execution."""
    async with async_session() as db:
        log = SchedulerLog(
            job_name=job_name,
            status=status,
            message=message,
            started_at=datetime.utcnow() if status == "started" else None,
            completed_at=datetime.utcnow() if status in ("completed", "failed") else None,
        )
        db.add(log)
        await db.commit()


async def job_sync_news():
    """Sync news every 4 hours."""
    job_name = "sync_news"
    await _log_job(job_name, "started")
    try:
        from app.services.news_service import sync_all_news
        async with async_session() as db:
            count = await sync_all_news(db)
        await _log_job(job_name, "completed", f"Synced {count} news items")
        logger.info(f"Scheduled news sync completed: {count} items")
    except Exception as e:
        await _log_job(job_name, "failed", str(e))
        logger.error(f"Scheduled news sync failed: {e}")


async def job_sync_prices():
    """Daily price sync for all stocks."""
    job_name = "daily_price_sync"
    await _log_job(job_name, "started")
    try:
        from app.services.data_service import sync_all_prices
        async with async_session() as db:
            count = await sync_all_prices(db, limit=None)
        await _log_job(job_name, "completed", f"Synced {count} stocks")
        logger.info(f"Scheduled price sync completed: {count} stocks")
    except Exception as e:
        await _log_job(job_name, "failed", str(e))
        logger.error(f"Scheduled price sync failed: {e}")


async def job_recompute_features():
    """Weekly feature recomputation."""
    job_name = "weekly_feature_recompute"
    await _log_job(job_name, "started")
    try:
        from app.services.feature_service import recompute_all_features
        async with async_session() as db:
            count = await recompute_all_features(db)
        await _log_job(job_name, "completed", f"Computed features for {count} stocks")
        logger.info(f"Scheduled feature recompute completed: {count} stocks")
    except Exception as e:
        await _log_job(job_name, "failed", str(e))
        logger.error(f"Scheduled feature recompute failed: {e}")


async def job_sync_fundamentals():
    """Weekly fundamental data sync."""
    job_name = "weekly_fundamental_sync"
    await _log_job(job_name, "started")
    try:
        from app.services.fundamental_service import sync_all_fundamentals
        async with async_session() as db:
            count = await sync_all_fundamentals(db)
        await _log_job(job_name, "completed", f"Synced fundamentals for {count} stocks")
    except Exception as e:
        await _log_job(job_name, "failed", str(e))
        logger.error(f"Scheduled fundamental sync failed: {e}")


async def job_regime_check():
    """Daily regime check."""
    job_name = "daily_regime_check"
    await _log_job(job_name, "started")
    try:
        from app.services.regime_service import regime_detector
        async with async_session() as db:
            result = await regime_detector.detect_current_regime(db)
        await _log_job(job_name, "completed", f"Regime: {result.get('regime', 'unknown')}")
    except Exception as e:
        await _log_job(job_name, "failed", str(e))
        logger.error(f"Scheduled regime check failed: {e}")


async def job_sync_universe():
    """Weekly universe sync."""
    job_name = "weekly_universe_sync"
    await _log_job(job_name, "started")
    try:
        from app.services.data_service import sync_universe_from_csv
        async with async_session() as db:
            count = await sync_universe_from_csv(db)
        await _log_job(job_name, "completed", f"Synced {count} tickers")
        logger.info(f"Scheduled universe sync completed: {count} tickers")
    except Exception as e:
        await _log_job(job_name, "failed", str(e))
        logger.error(f"Scheduled universe sync failed: {e}")


async def job_monitor_strategies():
    """Daily automated strategy drift & health monitoring."""
    job_name = "daily_strategy_monitor"
    await _log_job(job_name, "started")
    try:
        from app.services.strategy_monitor_service import strategy_monitor
        async with async_session() as db:
            reports = await strategy_monitor.monitor_all_active_strategies(db)
        await _log_job(job_name, "completed", f"Monitored {len(reports)} active strategies")
        logger.info(f"Scheduled strategy monitoring completed: {len(reports)} strategies checked")
    except Exception as e:
        await _log_job(job_name, "failed", str(e))
        logger.error(f"Scheduled strategy monitoring failed: {e}")


def setup_scheduler():
    """Configure all scheduled jobs."""
    # Weekly universe sync on Saturday at 1 AM IST (19:30 UTC Friday)
    scheduler.add_job(
        job_sync_universe,
        CronTrigger(day_of_week="sat", hour=1, minute=0),
        id="weekly_universe_sync",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    # Daily price sync at 6 PM IST (12:30 PM UTC) on weekdays
    scheduler.add_job(
        job_sync_prices,
        CronTrigger(day_of_week="mon-fri", hour=12, minute=30),
        id="daily_price_sync",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    # Weekly feature recompute on Saturday at 8 AM IST (2:30 AM UTC)
    scheduler.add_job(
        job_recompute_features,
        CronTrigger(day_of_week="sat", hour=2, minute=30),
        id="weekly_feature_recompute",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    # Weekly fundamental sync on Saturday at 9 AM IST (3:30 AM UTC)
    scheduler.add_job(
        job_sync_fundamentals,
        CronTrigger(day_of_week="sat", hour=3, minute=30),
        id="weekly_fundamental_sync",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    # Daily regime check at 6:30 PM IST (1:00 PM UTC) on weekdays
    scheduler.add_job(
        job_sync_news,
        "interval",
        hours=4,
        id="job_sync_news",
        replace_existing=True,
        next_run_time=datetime.utcnow() + timedelta(minutes=6),
    )

    scheduler.add_job(
        job_regime_check,
        CronTrigger(day_of_week="mon-fri", hour=13, minute=0),
        id="daily_regime_check",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    # Daily strategy drift & alerting check at 7:00 PM IST (1:30 PM UTC) on weekdays
    scheduler.add_job(
        job_monitor_strategies,
        CronTrigger(day_of_week="mon-fri", hour=13, minute=30),
        id="daily_strategy_monitor",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    logger.info("Scheduler configured with 6 jobs")



def start_scheduler():
    """Start the scheduler."""
    setup_scheduler()
    scheduler.start()
    logger.info("Scheduler started")


def get_scheduler_status() -> dict:
    """Get scheduler status and job info."""
    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name or job.id,
            "next_run": str(job.next_run_time) if job.next_run_time else None,
            "trigger": str(job.trigger),
        })

    return {
        "running": scheduler.running,
        "jobs": jobs,
    }
