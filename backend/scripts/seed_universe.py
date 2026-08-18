import sys
import os
from pathlib import Path
import pandas as pd
from loguru import logger

# Add app path to sys.path so we can import db
sys.path.append(str(Path(__file__).parent.parent))

from app.db.supabase import get_supabase_client

def fetch_nifty500_csv(csv_path: str):
    import httpx
    logger.info("Attempting to download Nifty 500 list from NSE...")
    url = "https://nsearchives.nseindia.com/content/indices/ind_nifty500list.csv"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }
    try:
        with httpx.Client(headers=headers, timeout=10.0) as client:
            response = client.get(url)
            if response.status_code == 200:
                with open(csv_path, "wb") as f:
                    f.write(response.content)
                logger.info("Successfully downloaded Nifty 500 CSV.")
                return True
            else:
                logger.error(f"Failed to download: {response.status_code}")
    except Exception as e:
        logger.error(f"Download error: {e}")
    return False

def seed_universe(csv_path: str = "nifty500.csv"):
    """
    Seeds the stocks table with the Nifty 500 universe from a CSV file.
    Expected CSV columns: Symbol, Company Name, Industry
    """
    if not os.path.exists(csv_path):
        success = fetch_nifty500_csv(csv_path)
        if not success:
            logger.warning("Could not download CSV. Proceeding with a fallback top 5 stocks list for testing.")
            fallback_data = [
                {"Symbol": "RELIANCE", "Company Name": "Reliance Industries", "Industry": "Energy"},
                {"Symbol": "TCS", "Company Name": "Tata Consultancy Services", "Industry": "IT"},
                {"Symbol": "HDFCBANK", "Company Name": "HDFC Bank", "Industry": "Financial Services"},
                {"Symbol": "INFY", "Company Name": "Infosys", "Industry": "IT"},
                {"Symbol": "ICICIBANK", "Company Name": "ICICI Bank", "Industry": "Financial Services"}
            ]
            df = pd.DataFrame(fallback_data)
        else:
            logger.info(f"Reading {csv_path}...")
            df = pd.read_csv(csv_path)
    else:
        logger.info(f"Reading {csv_path}...")
        df = pd.read_csv(csv_path)
    
    supabase = get_supabase_client()
    
    records = []
    for _, row in df.iterrows():
        # Handle column names flexibly
        symbol = row.get("Symbol") or row.get("Ticker")
        name = row.get("Company Name") or row.get("Name")
        industry = row.get("Industry") or row.get("Sector")
        
        if not symbol or not name:
            continue
            
        records.append({
            "ticker": symbol.strip(),
            "exchange": "NSE",
            "name": name.strip(),
            "industry": industry.strip() if pd.notna(industry) else None,
            "is_index_member": True,
            "index_name": "NIFTY 500"
        })
        
    logger.info(f"Preparing to insert {len(df)} stocks into Postgres...")
    import psycopg2
    from dotenv import load_dotenv
    load_dotenv()
    db_url = os.environ.get("DATABASE_URL")
    
    if not db_url:
        logger.error("DATABASE_URL not found in .env")
        return
        
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # Prepare bulk insert
        insert_query = """
        INSERT INTO stocks (ticker, exchange, name, industry, is_index_member, index_name)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (ticker, exchange) DO UPDATE 
        SET name = EXCLUDED.name, industry = EXCLUDED.industry;
        """
        
        data_tuples = []
        for _, row in df.iterrows():
            symbol = row.get("Symbol") or row.get("Ticker")
            name = row.get("Company Name") or row.get("Name")
            industry = row.get("Industry") or row.get("Sector")
            if not symbol or not name: continue
            
            symbol_str = symbol.strip()
            if not symbol_str.endswith(".NS"):
                symbol_str += ".NS"
                
            data_tuples.append((
                symbol_str,
                "NSE",
                name.strip(),
                industry.strip() if pd.notna(industry) else None,
                True,
                "NIFTY 500"
            ))
            
        cur.executemany(insert_query, data_tuples)
        conn.commit()
        logger.info(f"Successfully seeded {cur.rowcount} stocks.")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        logger.error(f"Failed to insert: {e}")
        
    logger.info("Seeding complete.")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", type=str, default="nifty500.csv", help="Path to Nifty 500 CSV")
    args = parser.parse_args()
    
    seed_universe(args.csv)
