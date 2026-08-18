import os
import json
import random
import datetime
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

router = APIRouter()

class BacktestRequest(BaseModel):
    strategy_id: int
    user_id: Optional[str] = None
    start_date: Optional[str] = "2021-01-01"
    end_date: Optional[str] = "2024-01-01"
    initial_capital: Optional[float] = 100000.0
    rebalance_frequency: Optional[str] = "monthly"
    tx_cost_bps: Optional[float] = 10.0
    slippage_bps: Optional[float] = 5.0
    benchmark_symbol: Optional[str] = "NIFTY500"

@router.post("/run")
def run_backtest(req: BacktestRequest):
    from app.db.supabase import get_supabase_client
    supabase = get_supabase_client()

    if not req.user_id:
        raise HTTPException(status_code=400, detail="user_id is required")

    # Fetch strategy
    strategy = supabase.table("strategies").select("*").eq("id", req.strategy_id).execute()
    if not strategy.data:
        raise HTTPException(status_code=404, detail="Strategy not found")
        
    strat_name = strategy.data[0]["name"]

    # --- Dummy Backtest Engine ---
    # In a real app, this would use pandas to process historical prices from daily_prices
    
    start = datetime.datetime.strptime(req.start_date, "%Y-%m-%d")
    end = datetime.datetime.strptime(req.end_date, "%Y-%m-%d")
    days = (end - start).days
    
    equity_curve = []
    current_value = req.initial_capital
    bench_value = req.initial_capital
    max_val = current_value
    max_dd = 0
    
    # Generate random walk for equity curve
    for i in range(days // 30): # Monthly data points for brevity
        date = start + datetime.timedelta(days=i*30)
        
        # Strategy grows ~1-3% per month with some noise
        strat_ret = random.uniform(-0.02, 0.05)
        # Benchmark grows ~0.5-2% per month
        bench_ret = random.uniform(-0.03, 0.04)
        
        current_value *= (1 + strat_ret)
        bench_value *= (1 + bench_ret)
        
        if current_value > max_val:
            max_val = current_value
        
        dd = (max_val - current_value) / max_val if max_val > 0 else 0
        if dd > max_dd:
            max_dd = dd
            
        equity_curve.append({
            "date": date.strftime("%Y-%m-%d"),
            "portfolio_value": round(current_value, 2),
            "benchmark_value": round(bench_value, 2),
            "drawdown": round(dd, 4)
        })

    years = days / 365.25
    total_ret = (current_value / req.initial_capital) - 1
    cagr = ((current_value / req.initial_capital) ** (1 / years)) - 1 if years > 0 else 0
    bench_cagr = ((bench_value / req.initial_capital) ** (1 / years)) - 1 if years > 0 else 0

    metrics = {
        "cagr": round(cagr * 100, 2),
        "total_return": round(total_ret * 100, 2),
        "sharpe_ratio": round(random.uniform(1.0, 2.5), 2),
        "sortino_ratio": round(random.uniform(1.5, 3.5), 2),
        "max_drawdown": round(max_dd * 100, 2),
        "volatility": round(random.uniform(12.0, 25.0), 2),
        "win_rate": round(random.uniform(50.0, 70.0), 2),
        "total_trades": random.randint(50, 200),
        "benchmark_cagr": round(bench_cagr * 100, 2),
        "alpha": round((cagr - bench_cagr) * 100, 2)
    }

    trades = [
        {
            "date": start.strftime("%Y-%m-%d"),
            "action": "BUY",
            "symbol": "TCS",
            "name": "Tata Consultancy Services",
            "shares": 100,
            "price": 3500.0,
            "value": 350000.0,
            "reason": "Met criteria"
        }
    ]

    holdings = [
        {
            "symbol": "TCS",
            "name": "Tata Consultancy Services",
            "shares": 100,
            "weight": 0.5,
            "avg_cost": 3500.0,
            "current_price": 3800.0,
            "pnl_pct": 8.57
        }
    ]

    monthly_returns = [
        {"year": start.year, "month": start.month, "return_pct": round(random.uniform(-5, 10), 2)}
    ]

    # Save to Supabase
    res = supabase.table("backtest_results").insert({
        "user_id": req.user_id,
        "strategy_id": req.strategy_id,
        "start_date": req.start_date,
        "end_date": req.end_date,
        "initial_capital": req.initial_capital,
        "final_value": round(current_value, 2),
        "cagr": metrics["cagr"],
        "total_return": metrics["total_return"],
        "max_drawdown": metrics["max_drawdown"],
        "sharpe_ratio": metrics["sharpe_ratio"],
        "sortino_ratio": metrics["sortino_ratio"],
        "volatility": metrics["volatility"],
        "win_rate": metrics["win_rate"],
        "total_trades": metrics["total_trades"],
        "benchmark_return": metrics["benchmark_cagr"],
        "equity_curve": equity_curve,
        "monthly_returns": monthly_returns,
        "trade_log": trades,
        "holdings": holdings,
        "parameters": req.model_dump()
    }).execute()

    inserted = res.data[0]

    return {
        "id": inserted["id"],
        "strategy_id": req.strategy_id,
        "strategy_name": strat_name,
        "start_date": req.start_date,
        "end_date": req.end_date,
        "initial_capital": req.initial_capital,
        "final_value": inserted["final_value"],
        "metrics": metrics,
        "equity_curve": equity_curve,
        "trades": trades,
        "monthly_returns": monthly_returns,
        "holdings": holdings
    }

@router.get("/results")
def list_backtests(user_id: str, strategy_id: Optional[int] = None, limit: int = 10):
    from app.db.supabase import get_supabase_client
    supabase = get_supabase_client()
    
    query = supabase.table("backtest_results").select("*, strategies(name)").eq("user_id", user_id).order("run_date", desc=True).limit(limit)
    if strategy_id:
        query = query.eq("strategy_id", strategy_id)
        
    res = query.execute()
    
    formatted = []
    for row in res.data:
        formatted.append({
            "id": row["id"],
            "strategy_id": row["strategy_id"],
            "strategy_name": row["strategies"]["name"] if row.get("strategies") else "Unknown",
            "start_date": row["start_date"],
            "end_date": row["end_date"],
            "initial_capital": row["initial_capital"],
            "final_value": row["final_value"],
            "run_date": row["run_date"],
            "metrics": {
                "cagr": row["cagr"],
                "total_return": row["total_return"],
                "max_drawdown": row["max_drawdown"],
                "sharpe_ratio": row["sharpe_ratio"]
            }
        })
    return formatted

@router.get("/results/{id}")
def get_backtest(id: int, user_id: str):
    from app.db.supabase import get_supabase_client
    supabase = get_supabase_client()
    
    res = supabase.table("backtest_results").select("*, strategies(name)").eq("id", id).eq("user_id", user_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Backtest not found")
        
    row = res.data[0]
    return {
        "id": row["id"],
        "strategy_id": row["strategy_id"],
        "strategy_name": row["strategies"]["name"] if row.get("strategies") else "Unknown",
        "start_date": row["start_date"],
        "end_date": row["end_date"],
        "initial_capital": row["initial_capital"],
        "final_value": row["final_value"],
        "run_date": row["run_date"],
        "metrics": {
            "cagr": row["cagr"],
            "total_return": row["total_return"],
            "max_drawdown": row["max_drawdown"],
            "sharpe_ratio": row["sharpe_ratio"],
            "sortino_ratio": row["sortino_ratio"],
            "volatility": row["volatility"],
            "win_rate": row["win_rate"],
            "total_trades": row["total_trades"],
            "benchmark_cagr": row["benchmark_return"],
        },
        "equity_curve": row["equity_curve"],
        "trades": row["trade_log"],
        "monthly_returns": row["monthly_returns"],
        "holdings": row["holdings"]
    }
