"""
Export route — Flask + MongoDB
GET /api/export/pdf   streams a PDF of the user's full journal
"""
from flask import Blueprint, send_file, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from datetime import datetime, timezone, timedelta
import io

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle,
    Paragraph, Spacer, HRFlowable,
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER

from db import get_db
from utils import calculate_avg_rr

export_bp = Blueprint("export", __name__)

# ── Colours ───────────────────────────────────────────────────────────────────
C_DARK   = colors.HexColor("#1F2937")
C_INDIGO = colors.HexColor("#4F46E5")
C_ROSE   = colors.HexColor("#ff4d6d")
C_AMBER  = colors.HexColor("#ffb547")
C_PURPLE = colors.HexColor("#b47fff")
C_SUB    = colors.HexColor("#475569")
C_CARD   = colors.HexColor("#FFFFFF")
C_BORDER = colors.HexColor("#E2E8F0")
C_WIN    = colors.HexColor("#22C55E")
C_LOSS   = colors.HexColor("#EF4444")
C_BE     = colors.HexColor("#3B82F6")
C_DRAFT  = colors.HexColor("#F59E0B")
C_ORANGE = colors.HexColor("#ea580c")
C_L_ORANGE = colors.HexColor("#f97316")

MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

# ── Styles — module-level with unique names so ReportLab never collides ───────
S_TITLE  = ParagraphStyle("ep_title",  fontName="Helvetica-Bold", fontSize=22, textColor=C_DARK,   leading=28)
S_DATE   = ParagraphStyle("ep_date",   fontName="Helvetica",      fontSize=10, textColor=C_SUB,    leading=14)
S_SEC    = ParagraphStyle("ep_sec",    fontName="Helvetica-Bold", fontSize=11, textColor=C_INDIGO, leading=15, spaceBefore=12, spaceAfter=5)
S_CELL   = ParagraphStyle("ep_cell",   fontName="Helvetica",      fontSize=9,  textColor=C_DARK,   leading=13)
S_CELL_B = ParagraphStyle("ep_cell_b", fontName="Helvetica-Bold", fontSize=9,  textColor=C_DARK,   leading=13)
S_MONO   = ParagraphStyle("ep_mono",   fontName="Courier",        fontSize=8,  textColor=C_DARK,   leading=12)
S_HDR    = ParagraphStyle("ep_hdr",    fontName="Helvetica-Bold", fontSize=8,  textColor=colors.white, leading=12)
S_STAT_L = ParagraphStyle("ep_stat_l", fontName="Helvetica",      fontSize=7,  textColor=C_SUB,    leading=10)
S_FOOT   = ParagraphStyle("ep_foot",   fontName="Helvetica",      fontSize=7,  textColor=C_SUB,    leading=10, alignment=TA_CENTER)

# Stat value styles — cached by colour hex so we never create duplicate names
_SV_STYLES: dict = {}


def _sv(color_val):
    key = color_val.hexval()
    if key not in _SV_STYLES:
        _SV_STYLES[key] = ParagraphStyle(
            f"ep_sv_{key}", fontName="Helvetica-Bold",
            fontSize=16, textColor=color_val, leading=20,
        )
    return _SV_STYLES[key]


def _sf(v):
    try:
        if v is None or str(v).strip() == "": return 0.0
        return float(v)
    except:
        return 0.0


# ── Helpers ───────────────────────────────────────────────────────────────────
def _p(txt, style=None):
    return Paragraph(str(txt) if txt is not None else "-", style or S_CELL)


def _fmt_pnl(v):
    if v is None:
        return "-"
    f = _sf(v)
    return ("+" if f >= 0 else "") + f"{f:.2f}%"


def _fmt_pct(v):
    if v is None or v == "\u2014" or str(v).strip() == "":
        return "-"
    return f"{_sf(v):.1f}%"


def _pnl_color(v):
    return C_WIN if (v or 0) >= 0 else C_LOSS


def _fd(iso_date):
    """Formats YYYY-MM-DD to DD-MM-YYYY"""
    if not iso_date or len(iso_date) < 10:
        return "-"
    parts = iso_date[:10].split("-")
    if len(parts) != 3:
        return iso_date
    return f"{parts[2]}-{parts[1]}-{parts[0]}"


def _stat_box(label, value, val_color, col_w):
    return Table(
        [[_p(label, S_STAT_L)], [_p(str(value), _sv(val_color))]],
        colWidths=[col_w - 4 * mm],
        style=TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), C_CARD),
            ("BOX",           (0, 0), (-1, -1), 0.5, C_BORDER),
            ("LEFTPADDING",   (0, 0), (-1, -1), 6),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
            ("TOPPADDING",    (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]),
    )


