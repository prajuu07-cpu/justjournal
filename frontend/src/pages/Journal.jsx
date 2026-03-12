import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import NewTrade from './NewTrade';
import { formatDate } from '../utils/dateHelper';

export default function Journal() {
  const nav = useNavigate();
  const [trades,    setTrades]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [editing,   setEditing]   = useState(null);
  const [filter,    setFilter]    = useState({ model: 'All', grade: 'All', result: 'All' });
  const [addResult, setAddResult] = useState(null); // { trade, result:'', rMult:'' }
  const [err,       setErr]       = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams();
    if (filter.model  !== 'All') q.set('model',  filter.model);
    if (filter.grade  !== 'All') q.set('grade',  filter.grade);
    if (filter.result !== 'All') q.set('result', filter.result);
    api.get(`/trades?${q}`)
      .then(r => setTrades(r.data.trades))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const del = async (id) => {
    if (!window.confirm('Delete this trade?')) return;
    await api.delete(`/trades/${id}`);
    load();
  };

  const deleteDrafts = async () => {
    if (!window.confirm('Delete all draft trades? This cannot be undone.')) return;
    try {
      await api.delete('/trades/drafts');
      load();
    } catch (ex) {
      setErr(ex.response?.data?.error || 'Failed to delete drafts');
    }
  };

  const saveResult = async () => {
    const { trade, result, rMult } = addResult;
    if (!result) return;
    try {
      await api.patch(`/trades/${trade.id}/result`, { result, r_multiple: rMult });
      setAddResult(null);
      load();
    } catch (ex) {
      setErr(ex.response?.data?.error || 'Failed to save result');
    }
  };


  if (editing) return <NewTrade editTrade={editing} onDone={() => { setEditing(null); load(); }} />;

  return (
    <div className="m-page-fade">
      <div className="page-hd">
        <h1>Trade Journal</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="m-glass-btn" style={{ borderColor: 'var(--m-danger)', color: 'var(--m-danger)', padding: '8px 12px', fontSize: '12px' }} onClick={deleteDrafts}>
            Clean Drafts
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar" style={{ marginBottom: 24 }}>
        {[
          { key: 'model',  opts: ['All', 'Model 1', 'Model 2'] },
          { key: 'grade',  opts: ['All', 'A+', 'A', 'Draft'] },
          { key: 'result', opts: ['All', 'Win', 'Loss', 'Breakeven'] },
        ].map(f => (
          <select
            key={f.key}
            className="fsel"
            style={{ background: 'var(--m-card)', color: '#fff', border: '1px solid var(--m-border)', borderRadius: '12px' }}
            value={filter[f.key]}
            onChange={e => setFilter(p => ({ ...p, [f.key]: e.target.value }))}
          >
            {f.opts.map(o => <option key={o} style={{ background: '#1e293b' }}>{o}</option>)}
          </select>
        ))}
      </div>

      {err && <div className="err-box">{err}</div>}

      {loading ? (
        <div className="loading">Loading trades…</div>
      ) : trades.length === 0 ? (
        <div className="m-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '40px', marginBottom: 12 }}>🕯️</div>
          <p style={{ color: 'var(--m-sub)', marginBottom: 20 }}>No trades found in this journal.</p>
          <button className="m-glass-btn" onClick={() => nav('/new-trade')}>
            Add Your First Trade
          </button>
        </div>
      ) : (
        <div className="m-trade-list">
          {trades.map(t => (
            <div key={t.id} className="m-card" onClick={() => setEditing(t)}>
              <div className="m-trade-card">
                <div className="m-trade-info">
                  <div className="m-trade-pair">
                    {t.pair} 
                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--m-sub)', marginLeft: 8 }}>
                      {t.status === 'draft' ? '(Draft)' : ''}
                    </span>
                  </div>
                  <div className="m-trade-date">
                    {formatDate(t.date)} • <span style={{ color: t.model === 'Model 2' ? 'var(--indigo)' : 'var(--purple)' }}>{t.model}</span>
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
                    <span className="m-pill" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--m-sub)', border: '1px solid var(--m-border)' }}>{t.grade}</span>
                    <span className="m-pill" style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--m-primary)', border: '1px solid rgba(99,102,241,0.2)' }}>{t.r_multiple != null ? `${parseFloat(t.r_multiple).toFixed(1)}R` : '—'}</span>
                  </div>
                </div>
                <div className="m-trade-result">
                  <div className={`m-trade-profit ${t.pnl_percentage > 0 ? 'svG' : t.pnl_percentage < 0 ? 'svR' : ''}`}>
                    {t.pnl_percentage != null ? `${t.pnl_percentage >= 0 ? '+' : ''}${parseFloat(t.pnl_percentage).toFixed(2)}%` : '—'}
                  </div>
                  {t.result ? (
                    <span className={`m-pill ${t.result === 'Win' ? 'm-pill-win' : t.result === 'Loss' ? 'm-pill-loss' : 'm-pill-be'}`}>
                      {t.result}
                    </span>
                  ) : t.status === 'final' ? (
                    <button className="m-glass-btn" style={{ padding: '4px 8px', fontSize: '10px', marginTop: 4 }} onClick={(e) => { e.stopPropagation(); setAddResult({ trade: t, result: '', rMult: '' }); }}>
                      + Result
                    </button>
                  ) : (
                    <span className="m-pill" style={{ background: '#fef3c722', color: '#f59e0b', border: '1px solid #fef3c733' }}>DRAFT</span>
                  )}
                </div>
              </div>
              <div style={{ marginTop: 12, borderTop: '1px solid var(--m-border)', paddingTop: 12, display: 'flex', gap: 12 }}>
                <button className="m-glass-btn" style={{ flex: 1, padding: '6px' }} onClick={(e) => { e.stopPropagation(); setEditing(t); }}>
                  Edit
                </button>
                <button className="m-glass-btn" style={{ flex: 1, padding: '6px', color: 'var(--m-danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }} onClick={(e) => { e.stopPropagation(); del(t.id); }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Result Modal */}
      {addResult && (
        <div className="lim-ov" onClick={() => setAddResult(null)}>
          <div className="m-card lim-box" style={{ background: '#0f172a', borderColor: 'var(--m-primary)' }} onClick={e => e.stopPropagation()}>
            <div className="lim-top">
              <div className="lim-title" style={{ color: '#fff' }}>
                Post-Trade Analysis
              </div>
            </div>
            <div className="lim-body">
              <div className="field" style={{ marginBottom: 16 }}>
                <label style={{ color: 'var(--m-sub)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Outcome</label>
                <select 
                  value={addResult.result} 
                  onChange={e => setAddResult(p => ({ ...p, result: e.target.value }))}
                  style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--m-border)', borderRadius: '12px', color: '#fff', marginTop: 4 }}
                >
                  <option value="" style={{ background: '#1e293b' }}>Select Outcome…</option>
                  <option style={{ background: '#1e293b' }}>Win</option>
                  <option style={{ background: '#1e293b' }}>Loss</option>
                  <option style={{ background: '#1e293b' }}>Breakeven</option>
                </select>
              </div>
              {addResult.result === 'Win' && (
                <div className="field" style={{ marginBottom: 16 }}>
                  <label style={{ color: 'var(--m-sub)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>R Multiple Earned</label>
                  <input
                    type="number"
                    value={addResult.rMult}
                    onChange={e => setAddResult(p => ({ ...p, rMult: e.target.value }))}
                    placeholder="e.g. 2.5"
                    min="0.01"
                    step="0.01"
                    style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--m-border)', borderRadius: '12px', color: '#fff', marginTop: 4 }}
                  />
                </div>
              )}
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button className="m-glass-btn" style={{ flex: 1 }} onClick={() => setAddResult(null)}>Cancel</button>
                <button className="m-glass-btn" style={{ flex: 1, background: 'var(--m-primary)', borderColor: 'var(--m-primary)' }} onClick={saveResult} disabled={!addResult.result}>Save Result</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
