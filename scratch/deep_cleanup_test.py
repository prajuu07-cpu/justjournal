from db import get_db
import os
from dotenv import load_dotenv

load_dotenv("backend/.env")

def deep_cleanup():
    db = get_db()
    
    # Find ALL users with 'test' in their username (case-insensitive)
    test_users = list(db.users.find({"username": {"$regex": "test", "$options": "i"}}))
    
    if not test_users:
        print("No remaining 'test' accounts found.")
        return

    print(f"Found {len(test_users)} matching accounts:")
    for user in test_users:
        uid = user["_id"]
        username = user["username"]
        print(f"\nPurging @{username} (ID: {uid})...")
        
        # 1. Delete trades
        t_del = db.trades.delete_many({"user_id": uid})
        print(f" - Deleted {t_del.deleted_count} trades.")
        
        # 2. Delete models
        m_del = db.models.delete_many({"user_id": uid})
        print(f" - Deleted {m_del.deleted_count} models.")
        
        # 3. Delete user record
        u_del = db.users.delete_one({"_id": uid})
        print(f" - Deleted user record: {u_del.deleted_count}")

    print("\nDeep cleanup complete.")

if __name__ == "__main__":
    deep_cleanup()