# ── Monthly PDF builder ───────────────────────────────────────────────────────
def _build_month_pdf(username: str, year: int, month: int,
                     stats: dict, trades: list) -> bytes:
    buf = io.BytesIO()
    W   = A4[0] - 32 * mm
    month_name = MONTHS[month - 1]

    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=16*mm, rightMargin=16*mm,
        topMargin=16*mm,  bottomMargin=16*mm,
        title=f"Trading Journal Performance \u2013 {month_name} {year}",
        author=username,
    )
    story = []

    story.append(_p(f"Trading Journal Performance \u2013 {month_name} {year}", S_TITLE))
    ist = timezone(timedelta(hours=5, minutes=30))
    now = datetime.now(ist).strftime("%d-%m-%Y %H:%M IST")
    story.append(_p(f"@{username}  \u00b7  Generated {now}", S_DATE))
    story.append(Spacer(1, 4 * mm))
    story.append(HRFlowable(width="100%", thickness=1, color=C_BORDER))
    story.append(Spacer(1, 4 * mm))

    story.append(_p(f"Performance \u2013 {month_name} {year}", S_SEC))
    col_w = W / 4
    s = stats

    def _pf(v, suffix=""):
        if v is None or v == "\u2014" or str(v).strip() == "":
            return "\u2014"
        val = _sf(v)
        return ("+" if val >= 0 else "") + f"{val:.2f}" + suffix

    wr = _sf(s.get("winRate"))
    wr_c = C_WIN if wr > 50 else (C_LOSS if wr < 50 else C_DARK)
    npnl = _sf(s.get("netPNL"))
    npnl_c = C_WIN if npnl > 0 else (C_LOSS if npnl < 0 else C_DARK)
    tr = _sf(s.get("totalReturn"))
    tr_c = C_WIN if tr > 0 else (C_LOSS if tr < 0 else C_DARK)

    stat_rows = [
        [
            _stat_box("Total Trades",    str(s.get("totalTrades", 0)),              C_DARK,   col_w),
            _stat_box("Wins",            str(s.get("wins", 0)),                     C_WIN,    col_w),
            _stat_box("Losses",          str(s.get("losses", 0)),                   C_LOSS,   col_w),
            _stat_box("Win Rate",        _pf(wr, "%"),                             wr_c,     col_w),
        ],
        [
            _stat_box("Net PNL",         _pf(npnl, "%"),                           npnl_c,     col_w),
            _stat_box("Avg RR",          _pf(s.get("avgRR")),                      C_INDIGO,   col_w),
            _stat_box("Max Loss Streak", str(s.get("maxLossStreak", 0)),            C_LOSS,     col_w),
            _stat_box("",                "",                                       colors.white, col_w),
        ],
    ]
    story.append(Table(
        stat_rows, colWidths=[col_w] * 4,
        style=TableStyle([
            ("VALIGN",        (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING",   (0, 0), (-1, -1), 2),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 2),
            ("TOPPADDING",    (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ]),
    ))
    story.append(Spacer(1, 5 * mm))

    if trades:
        story.append(_p(f"Trades \u2013 {month_name} {year}", S_SEC))
        t_headers = ["Date", "Pair", "Model", "Dir", "Risk%", "Grade", "Result", "R:R", "PNL%"]
        t_col_ws  = [22*mm, 20*mm, 18*mm, 12*mm, 14*mm, 14*mm, 16*mm, 14*mm, 20*mm]
        t_rows    = [[_p(h, S_HDR) for h in t_headers]]
        for t in trades:
            rr  = t.get("r_multiple")
            pnl = t.get("pnl_percentage")
            t_rows.append([
                _p(_fd(t.get("date"))),
                _p(t.get("pair", "-"), S_CELL_B),
                _p(t.get("model", "-")),
                _p(t.get("direction", "-")),
                _p(f'{t.get("risk_percent", 0)}%'),
                _p(t.get("grade", "-")),
                _p(t.get("result") or "-"),
                _p(f"{rr:.2f}R" if rr is not None else "-", S_MONO),
                _p(_fmt_pnl(pnl), S_MONO),
            ])
        ts = TableStyle([
            ("BACKGROUND",    (0, 0),  (-1, 0),  C_DARK),
            ("ROWBACKGROUNDS",(0, 1),  (-1, -1), [colors.white, C_CARD]),
            ("GRID",          (0, 0),  (-1, -1), 0.3, C_BORDER),
            ("VALIGN",        (0, 0),  (-1, -1), "MIDDLE"),
            ("TOPPADDING",    (0, 0),  (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0),  (-1, -1), 4),
            ("LEFTPADDING",   (0, 0),  (-1, -1), 3),
            ("RIGHTPADDING",  (0, 0),  (-1, -1), 3),
        ])
        for i, t in enumerate(trades, 1):
            result = t.get("result")
            pnl    = t.get("pnl_percentage")
            grade  = t.get("grade")
            if result == "Win":
                ts.add("TEXTCOLOR", (6, i), (6, i), C_WIN)
            elif result == "Loss":
                ts.add("TEXTCOLOR", (6, i), (6, i), C_LOSS)
            elif result == "Breakeven":
                ts.add("TEXTCOLOR", (6, i), (6, i), C_BE)
            if pnl is not None:
                ts.add("TEXTCOLOR", (8, i), (8, i), C_WIN if _sf(pnl) >= 0 else C_LOSS)
            if grade == "A+":
                ts.add("TEXTCOLOR", (5, i), (5, i), C_PURPLE)
        story.append(Table(t_rows, colWidths=t_col_ws, repeatRows=1, style=ts))
        story.append(Spacer(1, 5 * mm))
    else:
        story.append(_p(f"No finalized trades for {month_name} {year}.", S_CELL))
        story.append(Spacer(1, 5 * mm))


    doc.build(story)
    return buf.getvalue()


# ── Yearly PDF builder ────────────────────────────────────────────────────────
def _build_year_pdf(username: str, year: int,
                    stats: dict, trades: list, monthly_breakdown: list) -> bytes:
    buf = io.BytesIO()
    W   = A4[0] - 32 * mm

    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=16*mm, rightMargin=16*mm,
        topMargin=16*mm,  bottomMargin=16*mm,
        title=f"Trading Journal Performance \u2013 {year}",
        author=username,
    )
    story = []

    story.append(_p(f"Trading Journal Performance \u2013 {year}", S_TITLE))
    ist = timezone(timedelta(hours=5, minutes=30))
    now = datetime.now(ist).strftime("%d-%m-%Y %H:%M IST")
    story.append(_p(f"@{username}  \u00b7  Generated {now}", S_DATE))
    story.append(Spacer(1, 4 * mm))
    story.append(HRFlowable(width="100%", thickness=1, color=C_BORDER))
    story.append(Spacer(1, 4 * mm))

    story.append(_p(f"Performance \u2013 {year}", S_SEC))
    col_w = W / 4
    s = stats

    def _pf(v, suffix=""):
        if v is None or v == "\u2014" or str(v).strip() == "":
            return "\u2014"
        val = _sf(v)
        return ("+" if val >= 0 else "") + f"{val:.2f}" + suffix

    best_m  = s.get("bestMonth")
    worst_m = s.get("worstMonth")
    best_lbl  = f"{MONTHS[best_m['month']-1]} ({_pf(best_m['pnl'], '%')})"  if best_m  else "\u2014"
    worst_lbl = f"{MONTHS[worst_m['month']-1]} ({_pf(worst_m['pnl'], '%')})" if worst_m else "\u2014"
    wr = s.get("winRate") or 0
    wr_c = C_WIN if wr > 50 else (C_LOSS if wr < 50 else C_DARK)
    npnl = s.get("netPNL") or 0
    npnl_c = C_WIN if npnl > 0 else (C_LOSS if npnl < 0 else C_DARK)
    best_c  = C_WIN if (best_m and best_m.get('pnl', 0) > 0) else C_DARK
    worst_c = C_LOSS if (worst_m and worst_m.get('pnl', 0) < 0) else C_DARK

    stat_rows = [
        [
            _stat_box("Total Trades", str(s.get("totalTrades", 0)),              C_DARK,   col_w),
            _stat_box("Wins",         str(s.get("wins", 0)),                     C_WIN,    col_w),
            _stat_box("Losses",       str(s.get("losses", 0)),                   C_LOSS,   col_w),
            _stat_box("Win Rate",     _pf(wr, "%"),                             wr_c,     col_w),
        ],
        [
            _stat_box("Net PNL",      _pf(npnl, "%"),                           npnl_c,    col_w),
            _stat_box("Avg RR",       _pf(s.get("avgRR")),                      C_INDIGO,  col_w),
            _stat_box("Best Month",   best_lbl,                                  best_c,    col_w),
            _stat_box("Worst Month",  worst_lbl,                                 worst_c,   col_w),
        ],
    ]
    story.append(Table(
        stat_rows, colWidths=[col_w] * 4,
        style=TableStyle([
            ("VALIGN",        (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING",   (0, 0), (-1, -1), 2),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 2),
            ("TOPPADDING",    (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ]),
    ))
    story.append(Spacer(1, 5 * mm))

    # Monthly PNL breakdown
    if monthly_breakdown:
        story.append(_p(f"Monthly PNL Breakdown \u2013 {year}", S_SEC))
        mb_headers = ["Month", "Net PNL"]
        mb_col_ws  = [40*mm, 40*mm]
        mb_rows    = [[_p(h, S_HDR) for h in mb_headers]]
        for m in monthly_breakdown:
            pnl = m.get("pnl", 0)
            mb_rows.append([
                _p(MONTHS[m["month"] - 1], S_CELL_B),
                _p(_pf(pnl, "%"), S_MONO),
            ])
        mb_ts = TableStyle([
            ("BACKGROUND",    (0, 0),  (-1, 0),  C_DARK),
            ("ROWBACKGROUNDS",(0, 1),  (-1, -1), [colors.white, C_CARD]),
            ("GRID",          (0, 0),  (-1, -1), 0.3, C_BORDER),
            ("VALIGN",        (0, 0),  (-1, -1), "MIDDLE"),
            ("TOPPADDING",    (0, 0),  (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0),  (-1, -1), 4),
            ("LEFTPADDING",   (0, 0),  (-1, -1), 3),
            ("RIGHTPADDING",  (0, 0),  (-1, -1), 3),
        ])
        for i, m in enumerate(monthly_breakdown, 1):
            mb_ts.add("TEXTCOLOR", (1, i), (1, i), C_WIN if m.get("pnl", 0) >= 0 else C_LOSS)
        story.append(Table(mb_rows, colWidths=mb_col_ws, repeatRows=1, style=mb_ts))
        story.append(Spacer(1, 5 * mm))

    # Trade log
    if trades:
        story.append(_p(f"Trades \u2013 {year}", S_SEC))
        t_headers = ["Date", "Pair", "Model", "Dir", "Risk%", "Grade", "Result", "R:R", "PNL%"]
        t_col_ws  = [22*mm, 20*mm, 18*mm, 12*mm, 14*mm, 14*mm, 16*mm, 14*mm, 20*mm]
        t_rows    = [[_p(h, S_HDR) for h in t_headers]]
        for t in trades:
            rr  = t.get("r_multiple")
            pnl = t.get("pnl_percentage")
            t_rows.append([
                _p(_fd(t.get("date"))),
                _p(t.get("pair", "-"), S_CELL_B),
                _p(t.get("model", "-")),
                _p(t.get("direction", "-")),
                _p(f'{t.get("risk_percent", 0)}%'),
                _p(t.get("grade", "-")),
                _p(t.get("result") or "-"),
                _p(f"{rr:.2f}R" if rr is not None else "-", S_MONO),
                _p(_fmt_pnl(pnl), S_MONO),
            ])
        ts = TableStyle([
            ("BACKGROUND",    (0, 0),  (-1, 0),  C_DARK),
            ("ROWBACKGROUNDS",(0, 1),  (-1, -1), [colors.white, C_CARD]),
            ("GRID",          (0, 0),  (-1, -1), 0.3, C_BORDER),
            ("VALIGN",        (0, 0),  (-1, -1), "MIDDLE"),
            ("TOPPADDING",    (0, 0),  (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0),  (-1, -1), 4),
            ("LEFTPADDING",   (0, 0),  (-1, -1), 3),
            ("RIGHTPADDING",  (0, 0),  (-1, -1), 3),
        ])
        for i, t in enumerate(trades, 1):
            result = t.get("result")
            pnl    = t.get("pnl_percentage")
            grade  = t.get("grade")
            if result == "Win":
                ts.add("TEXTCOLOR", (6, i), (6, i), C_WIN)
            elif result == "Loss":
                ts.add("TEXTCOLOR", (6, i), (6, i), C_LOSS)
            elif result == "Breakeven":
                ts.add("TEXTCOLOR", (6, i), (6, i), C_BE)
            if pnl is not None:
                ts.add("TEXTCOLOR", (8, i), (8, i), C_WIN if _sf(pnl) >= 0 else C_LOSS)
            if grade == "A+":
                ts.add("TEXTCOLOR", (5, i), (5, i), C_PURPLE)
        story.append(Table(t_rows, colWidths=t_col_ws, repeatRows=1, style=ts))
        story.append(Spacer(1, 5 * mm))
    else:
        story.append(_p(f"No finalized trades for {year}.", S_CELL))
        story.append(Spacer(1, 5 * mm))


    doc.build(story)
    return buf.getvalue()


# ── Endpoints ─────────────────────────────────────────────────────────────────
@export_bp.get("/month/<int:year>/<int:month>")
@jwt_required()
def export_month_pdf(year, month):
    uid = ObjectId(get_jwt_identity())
    db  = get_db()

    user     = db.users.find_one({"_id": uid}, {"username": 1})
    username = user["username"] if user else "unknown"

    ym_prefix = f"{year}-{month:02d}"

    trades = list(db.trades.find({
        "user_id": uid,
        "date":    {"$regex": f"^{ym_prefix}"},
        "status":  "final",
        "result":  {"$in": ["Win", "Loss", "Breakeven"]},
    }).sort("date", 1))

    total  = len(trades)
    wins   = sum(1 for t in trades if _sf(t.get("pnl_percentage")) > 0)
    losses = sum(1 for t in trades if _sf(t.get("pnl_percentage")) < 0)
    win_rate     = round(wins / total * 100, 2) if total else 0
    net_pnl      = round(sum(_sf(t.get("pnl_percentage")) for t in trades), 4)
    equity       = 1.0
    max_streak = streak = 0
    for t in trades:
        pnl_v = _sf(t.get("pnl_percentage"))
        equity *= (1 + pnl_v / 100)
        if pnl_v < 0:
            streak += 1
            max_streak = max(max_streak, streak)
        else:
            streak = 0
    total_return = round((equity - 1.0) * 100, 4)

    max_dd = 0.0 # Placeholder

    # Win-Only Avg RR for Header (using Isolated Compute Layer)
    avg_rr = calculate_avg_rr(trades)

    stats = dict(
        totalTrades=total, wins=wins, losses=losses,
        winRate=win_rate, netPNL=net_pnl,
        totalReturn=total_return, maxLossStreak=max_streak,
        avgRR=avg_rr
    )

    pdf_bytes = _build_month_pdf(username, year, month, stats, trades)
    filename  = f"trading-journal-{username}-{year}-{month:02d}.pdf"
    return send_file(
        io.BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=filename,
    )


@export_bp.get("/year/<int:year>")
@jwt_required()
def export_year_pdf(year):
    uid = ObjectId(get_jwt_identity())
    db  = get_db()

    user     = db.users.find_one({"_id": uid}, {"username": 1})
    username = user["username"] if user else "unknown"

    y_prefix = f"{year}-"

    trades = list(db.trades.find({
        "user_id": uid,
        "date":    {"$regex": f"^{y_prefix}"},
        "status":  "final",
        "result":  {"$in": ["Win", "Loss", "Breakeven"]},
    }).sort("date", 1))

    total  = len(trades)
    wins   = sum(1 for t in trades if _sf(t.get("pnl_percentage")) > 0)
    losses = sum(1 for t in trades if _sf(t.get("pnl_percentage")) < 0)
    win_rate = round(wins / total * 100, 2) if total else 0
    net_pnl  = round(sum(_sf(t.get("pnl_percentage")) for t in trades), 4)

    monthly_pnl = {m: 0.0 for m in range(1, 13)}

    for t in trades:
        pnl_v = _sf(t.get("pnl_percentage"))
        try:
            m = int(t.get("date", "").split("-")[1])
            monthly_pnl[m] = round(monthly_pnl[m] + pnl_v, 4)
        except Exception:
            pass
        # gross_profit/loss and max_dd calculations removed

    months_with_trades = {
        int(t.get("date").split("-")[1])
        for t in trades if len(t.get("date", "").split("-")) >= 2
    }
    best_month = worst_month = None
    best_pnl   = -float("inf")
    worst_pnl  =  float("inf")
    for m in months_with_trades:
        mpnl = monthly_pnl[m]
        if mpnl > best_pnl:
            best_pnl   = mpnl
            best_month = {"month": m, "pnl": round(mpnl, 2)}
        if mpnl < worst_pnl:
            worst_pnl   = mpnl
            worst_month = {"month": m, "pnl": round(mpnl, 2)}

    mb_arr = [{"month": m, "pnl": round(monthly_pnl[m], 2)} for m in range(1, 13)]

    max_dd = 0.0 # Placeholder

    # Win-Only Avg RR for Header (using Isolated Compute Layer)
    avg_rr = calculate_avg_rr(trades)

    stats = dict(
        totalTrades=total, wins=wins, losses=losses,
        winRate=win_rate, netPNL=net_pnl,
        bestMonth=best_month, worstMonth=worst_month,
        avgRR=avg_rr
    )

    pdf_bytes = _build_year_pdf(username, year, stats, trades, mb_arr)
    filename  = f"trading-journal-{username}-{year}.pdf"
    return send_file(
        io.BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=filename,
    )
