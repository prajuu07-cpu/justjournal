from flask import request

def get_mode() -> str:
    """Extract mode from params or X-Mode header."""
    m = request.args.get("mode") or request.headers.get("X-Mode") or "justchill"
    m = m.lower()
    return m if m in ("justchill", "practice") else "justchill"

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
