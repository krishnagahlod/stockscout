import sqlite3
import os

db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "stock_ai.db")
print("Target SQLite DB:", db_path)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

def add_col_if_missing(table, col, col_type, copy_from=None):
    cursor.execute(f"PRAGMA table_info('{table}')")
    cols = [r[1] for r in cursor.fetchall()]
    if col not in cols:
        print(f"Adding {col} to {table}...")
        cursor.execute(f'ALTER TABLE "{table}" ADD COLUMN "{col}" {col_type}')
        if copy_from and copy_from in cols:
            cursor.execute(f'UPDATE "{table}" SET "{col}" = "{copy_from}"')
            print(f"  Copied data from {copy_from} to {col}")
        conn.commit()
    else:
        print(f"{col} already exists in {table}")

# stocks
add_col_if_missing('stocks', 'ticker', 'TEXT', 'symbol')
add_col_if_missing('stocks', 'is_index_member', 'BOOLEAN', 'is_nifty500')
add_col_if_missing('stocks', 'last_refreshed', 'DATETIME', 'last_updated')
add_col_if_missing('stocks', 'exchange', 'TEXT')
cursor.execute("UPDATE stocks SET exchange = 'NSE' WHERE exchange IS NULL")

# backtest_results
add_col_if_missing('backtest_results', 'equity_curve', 'TEXT', 'equity_curve_json')
add_col_if_missing('backtest_results', 'monthly_returns', 'TEXT', 'monthly_returns_json')
add_col_if_missing('backtest_results', 'trade_log', 'TEXT', 'trade_log_json')
add_col_if_missing('backtest_results', 'parameters', 'TEXT', 'parameters_json')
add_col_if_missing('backtest_results', 'holdings', 'TEXT', 'holdings_json')

# portfolio_allocations
add_col_if_missing('portfolio_allocations', 'allocations', 'TEXT', 'allocations_json')

# alerts
add_col_if_missing('alerts', 'condition', 'TEXT', 'condition_json')

conn.commit()
conn.close()
print("SQLite migration completed successfully!")
