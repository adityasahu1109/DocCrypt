import sqlite3
import os

DB_FILE = "trust_registry.db"

def purge_db():
    print(f"Purging trust_registry database: {DB_FILE}...")
    try:
        if os.path.exists(DB_FILE):
            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM public_keys")
            conn.commit()
            conn.close()
            print("Successfully purged 'public_keys' table.")
        else:
            print("Database file does not exist. Nothing to purge.")
    except Exception as e:
        print(f"Error purging database: {e}")

if __name__ == "__main__":
    purge_db()
