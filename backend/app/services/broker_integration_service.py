import os
import json
from dataclasses import dataclass
from typing import List, Optional, Dict, Any
from datetime import datetime
from loguru import logger

# Broker SDKs
from kiteconnect import KiteConnect
from dhanhq import dhanhq
from growwapi import GrowwAPI

@dataclass
class NormalizedHolding:
    trading_symbol: str
    exchange: str
    isin: str
    quantity: int
    avg_buy_price: float
    last_price: float
    pnl: float
    day_change: float
    day_change_pct: float
    product: str
    instrument_type: str  # "EQ", "ETF"

class BaseBrokerAdapter:
    def authenticate(self) -> bool:
        raise NotImplementedError
        
    def fetch_holdings(self) -> List[NormalizedHolding]:
        raise NotImplementedError

class ZerodhaAdapter(BaseBrokerAdapter):
    def __init__(self, api_key: str, access_token: str):
        self.api_key = api_key
        self.access_token = access_token
        self.kite = KiteConnect(api_key=self.api_key)
        self.kite.set_access_token(self.access_token)
        
    def authenticate(self) -> bool:
        try:
            profile = self.kite.profile()
            logger.info(f"Zerodha authenticated for user: {profile.get('user_name')}")
            return True
        except Exception as e:
            logger.error(f"Zerodha authentication failed: {e}")
            return False
            
    def fetch_holdings(self) -> List[NormalizedHolding]:
        try:
            raw_holdings = self.kite.holdings()
            normalized = []
            for h in raw_holdings:
                # Only include actual equity/ETF holdings that have quantity > 0
                if h.get("quantity", 0) <= 0:
                    continue
                    
                normalized.append(NormalizedHolding(
                    trading_symbol=h.get("tradingsymbol", ""),
                    exchange=h.get("exchange", ""),
                    isin=h.get("isin", ""),
                    quantity=h.get("quantity", 0),
                    avg_buy_price=float(h.get("average_price", 0.0)),
                    last_price=float(h.get("last_price", 0.0)),
                    pnl=float(h.get("pnl", 0.0)),
                    day_change=float(h.get("day_change", 0.0)),
                    day_change_pct=float(h.get("day_change_percentage", 0.0)),
                    product=h.get("product", "CNC"),
                    instrument_type="EQ"  # Kite doesn't explicitly distinguish ETF in holdings response
                ))
            return normalized
        except Exception as e:
            logger.error(f"Failed to fetch Zerodha holdings: {e}")
            raise e

class DhanAdapter(BaseBrokerAdapter):
    def __init__(self, client_id: str, access_token: str):
        self.client_id = client_id
        self.access_token = access_token
        self.dhan = dhanhq(client_id=self.client_id, access_token=self.access_token)
        
    def authenticate(self) -> bool:
        try:
            # DhanHQ doesn't have a direct ping/profile endpoint that is lightweight, 
            # so we test by fetching fund limits
            funds = self.dhan.get_fund_limits()
            if funds and "data" in funds:
                return True
            return False
        except Exception as e:
            logger.error(f"Dhan authentication failed: {e}")
            return False
            
    def fetch_holdings(self) -> List[NormalizedHolding]:
        try:
            response = self.dhan.get_holdings()
            if not response or response.get("status") != "success":
                raise ValueError(f"Dhan API returned error: {response}")
                
            raw_holdings = response.get("data", [])
            normalized = []
            for h in raw_holdings:
                qty = h.get("totalQty", 0)
                if qty <= 0:
                    continue
                    
                avg_price = float(h.get("avgCostPrice", 0.0))
                ltp = float(h.get("lastTradedPrice", 0.0))
                pnl = (ltp - avg_price) * qty
                prev_close = float(h.get("previousClose", 0.0))
                day_change = ltp - prev_close if prev_close else 0.0
                day_change_pct = (day_change / prev_close * 100) if prev_close else 0.0
                
                normalized.append(NormalizedHolding(
                    trading_symbol=h.get("tradingSymbol", ""),
                    exchange=h.get("exchange", "NSE"),
                    isin=h.get("isin", ""),
                    quantity=qty,
                    avg_buy_price=avg_price,
                    last_price=ltp,
                    pnl=pnl,
                    day_change=day_change,
                    day_change_pct=day_change_pct,
                    product="CNC",
                    instrument_type="EQ"
                ))
            return normalized
        except Exception as e:
            logger.error(f"Failed to fetch Dhan holdings: {e}")
            raise e

class GrowwAdapter(BaseBrokerAdapter):
    def __init__(self, api_auth_token: str):
        self.api_auth_token = api_auth_token
        # Suppress prints from the growwapi package if possible
        self.groww = GrowwAPI(API_AUTH_TOKEN=self.api_auth_token)
        
    def authenticate(self) -> bool:
        try:
            # Try fetching user profile
            profile = self.groww.get_user_profile()
            if profile and profile.get("data"):
                return True
            return False
        except Exception as e:
            logger.error(f"Groww authentication failed: {e}")
            return False
            
    def fetch_holdings(self) -> List[NormalizedHolding]:
        try:
            holdings_response = self.groww.get_holdings_for_user()
            if not holdings_response or "data" not in holdings_response:
                raise ValueError("Invalid response from Groww")
                
            raw_holdings = holdings_response.get("data", {}).get("holdings", [])
            normalized = []
            for h in raw_holdings:
                qty = h.get("quantity", 0)
                if qty <= 0:
                    continue
                    
                avg_price = float(h.get("averagePrice", 0.0))
                ltp = float(h.get("lastTradedPrice", 0.0))
                pnl = float(h.get("pnl", 0.0))
                day_change = float(h.get("dayChange", 0.0))
                day_change_pct = float(h.get("dayChangePerc", 0.0))
                
                normalized.append(NormalizedHolding(
                    trading_symbol=h.get("growwContractId", h.get("companyName", "")),
                    exchange=h.get("exchange", "NSE"),
                    isin=h.get("isin", ""),
                    quantity=qty,
                    avg_buy_price=avg_price,
                    last_price=ltp,
                    pnl=pnl,
                    day_change=day_change,
                    day_change_pct=day_change_pct,
                    product="CNC",
                    instrument_type="EQ"
                ))
            return normalized
        except Exception as e:
            logger.error(f"Failed to fetch Groww holdings: {e}")
            raise e


class BrokerIntegrationService:
    @staticmethod
    def get_adapter(broker_name: str, credentials_dict: Dict[str, Any]) -> BaseBrokerAdapter:
        broker_name = broker_name.lower()
        if broker_name == "zerodha":
            return ZerodhaAdapter(
                api_key=credentials_dict.get("api_key", ""),
                access_token=credentials_dict.get("access_token", "")
            )
        elif broker_name == "dhan":
            return DhanAdapter(
                client_id=credentials_dict.get("client_id", ""),
                access_token=credentials_dict.get("access_token", "")
            )
        elif broker_name == "groww":
            return GrowwAdapter(
                api_auth_token=credentials_dict.get("api_auth_token", "")
            )
        else:
            raise ValueError(f"Unsupported broker: {broker_name}")
