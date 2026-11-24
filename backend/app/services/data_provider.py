"""Unified Market Data Provider with Tapetide MCP, Direct Yahoo Chart, and Local DB."""

import json
import asyncio
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any
import httpx
import pandas as pd
from loguru import logger
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.cache import cache, cached
from app.models.db_models import Stock, DailyPrice, Fundamental


class TapetideMCPClient:
    """Client for Tapetide Indian Stock Market MCP server (https://mcp.tapetide.com/mcp)."""

    def __init__(self, token: Optional[str] = None):
        self.endpoint = "https://mcp.tapetide.com/mcp"
        self.token = token or settings.TAPETIDE_TOKEN

    def is_configured(self) -> bool:
        return bool(self.token)

    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Execute a tool call against the Tapetide MCP server via JSON-RPC."""
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        payload = {
            "jsonrpc": "2.0",
            "id": int(datetime.utcnow().timestamp()),
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                resp = await client.post(self.endpoint, json=payload, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    if "result" in data:
                        content = data["result"].get("content", [])
                        if content and isinstance(content, list):
                            text = content[0].get("text", "{}")
                            try:
                                return json.loads(text)
                            except Exception:
                                return {"raw": text}
                        return data["result"]
                    elif "error" in data:
                        logger.warning(f"Tapetide MCP error for {tool_name}: {data['error']}")
                elif resp.status_code == 401:
                    logger.warning("Tapetide MCP 401 Unauthorized - Check TAPETIDE_TOKEN in backend/.env")
                elif resp.status_code == 429:
                    logger.warning("Tapetide MCP 429 Rate Limit - Falling back to local/Yahoo")
        except Exception as e:
            logger.debug(f"Tapetide MCP call failed: {e}")
        return None


class DirectYahooClient:
    """Fast, direct HTTP client for Yahoo Finance v8 chart API."""

    def __init__(self):
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "application/json",
        }

    async def fetch_chart_candles(
        self, symbol: str, start_date: str, end_date: str
    ) -> pd.DataFrame:
        """Fetch daily historical candles directly from Yahoo's v8 chart endpoint."""
        # Ensure proper exchange suffix (.NS for NSE, default)
        clean_symbol = symbol.strip().upper()
        if not (clean_symbol.endswith(".NS") or clean_symbol.endswith(".BO")):
            clean_symbol = f"{clean_symbol}.NS"

        try:
            p1 = int(datetime.strptime(start_date[:10], "%Y-%m-%d").timestamp())
            p2 = int(datetime.strptime(end_date[:10], "%Y-%m-%d").timestamp()) + 86400
        except Exception:
            p1 = int((datetime.now() - timedelta(days=365)).timestamp())
            p2 = int(datetime.now().timestamp())

        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{clean_symbol}?period1={p1}&period2={p2}&interval=1d"

        try:
            async with httpx.AsyncClient(headers=self.headers, timeout=10.0, follow_redirects=True) as client:
                resp = await client.get(url)
                if resp.status_code != 200:
                    logger.warning(f"Yahoo v8 chart returned status {resp.status_code} for {clean_symbol}")
                    return pd.DataFrame()

                data = resp.json()
                chart = data.get("chart", {})
                result = chart.get("result")
                if not result:
                    return pd.DataFrame()

                res = result[0]
                timestamps = res.get("timestamp", [])
                indicators = res.get("indicators", {})
                quotes = indicators.get("quote", [{}])[0]
                adjclose = indicators.get("adjclose", [{}])[0].get("adjclose", quotes.get("close", []))

                rows = []
                for i, ts in enumerate(timestamps):
                    c = quotes.get("close", [])[i] if i < len(quotes.get("close", [])) else None
                    if c is None:
                        continue
                    rows.append({
                        "date": datetime.fromtimestamp(ts).strftime("%Y-%m-%d"),
                        "open": quotes.get("open", [])[i] or c,
                        "high": quotes.get("high", [])[i] or c,
                        "low": quotes.get("low", [])[i] or c,
                        "close": c,
                        "adj_close": (adjclose[i] if i < len(adjclose) and adjclose[i] is not None else c),
                        "volume": quotes.get("volume", [])[i] or 0,
                    })

                if rows:
                    df = pd.DataFrame(rows)
                    df["date"] = pd.to_datetime(df["date"])
                    return df
        except Exception as e:
            logger.warning(f"Error fetching direct candles for {clean_symbol}: {e}")

        return pd.DataFrame()


