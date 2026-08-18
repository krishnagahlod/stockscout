"""Portfolio optimization and regime detection API router."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.portfolio_service import optimize_portfolio
from app.services.regime_service import regime_detector
from app.services.llm_service import llm_service
from app.models.db_models import Holding, Stock
from pydantic import BaseModel
from typing import List, Optional

class ChatMessage(BaseModel):
    role: str
    content: str

class PortfolioChatRequest(BaseModel):
    messages: List[ChatMessage]
    user_id: str

class CustomStocksRequest(BaseModel):
    names: List[str]

class CsvPriceUpdate(BaseModel):
    stock_id: int
    price: float

class CsvPriceUpdateRequest(BaseModel):
    prices: List[CsvPriceUpdate]

router = APIRouter(prefix="/portfolio", tags=["portfolio"])

@router.post("/update-csv-prices")
async def update_csv_prices(
    request: CsvPriceUpdateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Insert or update the current price for stocks imported from CSV."""
    from datetime import datetime
    from app.models.db_models import DailyPrice
    from sqlalchemy.dialects.postgresql import insert

    today = datetime.utcnow().date()
    
    if not request.prices:
        return {"success": True}

    values = []
    for item in request.prices:
        values.append({
            "stock_id": item.stock_id,
            "date": today,
            "open": item.price,
            "high": item.price,
            "low": item.price,
            "close": item.price,
            "volume": 0
        })

    # Upsert the prices for today
    stmt = insert(DailyPrice).values(values)
    stmt = stmt.on_conflict_do_update(
        index_elements=['stock_id', 'date'],
        set_={
            'open': stmt.excluded.open,
            'high': stmt.excluded.high,
            'low': stmt.excluded.low,
            'close': stmt.excluded.close,
        }
    )
    
    try:
        await db.execute(stmt)
        await db.commit()
    except Exception as e:
        await db.rollback()
        import logging
        logging.getLogger(__name__).error(f"Failed to update CSV prices: {e}")
        
    return {"success": True, "count": len(request.prices)}

@router.post("/add-custom-stocks")
async def add_custom_stocks(
    request: CustomStocksRequest,
    db: AsyncSession = Depends(get_db)
):
    """Ensure custom stocks exist in the database and return their IDs."""
    import re
    import hashlib
    from sqlalchemy import select
    from app.models.db_models import Stock

    results = {}
    for name in request.names:
        try:
            # Search by exact name (case insensitive)
            stmt = select(Stock).where(Stock.name.ilike(name.strip()))
            res = await db.execute(stmt)
            stock = res.scalars().first()

            if not stock:
                # Create a unique custom ticker using a hash to avoid collisions
                safe_name = re.sub(r'[^a-zA-Z0-9]', '', name).upper()[:20]
                hash_suffix = hashlib.md5(name.encode()).hexdigest()[:6].upper()
                custom_ticker = f"C_{safe_name}_{hash_suffix}"
                
                # Check if custom ticker already exists
                stmt2 = select(Stock).where(Stock.symbol == custom_ticker)
                res2 = await db.execute(stmt2)
                stock2 = res2.scalars().first()
                
                if not stock2:
                    new_stock = Stock(
                        symbol=custom_ticker,
                        name=name.strip(),
                        is_nifty500=False,
                        sector="Other",
                        industry="Other",
                        exchange="NSE",
                    )
                    db.add(new_stock)
                    await db.commit()
                    await db.refresh(new_stock)
                    stock = new_stock
                else:
                    stock = stock2

            results[name] = stock.id
        except Exception as e:
            # Rollback the failed transaction and continue with the next stock
            await db.rollback()
            import logging
            logging.getLogger(__name__).error(f"Failed to create custom stock '{name}': {e}")
            continue

    return {"stocks": results}


@router.post("/optimize")
async def optimize(
    strategy_id: int,
    method: str = Query("equal_weight", pattern="^(equal_weight|inverse_volatility|min_variance|max_sharpe)$"),
    capital: float = Query(1000000, gt=0),
    db: AsyncSession = Depends(get_db),
):
    """Optimize portfolio allocation for a strategy."""
    try:
        result = await optimize_portfolio(db, strategy_id, method, capital)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e)}")


@router.get("/regime")
async def get_regime(db: AsyncSession = Depends(get_db)):
    """Get current market regime (bull/bear/sideways)."""
    return await regime_detector.detect_current_regime(db)


