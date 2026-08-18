import pandas as pd
import ta
from loguru import logger

def compute_technical_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes technical indicators for a given OHLCV dataframe.
    Requires columns: open, high, low, close, volume.
    """
    if df.empty or len(df) < 50:
        logger.warning("Not enough data to compute technical indicators reliably (need at least 50 periods).")
        return df

    # Ensure data is sorted by date ascending
    if 'date' in df.columns:
        df = df.sort_values('date').copy()
    
    try:
        # 1. Trend Indicators (Moving Averages, MACD)
        df['sma_20'] = ta.trend.sma_indicator(df['close'], window=20)
        df['sma_50'] = ta.trend.sma_indicator(df['close'], window=50)
        df['sma_200'] = ta.trend.sma_indicator(df['close'], window=200)
        df['ema_20'] = ta.trend.ema_indicator(df['close'], window=20)
        
        macd = ta.trend.MACD(df['close'])
        df['macd'] = macd.macd()
        df['macd_signal'] = macd.macd_signal()
        df['macd_diff'] = macd.macd_diff()
        
        # 2. Momentum Indicators (RSI, Stochastic)
        df['rsi_14'] = ta.momentum.rsi(df['close'], window=14)
        
        stoch = ta.momentum.StochasticOscillator(df['high'], df['low'], df['close'], window=14, smooth_window=3)
        df['stoch_k'] = stoch.stoch()
        df['stoch_d'] = stoch.stoch_signal()
        
        # 3. Volatility Indicators (Bollinger Bands, ATR)
        bb = ta.volatility.BollingerBands(df['close'], window=20, window_dev=2)
        df['bb_high'] = bb.bollinger_hband()
        df['bb_low'] = bb.bollinger_lband()
        df['bb_mid'] = bb.bollinger_mavg()
        
        df['atr_14'] = ta.volatility.average_true_range(df['high'], df['low'], df['close'], window=14)
        
        # 4. Volume Indicators
        df['obv'] = ta.volume.on_balance_volume(df['close'], df['volume'])
        
        return df
    except Exception as e:
        logger.error(f"Error computing technical indicators: {e}")
        return df