class MarketDataProvider:
    """Unified facade managing Tapetide MCP, Direct Yahoo, and local SQLite data feeds."""

    def __init__(self):
        self.tapetide = TapetideMCPClient()
        self.yahoo = DirectYahooClient()

    async def get_daily_prices(
        self, db: AsyncSession, symbol: str, start_date: str, end_date: str
    ) -> pd.DataFrame:
        """Fetch daily prices: checks DB first, then Yahoo/Tapetide if missing."""
        clean_symbol = symbol.strip().upper()
        if not clean_symbol.endswith(".NS") and not clean_symbol.endswith(".BO"):
            clean_symbol = f"{clean_symbol}.NS"

        # 1. Try local database
        try:
            stock_res = await db.execute(select(Stock).where(Stock.symbol == clean_symbol))
            stock = stock_res.scalar_one_or_none()
            if stock:
                p_res = await db.execute(
                    select(DailyPrice)
                    .where(
                        DailyPrice.stock_id == stock.id,
                        DailyPrice.date >= datetime.strptime(start_date[:10], "%Y-%m-%d").date(),
                        DailyPrice.date <= datetime.strptime(end_date[:10], "%Y-%m-%d").date(),
                    )
                    .order_by(DailyPrice.date.asc())
                )
                prices = p_res.scalars().all()
                if len(prices) > 20:
                    rows = [{
                        "date": p.date,
                        "open": p.open,
                        "high": p.high,
                        "low": p.low,
                        "close": p.close,
                        "adj_close": p.adj_close or p.close,
                        "volume": p.volume,
                    } for p in prices]
                    return pd.DataFrame(rows)
        except Exception as e:
            logger.debug(f"DB price lookup failed: {e}")

        # 2. Fallback to Direct Yahoo API
        df = await self.yahoo.fetch_chart_candles(clean_symbol, start_date, end_date)
        return df

    async def get_stock_profile(self, db: AsyncSession, symbol: str) -> Dict[str, Any]:
        """Fetch comprehensive stock profile with fundamentals, peer data, and financials."""
        clean_symbol = symbol.strip().upper()
        if not clean_symbol.endswith(".NS") and not clean_symbol.endswith(".BO"):
            clean_symbol = f"{clean_symbol}.NS"

        cache_key = f"stock_profile:{clean_symbol}"
        cached_data = cache.get(cache_key)
        if cached_data:
            return cached_data

        # 1. Query DB for stock and fundamental records
        stock_res = await db.execute(select(Stock).where(Stock.symbol == clean_symbol))
        stock = stock_res.scalar_one_or_none()
        if not stock:
            # Try matching without suffix
            plain = clean_symbol.replace(".NS", "").replace(".BO", "")
            stock_res = await db.execute(select(Stock).where(Stock.symbol.like(f"{plain}%")).order_by(Stock.symbol).limit(1))
            stock = stock_res.scalars().first()

        fundamentals = None
        if stock:
            fund_res = await db.execute(
                select(Fundamental)
                .where(Fundamental.stock_id == stock.id)
                .order_by(Fundamental.as_of_date.desc())
                .limit(1)
            )
            fundamentals = fund_res.scalar_one_or_none()

        # Build comprehensive fundamentals
        pe = float(getattr(fundamentals, "pe", 0) or 0)
        pb = float(getattr(fundamentals, "pb", 0) or 0)
        roe = float(getattr(fundamentals, "roe", 0) or 0)
        de = float(getattr(fundamentals, "debt_to_equity", 0) or 0)
        div_yield = float(getattr(fundamentals, "dividend_yield", 0) or 0)
        mcap = float(getattr(fundamentals, "market_cap", 0) or (stock.market_cap_cr if stock else 0) or 0)

        # Only real values: no estimated ROCE, statements or shareholding (we have no source for them yet)
        roce = getattr(fundamentals, "roce", None)
        peers = await self._generate_peer_comparison(db, stock.sector, clean_symbol) if stock and stock.sector else []

        profile = {
            "symbol": clean_symbol,
            "name": stock.name if stock else clean_symbol.replace(".NS", ""),
            "sector": stock.sector if stock else "Diversified",
            "market_cap_cr": mcap,
            "fundamentals": {
                "pe": pe,
                "pb": pb,
                "roe": roe,
                "roce": roce,
                "debt_to_equity": de,
                "dividend_yield": div_yield,
                "net_profit_margin": float(getattr(fundamentals, "net_margin", 0) or 0),
                "operating_margin": float(getattr(fundamentals, "operating_margin", 0) or 0),
                "market_cap": mcap,
            },
            "financial_statements": None,
            "shareholding": [],
            "peers": peers,
        }

        # Cache for 10 minutes
        cache.set(cache_key, profile, ttl=600)
        return profile

    async def _generate_peer_comparison(
        self, db: AsyncSession, sector: str, current_symbol: str
    ) -> List[Dict[str, Any]]:
        """Fetch sector peers for relative valuation comparisons."""
        try:
            peer_res = await db.execute(
                select(Stock, Fundamental)
                .join(Fundamental, Stock.id == Fundamental.stock_id)
                .where(Stock.sector == sector, Stock.symbol != current_symbol)
                .order_by(Stock.market_cap_cr.desc().nullslast(), Fundamental.as_of_date.desc())
                .limit(40)
            )
            peers = []
            seen = set()
            for stock, fund in peer_res.all():
                if stock.id in seen or len(seen) == 4:
                    continue
                seen.add(stock.id)
                peers.append({
                    "symbol": stock.symbol.replace(".NS", ""),
                    "name": stock.name,
                    "market_cap": fund.market_cap or stock.market_cap_cr or 0,
                    "pe": fund.pe or 0,
                    "pb": fund.pb or 0,
                    "roe": fund.roe or 0,
                    "dividend_yield": fund.dividend_yield or 0,
                })
            if peers:
                return peers
        except Exception as e:
            logger.debug(f"Peer comparison query failed: {e}")

        return []


# Global unified market data provider
data_provider = MarketDataProvider()
