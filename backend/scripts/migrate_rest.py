import os
import json
import sqlite3
import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

def migrate_rest():
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))
    pg_url = os.environ.get("DATABASE_URL")
    if not pg_url:
        load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
        pg_url = os.environ.get("DATABASE_URL")
    if pg_url and pg_url.startswith("postgres://"):
        pg_url = pg_url.replace("postgres://", "postgresql://", 1)

    sqlite_conn = sqlite3.connect('../data/stock_ai.db')
    pg_engine = create_engine(pg_url)

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
    
    # We will insert rows manually to bypass pandas JSONB weirdness
    import numpy as np
    df_bt = df_bt.replace({np.nan: None})
    
    with pg_engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE backtest_results CASCADE;"))
        for _, row in df_bt.iterrows():
            params = row.to_dict()
            for col in ['equity_curve', 'monthly_returns', 'trade_log', 'parameters', 'holdings']:
                params[col] = params[col] if params[col] else None # Insert string directly, we will cast it in SQL
            
            # Ensure new columns exist in params
            for col in ['avg_trade_return', 'benchmark_return', 'transaction_cost_bps', 'slippage_bps']:
                if col not in params:
                    params[col] = None

            conn.execute(text("""
                INSERT INTO backtest_results 
                (id, strategy_id, run_date, start_date, end_date, initial_capital, final_value, cagr, total_return, max_drawdown, sharpe_ratio, sortino_ratio, calmar_ratio, volatility, win_rate, total_trades, avg_trade_return, benchmark_return, transaction_cost_bps, slippage_bps, equity_curve, monthly_returns, trade_log, parameters, holdings)
                VALUES 
                (:id, :strategy_id, :run_date, :start_date, :end_date, :initial_capital, :final_value, :cagr, :total_return, :max_drawdown, :sharpe_ratio, :sortino_ratio, :calmar_ratio, :volatility, :win_rate, :total_trades, :avg_trade_return, :benchmark_return, :transaction_cost_bps, :slippage_bps, cast(:equity_curve as jsonb), cast(:monthly_returns as jsonb), cast(:trade_log as jsonb), cast(:parameters as jsonb), cast(:holdings as jsonb))
            """), params)

    # 7. Portfolio Allocations
    print("Migrating portfolio_allocations...")
    df_port = pd.read_sql_query("SELECT * FROM portfolio_allocations", sqlite_conn)
    with pg_engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE portfolio_allocations CASCADE;"))
    if not df_port.empty:
        df_port.to_sql('portfolio_allocations', pg_engine, if_exists='append', index=False)

    # 8. Alerts
    print("Migrating alerts...")
    df_alerts = pd.read_sql_query("SELECT * FROM alerts", sqlite_conn)
    with pg_engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE alerts CASCADE;"))
    if not df_alerts.empty:
        df_alerts.to_sql('alerts', pg_engine, if_exists='append', index=False)

    print("Migration of remaining tables complete!")

if __name__ == "__main__":
    migrate_rest()
