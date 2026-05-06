from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv("backend/.env")

def final_wipe():
    uri = os.getenv("MONGO_URI")
    db_name = os.getenv("MONGO_DB_NAME", "trading_journal")
    
    client = MongoClient(uri)
    db = client[db_name]
    
    print("Performing final wipe of ALL collections...")
    all_colls = db.list_collection_names()
    for coll in all_colls:
        print(f"Wiping {coll}...")
        db[coll].delete_many({})
    
    print("\nSUCCESS: Database is now 100% EMPTY across all collections.")

if __name__ == "__main__":
    final_wipe()
