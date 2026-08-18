import yfinance as yf
import pandas as pd
from loguru import logger
from datetime import datetime, timedelta

def sync_daily_prices(tickers: list[str], start_date: str = None, end_date: str = None):
    """
    Fetches daily OHLCV prices from yfinance for a list of tickers (NSE/BSE).
    Tickers should have .NS or .BO suffix.
    """
    if not start_date:
        # Default to last 30 days if not specified
        start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        
    logger.info(f"Fetching yfinance data for {len(tickers)} stocks from {start_date} to {end_date or 'today'}")
    
    # Download data
    data = yf.download(
        tickers=tickers,
        start=start_date,
        end=end_date,
        group_by='ticker',
        auto_adjust=False,
        threads=True,
    )
    
    # Process and flatten the dataframe
    results = []
    
    # Handle single ticker edge case
    if len(tickers) == 1:
        ticker = tickers[0]
        df = data.reset_index()
        for _, row in df.iterrows():
            if pd.isna(row['Close']): continue
            results.append({
                "ticker": ticker,
                "date": row['Date'].strftime("%Y-%m-%d"),
                "open": float(row['Open']),
                "high": float(row['High']),
                "low": float(row['Low']),
                "close": float(row['Close']),
                "adj_close": float(row['Adj Close']),
                "volume": int(row['Volume']),
            })
        return results

    # Multi-ticker case
    for ticker in tickers:
        if ticker not in data: continue
        ticker_df = data[ticker].reset_index()
        for _, row in ticker_df.iterrows():
            if pd.isna(row['Close']): continue
            results.append({
                "ticker": ticker,
                "date": row['Date'].strftime("%Y-%m-%d"),
                "open": float(row['Open']),
                "high": float(row['High']),
                "low": float(row['Low']),
                "close": float(row['Close']),
                "adj_close": float(row['Adj Close']),
                "volume": int(row['Volume']),
            })
            
    return results

def get_live_prices(tickers: list[str]) -> dict[str, float]:
    """
    Fetches the most recent live price for a list of tickers.
    Returns a dict mapping ticker (e.g. 'RELIANCE.NS') to its current price.
    """
    if not tickers:
        return {}
        
    try:
        data = yf.download(
            tickers=tickers,
            period="1d",
            group_by='ticker',
            auto_adjust=False,
            threads=True,
        )
        
        live_prices = {}
        if len(tickers) == 1:
            if "Close" in data and not data["Close"].empty:
                val = float(data["Close"].iloc[-1])
                if val > 0 and not pd.isna(val):
                    live_prices[tickers[0]] = val
        else:
            for ticker in tickers:
                if ticker in data and "Close" in data[ticker]:
                    val = data[ticker]["Close"].dropna()
                    if not val.empty:
                        float_val = float(val.iloc[-1])
                        if float_val > 0 and not pd.isna(float_val):
                            live_prices[ticker] = float_val
                            
        return live_prices
    except Exception as e:
        logger.error(f"Failed to fetch live prices from yfinance: {e}")
        return {}
