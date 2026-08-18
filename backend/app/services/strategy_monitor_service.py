import json
import asyncio
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import Strategy, Stock, DailyPrice, TechnicalFeature, Alert
from app.models.strategy_schemas import StrategyRules
from app.models.monitor_schemas import (
    HoldingDrift,
    RegimeDriftWarning,
    StrategyDriftReport,
)
from app.services.rule_engine import rule_engine
from app.services.macro_context_service import macro_service
from app.services.notification_service import notification_service



class StrategyMonitorService:
    """
    Evaluates strategy drift, rule erosion, stop-loss / take-profit boundary breaches,
    and market regime divergence. Computes a real-time Strategy Health Score.
    """

    async def check_strategy_drift(
        self, db: AsyncSession, strategy_id: int, send_notifications: bool = False
    ) -> Optional[StrategyDriftReport]:
        logger.info(f"Running drift & health monitoring for Strategy ID {strategy_id}")
        
        result = await db.execute(select(Strategy).where(Strategy.id == strategy_id))
        strategy = result.scalar_one_or_none()
        if not strategy or not strategy.rules_json:
            logger.warning(f"Strategy {strategy_id} not found or lacks rules.")
            return None

        if isinstance(strategy.rules_json, str):
            rules = StrategyRules.model_validate_json(strategy.rules_json)
        else:
            rules = StrategyRules.model_validate(strategy.rules_json)

        # 1. Get current recommended universe from rule engine
        universe = await rule_engine.run(rules, db)
        selected_stocks = universe.stocks

        # 2. Get Live Macro Context & check Regime alignment
        macro = await macro_service.get_live_macro_context(db)

        regime = macro.regime.upper()

        regime_warning: Optional[RegimeDriftWarning] = None

        if regime in ("BEAR", "HIGH_VOLATILITY"):
            regime_warning = RegimeDriftWarning(
                current_regime=regime,
                severity="high" if regime == "HIGH_VOLATILITY" else "medium",
                recommended_action=f"Current market regime is {regime} (VIX: {macro.vix:.1f}). Consider moving to Risk Parity sizing, tightening ATR stop multiples, or reducing high-beta exposure.",
            )
        elif regime == "SIDEWAYS" and rules.rebalance and rules.rebalance.frequency == "daily":
            regime_warning = RegimeDriftWarning(
                current_regime=regime,
                severity="medium",
                recommended_action="In sideways/whipsaw markets, high-frequency rebalancing increases slippage without yield. Consider widening rebalance frequency to weekly or monthly.",
            )

        # 3. Evaluate each holding's technical posture and stop-loss boundaries
        holdings_drift: List[HoldingDrift] = []
        total_score_acc = 0.0

        if not selected_stocks:
            return StrategyDriftReport(
                strategy_id=strategy.id,
                strategy_name=strategy.name,
                checked_at=datetime.utcnow().isoformat() + "Z",
                health_score=0.0,
                health_status="CRITICAL_INTERVENTION",
                regime_warning=regime_warning,
                holdings_drift=[],
                summary_commentary="No stocks match current screening filters. Strategy rule erosion detected.",
                action_required=True,
            )

        symbols = [s.symbol for s in selected_stocks]
        stocks_res = await db.execute(select(Stock).where(Stock.symbol.in_(symbols)))
        stock_map = {s.symbol: s for s in stocks_res.scalars().all()}

        thirty_days_ago = datetime.utcnow().date() - timedelta(days=30)

        for sc in selected_stocks:
            stk = stock_map.get(sc.symbol)
            if not stk:
                continue

            # Fetch recent price and technical features
            prices_res = await db.execute(
                select(DailyPrice.close)
                .where(DailyPrice.stock_id == stk.id)
                .where(DailyPrice.date >= thirty_days_ago)
                .order_by(DailyPrice.date.desc())
                .limit(30)
            )
            recent_prices = prices_res.scalars().all()
            curr_price = recent_prices[0] if recent_prices else 0.0

            tech_res = await db.execute(
                select(TechnicalFeature)
                .where(TechnicalFeature.stock_id == stk.id)
                .order_by(TechnicalFeature.date.desc())
                .limit(1)
            )
            tf = tech_res.scalar_one_or_none()

            atr = tf.atr_14 if tf and tf.atr_14 else (0.02 * curr_price)
            rsi = tf.rsi_14 if tf and tf.rsi_14 else 50.0
            sma50 = tf.sma_50 if tf and tf.sma_50 else curr_price
            sma200 = tf.sma_200 if tf and tf.sma_200 else curr_price

            # Calculate Stop Loss and Take Profit
            stop_mult = rules.trailing_stop_atr_multiple or 2.0
            stop_loss_price = round(max(curr_price - (atr * stop_mult), 0.01), 2)
            if rules.stop_loss_pct and recent_prices:
                max_high = max(recent_prices)
                pct_stop = round(max_high * (1.0 - rules.stop_loss_pct), 2)
                stop_loss_price = max(stop_loss_price, pct_stop)

            take_profit_price = None
            if rules.take_profit_pct and curr_price > 0:
                take_profit_price = round(curr_price * (1.0 + rules.take_profit_pct), 2)

            # Check status and drift reasons
            status = "ALIGNED"
            reasons = []

            # Check if breached stop loss from 30d high
            if recent_prices and len(recent_prices) > 1:
                recent_high = max(recent_prices)
                if curr_price <= stop_loss_price:
                    status = "STOP_LOSS_BREACHED"
                    reasons.append(f"Price ₹{curr_price} breached dynamic ATR stop loss level of ₹{stop_loss_price}.")
                elif (recent_high - curr_price) / max(recent_high, 0.01) >= (rules.stop_loss_pct or 0.08):
                    status = "STOP_LOSS_BREACHED"
                    reasons.append(f"Drawdown from recent peak exceeds maximum risk tolerance.")

            if status == "ALIGNED":
                if rsi < 35.0:
                    status = "AT_RISK"
                    reasons.append(f"RSI-14 fell to {rsi:.1f}, indicating significant loss of momentum.")
                elif curr_price < sma200 * 0.98 and curr_price < sma50:
                    status = "DRIFTED"
                    reasons.append(f"Price broke below SMA-50 (₹{round(sma50,1)}) and SMA-200 (₹{round(sma200,1)}). Technical trend reversed.")
                elif rsi > 80.0:
                    status = "AT_RISK"
                    reasons.append(f"RSI-14 is extremely overbought ({rsi:.1f}); vulnerable to sharp pullback or mean reversion.")
                else:
                    reasons.append("Technical trend, RSI momentum, and ATR volatility buffers remain well aligned.")

            if status == "ALIGNED":
                total_score_acc += 100.0
            elif status == "AT_RISK":
                total_score_acc += 70.0
            elif status == "DRIFTED":
                total_score_acc += 40.0
            elif status in ("STOP_LOSS_BREACHED", "TAKE_PROFIT_REACHED"):
                total_score_acc += 0.0

            holdings_drift.append(
                HoldingDrift(
                    symbol=stk.symbol,
                    name=stk.name,
                    sector=stk.sector,
                    status=status,
                    current_price=round(curr_price, 2),
                    stop_loss_price=stop_loss_price,
                    take_profit_price=take_profit_price,
                    reasons=reasons,
                )
            )

        # 4. Calculate final health score and health status
        num_stocks = len(holdings_drift)
        raw_health_score = round((total_score_acc / (num_stocks * 100.0)) * 100.0, 1) if num_stocks > 0 else 0.0
        
        # Penalize slightly for severe regime mismatch
        if regime_warning and regime_warning.severity == "high":
            raw_health_score = max(round(raw_health_score - 15.0, 1), 0.0)
        elif regime_warning and regime_warning.severity == "medium":
            raw_health_score = max(round(raw_health_score - 8.0, 1), 0.0)

        any_stop_breach = any(h.status == "STOP_LOSS_BREACHED" for h in holdings_drift)
        any_drift = any(h.status in ("DRIFTED", "AT_RISK") for h in holdings_drift)

        if any_stop_breach or raw_health_score < 60.0:
            health_status = "CRITICAL_INTERVENTION"
            action_required = True
            summary_commentary = f"Critical action required: {sum(1 for h in holdings_drift if h.status=='STOP_LOSS_BREACHED')} stock(s) breached stop-loss thresholds or experienced trend reversal."
        elif raw_health_score < 85.0 or (regime_warning and regime_warning.severity == "high"):
            health_status = "NEEDS_REBALANCE"
            action_required = True
            summary_commentary = f"Strategy health stands at {raw_health_score}%. Minor factor drift and market regime headwinds suggest scheduling a routine portfolio rebalance."
        else:
            health_status = "HEALTHY"
            action_required = False
            summary_commentary = f"Strategy is operating smoothly with {raw_health_score}% health alignment. All holdings remain within technical trend boundaries and ATR buffers."

        report = StrategyDriftReport(
            strategy_id=strategy.id,
            strategy_name=strategy.name,
            checked_at=datetime.utcnow().isoformat() + "Z",
            health_score=raw_health_score,
            health_status=health_status,
            regime_warning=regime_warning,
            holdings_drift=holdings_drift,
            summary_commentary=summary_commentary,
            action_required=action_required,
        )

        # 5. Send automated notifications if triggered
        if send_notifications and action_required:
            await self._dispatch_drift_alert(db, strategy, report)

        return report

    async def _dispatch_drift_alert(
        self, db: AsyncSession, strategy: Strategy, report: StrategyDriftReport
    ):
        """Creates DB alert and sends Resend email / Telegram notifications."""
        severity_map = {
            "CRITICAL_INTERVENTION": "critical",
            "NEEDS_REBALANCE": "warning",
            "HEALTHY": "info",
        }
        severity = severity_map.get(report.health_status, "warning")
        title = f"Drift Warning: {report.health_status.replace('_', ' ')} ({report.health_score}%)"
        
        breached = [h for h in report.holdings_drift if h.status != "ALIGNED"]
        details_str = "\n".join([f"- **{h.symbol}** ({h.status}): {h.reasons[0]}" for h in breached[:5]])
        
        msg = f"Your strategy '{strategy.name}' currently shows a health score of **{report.health_score}%**.\n\n"
        if report.regime_warning:
            msg += f"**Market Regime:** {report.regime_warning.current_regime} - {report.regime_warning.recommended_action}\n\n"
        msg += f"**Holdings Requiring Attention:**\n{details_str}\n\n"
        msg += "We strongly recommend logging into the AI Co-Pilot platform to review your execution playbook and rebalance allocations."

        # Check deduplication within last 24h
        yesterday = datetime.utcnow() - timedelta(days=1)
        res = await db.execute(
            select(Alert).where(
                Alert.strategy_id == strategy.id,
                Alert.title == title,
                Alert.triggered_at >= yesterday,
            )
        )
        if not res.scalar_one_or_none():
            new_alert = Alert(
                strategy_id=strategy.id,
                stock_id=None,
                alert_type="drift_monitor",
                severity=severity,
                title=title,
                message=msg,
                is_read=False,
            )
            db.add(new_alert)
            await db.commit()
            
            # Dispatch multi-channel notification
            await notification_service.send_alert(
                title=title,
                message=msg,
                severity=severity,
                strategy_name=strategy.name,
            )

    async def monitor_all_active_strategies(self, db: AsyncSession) -> List[StrategyDriftReport]:
        """Runs scheduled automated drift evaluation across all active strategies in database."""
        logger.info("Starting automated batch drift monitoring across all strategies...")
        res = await db.execute(select(Strategy).where(Strategy.status == "active"))
        strategies = res.scalars().all()
        
        reports = []
        for strat in strategies:
            try:
                rep = await self.check_strategy_drift(db, strat.id, send_notifications=True)
                if rep:
                    reports.append(rep)
            except Exception as e:
                logger.error(f"Error monitoring strategy {strat.name} (ID {strat.id}): {e}")
                
        logger.info(f"Completed monitoring for {len(reports)} active strategies.")
        return reports


strategy_monitor = StrategyMonitorService()
