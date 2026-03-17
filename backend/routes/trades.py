"""
Trades routes — Flask + MongoDB
GET    /api/trades
GET    /api/trades/<id>
POST   /api/trades
PUT    /api/trades/<id>
PATCH  /api/trades/<id>/result
DELETE /api/trades/<id>
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime, timezone, date, timedelta
from typing import Optional
from db import get_db
from utils import get_mode
from rebuild_reports import rebuild_reports

trades_bp = Blueprint("trades", __name__)

# ── Checklist weights ─────────────────────────────────────────────────────────
MODEL1_WEIGHTS = {
    "drawDailyTP":  5,
    "trigger":      5,
    "prevMS":       15,
    "sync2H":       25,
    "priceReached": 20,
    "engulfing":    25,
    "minRR":        5,
}

MODEL2_WEIGHTS = {
    "drawDailyTP":  5,
    "sos":          5,
    "prevMS":       15,
    "sync2H":       25,
    "priceReached": 20,
    "engulfing":    25,
    "minRR":        5,
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()



def _calc_score(model: str, cl: dict, uid: Optional[ObjectId] = None) -> int:
    if model == "Practice":
        return 0
    if model == "Model 1":
        return sum(MODEL1_WEIGHTS[k] for k, v in cl.items() if v and k in MODEL1_WEIGHTS)
    if model == "Model 2":
        return sum(MODEL2_WEIGHTS[k] for k, v in cl.items() if v and k in MODEL2_WEIGHTS)
    
    # Custom model lookup
    if uid:
        db = get_db()
        custom = db.custom_models.find_one({"user_id": uid, "name": model})
        if custom and custom.get("checklist"):
            items = custom["checklist"]
            if not items: return 0
            
            score = 0
            for item in items:
                # Support both old string list and new object list
                label = item["label"] if isinstance(item, dict) else item
                weight = item.get("weight", 100/len(items)) if isinstance(item, dict) else (100/len(items))
                
                if cl.get(label):
                    score += weight
            return int(round(score))
            
    return 0

def _get_model_color(model: str, uid: ObjectId) -> Optional[dict]:
    if model in ("Model 1", "Practice"):
        return { "bg": "#F3E8FF", "text": "#7E22CE", "border": "#E9D5FF" } # pM1 style
    if model == "Model 2":
        return { "bg": "#E0E7FF", "text": "#4F46E5", "border": "#C7D2FE" } # pM2 style
    
    db = get_db()
    custom = db.custom_models.find_one({"user_id": uid, "name": model})
    if custom and "color" in custom:
        return custom["color"]
    return None

def _calc_grade(score: int) -> str:
    return "A+" if score >= 90 else "A" if score >= 75 else "Draft"

def _calc_pnl(risk: float, r_mult) -> Optional[float]:
    if r_mult is None:
        return None
    return round(float(risk) * float(r_mult), 4)

def _week_bounds(d: date):
    """Monday-Sunday that contains d."""
    monday = d - timedelta(days=d.weekday())
    sunday = monday + timedelta(days=6)
    return monday.isoformat(), sunday.isoformat()

def _trade_out(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"]      = str(doc.pop("_id"))
    doc["user_id"] = str(doc["user_id"])
    return doc

def _oid(raw: str) -> Optional[ObjectId]:
    try:
        return ObjectId(raw)
    except (InvalidId, TypeError):
        return None


# ── GET /api/trades ───────────────────────────────────────────────────────────
@trades_bp.get("/")
@jwt_required()
def list_trades():
    uid  = ObjectId(get_jwt_identity())
    db   = get_db()
    mode = get_mode()

    # Base filter: same user AND same mode
    filt = {"user_id": uid, "mode": mode}

    for key in ("model", "grade", "status", "result"):
        val = request.args.get(key)
        if val and val != "All":
            filt[key] = val

    print(f"[DEBUG trades/list] User: {uid} | Mode: {mode} | Filter: {filt}")
    trades = list(db.trades.find(filt).sort([("date", -1), ("created_at", -1)]))
    return jsonify(trades=[_trade_out(t) for t in trades])


# ── GET /api/trades/<id> ──────────────────────────────────────────────────────
@trades_bp.get("/<trade_id>")
@jwt_required()
def get_trade(trade_id):
    uid  = ObjectId(get_jwt_identity())
    db   = get_db()
    oid  = _oid(trade_id)
    mode = get_mode()

    if not oid:
        return jsonify(error="Invalid ID"), 400

    # For detail view, we also filter by user to ensure security
    doc = db.trades.find_one({"_id": oid, "user_id": uid, "mode": mode})
    if not doc:
        return jsonify(error="Trade not found"), 404
    return jsonify(trade=_trade_out(doc))


# ── POST /api/trades ──────────────────────────────────────────────────────────
@trades_bp.post("/")
@jwt_required()
def create_trade():
    uid  = ObjectId(get_jwt_identity())
    db   = get_db()
    mode = get_mode()
    data = request.get_json(silent=True) or {}

    pair       = (data.get("pair") or "").strip().upper()
    trade_date = (data.get("date") or "").strip()
    session    = (data.get("session") or "").strip()
    model      = data.get("model", "Model 1")
    direction  = data.get("direction", "Buy")
    risk_str   = data.get("risk_percent")
    status     = data.get("status", "draft")
    checklist  = data.get("checklist", {})
    notes       = data.get("notes", "")
    entry_price = data.get("entry_price")
    exit_price  = data.get("exit_price")

    if not pair:
        return jsonify(error="Pair is required"), 400
    if not trade_date:
        return jsonify(error="Date is required"), 400
    try:
        d = datetime.strptime(trade_date, "%Y-%m-%d").date()
    except ValueError:
        return jsonify(error="Date must be YYYY-MM-DD"), 400

    try:
        risk = float(risk_str or 0.0)
        assert 0.01 <= risk <= 5
    except (TypeError, ValueError, AssertionError):
        return jsonify(error="Risk % must be between 0.01 and 5"), 400

    # Removed strict model restriction for JustChill to allow custom models
    if mode == "practice":
        if not model or model == "Practice Model":
            model = "Practice"
    if direction not in ("Buy", "Sell"):
        return jsonify(error="Direction must be Buy or Sell"), 400
    if status not in ("draft", "final"):
        return jsonify(error="Status must be 'draft' or 'final'"), 400

    score = _calc_score(model, checklist, uid)
    grade = _calc_grade(score)

    result: Optional[str]  = None
    r_multiple: Optional[float] = None
    pnl: Optional[float]   = None

    if status == "final":
        result = data.get("result") or None
        if result:
            if result not in ("Win", "Loss", "Breakeven"):
                return jsonify(error="result must be Win, Loss or Breakeven"), 400
            if result == "Loss":
                r_multiple = 0.0
                pnl = -float(risk)
            elif result == "Breakeven":
                r_multiple = 0.0
                pnl = 0.0
            else: # Win
                r_multiple = float(data.get("r_multiple") or 0)
                if r_multiple <= 0:
                    return jsonify(error="Win needs a positive R multiple"), 400
                pnl = _calc_pnl(risk, r_multiple) if status == "final" and result else None

    if mode == "justchill":
        settings = db.user_settings.find_one({"user_id": uid}) or {}
        w_limit = settings.get("weekly_limit", 2)
        m_limit = settings.get("monthly_loss_limit", 5)

        # Weekly limit (Siloed by mode)
        start, end = _week_bounds(d)
        w_filt = {
            "user_id": uid,
            "status":  "final",
            "date":    {"$gte": start, "$lte": end},
        }
        w_filt["mode"] = mode

        wcount = db.trades.count_documents(w_filt)
        if wcount >= w_limit:
            return jsonify(limitType="weekly", error=f"Weekly limit reached ({w_limit} final trades)."), 422

        # Monthly loss limit (Siloed by mode)
        ym = trade_date[:7]
        l_filt = {
            "user_id": uid,
            "status":  "final",
            "result":  "Loss",
            "date":    {"$regex": f"^{ym}"},
        }
        l_filt["mode"] = mode

        lcount = db.trades.count_documents(l_filt)
        if lcount >= m_limit:
            return jsonify(limitType="monthly", error=f"Monthly loss limit reached ({m_limit} losses)."), 422

    now = _now_iso()
    doc = {
        "user_id":        uid,
        "mode":           mode,
        "session":        session if mode == "practice" else None,
        "date":           trade_date,
        "pair":           pair,
        "model":          model,
        "model_color":    _get_model_color(model, uid),
        "direction":      direction,
        "risk_percent":   risk,
        "checklist":      checklist,
        "score":          score,
        "grade":          grade,
        "status":         status,
        "result":         result,
        "r_multiple":     r_multiple,
        "pnl_percentage": pnl,
        "entry_price":    entry_price,
        "exit_price":     exit_price,
        "notes":          notes,
        "created_at":     now,
        "updated_at":     now,
    }
    res = db.trades.insert_one(doc)
    doc["_id"] = res.inserted_id
    rebuild_reports(str(uid))
    return jsonify(trade=_trade_out(doc)), 201


# ── PUT /api/trades/<id> ──────────────────────────────────────────────────────
@trades_bp.put("/<trade_id>")
@jwt_required()
def update_trade(trade_id):
    uid = ObjectId(get_jwt_identity())
    db  = get_db()
    oid = _oid(trade_id)
    mode = get_mode()
    if not oid:
        return jsonify(error="Invalid ID"), 400

    existing = db.trades.find_one({"_id": oid, "user_id": uid, "mode": get_mode()})
    if not existing:
        return jsonify(error="Trade not found"), 404

    data = request.get_json(silent=True) or {}

    pair       = (data.get("pair") or existing.get("pair", "")).strip().upper()
    trade_date = (data.get("date") or existing.get("date", "")).strip()
    session    = data.get("session", existing.get("session", ""))
    if isinstance(session, str): session = session.strip()
    model      = data.get("model",        existing.get("model",      "Model 1"))
    direction  = data.get("direction",    existing.get("direction",  "Buy"))
    risk_str   = data.get("risk_percent", existing.get("risk_percent"))
    status     = data.get("status",       existing.get("status",     "draft"))
    checklist  = data.get("checklist",    existing.get("checklist",  {}))
    notes       = data.get("notes",        existing.get("notes",      ""))
    entry_price = data.get("entry_price",  existing.get("entry_price"))
    exit_price  = data.get("exit_price",   existing.get("exit_price"))

    try:
        d = datetime.strptime(trade_date, "%Y-%m-%d").date()
    except ValueError:
        return jsonify(error="Date must be YYYY-MM-DD"), 400
    try:
        risk = float(risk_str or 0.0)
        assert 0.01 <= risk <= 5
    except (TypeError, ValueError, AssertionError):
        return jsonify(error="Risk % must be between 0.01 and 5"), 400

    score = _calc_score(model, checklist, uid)
    grade = _calc_grade(score)

    result     = existing.get("result")
    r_multiple = existing.get("r_multiple")
    pnl        = existing.get("pnl_percentage")

    if "result" in data:
        result = data["result"] or None
        if result:
            if result == "Loss":
                r_multiple = 0.0
                pnl = -float(risk)
            elif result == "Breakeven":
                r_multiple = 0.0
                pnl = 0.0
            else: # Win
                r_multiple = float(data.get("r_multiple") or 0)
                if r_multiple <= 0:
                    return jsonify(error="Win needs a positive R multiple"), 400
                pnl = _calc_pnl(risk, r_multiple)
        else:
            r_multiple, pnl = None, None

    if mode == "justchill":
        settings = db.user_settings.find_one({"user_id": uid}) or {}
        w_limit = settings.get("weekly_limit", 2)
        m_limit = settings.get("monthly_loss_limit", 5)

        # Weekly limit (exclude self, Siloed by mode)
        start, end = _week_bounds(d)
        w_filt = {
            "user_id": uid,
            "status":  "final",
            "date":    {"$gte": start, "$lte": end},
            "_id":     {"$ne": oid},
        }
        w_filt["mode"] = mode

        wcount = db.trades.count_documents(w_filt)
        if wcount >= w_limit:
            return jsonify(limitType="weekly", error="Weekly limit reached."), 422

        # Monthly loss limit (Siloed by mode)
        ym = trade_date[:7]
        l_filt = {
            "user_id": uid,
            "status":  "final",
            "result":  "Loss",
            "date":    {"$regex": f"^{ym}"},
            "_id":     {"$ne": oid},
        }
        l_filt["mode"] = mode

        lcount = db.trades.count_documents(l_filt)
        if lcount >= m_limit:
            return jsonify(limitType="monthly", error="Monthly loss limit reached."), 422

    db.trades.update_one({"_id": oid, "user_id": uid, "mode": get_mode()}, {"$set": {
        "pair":           pair,
        "date":           trade_date,
        "session":        session if get_mode() == "practice" else None,
        "model":          model,
        "model_color":    _get_model_color(model, uid),
        "direction":      direction,
        "risk_percent":   risk,
        "checklist":      checklist,
        "score":          score,
        "grade":          grade,
        "status":         status,
        "result":         result,
        "r_multiple":     r_multiple,
        "pnl_percentage": pnl,
        "entry_price":    entry_price,
        "exit_price":     exit_price,
        "notes":          notes,
        "updated_at":     _now_iso(),
    }})
    doc = db.trades.find_one({"_id": oid})
    rebuild_reports(str(uid))
    return jsonify(trade=_trade_out(doc))


# ── PATCH /api/trades/<id>/result ─────────────────────────────────────────────
@trades_bp.patch("/<trade_id>/result")
@jwt_required()
def add_result(trade_id):
    uid = ObjectId(get_jwt_identity())
    db  = get_db()
    oid = _oid(trade_id)
    if not oid:
        return jsonify(error="Invalid ID"), 400

    existing = db.trades.find_one({"_id": oid, "user_id": uid, "mode": get_mode()})
    if not existing:
        return jsonify(error="Trade not found"), 404

    data   = request.get_json(silent=True) or {}
    result = data.get("result")
    if result not in ("Win", "Loss", "Breakeven"):
        return jsonify(error="result must be Win, Loss or Breakeven"), 400

    if result in ("Loss", "Breakeven"):
        r_multiple = 0.0
    else:
        r_multiple = float(data.get("r_multiple") or 0)
    if result == "Win" and r_multiple <= 0:
        return jsonify(error="Win needs a positive R multiple"), 400

    if result == "Loss":
        pnl = -float(existing.get("risk_percent", 1.0))
    elif result == "Breakeven":
        pnl = 0.0
    else: # Win
        pnl = _calc_pnl(existing.get("risk_percent", 1.0), r_multiple)

    db.trades.update_one({"_id": oid, "user_id": uid, "mode": get_mode()}, {"$set": {
        "result":         result,
        "r_multiple":     r_multiple,
        "pnl_percentage": pnl,
        "updated_at":     _now_iso(),
    }})
    doc = db.trades.find_one({"_id": oid})
    rebuild_reports(str(uid))
    return jsonify(trade=_trade_out(doc))


# ── DELETE /api/trades/<id> ───────────────────────────────────────────────────
@trades_bp.delete("/<trade_id>")
@jwt_required()
def delete_trade(trade_id):
    uid = ObjectId(get_jwt_identity())
    db  = get_db()
    oid = _oid(trade_id)
    if not oid:
        return jsonify(error="Invalid ID"), 400

    res = db.trades.delete_one({"_id": oid, "user_id": uid, "mode": get_mode()})
    if res.deleted_count == 0:
        return jsonify(error="Trade not found"), 404

    rebuild_reports(str(uid))
    return jsonify(message="Trade deleted")


# ── GET /api/trades/limit-status ──────────────────────────────────────────────
@trades_bp.get("/limit-status")
@jwt_required()
def get_limit_status():
    uid  = ObjectId(get_jwt_identity())
    db   = get_db()
    mode = get_mode()
    
    if mode != "justchill":
        return jsonify(weekly_reached=False, monthly_reached=False)

    settings = db.user_settings.find_one({"user_id": uid}) or {}
    w_limit = settings.get("weekly_limit", 2)
    m_limit = settings.get("monthly_loss_limit", 5)

    today = date.today()
    start, end = _week_bounds(today)
    
    # Weekly final trades
    w_filt = {
        "user_id": uid,
        "status":  "final",
        "mode":    mode,
        "date":    {"$gte": start, "$lte": end},
    }
    wcount = db.trades.count_documents(w_filt)

    # Monthly losses
    ym = today.strftime("%Y-%m")
    l_filt = {
        "user_id": uid,
        "status":  "final",
        "mode":    mode,
        "result":  "Loss",
        "date":    {"$regex": f"^{ym}"},
    }
    lcount = db.trades.count_documents(l_filt)

    return jsonify(
        weekly_reached=wcount >= w_limit,
        monthly_reached=lcount >= m_limit,
        weekly_count=wcount,
        weekly_limit=w_limit,
        monthly_count=lcount,
        monthly_limit=m_limit
    )


# ── DELETE /api/trades/drafts ────────────────────────────────────────────────
@trades_bp.delete("/drafts")
@jwt_required()
def delete_drafts():
    uid  = ObjectId(get_jwt_identity())
    db   = get_db()
    mode = get_mode()
    
    del_filt = {"user_id": uid, "status": "draft"}
    del_filt["mode"] = mode

    res = db.trades.delete_many(del_filt)
    
    if res.deleted_count > 0:
        rebuild_reports(str(uid))
        
    return jsonify(message=f"Deleted {res.deleted_count} draft trades ({mode}).")


# ── DELETE /api/trades/all ────────────────────────────────────────────────────
@trades_bp.delete("/all")
@jwt_required()
def delete_all_trades():
    uid  = ObjectId(get_jwt_identity())
    db   = get_db()
    mode = get_mode()
    
    del_filt = {"user_id": uid, "mode": mode}

    res = db.trades.delete_many(del_filt)
    
    if res.deleted_count > 0:
        rebuild_reports(str(uid))
        
    return jsonify(message=f"Deleted {res.deleted_count} trades ({mode}).")


# ── GET /api/trades/month/<year>/<month> ──────────────────────────────────────
@trades_bp.get("/month/<int:year>/<int:month>")
@jwt_required()
def get_month_trades(year, month):
    uid  = ObjectId(get_jwt_identity())
    db   = get_db()
    mode = get_mode()

    ym_prefix = f"{year}-{month:02d}"

    query = {
        "user_id": uid,
        "date":    {"$regex": f"^{ym_prefix}"},
        "status":  "final",
        "result":  {"$in": ["Win", "Loss", "Breakeven"]},
    }
    query["mode"] = mode

    trades = list(db.trades.find(query).sort("date", 1))

    # Table output (newest first)
    out_trades = [_trade_out(t) for t in reversed(trades)]

    total  = len(trades)
    wins   = sum(1 for t in trades if t.get("result") == "Win")
    losses = sum(1 for t in trades if t.get("result") == "Loss")
    win_rate = round(float(wins / total * 100), 2) if total else 0


    net_pnl = round(float(sum(float(t.get("pnl_percentage") or 0) for t in trades)), 4)



    # Max consecutive loss streak (negative PnL)
    max_streak = streak = 0
    for t in trades:
        if float(t.get("pnl_percentage") or 0) < 0:
            streak += 1
            max_streak = max(max_streak, streak)
        else:
            streak = 0

    # Daily PnL breakdown — group by date
    daily_breakdown = {}
    for t in trades:
        d_str = (t.get("date") or "")[:10]
        if not d_str:
            continue
        pnl_v = float(t.get("pnl_percentage") or 0)
        if d_str not in daily_breakdown:
            daily_breakdown[d_str] = {
                "date":        d_str,
                "net_pnl":     0.0,
                "trade_count": 0,
                "trades":      [],
            }
        daily_breakdown[d_str]["net_pnl"]     = round(float(daily_breakdown[d_str]["net_pnl"]) + pnl_v, 4)
        daily_breakdown[d_str]["trade_count"] = int(daily_breakdown[d_str]["trade_count"]) + 1
        daily_breakdown[d_str]["trades"].append({
            "id":           str(t.get("_id")),
            "pair":         t.get("pair"),
            "model":        t.get("model"),
            "direction":    t.get("direction"),
            "pnl":          pnl_v,
            "risk_percent": t.get("risk_percent"),
            "r_multiple":   t.get("r_multiple"),
            "grade":        t.get("grade"),
            "result":       t.get("result"),
        })

    return jsonify(
        v="v2",
        trades=out_trades,
        stats={
            "totalTrades":    total,
            "wins":           wins,
            "losses":         losses,
            "winRate":        win_rate,
            "netPNL":         net_pnl,
            "maxLossStreak":  max_streak,
            "dailyBreakdown": daily_breakdown,
        }
    )


# ── GET /api/trades/year/<year> ───────────────────────────────────────────────
@trades_bp.get("/year/<int:year>")
@jwt_required()
def get_year_trades(year):
    uid  = ObjectId(get_jwt_identity())
    db   = get_db()
    mode = get_mode()

    y_prefix = f"{year}-"
    
    query = {
        "user_id": uid,
        "date":    {"$regex": f"^{y_prefix}"},
        "status":  "final",
        "result":  {"$in": ["Win", "Loss", "Breakeven"]},
    }
    query["mode"] = mode

    trades = list(db.trades.find(query).sort("date", 1))

    out_trades = [_trade_out(t) for t in reversed(trades)]
    final_trades = trades

    total   = len(trades)
    wins    = sum(1 for t in trades if t.get("result") == "Win")
    losses  = sum(1 for t in trades if t.get("result") == "Loss")
    win_rate = round(float(wins / total * 100), 2) if total else 0


    net_pnl = round(float(sum(float(t.get("pnl_percentage") or 0) for t in trades)), 4)

    monthly_breakdown = {m: 0.0 for m in range(1, 13)}

    for t in trades:
        pnl = float(t.get("pnl_percentage") or 0)

        try:
            m = int(t.get("date", "").split("-")[1])
            monthly_breakdown[m] = round(monthly_breakdown[m] + pnl, 4)
        except Exception:
            pass

    best_month = None
    worst_month = None
    best_m_pnl = -float('inf')
    worst_m_pnl = float('inf')

    # Find best and worst only from months that actually have trades
    months_with_trades = {int(t.get("date").split("-")[1]) for t in trades if len(t.get("date", "").split("-")) >= 2}
    for m in months_with_trades:
        mpnl = monthly_breakdown[m]
        if mpnl > best_m_pnl:
            best_m_pnl = mpnl
            best_month = {"month": m, "pnl": round(mpnl, 2)}
        if mpnl < worst_m_pnl:
            worst_m_pnl = mpnl
            worst_month = {"month": m, "pnl": round(mpnl, 2)}

    # Format monthly breakdown for array output
    mb_arr = [{"month": m, "pnl": round(monthly_breakdown[m], 2)} for m in range(1, 13)]

    return jsonify(
        trades=out_trades,
        stats={
            "totalTrades":      total,
            "wins":             wins,
            "losses":           losses,
            "winRate":          win_rate,
            "netPNL":           net_pnl,
            "bestMonth":        best_month,
            "worstMonth":       worst_month,
            "monthlyBreakdown": mb_arr,
        }
    )
