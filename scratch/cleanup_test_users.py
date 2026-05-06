from db import get_db
from bson import ObjectId
import os
from dotenv import load_dotenv

load_dotenv("backend/.env")

def cleanup():
    db = get_db()
    usernames = ["test", "test2", "test3"]
    
    for username in usernames:
        user = db.users.find_one({"username": username})
        if not user:
            print(f"User @{username} not found.")
            continue
            
        uid = user["_id"]
        print(f"Cleaning up @{username} (ID: {uid})...")
        
        # 1. Delete trades
        t_del = db.trades.delete_many({"user_id": uid})
        print(f" - Deleted {t_del.deleted_count} trades.")
        
        # 2. Delete models
        m_del = db.models.delete_many({"user_id": uid})
        print(f" - Deleted {m_del.deleted_count} models.")
        
        # 3. Delete user
        u_del = db.users.delete_one({"_id": uid})
        print(f" - Deleted user record: {u_del.deleted_count}")
        
    print("\nCleanup complete.")

if __name__ == "__main__":
    cleanup()
