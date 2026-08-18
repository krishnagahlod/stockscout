import os
import json
import sqlite3
import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

def migrate():
    print("Loading environments...")
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
    pg_url = os.environ.get("DATABASE_URL")
    if pg_url and pg_url.startswith("postgres://"):
        pg_url = pg_url.replace("postgres://", "postgresql://", 1)

    print("Connecting to databases...")
    sqlite_conn = sqlite3.connect('../data/stock_ai.db')
    pg_engine = create_engine(pg_url)

    # TRUNCATE ALL TABLES ONCE
    with pg_engine.connect() as conn:
        print("Truncating existing Postgres tables...")
        conn.execute(text("TRUNCATE TABLE daily_prices, stock_fundamentals, technical_features, backtest_results, portfolio_allocations, alerts, news_items CASCADE;"))
        conn.execute(text("TRUNCATE TABLE strategies CASCADE;"))
        conn.execute(text("TRUNCATE TABLE stocks CASCADE;"))
        conn.commit()

    # 1. Stocks
    print("Migrating stocks...")
    df_stocks = pd.read_sql_query("SELECT * FROM stocks", sqlite_conn)
    df_stocks.rename(columns={
        'symbol': 'ticker',
        'is_nifty500': 'is_index_member',
        'last_updated': 'last_refreshed'
    }, inplace=True)
    df_stocks['exchange'] = 'NSE'
    df_stocks['is_index_member'] = df_stocks['is_index_member'].astype(bool)
    df_stocks.to_sql('stocks', pg_engine, if_exists='append', index=False)

    # 2. Daily Prices (Chunked)
    print("Migrating daily_prices...")
    for chunk in pd.read_sql_query("SELECT * FROM daily_prices", sqlite_conn, chunksize=50000):
        chunk.to_sql('daily_prices', pg_engine, if_exists='append', index=False)
        print(f"  Inserted {len(chunk)} rows of prices.")

    # 3. Fundamentals
    print("Migrating stock_fundamentals...")
    df_fund = pd.read_sql_query("SELECT * FROM fundamentals", sqlite_conn)
    df_fund.rename(columns={'period_end': 'as_of_date', 'trailing_pe': 'pe', 'price_to_book': 'pb'}, inplace=True)
    cols_to_keep = ['id', 'stock_id', 'as_of_date', 'pe', 'pb', 'roe', 'roce', 'debt_to_equity', 'dividend_yield', 'eps', 'ebitda', 'free_cash_flow', 'revenue', 'net_income', 'gross_margin', 'operating_margin', 'net_margin', 'revenue_cagr_3y', 'revenue_cagr_5y', 'eps_cagr_3y']
    df_fund = df_fund[[c for c in df_fund.columns if c in cols_to_keep]]
    df_fund.to_sql('stock_fundamentals', pg_engine, if_exists='append', index=False)

    # 4. Technical Features
    print("Migrating technical_features...")
    df_tech = pd.read_sql_query("SELECT * FROM technical_features", sqlite_conn)
    tech_cols_to_keep = ['id', 'stock_id', 'date', 'sma_50', 'sma_200', 'ema_50', 'ema_200', 'rsi_14', 'macd', 'macd_signal', 'macd_histogram', 'atr_14', 'bollinger_upper', 'bollinger_lower', 'bollinger_width', 'volatility_30d', 'volatility_90d', 'max_drawdown_1y', 'sharpe_trailing', 'momentum_12m']
    df_tech = df_tech[[c for c in df_tech.columns if c in tech_cols_to_keep]]
    df_tech.to_sql('technical_features', pg_engine, if_exists='append', index=False)

    # 5. Strategies
    print("Migrating strategies...")
    df_strat = pd.read_sql_query("SELECT * FROM strategies", sqlite_conn)
    df_strat.to_sql('strategies', pg_engine, if_exists='append', index=False)

    # 6. Backtest Results
    print("Migrating backtest_results...")
    df_bt = pd.read_sql_query("SELECT * FROM backtest_results", sqlite_conn)
    df_bt.rename(columns={
        'equity_curve_json': 'equity_curve',
        'monthly_returns_json': 'monthly_returns',
        'trade_log_json': 'trade_log',
        'parameters_json': 'parameters',
        'holdings_json': 'holdings'
    }, inplace=True)
    
    from sqlalchemy.dialects.postgresql import JSONB
    json_cols = ['equity_curve', 'monthly_returns', 'trade_log', 'parameters', 'holdings']
    for col in json_cols:
        df_bt[col] = df_bt[col].apply(lambda x: json.loads(x) if x and isinstance(x, str) else None)

    df_bt.to_sql('backtest_results', pg_engine, if_exists='append', index=False, dtype={col: JSONB for col in json_cols})
    
    # Reset sequences
    print("Resetting sequences...")
    with pg_engine.connect() as conn:
        tables_seqs = {
            'stocks': 'stocks_id_seq',
            'daily_prices': 'daily_prices_id_seq',
            'stock_fundamentals': 'stock_fundamentals_id_seq',
            'technical_features': 'technical_features_id_seq',
            'strategies': 'strategies_id_seq',
            'backtest_results': 'backtest_results_id_seq'
        }
        for table, seq in tables_seqs.items():
            conn.execute(text(f"SELECT setval('{seq}', (SELECT COALESCE(MAX(id), 1) FROM {table}));"))
        conn.commit()

    sqlite_conn.close()
    print("Migration complete!")

if __name__ == "__main__":
    migrate()
