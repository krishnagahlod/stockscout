from fastapi import APIRouter, HTTPException, BackgroundTasks, Header
from typing import List, Optional
import os
from loguru import logger
from app.db.supabase import get_supabase_client
from app.services.yfinance_service import sync_daily_prices
from app.services.scraper_service import fetch_screener_fundamentals

router = APIRouter()
API_SECRET_KEY = os.environ.get("API_SECRET_KEY", "dev_shared_secret_key")

def verify_token(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split(" ")[1]
    if token != API_SECRET_KEY:
        raise HTTPException(status_code=403, detail="Invalid token")

async def background_sync_task(batch_size: int = 50):
    """
    Background task to sync data for stocks that haven't been updated recently.
    """
    try:
        supabase = get_supabase_client()
        
        # 1. Fetch stocks needing updates (e.g., ordered by last_refreshed nulls first)
        response = supabase.table("stocks").select("id, ticker, exchange").order("last_refreshed", desc=False, nulls_first=True).limit(batch_size).execute()
        
        stocks = response.data
        if not stocks:
            logger.info("No stocks to sync.")
            return
            
        logger.info(f"Starting sync for {len(stocks)} stocks.")
        
        # Format tickers for yfinance (e.g., RELIANCE.NS)
        yf_tickers = []
        for s in stocks:
            suffix = ".NS" if s["exchange"] == "NSE" else ".BO"
            yf_tickers.append(f"{s['ticker']}{suffix}")
            
        # Sync Prices
        prices = sync_daily_prices(yf_tickers)
        
        if prices:
            # Map back to stock_id
            stock_map = {f"{s['ticker']}.NS" if s["exchange"] == "NSE" else f"{s['ticker']}.BO": s["id"] for s in stocks}
            
            db_prices = []
            for p in prices:
                stock_id = stock_map.get(p["ticker"])
                if stock_id:
                    db_prices.append({
                        "stock_id": stock_id,
                        "date": p["date"],
                        "open": p["open"],
                        "high": p["high"],
                        "low": p["low"],
                        "close": p["close"],
                        "adj_close": p["adj_close"],
                        "volume": p["volume"],
                        "source": "yfinance"
                    })
                    
            if db_prices:
                supabase.table("daily_prices").upsert(db_prices, on_conflict="stock_id,date").execute()
                logger.info(f"Upserted {len(db_prices)} price records.")
                
        # Sync Fundamentals & News (one by one to avoid rate limits)
        for s in stocks:
            # Fundamentals
            ratios = await fetch_screener_fundamentals(s["ticker"])
            if ratios:
                from datetime import date
                fundamentals_payload = {
                    "stock_id": s["id"],
                    "as_of_date": date.today().isoformat(),
                    "pe": ratios.get("stock_p/e"),
                    "pb": ratios.get("price_to_book_value"),
                    "roe": ratios.get("roe"),
                    "roce": ratios.get("roce"),
                    "debt_to_equity": ratios.get("debt_to_equity"),
                    "dividend_yield": ratios.get("dividend_yield"),
                    "market_cap": ratios.get("market_cap"),
                    "source": "screener"
                }
                supabase.table("stock_fundamentals").upsert([fundamentals_payload], on_conflict="stock_id,as_of_date").execute()
            
            # News is now synced automatically by the scheduler via job_sync_news
            # Update last_refreshed
            from datetime import datetime
            supabase.table("stocks").update({"last_refreshed": datetime.now().isoformat()}).eq("id", s["id"]).execute()
            
        logger.info("Sync complete.")
        
    except Exception as e:
        logger.error(f"Sync task failed: {e}")

@router.post("/sync/trigger")
async def trigger_sync(background_tasks: BackgroundTasks, authorization: Optional[str] = Header(None)):
    """
    Endpoint intended to be called by a Supabase Edge Function (Cron).
    """
    verify_token(authorization)
    background_tasks.add_task(background_sync_task, batch_size=20)
    return {"status": "Sync triggered successfully"}
