import httpx
from bs4 import BeautifulSoup
from loguru import logger
import asyncio

async def fetch_screener_fundamentals(ticker: str):
    """
    Attempts to fetch fundamental data from screener.in.
    Note: Screener.in is protected; this is a basic HTML parser that may need 
    to be augmented with stealth requests if blocked.
    """
    # Screener uses simple URLs for NSE/BSE stocks
    url = f"https://www.screener.in/company/{ticker}/consolidated/"
    
    # Use headers to mimic a browser
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }
    
    try:
        async with httpx.AsyncClient(headers=headers, timeout=10.0) as client:
            response = await client.get(url)
            
            # If consolidated fails, fallback to standalone
            if response.status_code == 404:
                url = f"https://www.screener.in/company/{ticker}/"
                response = await client.get(url)
                
            if response.status_code != 200:
                logger.error(f"Failed to fetch {ticker} from Screener: HTTP {response.status_code}")
                return None
                
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Extract ratios from the top summary widget
            ratios = {}
            company_ratios = soup.select("ul#top-ratios li")
            for item in company_ratios:
                if not hasattr(item, "find"): continue
                name_elem = item.find("span", class_="name")
                value_elem = item.find("span", class_="number")
                if name_elem and value_elem:
                    name = name_elem.text.strip().lower().replace(" ", "_").replace(".", "")
                    # Clean the value (remove commas, percentage signs)
                    val_str = value_elem.text.strip().replace(",", "").replace("%", "").replace("₹", "")
                    try:
                        ratios[name] = float(val_str)
                    except ValueError:
                        pass
                        
            return ratios
    except Exception as e:
        logger.error(f"Error scraping {ticker}: {e}")
        return None
