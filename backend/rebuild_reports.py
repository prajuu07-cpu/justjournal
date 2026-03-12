"""
rebuild_reports(user_id)
Re-computes monthly and yearly aggregates from all final+result trades.
Called async after every create / update / delete.
"""
from db import get_db
from bson import ObjectId
from datetime import datetime, timezone
import threading


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def rebuild_reports(user_id: str):
    """Runs in a background daemon thread so the API response is not blocked."""
    t = threading.Thread(target=_rebuild, args=(user_id,), daemon=True)
    t.start()


def _rebuild(user_id: str):
    try:
        db  = get_db()
        uid = ObjectId(user_id)

        # All final trades that have a result
        trades = list(db.trades.find({
            "user_id": uid,
            "status":  "final",
            "result":  {"$in": ["Win", "Loss", "Breakeven"]},
        }))

        # Group by (year, month)
        monthly: dict = {}
        for t in trades:
            date_str = t.get("date", "").strip()
            if not date_str:
                continue

            d = None
            for fmt in ("%Y-%m-%d", "%d-%m-%Y"):
                try:
                    d = datetime.strptime(date_str, fmt)
                    break 
                except (ValueError, TypeError):
                    continue
            
            if not d:
                print(f"[rebuild_reports] Could not parse date: {repr(date_str)} for trade {t['_id']}")
                continue

            key = (d.year, d.month)
            monthly.setdefault(key, []).append(t)

        # Upsert monthly reports
        for (year, month), mtrades in monthly.items():
            wins       = sum(1 for t in mtrades if t["result"] == "Win")
            losses     = sum(1 for t in mtrades if t["result"] == "Loss")
            breakevens = sum(1 for t in mtrades if t["result"] == "Breakeven")
            total      = len(mtrades)
            win_rate   = round(wins / total * 100, 2) if total else 0

            net_pnl    = round(sum(float(t.get("pnl_percentage") or 0) for t in mtrades), 4)
            m1         = sum(1 for t in mtrades if t.get("model") == "Model 1")
            m2         = sum(1 for t in mtrades if t.get("model") == "Model 2")

            db.monthly_reports.update_one(
                {"user_id": uid, "year": year, "month": month},
                {"$set": {
                    "user_id":       uid,
                    "year":          year,
                    "month":         month,
                    "total_trades":  total,
                    "wins":          wins,
                    "losses":        losses,
                    "breakevens":    breakevens,
                    "win_rate":      win_rate,
                    "net_pnl":       net_pnl,
                    "model1_trades": m1,
                    "model2_trades": m2,
                    "updated_at":    _now_iso(),
                }},
                upsert=True,
            )

        # Upsert yearly reports
        yearly: dict = {}
        for (year, month) in monthly:
            yearly.setdefault(year, []).append(month)

        for year in yearly:
            m_docs     = list(db.monthly_reports.find({"user_id": uid, "year": year}))
            total      = sum(d["total_trades"]  for d in m_docs)
            wins       = sum(d["wins"]           for d in m_docs)
            losses     = sum(d["losses"]         for d in m_docs)
            breakevens = sum(d["breakevens"]     for d in m_docs)
            win_rate   = round(wins / total * 100, 2) if total else 0

            net_pnl    = round(sum(d["net_pnl"]  for d in m_docs), 4)
            m1         = sum(d["model1_trades"]  for d in m_docs)
            m2         = sum(d["model2_trades"]  for d in m_docs)
            months_cov = sorted(d["month"] for d in m_docs)

            db.yearly_reports.update_one(
                {"user_id": uid, "year": year},
                {"$set": {
                    "user_id":        uid,
                    "year":           year,
                    "total_trades":   total,
                    "wins":           wins,
                    "losses":         losses,
                    "breakevens":     breakevens,
                    "win_rate":       win_rate,
                    "net_pnl":        net_pnl,
                    "model1_trades":  m1,
                    "model2_trades":  m2,
                    "months_covered": months_cov,
                    "updated_at":     _now_iso(),
                }},
                upsert=True,
            )

        # Clean up months/years that no longer have trades
        active_months = set(monthly.keys())
        for doc in list(db.monthly_reports.find({"user_id": uid}, {"_id": 1, "year": 1, "month": 1})):
            if (doc["year"], doc["month"]) not in active_months:
                db.monthly_reports.delete_one({"_id": doc["_id"]})

        active_years = {y for (y, _) in active_months}
        for doc in list(db.yearly_reports.find({"user_id": uid}, {"_id": 1, "year": 1})):
            if doc["year"] not in active_years:
                db.yearly_reports.delete_one({"_id": doc["_id"]})

    except Exception as e:
        print(f"[rebuild_reports] error: {e}")
