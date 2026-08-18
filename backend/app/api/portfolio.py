import random
from fastapi import APIRouter, HTTPException
from typing import Optional

router = APIRouter()

@router.post("/optimize")
def optimize_portfolio(strategy_id: int, method: str, capital: float, user_id: str = "default_user"):
    from app.db.supabase import get_supabase_client
    supabase = get_supabase_client()
    
    # Fetch strategy to get its name
    res = supabase.table("strategies").select("name").eq("id", strategy_id).execute()
    strat_name = res.data[0]["name"] if res.data else "Unknown Strategy"

    # Dummy allocation logic
    allocations = [
        {"symbol": "TCS", "name": "Tata Consultancy Services", "weight": 0.4, "shares": int(capital * 0.4 / 3500), "price": 3500.0, "value": capital * 0.4},
        {"symbol": "RELIANCE", "name": "Reliance Industries", "weight": 0.6, "shares": int(capital * 0.6 / 2500), "price": 2500.0, "value": capital * 0.6},
    ]

    invested = sum(a["value"] for a in allocations)
    leftover = capital - invested

    # Store in Supabase
    ins_res = supabase.table("portfolio_allocations").insert({
        "user_id": user_id,
        "strategy_id": strategy_id,
        "allocation_method": method,
        "capital": capital,
        "allocations": allocations,
        "regime": "bull_normal"
    }).execute()
    
    ins_id = ins_res.data[0]["id"] if ins_res.data else random.randint(1, 1000)

    return {
        "id": ins_id,
        "strategy_id": strategy_id,
        "strategy_name": strat_name,
        "method": method,
        "capital": capital,
        "invested": invested,
        "leftover_cash": leftover,
        "allocations": allocations
    }

@router.get("/regime")
def get_regime():
    return {
        "regime": "bull_normal",
        "nifty_close": 21500.0,
        "sma_200": 19800.0,
        "pct_vs_sma": 8.5,
        "reason": "NIFTY500 is trading significantly above its 200-day moving average.",
        "date": "2024-01-01"
    }
