from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from db import get_db
from datetime import datetime

custom_models_bp = Blueprint('custom_models', __name__)

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
        
    models = list(db.custom_models.find(query))
    for m in models:
        m['_id'] = str(m['_id'])
        if 'user_id' in m: m['user_id'] = str(m['user_id'])
    return jsonify(models)

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

    new_model = {
        "user_id": uid,
        "name": name,
        "checklist": checklist,
        "notes": notes,
        "mode": model_mode,
        "createdFrom": created_from,
        "created_at": _now_iso()
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
