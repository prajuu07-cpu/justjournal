filepath = r"d:\TradingJournal\justjournal\backend\routes\export.py"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Fix monthly export model stats
OLD_M = (
    "        m_stats_map[m][\"reward\"] += _sf(t.get(\"r_multiple\"))\n"
    "\n"
    "    model_stats = []\n"
    "    for m, s_ in m_stats_map.items():\n"
    "        tr = s_[\"trades\"]\n"
    "        model_stats.append({\n"
    "            \"name\": m,\n"
    "            \"trades\": tr,\n"
    "            \"winRate\": round(s_[\"wins\"] / tr * 100, 1) if tr else 0,\n"
    "            \"netPNL\": round(s_[\"pnl\"], 2),\n"
    "            \"rr\": f\"{round(s_['reward'], 2)}R\" if tr else \"N/A\",\n"
    "            \"color\": get_model_color(m, uid)\n"
    "        })\n"
    "\n"
    "    overall_rr_val = round(sum(_sf(t.get(\"r_multiple\")) for t in trades), 2) if total else 0\n"
    "    overall_rr_str = f\"{overall_rr_val}R\" if total else \"N/A\""
)

NEW_BLOCK = (
    "        pass  # reward aggregated via universal engine below\n"
    "\n"
    "    from utils import model_stats_from_trades, trade_rr\n"
    "    model_stats = model_stats_from_trades(trades, uid)\n"
    "    _orr = round(sum(trade_rr(t) for t in trades), 2) if total else 0\n"
    "    overall_rr_str = ('+' if _orr > 0 else '') + str(_orr) + 'R' if total else 'N/A'"
)

count = content.count(OLD_M)
print(f"Found {count} occurrence(s) of the export model block")

if count > 0:
    content = content.replace(OLD_M, NEW_BLOCK)
    print(f"Replaced {count} occurrence(s).")
else:
    print("Block not found — checking partial match...")
    # Try to find the reward line
    idx = content.find('m_stats_map[m]["reward"] += _sf(t.get("r_multiple"))')
    print(f"  reward line at index: {idx}")
    if idx != -1:
        snippet = content[idx:idx+600]
        print("SNIPPET:")
        print(repr(snippet))

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("export.py updated.")
