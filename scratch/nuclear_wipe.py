from pymongo import MongoClient
import os
from dotenv import load_dotenv

# Load env from backend directory
load_dotenv("backend/.env")

def cleanup():
    uri = os.getenv("MONGO_URI")
    db_name = os.getenv("MONGO_DB_NAME", "trading_journal")
    
    if not uri:
        print("Error: MONGO_URI not found in .env")
        return

    print(f"Connecting to Cloud DB: {db_name}...")
    client = MongoClient(uri)
    db = client[db_name]
    
    collections = ["users", "trades", "user_settings", "models", "monthly_reports", "yearly_reports"]
    
    for coll in collections:
        print(f"Wiping {coll}...")
        db[coll].delete_many({})
    
    print("\nSUCCESS: Database is now completely empty and fresh.")

if __name__ == "__main__":
    cleanup()
