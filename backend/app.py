"""
Trading Journal Pro — Flask + MongoDB Backend
"""
from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
import os
import re
from dotenv import load_dotenv
load_dotenv()

load_dotenv()

app = Flask(__name__)

# ── CONFIG ────────────────────────────────────────────────────────────────────
from dotenv import load_dotenv
load_dotenv()

app.url_map.strict_slashes = False
jwt_secret = os.getenv("JWT_SECRET_KEY")
if not jwt_secret:
    raise ValueError("Missing JWT_SECRET_KEY in environment variables. Please check your .env file.")
app.config["JWT_SECRET_KEY"]           = jwt_secret
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = False  # expiry set per token (7d)

frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
trusted_origins = [
    frontend_url,
    "http://localhost:5173",
    "http://localhost:3000",
    "https://journalforx.netlify.app",
    "https://journalpairs.netlify.app",
    re.compile(r"https://.*\.netlify\.app")
]

# Allow any netlify app in dev/testing if needed, but for now just ensure CORS is robust
CORS(app, origins=trusted_origins, supports_credentials=True)

jwt = JWTManager(app)

# ── BLUEPRINTS ────────────────────────────────────────────────────────────────
from routes.auth    import auth_bp
from routes.trades  import trades_bp
from routes.reports import reports_bp
from routes.export  import export_bp
from routes.custom_models import custom_models_bp

app.register_blueprint(auth_bp,    url_prefix="/api/auth")
app.register_blueprint(trades_bp,  url_prefix="/api/trades")
app.register_blueprint(reports_bp, url_prefix="/api/reports")
app.register_blueprint(export_bp,  url_prefix="/api/export")
app.register_blueprint(custom_models_bp, url_prefix="/api/custom-models")

@app.get("/health")
def health():
    return {"status": "ok"}

@app.after_request
def add_header(response):
    """
    Prevent caching and ensure mode isolation via Vary header.
    """
    response.headers["Vary"] = "X-Mode, Authorization"
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, post-check=0, pre-check=0, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)
