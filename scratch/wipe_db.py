from pymongo import MongoClient
import os
from dotenv import load_dotenv
import certifi

def wipe_database():
    load_dotenv("backend/.env")
    
    uri = os.getenv("MONGO_URI")
    db_name = os.getenv("MONGO_DB_NAME", "trading_journal")
    
    if not uri:
        print("MONGO_URI not found.")
        return

    ca = certifi.where()
    client = MongoClient(uri, tlsCAFile=ca)
    db = client[db_name]
    
    collections = [
        "users",
        "trades",
        "custom_models",
        "user_settings",
        "monthly_reports",
        "yearly_reports",
        "pips_data" # just in case
    ]
    
    print(f"Starting database wipe for: {db_name}")
    
    for coll in collections:
        count = db[coll].count_documents({})
        if count > 0:
            db[coll].delete_many({})
            print(f" - Deleted {count} documents from '{coll}'")
        else:
            print(f" - Collection '{coll}' is already empty")
            
    print("Database wipe complete.")

if __name__ == "__main__":
    wipe_database()
