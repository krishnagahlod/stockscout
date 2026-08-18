import os
import psycopg2
from dotenv import load_dotenv

def main():
    # Use the original DATABASE_URL from .env
    load_dotenv(dotenv_path="c:/Stock AI tool/backend/.env")
    database_url = os.environ.get("DATABASE_URL")
    
    # We must explicitly disable prepared statements for pgbouncer (transaction mode port 6543)
    # We can just add "?options=-c%20statement_timeout=0" or connect safely
    
    # Connect
    conn = psycopg2.connect(database_url)
    conn.autocommit = True
    cursor = conn.cursor()
    
    try:
        cursor.execute("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;")
        print("Successfully added is_admin column to user_profiles.")
        
        cursor.execute("SELECT id FROM auth.users WHERE email = 'krishnagahlod@gmail.com'")
        user_record = cursor.fetchone()
        
        if user_record:
            cursor.execute("UPDATE user_profiles SET is_admin = TRUE WHERE user_id = %s", (user_record[0],))
            print("Successfully made krishnagahlod@gmail.com an admin.")
        else:
            print("Account krishnagahlod@gmail.com does not exist yet. Please create it through the UI, and then run this script again.")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    main()
