import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useMode } from '../context/ModeContext';

export default function WinratePairs() {
  const { mode } = useMode();
  const navigate = useNavigate();
  const [stats, setStats] = useState([]);
  const [totalNetRR, setTotalNetRR] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [exporting, setExporting] = useState(false);

  // No mode-specific redirect needed as requested for both modes

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true); setErr('');
        const { data } = await api.get('/trades');
        const trades = data.trades || [];
        
        const groups = {};
        trades.forEach(t => {
          if (!t.result || !t.pair || t.status === 'binned') return;
          const p = t.pair.toUpperCase();
          if (!groups[p]) groups[p] = { wins: 0, losses: 0, total: 0, rr: 0 };
          groups[p].total += 1;
          
          if (t.result === 'Win') {
            groups[p].wins += 1;
            groups[p].rr += parseFloat(t.r_multiple || 0);
          } else if (t.result === 'Loss') {
            groups[p].losses += 1;
            groups[p].rr -= 1.0;
          }
        });

        const sorted = Object.entries(groups)
          .map(([pair, g]) => ({
            pair,
            total: g.total,
            wins: g.wins,
            losses: g.losses,
            winrate: parseFloat(((g.wins / g.total) * 100).toFixed(1)),
            rr: parseFloat(g.rr.toFixed(2))
          }))
          .sort((a, b) => b.winrate - a.winrate); // Highest to Lowest (Descending)

        setStats(sorted);
        setTotalNetRR(sorted.reduce((acc, curr) => acc + curr.rr, 0).toFixed(2));
      } catch (e) {
        setErr(e.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [mode]);

  const exportPDF = async () => {
    setExporting(true); setErr('');
    try {
      const url = `/api/export/winrate-pairs?mode=${mode}`;
      const res = await fetch(url, { 
        headers: { 
          Authorization: `Bearer ${localStorage.getItem('tjp_token')}`,
          'X-Mode': mode
        } 
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objUrl;
      link.download = `winrate-pairs-report.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objUrl);
    } catch(ex) { setErr('Export failed'); }
    finally { setExporting(false); }
  };

  return (
    <div className="page">
      <div className="page-hd">
        <h1>WinRate by Pairs</h1>
        <div className="header-btns">
          <button className="btn btn-ghost" onClick={exportPDF} disabled={exporting || loading || stats.length === 0}>
            {exporting ? 'Exporting…' : '⬇ Export PDF'}
          </button>
        </div>
      </div>

      {err && <div className="err-box">{err}</div>}
      
      {loading ? (
        <div className="loading">Loading performance data…</div>
      ) : stats.length === 0 ? (
        <div className="empty">
          <h3>No Data Yet</h3>
          <p>Add some trades with results to see your performance here.</p>
        </div>
      ) : (
        <>
          <div className="sg" style={{ marginBottom: '24px' }}>
            <div className="rpt-stat" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px' }}>
              <div className="rpt-sl" style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: '8px' }}>
                Total Net RR (All Trades)
              </div>
              <div className={`rpt-sv ${totalNetRR >= 0 ? 'rp' : 'rn'}`} style={{ fontSize: '28px', fontWeight: 850 }}>
                {totalNetRR >= 0 ? '+' : ''}{totalNetRR}R
              </div>
            </div>
          </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: '24px' }}>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ paddingLeft: '24px' }}>Pair</th>
                  <th>Win Rate</th>
                  <th>Total - Win - Loss</th>
                  <th style={{ paddingRight: '24px' }}>Net RR</th>
                </tr>
              </thead>
              <tbody>
                {stats.map(s => (
                  <tr key={s.pair} className="tr-final">
                    <td style={{ paddingLeft: '24px', fontWeight: 800, fontSize: '15px' }}>{s.pair}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', maxWidth: '300px' }}>
                        <span className={`pill ${s.winrate >= 50 ? 'pWin' : 'pLoss'}`} style={{ minWidth: '65px', textAlign: 'center', fontWeight: 700 }}>
                          {s.winrate}%
                        </span>
                        <div style={{ flex: 1, height: '6px', background: 'var(--bg)', borderRadius: '3px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                          <div style={{ 
                            width: `${s.winrate}%`, 
                            height: '100%', 
                            background: s.winrate >= 50 ? 'var(--success)' : 'var(--danger)',
                            transition: 'width 1s ease-out'
                          }}></div>
                        </div>
                      </div>
                    </td>
                    <td className="mono" style={{ fontWeight: 600 }}>
                      {s.total} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>Total</span> - {s.wins}W - {s.losses}L
                    </td>
                    <td className={s.rr >= 0 ? 'rp' : 'rn'} style={{ paddingRight: '24px', fontWeight: 800 }}>
                      {s.rr >= 0 ? '+' : ''}{s.rr}R
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>
    )}
    </div>
  );
}
