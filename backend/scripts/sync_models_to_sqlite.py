import sqlite3
import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.database import Base
import app.models.db_models

db_path = os.path.abspath("data/stock_ai.db")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get existing tables in SQLite
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
sqlite_tables = {r[0] for r in cursor.fetchall()}

for mapper in Base.registry.mappers:
    table = mapper.persist_selectable
    table_name = table.name
    if table_name not in sqlite_tables:
        print(f"Table '{table_name}' does not exist in SQLite, creating it...")
        # create table
        cols_defs = []
        for col in table.columns:
            col_type = "TEXT"
            if "int" in str(col.type).lower():
                col_type = "INTEGER"
            elif "float" in str(col.type).lower() or "numeric" in str(col.type).lower():
                col_type = "REAL"
            elif "bool" in str(col.type).lower():
                col_type = "BOOLEAN"
            elif "date" in str(col.type).lower() or "time" in str(col.type).lower():
                col_type = "DATETIME"
            
            pk = "PRIMARY KEY" if col.primary_key else ""
            cols_defs.append(f'"{col.name}" {col_type} {pk}')
        sql = f'CREATE TABLE IF NOT EXISTS "{table_name}" ({", ".join(cols_defs)})'
        cursor.execute(sql)
        conn.commit()
        sqlite_tables.add(table_name)
    else:
        # Check missing columns
        cursor.execute(f"PRAGMA table_info('{table_name}')")
        existing_cols = {r[1] for r in cursor.fetchall()}
        for col in table.columns:
            if col.name not in existing_cols:
                col_type = "TEXT"
                if "int" in str(col.type).lower():
                    col_type = "INTEGER"
                elif "float" in str(col.type).lower() or "numeric" in str(col.type).lower():
                    col_type = "REAL"
                elif "bool" in str(col.type).lower():
                    col_type = "BOOLEAN"
                elif "date" in str(col.type).lower() or "time" in str(col.type).lower():
                    col_type = "DATETIME"
                
                print(f"Adding missing column '{col.name}' ({col_type}) to table '{table_name}'")
                cursor.execute(f'ALTER TABLE "{table_name}" ADD COLUMN "{col.name}" {col_type}')
                conn.commit()

conn.close()
print("All SQLAlchemy models perfectly synchronized with SQLite tables!")
