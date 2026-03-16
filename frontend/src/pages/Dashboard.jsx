import { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/dateHelper';
import { useMode } from '../context/ModeContext';

export default function Dashboard() {
  const { user } = useAuth();
  const { mode } = useMode();
  const [stats,   setStats]   = useState(null);
  const [recent,  setRecent]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/reports/dashboard', { params: { mode } }),
      api.get('/trades', { params: { status: 'final', mode } }),
    ]).then(([s, t]) => {
      setStats(s.data);
      setRecent(t.data.trades.slice(0, 5));
    }).catch(console.error).finally(() => setLoading(false));
  }, [mode]);

  if (loading) return <div className="loading">Loading dashboard…</div>;

  const s = stats || {};
  const statBoxes = [
    { label:'Total Trades',    value: s.finalTrades  ?? 0,  cls:'' },
    { label:'Win Rate',        value: s.winRate != null ? `${s.winRate}%` : '--', cls: s.winRate > 50 ? 'svG' : s.winRate < 50 ? 'svR' : '' },
    { label:'Net PNL',         value: s.netPNL != null ? `${s.netPNL >= 0 ? '+' : ''}${s.netPNL}%` : '--', cls: s.netPNL > 0 ? 'svG' : s.netPNL < 0 ? 'svR' : '' },
    { label:'Max Drawdown',    value: s.maxDrawdown != null ? `-${s.maxDrawdown}%` : '--', cls: 'svR' },
    { label:'Max Loss Streak', value: s.maxLossStreak ?? 0, cls: 'svR' },
    { label:'Avg RR',          value: (s.avgRR != null && s.avgRR !== '—') ? s.avgRR : '—', cls: '' },
  ];

  return (
    <div className="page">
      <div className="page-hd">
        <h1>Dashboard</h1>
        <p>Welcome back, <strong>@{user?.username}</strong></p>
      </div>
      <div className="sg">
        {statBoxes.map(b => (
          <div key={b.label} className="sb">
            <div className="sl">{b.label}</div>
            <div className={`sv ${b.cls}`}>{b.value}</div>
          </div>
        ))}
      </div>
      {recent.length > 0 && (
        <div className="card" style={{ marginTop:24 }}>
          <div className="card-title">Recent Trades</div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Date</th><th>Pair</th><th>Model</th><th>Grade</th><th>Result</th><th>PNL</th></tr></thead>
              <tbody>
                {recent.map(t => (
                  <tr key={t.id} className={t.status === 'final' ? 'tr-final' : ''}>
                    <td>{formatDate(t.date)}</td>
                    <td><strong>{t.pair}</strong></td>
                    <td><span className={`pill ${t.model === 'Model 2' ? 'pM2' : t.model === 'Practice Model' ? 'pPM' : 'pM1'}`}>{t.model}</span></td>
                    <td><span className={`pill ${t.grade === 'A+' ? 'pAp' : t.grade === 'A' ? 'pB' : 'pLow'}`}>{t.grade}</span></td>
                    <td>{t.result ? <span className={`pill ${t.result === 'Win' ? 'pWin' : t.result === 'Loss' ? 'pLoss' : 'pBE'}`}>{t.result}</span> : '—'}</td>
                    <td className={t.pnl_percentage > 0 ? 'rp' : t.pnl_percentage < 0 ? 'rn' : 'mono'}>{t.pnl_percentage != null ? `${t.pnl_percentage >= 0 ? '+' : ''}${parseFloat(t.pnl_percentage).toFixed(2)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
