from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from db import get_db

settings_bp = Blueprint('settings', __name__)

@settings_bp.route('', methods=['GET'])
@jwt_required()
def get_settings():
    uid = ObjectId(get_jwt_identity())
    db = get_db()
    
    settings = db.user_settings.find_one({"user_id": uid})
    if not settings:
        settings = {}
        
    return jsonify({
        "weekly_limit": settings.get("weekly_limit", 2),
        "monthly_loss_limit": settings.get("monthly_loss_limit", 5),
        "hidden_models": settings.get("hidden_models", []),
        "binned_models": settings.get("binned_models", []),
        "archived_models": settings.get("archived_models", [])
    })

@settings_bp.route('', methods=['POST'])
@jwt_required()
def update_settings():
    uid = ObjectId(get_jwt_identity())
    db = get_db()
    data = request.get_json()
    
    weekly_limit = data.get("weekly_limit")
    monthly_loss_limit = data.get("monthly_loss_limit")
    
    # Use existing settings if fields are missing
    existing = db.user_settings.find_one({"user_id": uid}) or {}
    
    if weekly_limit is None:
        weekly_limit = existing.get("weekly_limit", 2)
    if monthly_loss_limit is None:
        monthly_loss_limit = existing.get("monthly_loss_limit", 5)
        
    try:
        weekly_limit = int(weekly_limit)
        monthly_loss_limit = int(monthly_loss_limit)
    except (ValueError, TypeError):
        return jsonify(error="Limits must be integers"), 400

    db.user_settings.update_one(
        {"user_id": uid},
        {"$set": {
            "weekly_limit": weekly_limit,
            "monthly_loss_limit": monthly_loss_limit,
            "hidden_models": data.get("hidden_models", []),
            "binned_models": data.get("binned_models", []),
            "archived_models": data.get("archived_models", [])
        }},
        upsert=True
    )
    
    return jsonify({
        "message": "Settings updated successfully",
        "settings": {
            "weekly_limit": weekly_limit,
            "monthly_loss_limit": monthly_loss_limit,
            "hidden_models": data.get("hidden_models", []),
            "binned_models": data.get("binned_models", []),
            "archived_models": data.get("archived_models", [])
        }
    })
