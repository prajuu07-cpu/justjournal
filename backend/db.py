"""
MongoDB connection — single shared client & db reference.
"""
from pymongo import MongoClient, DESCENDING
import os

_client = None
_db     = None

def get_db():
    global _client, _db
    if _db is None:
        uri  = os.getenv("MONGO_URI")
        if not uri:
            raise ValueError("Missing MONGO_URI in environment variables. Please add your MongoDB connection string.")
        
        name = os.getenv("MONGO_DB_NAME", "trading_journal")
        import certifi
        ca = certifi.where()
        _client = MongoClient(uri, serverSelectionTimeoutMS=5000, tlsCAFile=ca)
        # Verify connection
        _client.admin.command("ping")
        _db = _client[name]
        _ensure_indexes(_db)
    return _db

def _ensure_indexes(db):
    # trades
    db.trades.create_index([("user_id", 1), ("date", DESCENDING)])
    db.trades.create_index([("user_id", 1), ("status", 1)])
    db.trades.create_index([("user_id", 1), ("status", 1), ("result", 1)])
    # reports
    db.monthly_reports.create_index(
        [("user_id", 1), ("year", 1), ("month", 1)], unique=True
    )
    db.yearly_reports.create_index(
        [("user_id", 1), ("year", 1)], unique=True
    )
    # users
    db.users.create_index("email",    unique=True)
    db.users.create_index("username", unique=True)
