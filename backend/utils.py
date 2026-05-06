from flask import request

from bson import ObjectId

def get_mode() -> str:
    """Extract mode from params or X-Mode header."""
    m = request.args.get("mode") or request.headers.get("X-Mode") or "justchill"
    m = m.lower()
    return m if m in ("justchill", "practice") else "justchill"

def get_model_color(model: str, uid: ObjectId, model_id: str = None) -> dict:
    from db import get_db
    if model == "Practice":
        return { "bg": "#F1F5F9", "text": "#64748B", "border": "#CBD5E1" } # Practice colors
    
    db = get_db()
    
    # If we have a specific instance ID, use it for exact color match
    if model_id:
        try:
            custom = db.custom_models.find_one({"_id": ObjectId(model_id)})
            if custom and "color" in custom:
                return custom["color"]
        except:
            pass

    # Fallback to name-based lookup (newest active)
    custom = db.custom_models.find_one(
        {"user_id": uid, "name": model, "is_deleted": {"$ne": True}},
        sort=[("created_at", -1)]
    )
    if custom and "color" in custom:
        return custom["color"]
    return { "bg": "#F1F5F9", "text": "#475569", "border": "#E2E8F0" } # Default

def trade_rr(trade) -> float:
    """
    Universal RR Engine — single source of truth for per-trade RR.
    WIN       → stored r_multiple (reward in R, always positive)
    LOSS      → -1.0  (always exactly -1R regardless of stored value)
    BREAKEVEN → 0.0
    """
    result = trade.get("result")
    if result == "Win":
        try:
            v = float(trade.get("r_multiple") or 0)
            return v if v > 0 else 0.0
        except (TypeError, ValueError):
            return 0.0
    elif result == "Loss":
        return -1.0
    else:  # Breakeven or unset
        return 0.0


def model_stats_from_trades(trades, uid):
    """
    Single-pass model aggregator using the Universal RR Engine.
    Groups by model_id (instance) to ensure separate stat boxes.
    """
    m_map = {}
    for t in trades:
        # Group by model_id if available, otherwise fallback to name (for legacy trades)
        m_id = t.get("model_id") or t.get("model") or "Unknown"
        m_name = t.get("model") or "Unknown"
        
        if m_id not in m_map:
            m_map[m_id] = {
                "name": m_name, 
                "trades": 0, 
                "wins": 0, 
                "pnl": 0.0, 
                "rr": 0.0,
                "model_id": m_id if t.get("model_id") else None
            }
            
        m_map[m_id]["trades"] += 1
        if t.get("result") == "Win":
            m_map[m_id]["wins"] += 1
        try:
            m_map[m_id]["pnl"] += float(t.get("pnl_percentage") or 0)
        except (TypeError, ValueError):
            pass
        m_map[m_id]["rr"] += trade_rr(t)

    result = []
    for m_id, s in m_map.items():
        tr = s["trades"]
        net_rr = round(s["rr"], 2)
        if net_rr == 0:
            rr_str = "0:00R"
        else:
            rr_str = f"{'+' if net_rr > 0 else ''}{net_rr:.2f}R"
            
        result.append({
            "name":    s["name"],
            "trades":  tr,
            "winRate": round(s["wins"] / tr * 100, 1) if tr else 0,
            "netPNL":  round(s["pnl"], 2),
            "rr":      rr_str,
            "color":   get_model_color(s["name"], uid, s["model_id"]),
            "model_id": str(s["model_id"]) if s.get("model_id") else None
        })
    return result


def calculate_avg_rr(trades):

    """
    Isolated Compute Layer for Avg RR.
    
    Step 1 (Filter): Only trades where Status === "final" AND Result === "Win".
    Step 2 (Exclusion): Discard "Loss", "Breakeven", or "Draft".
    Step 3 (Math): Sum_RR / Count_Wins
    Step 4 (Safety): If Count_Wins === 0, return "—".
    """
    # Step 1 & 2: Filter and Exclusion
    win_trades = [
        t for t in trades 
        if t.get("status") == "final" and t.get("result") == "Win"
    ]
    
    count_wins = len(win_trades)
    
    # Step 4: Safety
    if count_wins == 0:
        return "—"
    
    # Step 3: The Math
    def _sf(v):
        try:
            return float(v) if v and str(v).strip() else 0.0
        except:
            return 0.0

    sum_rr = sum(_sf(t.get("r_multiple")) for t in win_trades)
    
    final_avg_rr = sum_rr / count_wins
    
    return round(final_avg_rr, 2)
