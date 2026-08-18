import asyncio
import psycopg2
from datetime import date
from app.services.scraper_service import fetch_screener_fundamentals

import os
DB_URL = os.environ.get("DATABASE_URL")

async def seed():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    
    symbols = [("TCS", "NSE", "IT"), ("SBIN", "NSE", "Banking"), ("RELIANCE", "NSE", "Energy")]
    
    for ticker, exchange, industry in symbols:
        cur.execute("SELECT id FROM stocks WHERE ticker = %s", (ticker,))
        row = cur.fetchone()
        if row:
            stock_id = row[0]
            print(f"Stock {ticker} already exists with ID: {stock_id}")
        else:
            print(f"Inserting {ticker}...")
            cur.execute("""
                INSERT INTO stocks (ticker, name, exchange, industry)
                VALUES (%s, %s, %s, %s) RETURNING id
            """, (ticker, ticker, exchange, industry))
            stock_id = cur.fetchone()[0]
            
        print(f"Fetching fundamentals for {ticker}...")
        ratios = await fetch_screener_fundamentals(ticker)
        if ratios:
            today = date.today().isoformat()
            
            # Upsert into stock_fundamentals
            cur.execute("""
                INSERT INTO stock_fundamentals (
                    stock_id, as_of_date, pe, pb, roe, roce, 
                    debt_to_equity, dividend_yield, market_cap, source
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (stock_id, as_of_date) DO UPDATE SET
                    pe = EXCLUDED.pe, pb = EXCLUDED.pb, roe = EXCLUDED.roe,
                    roce = EXCLUDED.roce, debt_to_equity = EXCLUDED.debt_to_equity,
                    dividend_yield = EXCLUDED.dividend_yield, market_cap = EXCLUDED.market_cap
            """, (
                stock_id, today, ratios.get("stock_p/e"), ratios.get("price_to_book_value"),
                ratios.get("roe"), ratios.get("roce"), ratios.get("debt_to_equity"),
                ratios.get("dividend_yield"), ratios.get("market_cap"), "screener"
            ))
            print(f"Upserted fundamentals for {ticker}")
            
    conn.commit()
    cur.close()
    conn.close()

if __name__ == "__main__":
    asyncio.run(seed())
