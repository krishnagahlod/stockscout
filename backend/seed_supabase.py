import asyncio
from datetime import datetime
from app.db.supabase import get_supabase_client
from app.services.scraper_service import fetch_screener_fundamentals

async def seed_supabase():
    supabase = get_supabase_client()
    symbols = [("TCS", "NSE", "IT"), ("SBIN", "NSE", "Banking"), ("RELIANCE", "NSE", "Energy")]
    
    for ticker, exchange, industry in symbols:
        # Check if exists
        existing = supabase.table("stocks").select("id").eq("ticker", ticker).execute()
        if existing.data:
            stock_id = existing.data[0]["id"]
            print(f"Stock {ticker} already exists with ID: {stock_id}")
        else:
            print(f"Inserting {ticker}...")
            res = supabase.table("stocks").insert({
                "ticker": ticker,
                "name": ticker,
                "industry": industry,
            }).execute()
            stock_id = res.data[0]["id"]
            
        print(f"Fetching fundamentals for {ticker}...")
        ratios = await fetch_screener_fundamentals(ticker)
        if ratios:
            from datetime import date
            fundamentals_payload = {
                "stock_id": stock_id,
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
            print(f"Upserted fundamentals for {ticker}")

if __name__ == "__main__":
    asyncio.run(seed_supabase())
