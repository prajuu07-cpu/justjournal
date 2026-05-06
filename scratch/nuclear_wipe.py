from db import get_db
import os
from dotenv import load_dotenv

load_dotenv("backend/.env")

def nuclear_wipe():
    db = get_db()
    
    print("WARNING: Starting NUCLEAR WIPE. All data will be deleted.")
    
    # 1. Wipe Trades
    t_del = db.trades.delete_many({})
    print(f" - Deleted {t_del.deleted_count} total trades.")
    
    # 2. Wipe Models
    m_del = db.models.delete_many({})
    print(f" - Deleted {m_del.deleted_count} total models.")
    
    # 3. Wipe Users
    u_del = db.users.delete_many({})
    print(f" - Deleted {u_del.deleted_count} total users.")
    
    # 4. Wipe Bin/Trash if they exist as separate collections
    if "trash" in db.list_collection_names():
        tr_del = db.trash.delete_many({})
        print(f" - Deleted {tr_del.deleted_count} items from trash.")

    print("\nNUCLEAR WIPE COMPLETE. The database is now empty.")

if __name__ == "__main__":
    nuclear_wipe()
