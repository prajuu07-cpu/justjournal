from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from db import get_db

settings_bp = Blueprint('settings', __name__)

@settings_bp.route('/models', methods=['GET'])
@jwt_required()
def get_journal_models():
    uid = ObjectId(get_jwt_identity())
    db = get_db()
    
    # Strictly follow the "New Trade" screen logic for Journal mode:
    # Only show custom models assigned to 'justchill' mode that are not deleted.
    # Treat different casing as independent models.
    models_list = []
    
    custom_models = db.custom_models.find({
        "user_id": uid, 
        "is_deleted": {"$ne": True},
        "mode": "justchill"
    })
    for cm in custom_models:
        name = cm.get("name")
        if name and name not in models_list:
            models_list.append(name)
                
    models_list.sort() # Natural sort
    return jsonify(models=models_list)

def _get_settings_data(uid, model=None):
    db = get_db()
    settings = db.user_settings.find_one({"user_id": uid})
    if not settings:
        settings = {}
        
    res = {
        "hidden_models": settings.get("hidden_models", []),
        "binned_models": settings.get("binned_models", []),
        "archived_models": settings.get("archived_models", []),
        "model_order": settings.get("model_order", [])
    }
    
    if model:
        model_limits = settings.get("model_limits", {})
        # Strictly case-sensitive lookup
        limits = model_limits.get(model, {})
        
        res.update({
            "weekly_limit": limits.get("weekly_limit", ""),
            "weekly_limit_enabled": limits.get("weekly_limit_enabled", False),
            "weekly_loss_limit": limits.get("weekly_loss_limit", ""),
            "weekly_loss_limit_enabled": limits.get("weekly_loss_limit_enabled", False),
            "monthly_loss_limit": limits.get("monthly_loss_limit", ""),
            "monthly_loss_limit_enabled": limits.get("monthly_loss_limit_enabled", False),
        })
    else:
        # Fallback/Global
        res.update({
            "weekly_limit": settings.get("weekly_limit", ""),
            "weekly_limit_enabled": settings.get("weekly_limit_enabled", False),
            "weekly_loss_limit": settings.get("weekly_loss_limit", ""),
            "weekly_loss_limit_enabled": settings.get("weekly_loss_limit_enabled", False),
            "monthly_loss_limit": settings.get("monthly_loss_limit", ""),
            "monthly_loss_limit_enabled": settings.get("monthly_loss_limit_enabled", False),
        })
    return res

@settings_bp.route('', methods=['GET'])
@jwt_required()
def get_settings():
    uid = ObjectId(get_jwt_identity())
    model = request.args.get("model")
    return jsonify(_get_settings_data(uid, model))

@settings_bp.route('', methods=['POST'])
@jwt_required()
def update_settings():
    uid = ObjectId(get_jwt_identity())
    db = get_db()
    data = request.get_json()
    model = data.get("model")
    
    weekly_limit = data.get("weekly_limit")
    weekly_limit_enabled = data.get("weekly_limit_enabled")
    weekly_loss_limit = data.get("weekly_loss_limit")
    weekly_loss_limit_enabled = data.get("weekly_loss_limit_enabled")
    monthly_loss_limit = data.get("monthly_loss_limit")
    monthly_loss_limit_enabled = data.get("monthly_loss_limit_enabled")
    
    # Use existing settings if fields are missing
    existing = db.user_settings.find_one({"user_id": uid}) or {}
    
    # Validation
    try:
        if weekly_limit is not None:
            weekly_limit = int(weekly_limit) if weekly_limit else 0
        if weekly_loss_limit is not None:
            weekly_loss_limit = int(weekly_loss_limit) if weekly_loss_limit else 0
        if monthly_loss_limit is not None:
            monthly_loss_limit = int(monthly_loss_limit) if monthly_loss_limit else 0
    except (ValueError, TypeError):
        return jsonify(error="Limits must be integers"), 400

    update_fields = {
        "hidden_models": data.get("hidden_models", existing.get("hidden_models", [])),
        "binned_models": data.get("binned_models", existing.get("binned_models", [])),
        "archived_models": data.get("archived_models", existing.get("archived_models", [])),
        "model_order": data.get("model_order", existing.get("model_order", []))
    }

    if model:
        # Per-model update (strictly case-sensitive)
        model_limits = existing.get("model_limits", {})
        target_key = model
        current_limits = model_limits.get(target_key, {})
        
        new_limits = {
            "weekly_limit": weekly_limit if weekly_limit is not None else current_limits.get("weekly_limit", 0),
            "weekly_limit_enabled": bool(weekly_limit_enabled) if weekly_limit_enabled is not None else current_limits.get("weekly_limit_enabled", False),
            "weekly_loss_limit": weekly_loss_limit if weekly_loss_limit is not None else current_limits.get("weekly_loss_limit", 0),
            "weekly_loss_limit_enabled": bool(weekly_loss_limit_enabled) if weekly_loss_limit_enabled is not None else current_limits.get("weekly_loss_limit_enabled", False),
            "monthly_loss_limit": monthly_loss_limit if monthly_loss_limit is not None else current_limits.get("monthly_loss_limit", 0),
            "monthly_loss_limit_enabled": bool(monthly_loss_limit_enabled) if monthly_loss_limit_enabled is not None else current_limits.get("monthly_loss_limit_enabled", False),
        }
        
        update_fields[f"model_limits.{target_key}"] = new_limits
    else:
        # Global update (legacy support)
        if weekly_limit is not None: update_fields["weekly_limit"] = weekly_limit
        if weekly_limit_enabled is not None: update_fields["weekly_limit_enabled"] = bool(weekly_limit_enabled)
        if weekly_loss_limit is not None: update_fields["weekly_loss_limit"] = weekly_loss_limit
        if weekly_loss_limit_enabled is not None: update_fields["weekly_loss_limit_enabled"] = bool(weekly_loss_limit_enabled)
        if monthly_loss_limit is not None: update_fields["monthly_loss_limit"] = monthly_loss_limit
        if monthly_loss_limit_enabled is not None: update_fields["monthly_loss_limit_enabled"] = bool(monthly_loss_limit_enabled)

    db.user_settings.update_one(
        {"user_id": uid},
        {"$set": update_fields},
        upsert=True
    )
    
    return jsonify({
        "message": "Settings updated successfully",
        "settings": _get_settings_data(uid, model)
    })
