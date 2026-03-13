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

def _calc_score(model: str, cl: dict) -> int:
    weights = MODEL1_WEIGHTS if model == "Model 1" else MODEL2_WEIGHTS
    return sum(w for k, w in weights.items() if cl.get(k))

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
    uid = ObjectId(get_jwt_identity())
    db  = get_db()

    filt: dict = {"user_id": uid}
    for key in ("model", "grade", "status", "result"):
        val = request.args.get(key)
        if val and val != "All":
            filt[key] = val

    print(f"[DEBUG trades/list] User: {uid} | Filter: {filt}")
    trades = list(db.trades.find(filt).sort([("date", -1), ("created_at", -1)]))
    print(f"[DEBUG trades/list] Found: {len(trades)}")
    return jsonify(trades=[_trade_out(t) for t in trades])


# ── GET /api/trades/<id> ──────────────────────────────────────────────────────
@trades_bp.get("/<trade_id>")
@jwt_required()
def get_trade(trade_id):
    uid = ObjectId(get_jwt_identity())
    db  = get_db()
    oid = _oid(trade_id)
    if not oid:
        return jsonify(error="Invalid ID"), 400

    doc = db.trades.find_one({"_id": oid, "user_id": uid})
    if not doc:
        return jsonify(error="Trade not found"), 404
    return jsonify(trade=_trade_out(doc))


