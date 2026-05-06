import os
from dotenv import load_dotenv
from pymongo import MongoClient
import certifi

load_dotenv(r"d:\TradingJournal\justjournal\backend\.env")

filepath = r"d:\TradingJournal\justjournal\backend\routes\trades.py"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# ── MONTHLY: replace old manual model-stats block ──────────────────────────────
OLD_MONTHLY = (
    "    # Calculate dynamic model stats\n"
    "    m_stats = {}\n"
    "    for t in trades:\n"
    "        m = t.get(\"model\") or \"Unknown\"\n"
    "        if m not in m_stats:\n"
    "            m_stats[m] = {\"trades\": 0, \"wins\": 0, \"pnl\": 0.0, \"reward\": 0.0}\n"
    "        \n"
    "        m_stats[m][\"trades\"] += 1\n"
    "        if t.get(\"result\") == \"Win\":\n"
    "            m_stats[m][\"wins\"] += 1\n"
    "        m_stats[m][\"pnl\"] += float(t.get(\"pnl_percentage\") or 0)\n"
    "        m_stats[m][\"reward\"] += float(t.get(\"r_multiple\") or 0)\n"
    "\n"
    "    final_m_stats = []\n"
    "    for m, s in m_stats.items():\n"
    "        tr = s[\"trades\"]\n"
    "        final_m_stats.append({\n"
    "            \"name\":    m,\n"
    "            \"trades\":  tr,\n"
    "            \"winRate\": round(s[\"wins\"] / tr * 100, 1) if tr else 0,\n"
    "            \"netPNL\":  round(s[\"pnl\"], 2),\n"
    "            \"rr\":      f\"{round(s['reward'], 2)}R\" if tr else \"N/A\",\n"
    "            \"color\":   get_model_color(m, uid)\n"
    "        })\n"
    "\n"
    "    overall_rr = round(sum(float(t.get(\"r_multiple\") or 0) for t in trades), 2) if total else 0\n"
    "    overall_rr_str = f\"{overall_rr}R\" if total else \"N/A\""
)

NEW_MODEL_BLOCK = (
    "    # Model stats \u2014 Universal RR Engine\n"
    "    final_m_stats = model_stats_from_trades(trades, uid)\n"
    "    _orr = round(sum(trade_rr(t) for t in trades), 2) if total else 0\n"
    "    overall_rr_str = ('+' if _orr > 0 else '') + str(_orr) + 'R' if total else 'N/A'"
)

# ── YEARLY: same old block appears again ──────────────────────────────────────
OLD_YEARLY = (
    "    # Calculate dynamic model stats\n"
    "    m_stats = {}\n"
    "    for t in trades:\n"
    "        m = t.get(\"model\") or \"Unknown\"\n"
    "        if m not in m_stats:\n"
    "            m_stats[m] = {\"trades\": 0, \"wins\": 0, \"pnl\": 0.0, \"reward\": 0.0}\n"
    "        \n"
    "        m_stats[m][\"trades\"] += 1\n"
    "        if t.get(\"result\") == \"Win\":\n"
    "            m_stats[m][\"wins\"] += 1\n"
    "        m_stats[m][\"pnl\"] += float(t.get(\"pnl_percentage\") or 0)\n"
    "        m_stats[m][\"reward\"] += float(t.get(\"r_multiple\") or 0)\n"
    "\n"
    "    final_m_stats = []\n"
    "    for m, s in m_stats.items():\n"
    "        tr = s[\"trades\"]\n"
    "        final_m_stats.append({\n"
    "            \"name\":    m,\n"
    "            \"trades\":  tr,\n"
    "            \"winRate\": round(s[\"wins\"] / tr * 100, 1) if tr else 0,\n"
    "            \"netPNL\":  round(s[\"pnl\"], 2),\n"
    "            \"rr\":      f\"{round(s['reward'], 2)}R\" if tr else \"N/A\",\n"
    "            \"color\":   get_model_color(m, uid)\n"
    "        })\n"
    "\n"
    "    overall_rr = round(sum(float(t.get(\"r_multiple\") or 0) for t in trades), 2) if total else 0\n"
    "    overall_rr_str = f\"{overall_rr}R\" if total else \"N/A\""
)

if OLD_MONTHLY in content:
    # Replace first occurrence (monthly)
    content = content.replace(OLD_MONTHLY, NEW_MODEL_BLOCK, 1)
    print("Monthly block replaced.")
else:
    print("WARNING: monthly block not found!")

if OLD_YEARLY in content:
    # Replace second occurrence (yearly)
    content = content.replace(OLD_YEARLY, NEW_MODEL_BLOCK, 1)
    print("Yearly block replaced.")
else:
    print("WARNING: yearly block not found (may already be updated).")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("trades.py updated.")
