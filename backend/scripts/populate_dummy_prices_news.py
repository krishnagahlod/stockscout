import os
import random
from datetime import datetime, timedelta
import psycopg2
from dotenv import load_dotenv

def generate_synthetic_data():
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not found in .env")
        return

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    print("Fetching stocks...")
    cur.execute("SELECT id, ticker, name FROM stocks")
    stocks = cur.fetchall()
    
    if not stocks:
        print("No stocks found. Please seed the universe first.")
        return

    print(f"Generating data for {len(stocks)} stocks...")
    
    # 1. Generate Daily Prices
    # Clear existing prices if any just in case
    print("Clearing existing dummy daily_prices and news_items...")
    cur.execute("TRUNCATE TABLE daily_prices CASCADE")
    cur.execute("TRUNCATE TABLE news_items CASCADE")
    conn.commit()

    price_tuples = []
    news_tuples = []
    
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=90)
    
    for stock_id, ticker, name in stocks:
        # Generate Prices
        current_price = random.uniform(100, 5000)
        
        # Go backwards from end_date
        current_date = start_date
        while current_date <= end_date:
            if current_date.weekday() < 5: # Monday to Friday
                change_pct = random.gauss(0, 0.02) # 2% daily volatility
                
                open_p = current_price * (1 - random.uniform(-0.01, 0.01))
                close_p = current_price * (1 + change_pct)
                high_p = max(open_p, close_p) * (1 + random.uniform(0, 0.01))
                low_p = min(open_p, close_p) * (1 - random.uniform(0, 0.01))
                volume = int(random.uniform(100000, 5000000))
                
                price_tuples.append((
                    stock_id,
                    current_date,
                    round(open_p, 2),
                    round(high_p, 2),
                    round(low_p, 2),
                    round(close_p, 2),
                    round(close_p, 2), # adj_close
                    volume,
                    0, 0, 'synthetic'
                ))
                
                current_price = close_p
            current_date += timedelta(days=1)
            
        # Generate News
        sentiments = [
            ("bullish", 0.8, f"{name} announces strong Q3 results beating estimates"),
            ("bullish", 0.6, f"New product launch by {name} receives positive market response"),
            ("neutral", 0.0, f"{name} management maintains steady outlook for next fiscal"),
            ("bearish", -0.5, f"Regulatory hurdles impact {name}'s expansion plans"),
            ("bearish", -0.7, f"{name} sees a dip in quarterly revenue amid global headwinds"),
        ]
        
        # Pick 3 random news items for this stock
        selected_news = random.sample(sentiments, 3)
        for i, (sentiment, score, headline) in enumerate(selected_news):
            pub_date = end_date - timedelta(days=random.randint(1, 14))
            news_tuples.append((
                stock_id,
                headline,
                "Financial Times",
                f"https://news.example.com/{ticker.lower()}/{i}",
                pub_date.strftime("%Y-%m-%d %H:%M:%S"),
                f"Summary for {name}: {headline}",
                sentiment,
                score
            ))

    print("Inserting synthetic daily prices...")
    from psycopg2.extras import execute_values
    execute_values(
        cur,
        """INSERT INTO daily_prices 
           (stock_id, date, open, high, low, close, adj_close, volume, dividends, stock_splits, source) 
           VALUES %s""",
        price_tuples,
        page_size=5000
    )
    
    print("Inserting synthetic news items...")
    execute_values(
        cur,
        """INSERT INTO news_items 
           (stock_id, headline, source, url, published_at, plain_language_summary, sentiment, sentiment_score) 
           VALUES %s""",
        news_tuples,
        page_size=5000
    )
    
    conn.commit()
    cur.close()
    conn.close()
    
    print("Finished generating synthetic prices and news.")

if __name__ == "__main__":
    generate_synthetic_data()
