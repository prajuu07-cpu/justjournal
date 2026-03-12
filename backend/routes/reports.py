"""
Reports routes — Flask + MongoDB
GET /api/reports/monthly
GET /api/reports/monthly/<year>/<month>
GET /api/reports/yearly
GET /api/reports/dashboard
"""
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from db import get_db
from utils import calculate_avg_rr

reports_bp = Blueprint("reports", __name__)


def _fmt(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"]      = str(doc.pop("_id"))
    doc["user_id"] = str(doc["user_id"])
    return doc


@reports_bp.get("/monthly")
@jwt_required()
def monthly():
    uid  = ObjectId(get_jwt_identity())
    db   = get_db()
    docs = list(db.monthly_reports.find({"user_id": uid}).sort([("year", -1), ("month", -1)]))
    return jsonify(reports=[_fmt(d) for d in docs])


@reports_bp.get("/monthly/<int:year>/<int:month>")
@jwt_required()
def monthly_one(year, month):
    uid = ObjectId(get_jwt_identity())
    db  = get_db()
    doc = db.monthly_reports.find_one({"user_id": uid, "year": year, "month": month})
    if not doc:
        return jsonify(error="Not found"), 404
    return jsonify(report=_fmt(doc))


@reports_bp.get("/yearly")
@jwt_required()
def yearly():
    uid  = ObjectId(get_jwt_identity())
    db   = get_db()
    docs = list(db.yearly_reports.find({"user_id": uid}).sort("year", -1))
    return jsonify(reports=[_fmt(d) for d in docs])


@reports_bp.get("/dashboard")
@jwt_required()
def dashboard():
    uid = ObjectId(get_jwt_identity())
    db  = get_db()

    final_trades = list(db.trades.find({
        "user_id": uid,
        "status":  "final",
        "result":  {"$in": ["Win", "Loss", "Breakeven"]},
    }).sort("date", 1))

    print(f"[DEBUG reports/dashboard] User: {uid} | Final trades found: {len(final_trades)}")
    for i, t in enumerate(final_trades[:5]):
        print(f"  [DASH] Trade {i+1}: {t.get('date')} | {t.get('pair')} | {t.get('direction')} | {t.get('result')}")

    final_count  = len(final_trades)
    total_trades = db.trades.count_documents({"user_id": uid})

    if not final_count:
        return jsonify(
            totalTrades=total_trades, finalTrades=final_count,
            winRate=None, netPNL=None,
            avgRR=None, maxDrawdown=None, maxLossStreak=None,
        )

    wins = sum(1 for t in final_trades if t["result"] == "Win")

    win_rate = round(wins / final_count * 100, 2)
    net_pnl  = round(sum(float(t.get("pnl_percentage") or 0) for t in final_trades), 4)


    equity = peak = 100.0
    max_dd = 0.0
    for t in final_trades:
        equity *= (1 + float(t.get("pnl_percentage") or 0) / 100)
        if equity > peak:
            peak = equity
        dd = (peak - equity) / peak * 100
        if dd > max_dd:
            max_dd = dd

    max_streak = streak = 0
    for t in final_trades:
        if t["result"] == "Loss":
            streak += 1
            max_streak = max(max_streak, streak)
        else:
            streak = 0

    # Phase 1 & 2: Avg RR Rebuild (Isolated Compute Layer)
    avg_rr = calculate_avg_rr(final_trades)

    # Equity Curve Data
    equity_curve = [0.0]
    curr_equity = 0.0
    for t in final_trades:
        curr_equity += float(t.get("pnl_percentage") or 0)
        equity_curve.append(round(curr_equity, 2))

    # Result Distribution
    distribution = {
        "Win":       wins,
        "Loss":      sum(1 for t in final_trades if t["result"] == "Loss"),
        "Breakeven": sum(1 for t in final_trades if t["result"] == "Breakeven"),
    }

    return jsonify(
        totalTrades=total_trades,
        finalTrades=final_count,
        winRate=win_rate if win_rate is not None else 0,
        netPNL=net_pnl if net_pnl is not None else 0,
        avgRR=avg_rr if (avg_rr is not None and avg_rr != "—") else "—",
        maxDrawdown=round(max_dd, 2),
        maxLossStreak=max_streak,
        equityCurve=equity_curve,
        distribution=distribution,
    )
