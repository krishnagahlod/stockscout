import sqlite3
import pandas as pd

conn = sqlite3.connect('../data/stock_ai.db')
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cur.fetchall()

for table in tables:
    table_name = table[0]
    print(f"Table: {table_name}")
    df = pd.read_sql_query(f"SELECT * FROM {table_name} LIMIT 1", conn)
    print(df.columns.tolist())
    print("Row count:", pd.read_sql_query(f"SELECT COUNT(*) as c FROM {table_name}", conn)['c'].iloc[0])
    print()
