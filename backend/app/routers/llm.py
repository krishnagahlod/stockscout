"""LLM API router — parse strategies, generate thesis, explain stocks, chat."""

import json
import re

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.db_models import Strategy, BacktestResult, Stock, NewsItem
from app.models.llm_schemas import (
    ParseStrategyRequest,
    InvestmentThesis,
    StockExplanation,
    GenerateThesisRequest,
    ExplainStockRequest,
    ExplainRulesRequest,
    ChatRequest,
)
from app.models.strategy_schemas import StrategyRules
from app.services.llm_service import llm_service
from app.services.prompt_templates import (
    STRATEGY_CHAT_SYSTEM,
    STRATEGY_FINALIZE_SYSTEM,
    GOAL_PROMPTS,
    get_strategy_chat_system,
    get_strategy_finalize_system,
)
from app.services.macro_context_service import macro_service

router = APIRouter(prefix="/llm", tags=["llm"])


@router.get("/macro-context")
async def get_macro_context(db: AsyncSession = Depends(get_db)):
    """Fetch live macroeconomic context, VIX, market breadth, and regime profile."""
    ctx = await macro_service.get_live_macro_context(db)
    return ctx.model_dump()



def _extract_partial_rules(text: str) -> dict | None:
    """Try to extract a JSON block from the LLM's chat response."""
    # Look for ```json ... ``` blocks or just ``` ... ```
    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?\s*```", text, re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group(1))
            # Validate it has at least filters
            if isinstance(parsed, dict) and "filters" in parsed:
                StrategyRules.model_validate(parsed)
                return parsed
        except (json.JSONDecodeError, Exception):
            pass
    return None

def _extract_options(text: str) -> list[str] | None:
    """Try to extract options from ```options block."""
    # 1. Primary: ```options ... ``` code block
    match = re.search(r"```options\s*\n?(.*?)\n?\s*```", text, re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group(1))
            if isinstance(parsed, list) and len(parsed) > 0:
                options = [str(opt) for opt in parsed][:5]
                if not any("custom" in o.lower() for o in options) and not any("type your own" in o.lower() for o in options):
                    options.append("Custom (Type your own)")
                return options
        except (json.JSONDecodeError, Exception):
            pass

    return None

def _strip_blocks(text: str) -> str:
    """Remove the ```json ... ``` and ```options ... ``` blocks from chat text for cleaner display."""
    text = re.sub(r"\n*```(?:json)?\s*\n?.*?\n?\s*```\n*", "", text, flags=re.DOTALL)
    text = re.sub(r"\n*```options\s*\n?.*?\n?\s*```\n*", "", text, flags=re.DOTALL)
    return text.strip()

@router.get("/status")
async def get_llm_status():
    """Check Groq API status and model availability."""
    return await llm_service.check_status()


@router.get("/goal-prompts")
async def get_goal_prompts():
    """Return available goal prompts for the goal selector."""
    return {
        goal_id: prompt
        for goal_id, prompt in GOAL_PROMPTS.items()
    }


@router.post("/chat")
async def strategy_chat(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    """Multi-turn strategy building conversation.
    When finalize=True, extracts strategy rules JSON from the conversation."""
    try:
        macro_ctx = await macro_service.get_live_macro_context(db)

        if request.finalize:
            sys_content = get_strategy_finalize_system(macro_ctx.macro_summary)
            if request.portfolio_context:
                sys_content += f"\n\nUSER PORTFOLIO CONTEXT:\nThe user has an existing portfolio:\n{request.portfolio_context}\nTake these holdings into account when generating the final strategy if appropriate."
            # Build messages with finalize system prompt injected with live context
            messages = [{"role": "system", "content": sys_content}]
            for msg in request.messages:
                messages.append({"role": msg.role, "content": msg.content})
            messages.append({
                "role": "user",
                "content": "Based on our conversation above, generate the final strategy JSON. Return ONLY the JSON object.",
            })

            response_text = await llm_service.chat_multi_turn(
                messages, json_mode=True, temperature=0
            )

            # Clean markdown code blocks or surrounding text if present
            clean_text = response_text.strip()
            clean_text = re.sub(r"^```(?:json)?\s*\n?", "", clean_text)
            clean_text = re.sub(r"\n?```$", "", clean_text).strip()
            
            json_match = re.search(r"(\{.*\})", clean_text, re.DOTALL)
            if json_match:
                clean_text = json_match.group(1)

            # Parse and validate the strategy rules
            parsed = json.loads(clean_text)
            rules = StrategyRules.model_validate(parsed)
            return {
                "role": "assistant",
                "content": "Here's your finalized strategy! You can review and edit it on the right, or save it to your portfolio.",
                "strategy_rules": rules.model_dump(),
            }
        else:
            # Normal conversation turn with live macro context
            sys_content = get_strategy_chat_system(macro_ctx.macro_summary)
            if request.portfolio_context:
                sys_content += f"\n\nUSER PORTFOLIO CONTEXT:\nThe user has an existing portfolio:\n{request.portfolio_context}\nConsider this when suggesting a strategy to complement or improve their holdings."
            messages = [{"role": "system", "content": sys_content}]
            for msg in request.messages:
                messages.append({"role": msg.role, "content": msg.content})


            response_text = await llm_service.chat_multi_turn(
                messages, json_mode=False, temperature=0.4
            )

            # Try to extract partial strategy rules and options from the response
            partial_rules = _extract_partial_rules(response_text)
            options = _extract_options(response_text)
            clean_content = _strip_blocks(response_text)

            result = {"role": "assistant", "content": clean_content}
            if partial_rules:
                result["partial_rules"] = partial_rules
            if options:
                result["options"] = options
            return result

    except json.JSONDecodeError as e:
        logger.error(f"JSONDecodeError in strategy_chat: {e}")
        raise HTTPException(status_code=422, detail=f"Failed to parse JSON strategy rules: {str(e)}")
    except RuntimeError as e:
        logger.error(f"RuntimeError in strategy_chat: {e}")
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in strategy_chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/parse-strategy")
async def parse_strategy(request: ParseStrategyRequest):
    """Convert plain-English strategy description to structured rules."""
    try:
        rules = await llm_service.parse_strategy(request.prompt)
        return {
            "rules": rules.model_dump(),
            "rules_json": rules.model_dump_json(),
        }
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/generate-thesis")
async def generate_thesis(
    request: GenerateThesisRequest,
    db: AsyncSession = Depends(get_db),
):
    """Generate an investment thesis for a strategy's portfolio.
    Accepts either strategy_id (saved strategy) or rules_json (unsaved rules)."""

    # Path 1: Generate from rules_json directly (no saved strategy needed)
    if request.rules_json and not request.strategy_id:
        try:
            rules = json.loads(request.rules_json)
            rules_summary = json.dumps(rules, indent=2)
            strategy_name = rules.get("name", "Custom Strategy")

            # Run screener to get matching stocks
            from app.services.rule_engine import rule_engine
            strategy_rules = StrategyRules.model_validate(rules)
            scored = await rule_engine.run(strategy_rules, db)


            stocks_lines = [
                f"- {s.symbol} ({s.name}), Sector: {s.sector or 'N/A'}"
                for s in scored.stocks[:10]
            ]
            stocks_summary = "\n".join(stocks_lines) if stocks_lines else "No matching stocks"

            thesis = await llm_service.generate_thesis_from_rules(
                strategy_name=strategy_name,
                rules_summary=rules_summary,
                stocks_summary=stocks_summary,
                match_count=scored.filtered_count,
            )
            return thesis
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # Path 2: Generate from saved strategy
    if not request.strategy_id:
        raise HTTPException(status_code=400, detail="Provide strategy_id or rules_json")

    result = await db.execute(select(Strategy).where(Strategy.id == request.strategy_id))
    strategy = result.scalar_one_or_none()
    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")

    # Load latest backtest for holdings
    bt_result = await db.execute(
        select(BacktestResult)
        .where(BacktestResult.strategy_id == strategy.id)
        .order_by(BacktestResult.run_date.desc())
        .limit(1)
    )
    backtest = bt_result.scalar_one_or_none()

    # Build summaries
    rules = strategy.rules_json if isinstance(strategy.rules_json, (dict, list)) else json.loads(strategy.rules_json)
    rules_summary = json.dumps(rules, indent=2)

    holdings_summary = "No backtest run yet."
    metrics_summary = "No metrics available."
    if backtest:
        holdings = backtest.holdings_json if isinstance(backtest.holdings_json, (list, dict)) else (json.loads(backtest.holdings_json) if backtest.holdings_json else [])
        holdings_lines = [
            f"- {h['symbol']}: {h['shares']} shares, weight {h.get('weight', 0) * 100:.1f}%, P&L {h.get('pnl_pct', 0) * 100:.1f}%"
            for h in holdings[:10]
        ]
        holdings_summary = "\n".join(holdings_lines) if holdings_lines else "No holdings"

        metrics_summary = (
            f"CAGR: {(backtest.cagr or 0) * 100:.1f}%, "
            f"Sharpe: {backtest.sharpe_ratio or 0:.2f}, "
            f"Max DD: {(backtest.max_drawdown or 0) * 100:.1f}%, "
            f"Win Rate: {(backtest.win_rate or 0) * 100:.1f}%, "
            f"Total Return: {(backtest.total_return or 0) * 100:.1f}%"
        )

    try:
        thesis = await llm_service.generate_thesis(
            strategy_name=strategy.name,
            rules_summary=rules_summary,
            holdings_summary=holdings_summary,
            metrics_summary=metrics_summary,
        )
        return thesis
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/explain-rules")
async def explain_rules(request: ExplainRulesRequest):
    """Explain strategy rules in plain English for beginners."""
    try:
        explanation = await llm_service.explain_rules(request.rules)
        return explanation
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/quick-preview")
async def quick_preview(
    rules: dict,
    db: AsyncSession = Depends(get_db),
):
    """Lightweight screener preview — returns match count + top 5 stocks."""
    try:
        from app.services.rule_engine import rule_engine
        strategy_rules = StrategyRules.model_validate(rules)
        scored = await rule_engine.run(strategy_rules, db)


        top_stocks = [
            {"symbol": s.symbol, "name": s.name, "sector": s.sector}
            for s in scored.stocks[:5]
        ]

        return {
            "match_count": scored.filtered_count,
            "top_stocks": top_stocks,
            "total_universe": scored.total_universe,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/explain-stock")
async def explain_stock(
    request: ExplainStockRequest,
    db: AsyncSession = Depends(get_db),
):
    """Explain why a stock was selected by a strategy."""
    from app.models.db_models import Stock, Fundamental, TechnicalFeature

    # Find stock by symbol or name
    result = await db.execute(
        select(Stock).where(
            (Stock.symbol == request.symbol) | 
            (Stock.symbol == f"{request.symbol}.NS") |
            (Stock.name.ilike(f"%{request.symbol}%"))
        )
    )
    stock = result.scalars().first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")

    # Load latest fundamentals
    fund_result = await db.execute(
        select(Fundamental)
        .where(Fundamental.stock_id == stock.id)
        .order_by(Fundamental.as_of_date.desc())
        .limit(1)
    )
    fund = fund_result.scalar_one_or_none()

    # Load latest technicals
    tech_result = await db.execute(
        select(TechnicalFeature)
        .where(TechnicalFeature.stock_id == stock.id)
        .order_by(TechnicalFeature.date.desc())
        .limit(1)
    )
    tech = tech_result.scalar_one_or_none()

    # Build metric summary
    metrics = {}
    if fund:
        for col in ["trailing_pe", "price_to_book", "dividend_yield", "roe", "roa",
                     "debt_to_equity", "gross_margin", "operating_margin", "net_margin", "eps"]:
            val = getattr(fund, col, None)
            if val is not None:
                metrics[col] = val
    if tech:
        for col in ["rsi_14", "volatility_30d", "volatility_90d", "beta",
                     "momentum_12m", "sharpe_trailing", "max_drawdown_1y"]:
            val = getattr(tech, col, None)
            if val is not None:
                metrics[col] = val
    if stock.market_cap_cr:
        metrics["market_cap"] = stock.market_cap_cr

    metric_summary = "\n".join(f"- {k}: {v}" for k, v in metrics.items())

    # Load strategy filters if provided
    filter_summary = "No specific strategy filters applied."
    if request.strategy_id:
        strat_result = await db.execute(
            select(Strategy).where(Strategy.id == request.strategy_id)
        )
        strat = strat_result.scalar_one_or_none()
        if strat:
            rules = json.loads(strat.rules_json)
            filters = rules.get("filters", [])
            filter_lines = [f"- {f.get('metric', '')}: {f.get('op', '>')} {f.get('value', '')}" for f in filters]
            filter_summary = "\n".join(filter_lines) if filter_lines else "No filters"

    try:
        explanation = await llm_service.explain_stock(
            symbol=stock.symbol,
            name=stock.name,
            sector=stock.sector or "Unknown",
            filter_summary=filter_summary,
            metric_summary=metric_summary or "No metrics available",
        )
        return explanation
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

@router.get("/news-analysis/{ticker}")
async def get_news_analysis(ticker: str, db: AsyncSession = Depends(get_db)):
    """Analyze recent news for a stock and return an AI synthesis."""
    decoded_ticker = ticker.upper()
    
    # 1. Get stock ID
    stock_res = await db.execute(select(Stock).where(Stock.ticker == decoded_ticker))
    stock = stock_res.scalar_one_or_none()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")

    # 2. Get recent news
    news_res = await db.execute(
        select(NewsItem)
        .where(NewsItem.stock_id == stock.id)
        .order_by(NewsItem.published_at.desc())
        .limit(10)
    )
    news_items = news_res.scalars().all()
    
    if not news_items:
        return {"analysis": "No recent news available to analyze."}

    news_data = [
        {
            "title": item.title,
            "summary": item.summary,
            "source": item.source,
            "published_at": item.published_at.isoformat() if item.published_at else ""
        }
        for item in news_items
    ]

    try:
        analysis = await llm_service.analyze_news(stock.ticker, news_data)
        return {"analysis": analysis}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Failed to generate news analysis: {str(e)}")