# ── POST /api/trades ──────────────────────────────────────────────────────────
@trades_bp.post("/")
@jwt_required()
def create_trade():
    uid  = ObjectId(get_jwt_identity())
    db   = get_db()
    data = request.get_json(silent=True) or {}

    pair       = (data.get("pair") or "").strip().upper()
    trade_date = (data.get("date") or "").strip()
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
        risk = float(risk_str)
        assert 0.01 <= risk <= 5
    except (TypeError, ValueError, AssertionError):
        return jsonify(error="Risk % must be between 0.01 and 5"), 400

    if model not in ("Model 1", "Model 2"):
        return jsonify(error="Model must be 'Model 1' or 'Model 2'"), 400
    if direction not in ("Buy", "Sell"):
        return jsonify(error="Direction must be Buy or Sell"), 400
    if status not in ("draft", "final"):
        return jsonify(error="Status must be 'draft' or 'final'"), 400

    score = _calc_score(model, checklist)
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
                pnl = _calc_pnl(risk, r_multiple)

    # Weekly limit (Applies to ALL saves, including Drafts, Mon-Sun)
    start, end = _week_bounds(d)
    wcount = db.trades.count_documents({
        "user_id": uid,
        "status":  "final",
        "date":    {"$gte": start, "$lte": end},
    })
    if wcount >= 2:
        return jsonify(
            limitType="weekly",
            error="Weekly trade limit reached. Maximum 2 final trades per week.",
        ), 422

    # Monthly loss limit (Applies to ALL saves, including Drafts)
    ym = trade_date[:7]
    lcount = db.trades.count_documents({
        "user_id": uid,
        "status":  "final",
        "result":  "Loss",
        "date":    {"$regex": f"^{ym}"},
    })
    if lcount >= 5:
        return jsonify(
            limitType="monthly",
            error="Monthly loss limit reached. 5 losses recorded this month.",
        ), 422

    now = _now_iso()
    doc = {
        "user_id":        uid,
        "date":           trade_date,
        "pair":           pair,
        "model":          model,
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
    if not oid:
        return jsonify(error="Invalid ID"), 400

    existing = db.trades.find_one({"_id": oid, "user_id": uid})
    if not existing:
        return jsonify(error="Trade not found"), 404

    data = request.get_json(silent=True) or {}

    pair       = (data.get("pair") or existing.get("pair", "")).strip().upper()
    trade_date = (data.get("date") or existing.get("date", "")).strip()
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
        risk = float(risk_str)
        assert 0.01 <= risk <= 5
    except (TypeError, ValueError, AssertionError):
        return jsonify(error="Risk % must be between 0.01 and 5"), 400

    score = _calc_score(model, checklist)
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

    # Weekly limit (exclude self, Applies to ALL saves, including Drafts)
    start, end = _week_bounds(d)
    wcount = db.trades.count_documents({
        "user_id": uid,
        "status":  "final",
        "date":    {"$gte": start, "$lte": end},
        "_id":     {"$ne": oid},
    })
    if wcount >= 2:
        return jsonify(limitType="weekly", error="Weekly trade limit reached."), 422

    # Monthly loss limit (Applies to ALL saves, including Drafts)
    ym = trade_date[:7]
    lcount = db.trades.count_documents({
        "user_id": uid,
        "status":  "final",
        "result":  "Loss",
        "date":    {"$regex": f"^{ym}"},
        "_id":     {"$ne": oid},
    })
    if lcount >= 5:
        return jsonify(limitType="monthly", error="Monthly loss limit reached."), 422

    db.trades.update_one({"_id": oid}, {"$set": {
        "pair":           pair,
        "date":           trade_date,
        "model":          model,
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

    existing = db.trades.find_one({"_id": oid, "user_id": uid})
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

    db.trades.update_one({"_id": oid}, {"$set": {
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

    res = db.trades.delete_one({"_id": oid, "user_id": uid})
    if res.deleted_count == 0:
        return jsonify(error="Trade not found"), 404

    rebuild_reports(str(uid))
    return jsonify(message="Trade deleted")


# ── DELETE /api/trades/drafts ────────────────────────────────────────────────
@trades_bp.delete("/drafts")
@jwt_required()
def delete_drafts():
    uid = ObjectId(get_jwt_identity())
    db  = get_db()
    
    res = db.trades.delete_many({
        "user_id": uid,
        "status":  "draft"
    })
    
    if res.deleted_count > 0:
        rebuild_reports(str(uid))
        
    return jsonify(message=f"Deleted {res.deleted_count} draft trades.")


# ── GET /api/trades/month/<year>/<month> ──────────────────────────────────────
@trades_bp.get("/month/<int:year>/<int:month>")
@jwt_required()
def get_month_trades(year, month):
    uid = ObjectId(get_jwt_identity())
    db  = get_db()

    ym_prefix = f"{year}-{month:02d}"

    query = {
        "user_id": uid,
        "date":    {"$regex": f"^{ym_prefix}"},
        "status":  "final",
        "result":  {"$in": ["Win", "Loss", "Breakeven"]},
    }
    trades = list(db.trades.find(query).sort("date", 1))

    # Table output (newest first)
    out_trades = [_trade_out(t) for t in reversed(trades)]

    total  = len(trades)
    wins   = sum(1 for t in trades if t.get("result") == "Win")
    losses = sum(1 for t in trades if t.get("result") == "Loss")
    win_rate = round(wins / total * 100, 2) if total else 0


    net_pnl = round(sum(float(t.get("pnl_percentage") or 0) for t in trades), 4)



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
        daily_breakdown[d_str]["net_pnl"]     = round(daily_breakdown[d_str]["net_pnl"] + pnl_v, 4)
        daily_breakdown[d_str]["trade_count"] += 1
        daily_breakdown[d_str]["trades"].append({
            "id":           str(t.get("_id")),
            "pair":         t.get("pair"),
            "model":        t.get("model"),
            "direction":    t.get("direction"),
            "pnl":          pnl_v,
            "risk_percent": t.get("risk_percent"),
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
    uid = ObjectId(get_jwt_identity())
    db  = get_db()

    y_prefix = f"{year}-"
    
    trades = list(db.trades.find({
        "user_id": uid,
        "date":    {"$regex": f"^{y_prefix}"},
        "status":  "final",
        "result":  {"$in": ["Win", "Loss", "Breakeven"]},
    }).sort("date", 1))

    out_trades = [_trade_out(t) for t in reversed(trades)]
    final_trades = trades

    total   = len(trades)
    wins    = sum(1 for t in trades if t.get("result") == "Win")
    losses  = sum(1 for t in trades if t.get("result") == "Loss")
    win_rate = round(wins / total * 100, 2) if total else 0


    net_pnl = round(sum(float(t.get("pnl_percentage") or 0) for t in trades), 4)

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
