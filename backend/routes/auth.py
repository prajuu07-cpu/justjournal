"""
Auth routes: POST /register  POST /login  GET /me
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from pymongo.errors import DuplicateKeyError
from bson import ObjectId
from datetime import datetime, timezone, timedelta
import re
from db import get_db

auth_bp = Blueprint("auth", __name__)


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _user_out(doc):
    return {"id": str(doc["_id"]), "email": doc["email"], "username": doc["username"]}


@auth_bp.post("/register")
def register():
    data     = request.get_json(silent=True) or {}
    email    = (data.get("email")    or "").strip().lower()
    username = (data.get("username") or "").strip().lower()
    password =  data.get("password") or ""

    if not email or not username or not password:
        return jsonify(error="email, username and password are required"), 400
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        return jsonify(error="Invalid email address"), 400
    if not re.match(r"^\w{3,30}$", username):
        return jsonify(error="Username: 3-30 letters, numbers or underscores"), 400
    if len(password) < 6:
        return jsonify(error="Password must be at least 6 characters"), 400

    db = get_db()
    doc = {
        "email":         email,
        "username":      username,
        "password_hash": generate_password_hash(password, method="pbkdf2:sha256", salt_length=16),
        "created_at":    _now_iso(),
    }
    try:
        result = db.users.insert_one(doc)
    except DuplicateKeyError:
        return jsonify(error="Email or username already in use"), 409

    doc["_id"] = result.inserted_id
    token = create_access_token(
        identity=str(result.inserted_id),
        expires_delta=timedelta(days=365),
    )
    return jsonify(token=token, user=_user_out(doc)), 201


@auth_bp.post("/login")
def login():
    data     = request.get_json(silent=True) or {}
    email    = (data.get("email")    or "").strip().lower()
    password =  data.get("password") or ""

    if not email or not password:
        return jsonify(error="email and password are required"), 400

    db  = get_db()
    doc = db.users.find_one({"email": email})
    if not doc or not check_password_hash(doc["password_hash"], password):
        return jsonify(error="Invalid email or password"), 401

    token = create_access_token(
        identity=str(doc["_id"]),
        expires_delta=timedelta(days=365),
    )
    return jsonify(token=token, user=_user_out(doc))


@auth_bp.get("/me")
@jwt_required()
def me():
    uid = ObjectId(get_jwt_identity())
    db  = get_db()
    doc = db.users.find_one({"_id": uid})
    if not doc:
        return jsonify(error="User not found"), 404
    return jsonify(user=_user_out(doc))
