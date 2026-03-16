import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import NewTrade from './NewTrade';
import { formatDate } from '../utils/dateHelper';
import { useMode } from '../context/ModeContext';

export default function Journal() {
  const nav = useNavigate();
  const { mode } = useMode();
  const [trades,    setTrades]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [editing,   setEditing]   = useState(null);
  const [filter,    setFilter]    = useState({ model: 'All', grade: 'All', result: 'All' });
  const [addResult, setAddResult] = useState(null); // { trade, result:'', rMult:'' }
  const [err,       setErr]       = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const params = { mode };
    if (filter.model  !== 'All') params.model = filter.model;
    if (filter.grade  !== 'All') params.grade = filter.grade;
    if (filter.result !== 'All') params.result = filter.result;

    api.get('/trades', { params })
      .then(r => setTrades(r.data.trades))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filter, mode]);

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
    <div className="page">
      <div className="page-hd">
        <h1>Trade Journal</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-danger" onClick={deleteDrafts}>Delete Drafts</button>
          <button className="btn btn-primary" onClick={() => nav('/new-trade')}>+ New Trade</button>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        {[
          { key: 'model',  opts: mode === 'practice' ? ['All', 'Practice Model'] : ['All', 'Model 1', 'Model 2'] },
          { key: 'grade',  opts: ['All', 'A+', 'A', 'Draft'] },
          { key: 'result', opts: ['All', 'Win', 'Loss', 'Breakeven'] },
        ].map(f => (
          <select
            key={f.key}
            className="fsel"
            value={filter[f.key]}
            onChange={e => setFilter(p => ({ ...p, [f.key]: e.target.value }))}
          >
            {f.opts.map(o => <option key={o}>{o}</option>)}
          </select>
        ))}
      </div>

      {err && <div className="err-box">{err}</div>}

      {loading ? (
        <div className="loading">Loading…</div>
      ) : trades.length === 0 ? (
        <div className="empty">
          No trades found.{' '}
          <span
            style={{ cursor: 'pointer', color: 'var(--indigo)' }}
            onClick={() => nav('/new-trade')}
          >
            Add your first trade →
          </span>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th><th>Pair</th>{mode === 'practice' && <th>Session</th>}<th>Model</th>{mode !== 'practice' && <th>Grade</th>}
                  <th>Status</th><th>RR</th><th>PNL</th><th>Result</th><th></th>
                </tr>
              </thead>
              <tbody>
                {trades.map(t => (
                  <tr key={t.id} className={t.status === 'final' ? 'tr-final' : ''}>
                    <td>{formatDate(t.date)}</td>
                    <td><strong>{t.pair}</strong></td>
                    {mode === 'practice' && <td>{t.session || '—'}</td>}
                    <td><span className={`pill ${t.model === 'Model 2' ? 'pM2' : t.model === 'Practice Model' ? 'pPM' : 'pM1'}`}>{t.model === 'Practice Model' ? 'Practice' : t.model}</span></td>
                    {mode !== 'practice' && <td><span className={`pill ${t.grade === 'A+' ? 'pAp' : t.grade === 'A' ? 'pB' : 'pLow'}`}>{t.grade}</span></td>}
                    <td><span className={`pill ${t.status === 'final' ? 'pFin' : 'pDft'}`}>{t.status}</span></td>
                    <td className="mono">{t.r_multiple != null ? `${parseFloat(t.r_multiple).toFixed(2)}R` : '—'}</td>
                    <td className={t.pnl_percentage > 0 ? 'rp' : t.pnl_percentage < 0 ? 'rn' : 'mono'}>
                      {t.pnl_percentage != null
                        ? `${t.pnl_percentage >= 0 ? '+' : ''}${parseFloat(t.pnl_percentage).toFixed(2)}%`
                        : '—'}
                    </td>
                    <td>
                      {t.result
                        ? <span className={`pill ${t.result === 'Win' ? 'pWin' : t.result === 'Loss' ? 'pLoss' : 'pBE'}`}>{t.result}</span>
                        : t.status === 'final'
                          ? <button className="btn btn-xs btn-ghost" onClick={() => setAddResult({ trade: t, result: '', rMult: '' })}>+ Result</button>
                          : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-xs btn-ghost" onClick={() => setEditing(t)}>Edit</button>
                        <button className="btn btn-xs btn-danger" onClick={() => del(t.id)}>Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Result Modal */}
      {addResult && (
        <div className="lim-ov" onClick={() => setAddResult(null)}>
          <div className="lim-box" style={{ borderColor: '#e0f2fe' }} onClick={e => e.stopPropagation()}>
            <div className="lim-top" style={{ background: '#f0f9ff' }}>
              <div className="lim-title" style={{ color: '#0369a1' }}>
                Add Result
              </div>
            </div>
            <div className="lim-body">
              <div className="field">
                <label>Result</label>
                <select value={addResult.result} onChange={e => setAddResult(p => ({ ...p, result: e.target.value }))}>
                  <option value="">Select…</option>
                  <option>Win</option>
                  <option>Loss</option>
                  <option>Breakeven</option>
                </select>
              </div>
              {addResult.result === 'Win' && (
                <div className="field">
                  <label>R Multiple</label>
                  <input
                    type="number"
                    value={addResult.rMult}
                    onChange={e => setAddResult(p => ({ ...p, rMult: e.target.value }))}
                    placeholder="e.g. 2.5"
                    min="0.01"
                    step="0.01"
                  />
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setAddResult(null)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveResult} disabled={!addResult.result}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
