import { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/dateHelper';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats,   setStats]   = useState(null);
  const [recent,  setRecent]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/reports/dashboard'),
      api.get('/trades?status=final'),
    ]).then(([s, t]) => {
      setStats(s.data);
      setRecent(t.data.trades.slice(0, 5));
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

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
    <div className="m-page-fade">
      <div className="page-hd">
        <div>
          <p style={{ margin: 0, opacity: 0.7, fontSize: '13px' }}>Dashboard</p>
          <h1 style={{ fontSize: '28px' }}>Welcome, {user?.username}</h1>
        </div>
      </div>

      <div className="m-stat-grid">
        {statBoxes.map(b => (
          <div key={b.label} className="m-stat-card">
            <div className="m-stat-label">{b.label}</div>
            <div className={`m-stat-val ${b.cls === 'svG' ? 'svG' : b.cls === 'svR' ? 'svR' : ''}`}>
              {b.value}
            </div>
          </div>
        ))}
      </div>

      {recent.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h3 style={{ marginBottom: 16, fontSize: '18px', fontWeight: 700 }}>Recent Trades</h3>
          {recent.map(t => (
            <div key={t.id} className="m-card m-trade-card">
              <div className="m-trade-info">
                <div className="m-trade-pair">{t.pair}</div>
                <div className="m-trade-date">
                  {formatDate(t.date)} • <span style={{ color: t.model === 'Model 2' ? 'var(--indigo)' : 'var(--purple)' }}>{t.model}</span>
                </div>
              </div>
              <div className="m-trade-result">
                <div className={`m-trade-profit ${t.pnl_percentage > 0 ? 'svG' : t.pnl_percentage < 0 ? 'svR' : ''}`}>
                  {t.pnl_percentage != null ? `${t.pnl_percentage >= 0 ? '+' : ''}${parseFloat(t.pnl_percentage).toFixed(2)}%` : '—'}
                </div>
                {t.result && (
                  <span className={`m-pill ${t.result === 'Win' ? 'm-pill-win' : t.result === 'Loss' ? 'm-pill-loss' : 'm-pill-be'}`}>
                    {t.result}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
