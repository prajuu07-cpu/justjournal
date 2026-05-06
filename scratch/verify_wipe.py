from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv("backend/.env")

def verify():
    uri = os.getenv("MONGO_URI")
    db_name = os.getenv("MONGO_DB_NAME", "trading_journal")
    
    client = MongoClient(uri)
    db = client[db_name]
    
    print(f"--- VERIFICATION REPORT: {db_name} ---")
    collections = db.list_collection_names()
    
    total_docs = 0
    for coll_name in collections:
        count = db[coll_name].count_documents({})
        print(f"Collection '{coll_name}': {count} documents")
        total_docs += count
    
    print("---------------------------------------")
    if total_docs == 0:
        print("CONFIRMED: The database is 100% EMPTY.")
    else:
        print(f"WARNING: Found {total_docs} remaining documents.")

if __name__ == "__main__":
    verify()
