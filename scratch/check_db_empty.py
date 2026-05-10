from pymongo import MongoClient
import os
from dotenv import load_dotenv
import certifi

def check_database_empty():
    load_dotenv("backend/.env")
    
    uri = os.getenv("MONGO_URI")
    db_name = os.getenv("MONGO_DB_NAME", "trading_journal")
    
    if not uri:
        print("MONGO_URI not found.")
        return

    ca = certifi.where()
    client = MongoClient(uri, tlsCAFile=ca)
    db = client[db_name]
    
    collections = db.list_collection_names()
    
    print(f"Checking all collections in database: {db_name}")
    
    if not collections:
        print("Database is completely empty (no collections found).")
        return

    is_empty = True
    for coll in collections:
        count = db[coll].count_documents({})
        print(f" - Collection '{coll}': {count} documents")
        if count > 0:
            is_empty = False
            
    if is_empty:
        print("\nAll existing collections are currently empty (0 documents).")
    else:
        print("\nWarning: Database still contains some documents.")

if __name__ == "__main__":
    check_database_empty()
