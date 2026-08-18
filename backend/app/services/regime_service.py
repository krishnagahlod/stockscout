"""Market regime detection based on Nifty 50 SMA and VIX."""

from datetime import date, timedelta

import pandas as pd
from loguru import logger
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import Stock, DailyPrice, RegimeHistory


class RegimeDetector:
    """Detect market regime: bull, bear, or sideways."""

    NIFTY_SYMBOL = "^NSEI"

    async def detect_current_regime(self, db: AsyncSession) -> dict:
        """Detect the current market regime from Nifty 50 price data."""
        # Load Nifty 50 prices
        result = await db.execute(select(Stock).where(Stock.symbol == self.NIFTY_SYMBOL))
        nifty = result.scalar_one_or_none()

        if not nifty:
            return {
                "regime": "unknown",
                "reason": "Nifty 50 data not available. Sync prices for ^NSEI first.",
            }

        # Load last 1500 days of prices for GMM fitting
        cutoff = date.today() - timedelta(days=1500)
        price_result = await db.execute(
            select(DailyPrice)
            .where(and_(
                DailyPrice.stock_id == nifty.id,
                DailyPrice.date >= cutoff,
            ))
            .order_by(DailyPrice.date.asc())
        )
        rows = price_result.scalars().all()
        if len(rows) < 252:
            return {
                "regime": "unknown",
                "reason": f"Only {len(rows)} days of Nifty data. Need 252+ for GMM.",
            }

        closes = pd.Series({r.date: r.close for r in rows})
        closes.index = pd.to_datetime(closes.index)

        # Compute features for GMM
        df = pd.DataFrame({"close": closes})
        df["returns"] = df["close"].pct_change()
        df["volatility_20d"] = df["returns"].rolling(20).std() * (252 ** 0.5)
        df["momentum_60d"] = df["close"].pct_change(60)
        df = df.dropna()

        if len(df) < 100:
            return {"regime": "unknown", "reason": "Not enough data after rolling windows."}

        try:
            from sklearn.mixture import GaussianMixture
            import numpy as np

            # Features for clustering
            X = df[["returns", "volatility_20d", "momentum_60d"]].values
            
            # Fit GMM with 3 components (Bull, Bear, Sideways)
            gmm = GaussianMixture(n_components=3, random_state=42, n_init=3)
            gmm.fit(X)
            
            # Predict for the latest day
            latest_X = X[-1].reshape(1, -1)
            probs = gmm.predict_proba(latest_X)[0]
            cluster = gmm.predict(latest_X)[0]
            
            # Label the clusters based on their means.
            means = gmm.means_
            scores = []
            for i in range(3):
                vol = means[i, 1] if means[i, 1] > 0 else 0.01
                mom = means[i, 2]
                scores.append((i, mom / vol))
            
            scores.sort(key=lambda x: x[1])
            labels = {scores[0][0]: "bear", scores[1][0]: "sideways", scores[2][0]: "bull"}
            
            regime = labels[cluster]
            confidence = float(probs[cluster])
            
            latest_close = float(df["close"].iloc[-1])
            sma_200 = float(closes.rolling(200).mean().iloc[-1])
            pct_above_sma = (latest_close - sma_200) / sma_200 if sma_200 > 0 else 0
            
            reason = f"GMM detected {regime.capitalize()} with {confidence*100:.1f}% probability based on volatility ({df['volatility_20d'].iloc[-1]*100:.1f}%) and momentum."
        except Exception as e:
            logger.error(f"GMM detection failed: {e}")
            return {"regime": "unknown", "reason": "GMM model failed to fit."}

        # Save to history
        today = date.today()
        existing = await db.execute(
            select(RegimeHistory).where(RegimeHistory.date == today)
        )
        if not existing.scalar_one_or_none():
            record = RegimeHistory(
                date=today,
                regime=regime,
                nifty_close=latest_close,
                nifty_sma200=latest_sma,
            )
            db.add(record)
            await db.commit()

        return {
            "regime": regime,
            "nifty_close": round(latest_close, 2),
            "sma_200": round(latest_sma, 2),
            "pct_vs_sma": round(pct_above_sma * 100, 2),
            "reason": reason,
            "date": str(today),
        }

    def adjust_allocation_for_regime(
        self, weights: dict[str, float], regime: str
    ) -> dict[str, float]:
        """Reduce equity allocation in bear markets."""
        if regime == "bear":
            # Reduce all weights by 30% (move to cash)
            factor = 0.7
            adjusted = {k: round(v * factor, 6) for k, v in weights.items()}
            return adjusted
        elif regime == "sideways":
            # Slight reduction
            factor = 0.9
            adjusted = {k: round(v * factor, 6) for k, v in weights.items()}
            return adjusted
        return weights


# Singleton
regime_detector = RegimeDetector()
