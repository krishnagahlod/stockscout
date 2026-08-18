"""Strategy Playbook Service.

Generates comprehensive quantitative playbooks including per-stock entry/exit zones,
ATR-based trailing stops, price targets, sector allocation rationale, and market outlook.
"""

import json
from datetime import datetime
from typing import Optional, List
from loguru import logger
from sqlalchemy import select, desc, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import Stock, DailyPrice, TechnicalFeature, NewsItem, Strategy
from app.models.strategy_schemas import StrategyRules, ScoredUniverse
from app.models.playbook_schemas import (
    StrategyPlaybook,
    StockPlaybookGuidance,
    WatchlistCandidate,
    ProfitTarget,
    TaxImpact
)
from app.services.rule_engine import rule_engine
from app.services.macro_context_service import macro_service
from app.services.llm_service import llm_service
from app.services.prompt_templates import STRATEGY_PLAYBOOK_SYSTEM, STRATEGY_PLAYBOOK_USER


def calculate_tax_impact(entry_price: float, target_price: float, tx_cost_pct: float = 0.002) -> dict:
    gross_gain = target_price - entry_price
    gross_gain_pct = (gross_gain / entry_price) * 100
    
    # Short-term (< 12 months): 20% on gains
    stcg_tax = max(0, gross_gain * 0.20)
    stcg_net = gross_gain - stcg_tax - (entry_price * tx_cost_pct * 2)  # round-trip cost
    
    # Long-term (> 12 months): 12.5% on gains (₹1.25L exemption handled at portfolio level)
    ltcg_tax = max(0, gross_gain * 0.125)
    ltcg_net = gross_gain - ltcg_tax - (entry_price * tx_cost_pct * 2)
    
    return {
        "short_term": TaxImpact(
            holding_period="short_term",
            tax_rate_pct=20.0,
            gross_gain_pct=round(gross_gain_pct, 2),
            tax_pct=round((stcg_tax / entry_price) * 100, 2) if entry_price > 0 else 0,
            net_gain_pct=round((stcg_net / entry_price) * 100, 2) if entry_price > 0 else 0,
            net_target_price=round(entry_price + stcg_net, 2),
        ),
        "long_term": TaxImpact(
            holding_period="long_term",
            tax_rate_pct=12.5,
            gross_gain_pct=round(gross_gain_pct, 2),
            tax_pct=round((ltcg_tax / entry_price) * 100, 2) if entry_price > 0 else 0,
            net_gain_pct=round((ltcg_net / entry_price) * 100, 2) if entry_price > 0 else 0,
            net_target_price=round(entry_price + ltcg_net, 2),
        ),
    }

