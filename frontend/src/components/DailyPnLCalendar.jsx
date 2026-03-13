import React, { useState, useEffect } from 'react';
import '../styles/DailyPnLCalendar.css';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

/**
 * DailyPnLCalendar — New clean implementation.
 * Renders a calendar grid for the selected month showing daily PnL.
 * Only renders rows needed for the month (no extra empty rows).
 *
 * Props:
 *  year           {number}
 *  month          {number}  1-indexed
 *  dailyBreakdown {object}  { "YYYY-MM-DD": { net_pnl, trade_count, trades: [...] } }
 */
export default function DailyPnLCalendar({ year, month, dailyBreakdown = {} }) {
  const [modalDay, setModalDay] = useState(null);

  // Close modal on ESC
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setModalDay(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Calendar math
  const daysInMonth   = new Date(year, month, 0).getDate();           // total days
  const startWeekday  = new Date(year, month - 1, 1).getDay();        // 0=Sun
  const numWeeks      = Math.ceil((daysInMonth + startWeekday) / 7);  // rows needed
  const totalCells    = numWeeks * 7;

  const handleDayClick = (dayNum) => {
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
    if (dailyBreakdown[dateStr]) setModalDay(dateStr);
  };

  const formatModalDate = (dateStr) => {
    const [y, m, d] = dateStr.split('-');
    return `${parseInt(d)} ${FULL_MONTHS[parseInt(m) - 1]} ${y}`;
  };

  // Build grid cells
  const cells = Array.from({ length: totalCells }, (_, i) => {
    const dayNum = i - startWeekday + 1;
    if (dayNum < 1 || dayNum > daysInMonth) {
      return <div key={`pad-${i}`} className="dpnl-cell dpnl-cell--pad" />;
    }

    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
    const info    = dailyBreakdown[dateStr];
    const pnl     = info ? info.net_pnl : null;
    const count   = info ? info.trade_count : 0;
    const hasData = !!info;

    let stateClass = '';
    if (hasData) {
      stateClass = pnl > 0 ? 'dpnl-cell--pos' : pnl < 0 ? 'dpnl-cell--neg' : 'dpnl-cell--neu';
    }

    return (
      <div
        key={dateStr}
        className={`dpnl-cell dpnl-cell--day ${stateClass} ${hasData ? 'dpnl-cell--click' : ''}`}
        onClick={() => hasData && handleDayClick(dayNum)}
        role={hasData ? 'button' : undefined}
        tabIndex={hasData ? 0 : undefined}
        onKeyDown={hasData ? (e) => e.key === 'Enter' && handleDayClick(dayNum) : undefined}
      >
        <span className="dpnl-date">{dayNum}</span>
        {hasData && (
          <span className="dpnl-pnl">
            {pnl > 0 ? '+' : ''}{pnl.toFixed(2)}%
          </span>
        )}
        {hasData && (
          <span className="dpnl-count">
            ({count} trade{count !== 1 ? 's' : ''})
          </span>
        )}
      </div>
    );
  });

  const modalData = modalDay ? dailyBreakdown[modalDay] : null;

  return (
    <div className="dpnl-wrap">
      <div className="dpnl-card">
        {/* Header */}
        <div className="dpnl-header">
          <h3 className="dpnl-title">
            Daily PnL Breakdown — {FULL_MONTHS[month - 1]} {year}
          </h3>
        </div>

        {/* Weekday labels */}
        <div className="dpnl-labels">
          {DAYS_OF_WEEK.map(d => (
            <div key={d} className="dpnl-label">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div
          className="dpnl-grid"
          style={{ gridTemplateRows: `repeat(${numWeeks}, auto)` }}
        >
          {cells}
        </div>
      </div>

      {/* Modal */}
      {modalDay && modalData && (
        <div
          className="dpnl-overlay"
          onClick={() => setModalDay(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="dpnl-modal" onClick={e => e.stopPropagation()}>
            <div className="dpnl-modal-hd">
              <span className="dpnl-modal-title">
                Trades on {formatModalDate(modalDay)}
              </span>
              <button
                className="dpnl-modal-close"
                onClick={() => setModalDay(null)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <div className="dpnl-modal-body">
              {modalData.trades && modalData.trades.length > 0 ? (
                <table className="dpnl-modal-tbl">
                  <thead>
                    <tr>
                      <th>Pair</th>
                      <th>Type</th>
                      <th>Risk</th>
                      <th>Result</th>
                      <th>RR</th>
                      <th>PnL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalData.trades.map((t, idx) => (
                      <tr key={t.id || idx}>
                        <td><strong>{t.pair}</strong></td>
                        <td>
                          <span className={`dpnl-dir dpnl-dir--${t.direction?.toLowerCase()}`}>
                            {t.direction}
                          </span>
                        </td>
                        <td className="dpnl-mono">
                          {t.risk_percent != null ? `${t.risk_percent}%` : '—'}
                        </td>
                        <td>
                          <span className={`dpnl-pill dpnl-pill--${(t.result || '').toLowerCase()}`}>
                            {t.result || '—'}
                          </span>
                        </td>
                        <td className="dpnl-mono">
                          {t.r_multiple != null ? `${parseFloat(t.r_multiple).toFixed(2)}R` : '—'}
                        </td>
                        <td>
                          <span className={t.pnl > 0 ? 'dpnl-up' : t.pnl < 0 ? 'dpnl-dn' : 'dpnl-zero'}>
                            {t.pnl > 0 ? '+' : ''}{parseFloat(t.pnl || 0).toFixed(2)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="dpnl-empty">No trade details available.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
