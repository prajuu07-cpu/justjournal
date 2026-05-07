from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from db import get_db
from datetime import datetime
import random
import re

custom_models_bp = Blueprint('custom_models', __name__)

MODEL_COLORS = [
    { "bg": "#F0F9FF", "text": "#0369A1", "border": "#B9E6FE" }, # Light Blue
    { "bg": "#F0FDF4", "text": "#15803D", "border": "#BBF7D0" }, # Light Green
    { "bg": "#FFF7ED", "text": "#C2410C", "border": "#FFEDD5" }, # Light Orange
    { "bg": "#FEFCE8", "text": "#A16207", "border": "#FEF9C3" }, # Light Yellow
    { "bg": "#FAF5FF", "text": "#7E22CE", "border": "#E9D5FF" }, # Light Purple
    { "bg": "#FDF2F8", "text": "#BE185D", "border": "#FCE7F3" }, # Light Pink
    { "bg": "#ECFEFF", "text": "#0E7490", "border": "#CFFAFE" }, # Light Cyan
    { "bg": "#F5F3FF", "text": "#6D28D9", "border": "#EDE9FE" }  # Light Violet
]

def _now_iso():
    return datetime.utcnow().isoformat()

@custom_models_bp.route('', methods=['GET'])
@jwt_required()
def get_custom_models():
    uid = ObjectId(get_jwt_identity())
    db = get_db()
    mode_filter = request.args.get('mode')
    query = {"user_id": uid, "is_deleted": {"$ne": True}}
    if mode_filter:
        query["mode"] = mode_filter
        
    models = list(db.custom_models.find(query).sort('created_at', 1))
    for m in models:
        m['_id'] = str(m['_id'])
        if 'user_id' in m: m['user_id'] = str(m['user_id'])
    return jsonify(models)

@custom_models_bp.route('/bin', methods=['GET'])
@jwt_required()
def get_binned_models():
    uid = ObjectId(get_jwt_identity())
    db = get_db()
    models = list(db.custom_models.find({"user_id": uid, "is_deleted": True}))
    for m in models:
        m['_id'] = str(m['_id'])
        if 'user_id' in m: m['user_id'] = str(m['user_id'])
    return jsonify(models)

@custom_models_bp.route('/<model_id>/restore', methods=['POST'])
@jwt_required()
def restore_custom_model(model_id):
    uid = ObjectId(get_jwt_identity())
    db = get_db()
    try:
        oid = ObjectId(model_id)
    except:
        return jsonify(error="Invalid model ID"), 400

    db.custom_models.update_one(
        {"_id": oid, "user_id": uid},
        {"$set": {"is_deleted": False}, "$unset": {"deleted_at": ""}}
    )
    return jsonify(message="Model restored successfully")

@custom_models_bp.route('/bin', methods=['DELETE'])
@jwt_required()
def empty_bin():
    uid = ObjectId(get_jwt_identity())
    db = get_db()
    db.custom_models.delete_many({"user_id": uid, "is_deleted": True})
    return jsonify(message="Bin emptied successfully")

@custom_models_bp.route('', methods=['POST'])
@jwt_required()
def create_custom_model():
    uid = ObjectId(get_jwt_identity())
    db = get_db()
    data = request.get_json()
    
    name = data.get('name', '').strip()
    checklist = data.get('checklist', [])
    notes = data.get('notes', '').strip()
    model_mode = data.get('mode', 'justchill')
    created_from = data.get('createdFrom', 'practice')

    if not name:
        return jsonify(error="Model name is required"), 400
    if not isinstance(checklist, list):
        return jsonify(error="Checklist must be a list"), 400

    # Fetch user settings to check for hidden/binned models
    settings = db.user_settings.find_one({"user_id": uid}) or {}
    hidden_models = settings.get("hidden_models", [])
    binned_models = settings.get("binned_models", [])
    hidden_lower = [h.lower() for h in hidden_models]
    binned_lower = [b.lower() for b in binned_models]

    # Check for name uniqueness (case-insensitive) across all modes
    existing_model = db.custom_models.find_one({
        "user_id": uid,
        "is_deleted": {"$ne": True},
        "name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}
    })
    
    if existing_model:
        return jsonify(error="This model name already exists.", message="MODEL_EXISTS"), 400
    
    # Get colors of all currently active (non-deleted) models to ensure uniqueness
    active_models = db.custom_models.find({"user_id": uid, "is_deleted": {"$ne": True}})
    used_colors = [m.get("color") for m in active_models if m.get("color")]
    
    # Filter out colors already in use
    available_colors = [c for c in MODEL_COLORS if c not in used_colors]
    
    if not available_colors:
        # If all colors are used, we can't guarantee uniqueness across ALL models, 
        # so just pick one at random or reuse the oldest used color.
        assigned_color = random.choice(MODEL_COLORS)
    else:
        assigned_color = random.choice(available_colors)

    # Special handling for "Model 3" name for legacy reasons if desired, 
    # but the user requested distinct colors even for identical names.
    if name.lower() == "model 3" and assigned_color not in used_colors:
        # Keep pink for Model 3 if it's available
        assigned_color = { "bg": "#FDF2F8", "text": "#DB2777", "border": "#FCE7F3" }

    new_model = {
        "user_id": uid,
        "name": name,
        "checklist": checklist,
        "notes": notes,
        "mode": model_mode,
        "createdFrom": created_from,
        "color": assigned_color,
        "created_at": _now_iso(),
        "is_deleted": False
    }
    
    result = db.custom_models.insert_one(new_model)
    new_model['_id'] = str(result.inserted_id)
    new_model['user_id'] = str(new_model['user_id'])
    
    return jsonify(new_model), 201

@custom_models_bp.route('/<model_id>', methods=['DELETE'])
@jwt_required()
def delete_custom_model(model_id):
    uid = ObjectId(get_jwt_identity())
    db = get_db()
    
    try:
        oid = ObjectId(model_id)
    except:
        return jsonify(error="Invalid model ID"), 400

    result = db.custom_models.update_one(
        {"_id": oid, "user_id": uid},
        {"$set": {"is_deleted": True, "deleted_at": _now_iso()}}
    )
    
    if result.matched_count == 0:
        return jsonify(error="Model not found"), 404
        
    return jsonify(message="Model deleted successfully")
