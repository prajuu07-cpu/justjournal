import os
from pymongo import MongoClient
import certifi
import urllib.parse

# URI from .env (encoded)
uri = "mongodb+srv://prajwalaids24_db_user:prajwal%40123@cluster0.3vdnder.mongodb.net/trading_journal?retryWrites=true&w=majority"
client = MongoClient(uri, tlsCAFile=certifi.where())
db = client['trading_journal']

# Perform $pull to remove 'Model 1' from arrays
res = db.user_settings.update_many(
    {}, 
    {"$pull": {"hidden_models": "Model 1", "binned_models": "Model 1"}}
)

print(f"Modified {res.modified_count} user settings documents.")

# Also check custom_models for any soft-deleted version (though Model 1 is usually built-in)
# But based on the code, builtin Model 1 is shown if NOT in hidden_models.
