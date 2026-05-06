import os
from pymongo import MongoClient
import certifi
from dotenv import load_dotenv
import sys

# Add backend to path
sys.path.append(r"d:\TradingJournal\justjournal\backend")
from rebuild_reports import rebuild_reports

# Load env vars
load_dotenv(r"d:\TradingJournal\justjournal\backend\.env")

# MongoDB connection
uri = os.getenv("MONGO_URI")
db_name = os.getenv("MONGO_DB_NAME", "trading_journal")
ca = certifi.where()
client = MongoClient(uri, tlsCAFile=ca)
db = client[db_name]

# Find all unique users who had their trades updated
# For simplicity, just rebuild for all users who have trades
users = db.trades.distinct("user_id")
for uid in users:
    print(f"Rebuilding reports for user {uid}...")
    rebuild_reports(str(uid))

print("All reports rebuilt.")