class PlaybookService:
    """Two-pass generator combining deterministic quant rules with LLM synthesis."""

    async def generate_playbook(
        self, db: AsyncSession, rules: StrategyRules, strategy_id: Optional[int] = None
    ) -> StrategyPlaybook:
        """Generate a complete Strategy Playbook from rules and current market context."""
        # 1. Get Live Macro Context
        macro_ctx = await macro_service.get_live_macro_context(db)

        # 2. Run rule engine to get top selected stocks + near misses (watchlist)
        top_n = rules.selection.top_n if rules.selection else 20
        # Clone rules with higher top_n to grab near-miss candidates
        extended_rules = rules.model_copy(deep=True)
        if extended_rules.selection:
            extended_rules.selection.top_n = top_n + 5
        else:
            from app.models.strategy_schemas import SelectionConfig
            extended_rules.selection = SelectionConfig(top_n=top_n + 5)

        scored_res: ScoredUniverse = await rule_engine.run(extended_rules, db)

        selected_stocks = scored_res.stocks[:top_n]
        watchlist_stocks = scored_res.stocks[top_n : top_n + 4]

        # Fetch Live Prices
        from app.services.yfinance_service import get_live_prices
        import asyncio
        tickers_to_fetch = [s.symbol + ".NS" for s in selected_stocks]
        live_prices_ns = await asyncio.to_thread(get_live_prices, tickers_to_fetch)
        # Map back to pure symbols
        live_prices = {k.replace(".NS", ""): v for k, v in live_prices_ns.items()}

        # 3. Deterministic Pass: Compute entry zones, ATR stops, price targets
        stock_guidance_list: List[StockPlaybookGuidance] = []
        stock_signals_for_llm = []

        for item in selected_stocks:
            symbol = item.symbol
            name = item.name
            sector = item.sector or "Equity"

            # Query stock DB entry
            stock_res = await db.execute(select(Stock).where(Stock.symbol == symbol))
            stock_obj = stock_res.scalar_one_or_none()

            current_price = 500.0  # fallback
            atr_14 = 15.0          # fallback
            rsi_14 = 50.0
            macd_hist = 0.0
            sma_50 = 490.0
            news_headlines = []

            if stock_obj:
                # Get latest price from DB as fallback
                p_res = await db.execute(
                    select(DailyPrice.close)
                    .where(DailyPrice.stock_id == stock_obj.id)
                    .order_by(DailyPrice.date.desc())
                    .limit(1)
                )
                p_val = p_res.scalar()
                
                # Check if we fetched a live price from Yahoo Finance
                if symbol in live_prices and live_prices[symbol] > 0:
                    current_price = live_prices[symbol]
                elif p_val and p_val > 0:
                    current_price = float(p_val)

                # Get latest technical features
                t_res = await db.execute(
                    select(TechnicalFeature)
                    .where(TechnicalFeature.stock_id == stock_obj.id)
                    .order_by(TechnicalFeature.date.desc())
                    .limit(1)
                )
                t_obj = t_res.scalar_one_or_none()
                if t_obj:
                    atr_14 = float(t_obj.atr_14) if t_obj.atr_14 and t_obj.atr_14 > 0 else (current_price * 0.025)
                    rsi_14 = float(t_obj.rsi_14) if t_obj.rsi_14 is not None else 50.0
                    macd_hist = float(t_obj.macd_histogram) if t_obj.macd_histogram is not None else 0.0
                    sma_50 = float(t_obj.sma_50) if t_obj.sma_50 and t_obj.sma_50 > 0 else (current_price * 0.96)
                else:
                    atr_14 = round(current_price * 0.025, 2)
                    sma_50 = round(current_price * 0.96, 2)

                # Get recent news
                n_res = await db.execute(
                    select(NewsItem.title, NewsItem.summary)
                    .where(NewsItem.stock_id == stock_obj.id)
                    .order_by(NewsItem.published_at.desc())

                    .limit(2)
                )
                for row in n_res.all():
                    headline = (row.title or row.summary or "")[:120]
                    if headline:
                        news_headlines.append(headline)

            # Calculate deterministic Entry Zone
            # Low entry near 50-day SMA or 3% dip; High entry around 1% above current price
            dip_price = round(current_price * 0.97, 2)
            entry_low = max(round(min(sma_50, dip_price), 2), round(current_price * 0.92, 2))
            entry_high = round(current_price * 1.01, 2)

            # Calculate deterministic Stop Loss (ATR Trailing Stop or static %)
            atr_mult = rules.trailing_stop_atr_multiple or 2.0
            stop_loss = round(current_price - (atr_14 * atr_mult), 2)
            if stop_loss >= current_price or stop_loss <= 0:
                stop_loss = round(current_price * 0.90, 2)

            stop_dist_pct = round(((current_price - stop_loss) / current_price) * 100.0, 1)

            # Take Profit Targets (Tiered T1, T2, T3)
            # T1: 1.5x ATR or 8% gain, lock in 40%
            t1_price = max(round(current_price + (atr_14 * 1.5), 2), round(current_price * 1.08, 2))
            t1_gain_pct = round(((t1_price - current_price) / current_price) * 100, 2)
            
            # T2: 2.5:1 R:R, 35% of position
            t2_price = round(current_price + (2.5 * (current_price - stop_loss)), 2)
            t2_gain_pct = round(((t2_price - current_price) / current_price) * 100, 2)
            
            # T3: Runner (4:1 R:R), 25% of position
            t3_price = round(current_price + (4.0 * (current_price - stop_loss)), 2)
            t3_gain_pct = round(((t3_price - current_price) / current_price) * 100, 2)
            
            profit_targets = [
                ProfitTarget(level="T1 (Lock-in)", price=t1_price, gain_pct=t1_gain_pct, exit_pct=0.40, method="1.5x ATR or 8% gain", rationale=""),
                ProfitTarget(level="T2 (Base Case)", price=t2_price, gain_pct=t2_gain_pct, exit_pct=0.35, method="2.5:1 R:R", rationale=""),
                ProfitTarget(level="T3 (Runner)", price=t3_price, gain_pct=t3_gain_pct, exit_pct=0.25, method="4:1 R:R", rationale=""),
            ]
            
            # Tax Impact per Target
            tax_impact_st = []
            tax_impact_lt = []
            for pt in profit_targets:
                impact = calculate_tax_impact(current_price, pt.price)
                tax_impact_st.append(impact["short_term"])
                tax_impact_lt.append(impact["long_term"])

            # Risk-Reward Ratio
            risk_per_share = current_price - stop_loss
            avg_target_gain = sum((pt.price - current_price) * pt.exit_pct for pt in profit_targets)
            rr_ratio = round(avg_target_gain / risk_per_share, 2) if risk_per_share > 0 else 0.0

            # Breakeven after STCG + Costs
            # gross_gain * 0.8 = tx_cost * 2  => gross_gain = tx_cost * 2 / 0.8
            tx_cost_pct = 0.002
            breakeven_pct = round(((tx_cost_pct * 2) / 0.8) * 100, 2)

            # Trailing Stop Rule description
            trailing_rule = f"Trail stop upwards at {atr_mult}x ATR (~₹{round(atr_14 * atr_mult, 1)}) below highest close since entry."

            # Signal Status
            if rsi_14 < 45.0 and macd_hist >= -0.5:
                status = "BULLISH_ENTRY"
            elif rsi_14 > 72.0:
                status = "WAIT_PULLBACK"
            else:
                status = "HOLD_TREND"

            guidance = StockPlaybookGuidance(
                symbol=symbol,
                name=name,
                sector=sector,
                current_price=round(current_price, 2),
                entry_zone_low=entry_low,
                entry_zone_high=entry_high,
                initial_stop_loss=stop_loss,
                stop_distance_pct=stop_dist_pct,
                take_profit_target=t2_price, # Backwards compatibility
                trailing_stop_rule=trailing_rule,
                technical_signal_status=status,
                profit_targets=profit_targets,
                tax_impact_short_term=tax_impact_st,
                tax_impact_long_term=tax_impact_lt,
                risk_reward_ratio=rr_ratio,
                breakeven_after_tax_pct=breakeven_pct,
            )
            stock_guidance_list.append(guidance)

            # Prepare compact JSON slice for LLM pass
            stock_signals_for_llm.append({
                "symbol": symbol,
                "name": name,
                "sector": sector,
                "price": current_price,
                "rsi_14": round(rsi_14, 1),
                "macd_histogram": round(macd_hist, 2),
                "atr_stop_loss": stop_loss,
                "stop_dist_pct": f"{stop_dist_pct}%",
                "status": status,
                "recent_news": news_headlines,
            })

        # Watchlist candidates processing
        watchlist_candidates: List[WatchlistCandidate] = []
        watchlist_for_llm = []
        for w in watchlist_stocks:
            watchlist_candidates.append(WatchlistCandidate(
                symbol=w.symbol,
                name=w.name,
                sector=w.sector or "Equity",
                current_price=0.0,
                reason_near_miss="Just below composite ranking threshold. Monitor for relative strength breakout or improving fundamental factor scores."
            ))
            watchlist_for_llm.append({"symbol": w.symbol, "name": w.name, "sector": w.sector})

        # 4. LLM Synthesis Pass: Generate narratives and stock rationales
        market_outlook_default = f"Under the current {macro_ctx.regime.upper()} market regime with India VIX at {macro_ctx.vix}, portfolio risk is disciplined through systematic position sizing and dynamic ATR stops."
        rebalance_default = f"Execute scheduled rebalancing on a {rules.rebalance.frequency if rules.rebalance else 'quarterly'} basis, or immediately if individual stock weights drift by more than 5%."
        risk_budget_default = f"Using {rules.position_sizing.replace('_', ' ').title()} weighting, portfolio loss exposure is capped by enforcing strict trailing stop losses (average stop distance {round(sum(g.stop_distance_pct for g in stock_guidance_list)/max(len(stock_guidance_list), 1), 1)}%)."
        sector_default = f"Sector allocations align with prevailing momentum leaders ({', '.join([s.sector for s in macro_ctx.top_sectors[:2]]) if macro_ctx.top_sectors else 'diversified sectors'}) while monitoring macroeconomic cyclicality."

        try:
            strategy_details = (
                f"Strategy Name: {rules.name}\n"
                f"Strategy Type: {getattr(rules, 'strategy_type', 'long_only')}\n"
                f"Sizing: {rules.position_sizing}\n"
                f"Rebalance: {rules.rebalance.frequency if rules.rebalance else 'quarterly'}\n"
                f"Macro Summary: {macro_ctx.macro_summary}"
            )

            prompt_content = STRATEGY_PLAYBOOK_USER.format(
                strategy_details=strategy_details,
                stock_signals_json=json.dumps(stock_signals_for_llm[:6], indent=2),
                watchlist_candidates_json=json.dumps(watchlist_for_llm, indent=2),
            )


            messages = [
                {"role": "system", "content": STRATEGY_PLAYBOOK_SYSTEM},
                {"role": "user", "content": prompt_content},
            ]

            response_text = await llm_service.chat_multi_turn(
                messages, json_mode=True, temperature=0.2
            )
            import json_repair
            llm_res = json_repair.loads(response_text)
            if not isinstance(llm_res, dict):
                raise ValueError("Parsed JSON is not a dictionary.")

            market_outlook = llm_res.get("market_outlook", market_outlook_default)
            rebalance_guidance = llm_res.get("rebalance_schedule_guidance", rebalance_default)
            risk_budget = llm_res.get("overall_risk_budget", risk_budget_default)
            sector_rationale = llm_res.get("sector_allocation_rationale", sector_default)

            # Merge stock explanations
            llm_stock_map = {item.get("symbol"): item for item in llm_res.get("stock_guidance", []) if isinstance(item, dict)}
            for g in stock_guidance_list:
                info = llm_stock_map.get(g.symbol)
                if info:
                    g.entry_rationale = info.get("entry_rationale", f"Price trading inside support zone; technical structure is {g.technical_signal_status.replace('_', ' ').lower()}.")
                    g.stop_loss_rationale = info.get("stop_loss_rationale", f"Trailing stop set {g.stop_distance_pct}% below market price using dynamic ATR volatility buffer.")
                    g.target_reasoning_summary = info.get("target_reasoning_summary", "Targets set using ATR-volatility-adjusted scaling with a tiered exit discipline.")
                    
                    if g.profit_targets:
                        if len(g.profit_targets) > 0:
                            g.profit_targets[0].rationale = info.get("t1_rationale", f"Conservative lock-in at {g.profit_targets[0].gain_pct}% gain.")
                            g.profit_targets[0].exit_pct = info.get("t1_exit_pct", g.profit_targets[0].exit_pct)
                        if len(g.profit_targets) > 1:
                            g.profit_targets[1].rationale = info.get("t2_rationale", f"Base-case target at 2.5:1 R:R.")
                            g.profit_targets[1].exit_pct = info.get("t2_exit_pct", g.profit_targets[1].exit_pct)
                        if len(g.profit_targets) > 2:
                            g.profit_targets[2].rationale = info.get("t3_rationale", f"Aggressive runner target for strong trends.")
                            g.profit_targets[2].exit_pct = info.get("t3_exit_pct", g.profit_targets[2].exit_pct)
                        
                        # Recompute RR ratio based on new dynamic exit percentages
                        risk_per_share = g.current_price - g.initial_stop_loss
                        avg_target_gain = sum((pt.price - g.current_price) * pt.exit_pct for pt in g.profit_targets)
                        g.risk_reward_ratio = round(avg_target_gain / risk_per_share, 2) if risk_per_share > 0 else 0.0
                            
                    g.key_metrics_to_watch = info.get("key_metrics_to_watch", ["Quarterly EPS trajectory", "Operating profit margins", "Relative sector momentum"])
                    g.news_catalysts = info.get("news_catalysts", "Monitor quarterly earnings disclosures and sector institutional flow.")
                    g.regime_behavior = info.get("regime_behavior", f"Within {macro_ctx.regime} regime, maintain tight execution discipline at trailing stop boundaries.")
                else:
                    g.entry_rationale = f"Price inside target zone; technical structure is {g.technical_signal_status.replace('_', ' ').lower()}."
                    g.stop_loss_rationale = f"Trailing stop set at {g.stop_distance_pct}% distance to prevent catastrophic drawdown."
                    g.target_reasoning_summary = "Targets set using ATR-volatility-adjusted scaling with a tiered exit discipline."
                    
                    if g.profit_targets:
                        if len(g.profit_targets) > 0:
                            g.profit_targets[0].rationale = f"Conservative lock-in at {g.profit_targets[0].gain_pct}% gain."
                        if len(g.profit_targets) > 1:
                            g.profit_targets[1].rationale = "Base-case target at 2.5:1 R:R."
                        if len(g.profit_targets) > 2:
                            g.profit_targets[2].rationale = "Aggressive runner target for strong trends."
                            
                    g.key_metrics_to_watch = ["Quarterly EPS trajectory", "Operating profit margins", "Relative sector momentum"]
                    g.news_catalysts = "No critical short-term negative news triggers identified."
                    g.regime_behavior = f"In {macro_ctx.regime} market conditions, adhere strictly to ATR trail stop levels."

            # Merge watchlist reasons
            llm_watch_map = {item.get("symbol"): item for item in llm_res.get("watchlist", []) if isinstance(item, dict)}
            for w in watchlist_candidates:
                info = llm_watch_map.get(w.symbol)
                if info and info.get("reason_near_miss"):
                    w.reason_near_miss = info["reason_near_miss"]

        except Exception as e:
            logger.error(f"LLM Playbook generation fallback due to error: {e}")
            logger.debug(f"Failed LLM response text was: {response_text if 'response_text' in locals() else 'N/A'}")
            # Ensure sensible default text on fallback
            market_outlook = market_outlook_default
            rebalance_guidance = rebalance_default
            risk_budget = risk_budget_default
            sector_rationale = sector_default
            for g in stock_guidance_list:
                if not g.entry_rationale:
                    g.entry_rationale = f"Price within entry parameters; signal is {g.technical_signal_status}."
                    g.stop_loss_rationale = f"Trailing stop protects against adverse swings beyond {g.stop_distance_pct}% distance."
                    g.key_metrics_to_watch = ["Quarterly revenue growth", "Debt ratio stability", "Sector relative strength"]
                    g.news_catalysts = "Monitor corporate announcements and impending financial results."
                    g.regime_behavior = f"In a {macro_ctx.regime} regime, prioritize capital preservation at stop boundaries."
                    
                    if g.profit_targets:
                        if len(g.profit_targets) > 0:
                            g.profit_targets[0].rationale = f"Conservative lock-in at {g.profit_targets[0].gain_pct}% gain."
                        if len(g.profit_targets) > 1:
                            g.profit_targets[1].rationale = "Base-case target at 2.5:1 R:R."
                        if len(g.profit_targets) > 2:
                            g.profit_targets[2].rationale = "Aggressive runner target for strong trends."

        return StrategyPlaybook(
            strategy_id=strategy_id,
            strategy_name=rules.name,
            generated_at=datetime.utcnow().isoformat() + "Z",
            macro_context=macro_ctx,
            market_outlook=market_outlook,
            rebalance_schedule_guidance=rebalance_guidance,
            overall_risk_budget=risk_budget,
            sector_allocation_rationale=sector_rationale,
            stock_guidance=stock_guidance_list,
            watchlist=watchlist_candidates,
        )


playbook_service = PlaybookService()