@router.get("/snapshot")
async def get_portfolio_snapshot(
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get a comprehensive snapshot of the user's portfolio including fundamentals, technicals, and regime."""
    from sqlalchemy import select
    from app.models.db_models import Holding, Stock, DailyPrice, Fundamental, TechnicalFeature, NewsItem
    from collections import defaultdict
    import math

    # 1. Fetch user's holdings with stock details
    stmt = select(Holding, Stock).join(Stock).where(Holding.user_id == user_id)
    result = await db.execute(stmt)
    holdings_data = result.all()

    if not holdings_data:
        return {
            "summary": {"total_invested": 0, "current_value": 0, "total_pnl": 0, "total_pnl_pct": 0, "holdings_count": 0, "sectors_count": 0},
            "holdings": [],
            "sector_allocation": [],
            "regime": await regime_detector.detect_current_regime(db),
            "risk_metrics": {}
        }

    stock_ids = [stock.id for _, stock in holdings_data]

    # 2. Fetch latest DailyPrices (with 60-day window to prevent connection overload)
    from datetime import datetime, timedelta
    cutoff_60d = datetime.utcnow() - timedelta(days=60)

    prices_res = await db.execute(
        select(DailyPrice).where(DailyPrice.stock_id.in_(stock_ids), DailyPrice.date >= cutoff_60d).order_by(DailyPrice.date.desc())
    )
    latest_prices = {}
    for p in prices_res.scalars().all():
        if p.stock_id not in latest_prices:
            latest_prices[p.stock_id] = p

    missing_p_ids = [sid for sid in stock_ids if sid not in latest_prices]
    if missing_p_ids:
        for sid in missing_p_ids:
            single_res = await db.execute(select(DailyPrice).where(DailyPrice.stock_id == sid).order_by(DailyPrice.date.desc()).limit(1))
            sp = single_res.scalar_one_or_none()
            if sp:
                latest_prices[sid] = sp

    # 3. Fetch latest Fundamentals
    fund_res = await db.execute(select(Fundamental).where(Fundamental.stock_id.in_(stock_ids)).order_by(Fundamental.as_of_date.desc()))
    all_funds = fund_res.scalars().all()
    latest_fundamentals = {}
    for f in all_funds:
        if f.stock_id not in latest_fundamentals:
            latest_fundamentals[f.stock_id] = f

    # 4. Fetch latest TechnicalFeatures
    tech_res = await db.execute(
        select(TechnicalFeature).where(TechnicalFeature.stock_id.in_(stock_ids), TechnicalFeature.date >= cutoff_60d).order_by(TechnicalFeature.date.desc())
    )
    latest_techs = {}
    for t in tech_res.scalars().all():
        if t.stock_id not in latest_techs:
            latest_techs[t.stock_id] = t

    missing_t_ids = [sid for sid in stock_ids if sid not in latest_techs]
    if missing_t_ids:
        for sid in missing_t_ids:
            single_res = await db.execute(select(TechnicalFeature).where(TechnicalFeature.stock_id == sid).order_by(TechnicalFeature.date.desc()).limit(1))
            st = single_res.scalar_one_or_none()
            if st:
                latest_techs[sid] = st

    # 5. Build holdings array and summary
    summary = {
        "total_invested": 0,
        "current_value": 0,
        "holdings_count": len(holdings_data),
    }
    
    sector_alloc = defaultdict(lambda: {"value": 0, "count": 0})
    holdings_list = []
    
    # Track risk metrics
    hhi = 0
    betas = []
    pes = []
    dividend_yields = []
    near_high = 0
    near_low = 0
    rsi_overbought = 0
    rsi_oversold = 0

    for holding, stock in holdings_data:
        price = latest_prices.get(stock.id)
        current_price = price.close if price else holding.avg_buy_price
        
        invested = holding.quantity * holding.avg_buy_price
        current_val = holding.quantity * current_price
        
        summary["total_invested"] += invested
        summary["current_value"] += current_val
        
        sector = stock.sector or "Other"
        sector_alloc[sector]["value"] += current_val
        sector_alloc[sector]["count"] += 1
        
        fund = latest_fundamentals.get(stock.id)
        fund_dict = {}
        if fund:
            fund_dict = {
                "pe": fund.pe, "pb": fund.pb, "roe": fund.roe, "roce": fund.roce,
                "debt_to_equity": fund.debt_to_equity, "dividend_yield": fund.dividend_yield,
                "eps": fund.eps, "market_cap": fund.market_cap, "beta": fund.beta,
                "gross_margin": fund.gross_margin, "operating_margin": fund.operating_margin,
                "net_margin": fund.net_margin,
                "week_52_high": fund.week_52_high, "week_52_low": fund.week_52_low
            }
            if fund.beta: betas.append(fund.beta)
            if fund.pe and fund.pe > 0: pes.append(fund.pe)
            if fund.dividend_yield: dividend_yields.append(fund.dividend_yield)
            if fund.week_52_high and current_price >= fund.week_52_high * 0.95:
                near_high += 1
            if fund.week_52_low and current_price <= fund.week_52_low * 1.05:
                near_low += 1
                
        tech = latest_techs.get(stock.id)
        tech_dict = {}
        if tech:
            tech_dict = {
                "rsi_14": tech.rsi_14, "sma_50": tech.sma_50, "sma_200": tech.sma_200,
                "macd": tech.macd, "macd_signal": tech.macd_signal,
                "volatility_30d": tech.volatility_30d, "momentum_12m": tech.momentum_12m,
                "sharpe_trailing": tech.sharpe_trailing, "max_drawdown_1y": tech.max_drawdown_1y
            }
            if tech.rsi_14 and tech.rsi_14 > 70: rsi_overbought += 1
            if tech.rsi_14 and tech.rsi_14 < 30: rsi_oversold += 1
            
        holdings_list.append({
            "stock_id": stock.id,
            "symbol": stock.symbol,
            "name": stock.name,
            "sector": sector,
            "industry": stock.industry or "Other",
            "quantity": holding.quantity,
            "avg_buy_price": holding.avg_buy_price,
            "current_price": current_price,
            "invested": invested,
            "current_value": current_val,
            "pnl": current_val - invested,
            "pnl_pct": ((current_val - invested) / invested * 100) if invested > 0 else 0,
            "fundamentals": fund_dict,
            "technicals": tech_dict
        })

    summary["total_pnl"] = summary["current_value"] - summary["total_invested"]
    summary["total_pnl_pct"] = (summary["total_pnl"] / summary["total_invested"] * 100) if summary["total_invested"] > 0 else 0
    summary["sectors_count"] = len(sector_alloc)
    
    # Calculate weights and HHI
    for h in holdings_list:
        weight = h["current_value"] / summary["current_value"] if summary["current_value"] > 0 else 0
        h["weight"] = weight * 100
        hhi += weight ** 2
        
    holdings_list.sort(key=lambda x: x["weight"], reverse=True)
    
    # Format sector allocation
    sector_list = []
    for s, data in sector_alloc.items():
        sector_list.append({
            "sector": s,
            "value": data["value"],
            "pct": (data["value"] / summary["current_value"] * 100) if summary["current_value"] > 0 else 0,
            "count": data["count"]
        })
    sector_list.sort(key=lambda x: x["value"], reverse=True)
    
    risk_metrics = {
        "top_holding_pct": holdings_list[0]["weight"] if holdings_list else 0,
        "top_3_holdings_pct": sum(h["weight"] for h in holdings_list[:3]),
        "hhi_concentration": hhi,
        "avg_beta": sum(betas)/len(betas) if betas else None,
        "avg_pe": sum(pes)/len(pes) if pes else None,
        "median_pe": sorted(pes)[len(pes)//2] if pes else None,
        "portfolio_dividend_yield": sum(dividend_yields)/len(dividend_yields) if dividend_yields else None,
        "stocks_near_52w_high": near_high,
        "stocks_near_52w_low": near_low,
        "stocks_rsi_overbought": rsi_overbought,
        "stocks_rsi_oversold": rsi_oversold
    }

    return {
        "summary": summary,
        "holdings": holdings_list,
        "sector_allocation": sector_list,
        "regime": await regime_detector.detect_current_regime(db),
        "risk_metrics": risk_metrics
    }


class PortfolioReportRequest(BaseModel):
    snapshot: dict

@router.post("/report")
async def generate_portfolio_report(
    request: PortfolioReportRequest,
    db: AsyncSession = Depends(get_db)
):
    """Generate an AI-powered health report based on the portfolio snapshot."""
    import json
    from app.services.prompt_templates import PORTFOLIO_REPORT_SYSTEM, PORTFOLIO_REPORT_USER
    
    snapshot_json = json.dumps(request.snapshot, indent=2)
    user_prompt = PORTFOLIO_REPORT_USER.format(snapshot_json=snapshot_json)
    
    try:
        response_text = await llm_service.chat_multi_turn(
            messages=[
                {"role": "system", "content": PORTFOLIO_REPORT_SYSTEM},
                {"role": "user", "content": user_prompt}
            ],
            json_mode=True,
            temperature=0.2
        )
        report_data = json.loads(response_text)
        return report_data
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Failed to generate report: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class ChatMessage(BaseModel):
    role: str
    content: str

class PortfolioChatRequest(BaseModel):
    messages: List[ChatMessage]
    user_id: str
    snapshot_summary: Optional[dict] = None

@router.post("/chat")
async def portfolio_chat(
    request: PortfolioChatRequest,
    db: AsyncSession = Depends(get_db)
):
    """Chat with the LLM about the user's portfolio."""
    import json
    
    if request.snapshot_summary:
        portfolio_context = f"Here is the user's current portfolio data (snapshot):\n{json.dumps(request.snapshot_summary, indent=2)}"
    else:
        from sqlalchemy import select
        # Fallback to basic fetch if no snapshot provided
        stmt = select(Holding, Stock).join(Stock).where(Holding.user_id == request.user_id)
        result = await db.execute(stmt)
        holdings_data = result.all()

        if not holdings_data:
            portfolio_context = "The user currently has no stocks in their portfolio."
        else:
            portfolio_context = "Here is the user's current portfolio:\n"
            for holding, stock in holdings_data:
                portfolio_context += f"- {holding.quantity} shares of {stock.symbol} ({stock.name}) in the {stock.sector or 'Unknown'} sector. Average buy price: {holding.avg_buy_price}.\n"

    system_prompt = f"""You are a professional financial advisor and portfolio analyst AI.
You have access to the user's current stock portfolio, including fundamentals, technicals, risk metrics, and the current market regime. 
Your goal is to analyze their portfolio, answer their questions, suggest rebalancing strategies, and provide insights.

{portfolio_context}

CRITICAL RULES:
1. DO NOT dump or list the entire portfolio in a huge table. If the user asks to "track" or "show" their stocks, provide a HIGH-LEVEL SUMMARY (e.g. top 5 holdings, sector exposure, overall health).
2. Provide clear, concise, and actionable advice.
3. Use markdown for formatting. You can render rich interactive visual widgets by using the following custom HTML-like tags if appropriate:
   - `<risk-meter score="high|medium|low" />`
   - `<stock-card symbol="TICKER" price="123" change="+5%" />`
4. Base your advice on the current market regime and the provided risk metrics (HHI, RSI, Beta)."""

    messages = [{"role": "system", "content": system_prompt}]
    for msg in request.messages:
        messages.append({"role": msg.role, "content": msg.content})

    try:
        response_text = await llm_service.chat_multi_turn(
            messages, json_mode=False, temperature=0.5
        )
        return {"role": "assistant", "content": response_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class PortfolioRebalanceRequest(BaseModel):
    user_id: str
    sizing_method: str = "risk_parity"
    capital_mode: str = "existing"  # "existing" or "fresh"
    additional_capital: float = 0.0

class PortfolioNotifyRequest(BaseModel):
    user_id: str
    email: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    capital_mode: str = "existing"
    additional_capital: float = 0.0

@router.get("/playbook")
async def get_portfolio_playbook(
    user_id: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve dynamic 14-day ATR trailing stops, hard capital defense floors, and AI quant guidance for portfolio holdings."""
    from app.services.portfolio_intelligence_service import portfolio_intelligence
    try:
        report = await portfolio_intelligence.get_portfolio_playbook(db, user_id)
        return {"success": True, "report": report}
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error generating portfolio playbook: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/drift")
async def get_portfolio_drift(
    user_id: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Evaluate real-time portfolio concentration, hard capital floor defense, ATR stops, and macro regime headwinds."""
    from app.services.portfolio_intelligence_service import portfolio_intelligence
    try:
        report = await portfolio_intelligence.get_portfolio_drift(db, user_id)
        return {"success": True, "report": report}
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error checking portfolio drift: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/rebalance-sheet")
async def generate_portfolio_rebalance_sheet(
    request: PortfolioRebalanceRequest,
    db: AsyncSession = Depends(get_db)
):
    """Generate institutional trade execution schedules with 'Deploy Fresh Capital' vs 'Rebalance Existing NAV' modeling."""
    from app.services.portfolio_intelligence_service import portfolio_intelligence
    try:
        plan = await portfolio_intelligence.generate_portfolio_rebalance(
            db,
            request.user_id,
            request.sizing_method,
            request.capital_mode,
            request.additional_capital
        )
        return {"success": True, "plan": plan}
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error generating portfolio rebalance plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/notify-rebalance")
async def notify_portfolio_rebalance(
    request: PortfolioNotifyRequest,
    db: AsyncSession = Depends(get_db)
):
    """Dispatch actionable trade orders and stop-loss evaluation sheets to Resend Email & Telegram."""
    from app.services.portfolio_intelligence_service import portfolio_intelligence
    try:
        result = await portfolio_intelligence.notify_portfolio_status(
            db,
            request.user_id,
            request.email,
            request.telegram_chat_id,
            request.capital_mode,
            request.additional_capital
        )
        return result
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error dispatching portfolio alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))

