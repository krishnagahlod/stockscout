import psycopg2
import os

db_url = os.environ.get("DATABASE_URL")
conn = psycopg2.connect(db_url)
cur = conn.cursor()
try:
    cur.execute("INSERT INTO score_results (user_id, stock_id, fundamentals_score, sector_score, news_score, combined_score, risk_band, score_breakdown) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)", ('608f555b-eef6-4fec-a35a-a14dfd043da2', 7, 50, 50, 50, 50, 'moderate', '{}'))
    conn.commit()
    print("Inserted")
except Exception as e:
    print("Error:", e)
cur.execute("SELECT COUNT(*) FROM score_results")
print(cur.fetchone()[0])
cur.close()
conn.close()
