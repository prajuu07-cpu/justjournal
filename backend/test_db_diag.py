import os
from dotenv import load_dotenv
from pymongo import MongoClient
import sys

load_dotenv()

def test_mongo():
    uri = os.getenv("MONGO_URI")
    db_name = os.getenv("MONGO_DB_NAME", "trading_journal")
    
    if not uri:
        print("ERROR: MONGO_URI not found in .env")
        return
    
    print(f"Attempting to connect to MongoDB: {uri.split('@')[-1]}") # Hide credentials
    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=5000, tlsAllowInvalidCertificates=True)
        client.admin.command("ping")
        print("SUCCESS: Connected to MongoDB")
        db = client[db_name]
        users_count = db.users.count_documents({})
        print(f"SUCCESS: Found {users_count} users in database '{db_name}'")
    except Exception as e:
        print(f"ERROR: Failed to connect to MongoDB: {e}")

if __name__ == "__main__":
    test_mongo()
