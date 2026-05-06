import os
from pymongo import MongoClient
import certifi
from dotenv import load_dotenv

# Load env vars
load_dotenv(r"d:\TradingJournal\justjournal\backend\.env")

# MongoDB connection
uri = os.getenv("MONGO_URI")
db_name = os.getenv("MONGO_DB_NAME", "trading_journal")
ca = certifi.where()
client = MongoClient(uri, tlsCAFile=ca)
db = client[db_name]

# 1. Update the code file
filepath = r"d:\TradingJournal\justjournal\backend\routes\trades.py"
with open(filepath, 'r') as f:
    content = f.read()

# Fix create_trade logic
# Looking for:
#             if result == "Loss":
#                 r_multiple = 0.0
#                 pnl = -float(risk)
# Replacing with:
#             if result == "Loss":
#                 r_multiple = -1.0
#                 pnl = -float(risk)

content = content.replace('r_multiple = 0.0\n                pnl = -float(risk)', 'r_multiple = -1.0\n                pnl = -float(risk)')

# Fix add_result logic (already partially done by model, but let's be sure)
# Looking for:
#     if result in ("Loss", "Breakeven"):
#         r_multiple = 0.0
# Replacing with:
#     if result == "Loss":
#         r_multiple = -1.0
#     elif result == "Breakeven":
#         r_multiple = 0.0

content = content.replace('if result in ("Loss", "Breakeven"):\n        r_multiple = 0.0', 'if result == "Loss":\n        r_multiple = -1.0\n    elif result == "Breakeven":\n        r_multiple = 0.0')

with open(filepath, 'w') as f:
    f.write(content)

# 2. Update existing database records
# Find all "final" trades with result "Loss" and r_multiple 0.0
res = db.trades.update_many(
    {"status": "final", "result": "Loss", "r_multiple": 0.0},
    {"$set": {"r_multiple": -1.0}}
)

print(f"Updated {res.modified_count} trades in database.")
