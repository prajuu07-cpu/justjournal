import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import NewTrade from './NewTrade';
import { formatDate } from '../utils/dateHelper';
import { useMode } from '../context/ModeContext';

export default function Journal() {
  const nav = useNavigate();
  const { mode, customModels, userSettings } = useMode();
  const [trades,    setTrades]    = useState([]);
  const [availableModels, setAvailableModels] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [editing,   setEditing]   = useState(null);
  const [filter,    setFilter]    = useState({ model: 'All', grade: 'All', result: 'All', status: 'All' });
  const [addResult, setAddResult] = useState(null); // { trade, result:'', rMult:'' }
  const [err,       setErr]       = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteRef = useRef(null);

  // Close delete dropdown when clicking outside
  useEffect(() => {
    if (!deleteOpen) return;
    const handleClickOutside = (e) => {
      if (deleteRef.current && !deleteRef.current.contains(e.target)) {
        setDeleteOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [deleteOpen]);

  const load = useCallback(() => {
    setLoading(true);
    const params = { mode };
    if (filter.model  !== 'All') params.model = filter.model;
    if (filter.grade  !== 'All') params.grade = filter.grade;
    if (filter.result !== 'All') params.result = filter.result;
    if (filter.status !== 'All') params.status = filter.status.toLowerCase();

    api.get('/trades', { params })
      .then(r => {
        setTrades(r.data.trades);
        if (r.data.models) setAvailableModels(r.data.models);
      })
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
    setDeleteOpen(false);
    if (!window.confirm('Delete all draft trades? This cannot be undone.')) return;
    try {
      await api.delete('/trades/drafts');
      load();
    } catch (ex) {
      setErr(ex.response?.data?.error || 'Failed to delete drafts');
    }
  };

  const deleteAllTrades = async () => {
    setDeleteOpen(false);
    if (!window.confirm('Delete ALL trades? This cannot be undone.')) return;
    try {
      await api.delete('/trades/all');
      load();
    } catch (ex) {
      setErr(ex.response?.data?.error || 'Failed to delete all trades');
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

  const deleteByGrade = async (g) => {
    setDeleteOpen(false);
    if (!window.confirm(`Delete all trades with grade ${g}? This cannot be undone.`)) return;
    try {
      await api.delete('/trades/by-grade', { params: { grade: g } });
      load();
    } catch (ex) {
      setErr(ex.response?.data?.error || 'Failed to delete trades by grade');
    }
  };

  const uniqueGrades = [...new Set(trades.map(t => t.grade).filter(g => g && g !== 'Draft'))].sort();


  if (editing) return <NewTrade editTrade={editing} onDone={() => { setEditing(null); load(); }} />;

  return (
    <div className="page">
      <div className="page-hd">
        <h1>Trade Journal</h1>
        <div className="header-btns">
          {mode === 'practice' ? (
            <div ref={deleteRef} style={{ position: 'relative' }}>
              <button
                className="btn btn-danger"
                onClick={() => setDeleteOpen(o => !o)}
              >
                Delete ▾
              </button>
              {deleteOpen && (
                <div 
                  className="dropdown-menu"
                  style={{
                    position: 'absolute', top: '110%', left: 0,
                    background: 'var(--card)', border: '1px solid var(--border2)',
                    borderRadius: 12, boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                    zIndex: 100, minWidth: 180, overflow: 'hidden'
                  }}
                >
                  <button
                    style={{ display:'block', width:'100%', padding:'12px 16px', textAlign:'left',
                      background:'none', border:'none', cursor:'pointer', fontSize:14,
                      color:'var(--danger)', fontWeight:600 }}
                    onMouseOver={e => e.currentTarget.style.background='var(--danger-bg)'}
                    onMouseOut={e => e.currentTarget.style.background='none'}
                    onClick={deleteDrafts}
                  >
                    Delete Drafts
                  </button>
                  <button
                    style={{ display:'block', width:'100%', padding:'12px 16px', textAlign:'left',
                      background:'none', border:'none', cursor:'pointer', fontSize:14,
                      color:'var(--danger)', fontWeight:600, borderTop:'1px solid var(--border)' }}
                    onMouseOver={e => e.currentTarget.style.background='var(--danger-bg)'}
                    onMouseOut={e => e.currentTarget.style.background='none'}
                    onClick={deleteAllTrades}
                  >
                    Delete All Trades
                  </button>
                  {uniqueGrades.map(g => (
                    <button
                      key={g}
                      style={{ display:'block', width:'100%', padding:'12px 16px', textAlign:'left',
                        background:'none', border:'none', cursor:'pointer', fontSize:14,
                        color:'var(--danger)', fontWeight:600, borderTop:'1px solid var(--border)' }}
                      onMouseOver={e => e.currentTarget.style.background='var(--danger-bg)'}
                      onMouseOut={e => e.currentTarget.style.background='none'}
                      onClick={() => deleteByGrade(g)}
                    >
                      Delete Grade {g}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button className="btn btn-danger" onClick={deleteDrafts}>Delete Drafts</button>
          )}
          <button className="btn btn-primary" onClick={() => nav('/new-trade')}>+ New Trade</button>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar" style={{ marginBottom: 24 }}>
        {[
          { 
            key: 'model',  
            opts: (() => {
              const sorted = [...availableModels].filter(m => m && m.trim() !== '');
              sorted.sort((a, b) => {
                const la = a.toLowerCase();
                const lb = b.toLowerCase();
                
                // Practice first
                if (la === 'practice' || la === 'practice model') return -1;
                if (lb === 'practice' || lb === 'practice model') return 1;
                
                // Then anything starting with "Model" (e.g., Model 1, Model 2, model 3)
                const isModelA = la.startsWith('model');
                const isModelB = lb.startsWith('model');
                
                if (isModelA && !isModelB) return -1;
                if (!isModelA && isModelB) return 1;
                
                // Natural alphanumeric sort for everything else (handles Model 1, Model 2, Model 10 correctly)
                return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
              });
              return [{ label: 'All Models', value: 'All' }, ...sorted.map(m => ({ label: m, value: m }))];
            })()
          },
          { 
            key: 'grade',  
            opts: [
              { label: 'All Grades', value: 'All' }, 
              ...['A+', 'A', 'B', 'C', ...(mode === 'practice' ? [] : ['Avoid'])].map(o => ({ label: o, value: o }))
            ] 
          },
          { 
            key: 'result', 
            opts: [{ label: 'All Results', value: 'All' }, ...['Win', 'Loss', 'Breakeven'].map(o => ({ label: o, value: o }))] 
          },
          { 
            key: 'status', 
            opts: [{ label: 'All Status', value: 'All' }, { label: 'Final', value: 'Final' }, { label: 'Draft', value: 'Draft' }] 
          },
        ].map(f => (
          <select
            key={f.key}
            className="fsel"
            style={{ flex: '1 1 120px' }}
            value={filter[f.key]}
            onChange={e => setFilter(p => ({ ...p, [f.key]: e.target.value }))}
          >
            {f.opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
                  <th>Date</th><th>Pair</th>{mode === 'practice' && <th>Session</th>}<th>Model</th><th>Grade</th>
                  <th>Status</th><th>RR</th><th>PNL</th><th>Result</th><th></th>
                </tr>
              </thead>
              <tbody>
                {trades.map(t => (
                  <tr key={t.id} className={t.status === 'final' ? 'tr-final' : ''}>
                    <td>{formatDate(t.date)}</td>
                    <td><strong>{t.pair}</strong></td>
                    {mode === 'practice' && <td>{t.session || '—'}</td>}
                    <td>
                      <span 
                        className={`pill ${
                          t.model === 'Practice' || t.model === 'Practice Model' ? 'pPM' :
                          t.model === 'Model 2' ? 'pM2' :
                          t.model?.toLowerCase() === 'model 3' ? 'pM3' : 'pM1'
                        }`}
                        style={
                          t.model === 'Practice' || t.model === 'Practice Model' ? {} :
                          t.model_color ? {
                            backgroundColor: t.model_color.bg,
                            color: t.model_color.text,
                            borderColor: t.model_color.border,
                            borderWidth: '1px',
                            borderStyle: 'solid'
                          } : (t.model?.toLowerCase() === 'model 3' ? {
                            backgroundColor: '#FDF2F8',
                            color: '#DB2777',
                            borderColor: '#FCE7F3',
                            borderWidth: '1px',
                            borderStyle: 'solid'
                          } : {})
                        }
                      >
                        {t.model === 'Practice Model' ? 'Practice' : t.model}
                      </span>
                    </td>
                    <td>
                      <span className={`pill ${
                        (t.grade === 'A+' && t.model === 'Practice') ? 'pAp' : 
                        (t.grade === 'A' && t.model === 'Practice') ? 'pA' : 
                        (t.grade === 'B' && t.model === 'Practice') ? 'pB' : 
                        (t.grade === 'C' && t.model === 'Practice') ? 'pC' : 
                        (t.model !== 'Practice' && t.grade === 'A+') ? 'pAp' :
                        (t.model !== 'Practice' && t.grade === 'A') ? 'pA' :
                        (t.model !== 'Practice' && t.grade === 'B') ? 'pB' :
                        (t.model !== 'Practice' && t.grade === 'C') ? 'pC' :
                        (t.grade === 'Draft' || (t.model === 'Practice' && t.grade === 'Avoid')) ? 'pDft' : 'pLow'
                      }`}>
                        {(t.model === 'Practice' && t.grade === 'Avoid') ? 'Draft' : (t.grade || 'Draft')}
                      </span>
                    </td>
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
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        {(() => {
                          const isBinned = (userSettings.binned_models || []).includes(t.model);
                          const isCustomActive = customModels.some(cm => cm.name === t.model);
                          const isBuiltin = t.model === 'Model 1' || t.model === 'Model 2';
                          const isPractice = t.model === 'Practice' || t.model === 'Practice Model';
                          
                          const canEdit = isPractice || (isBuiltin && !isBinned) || isCustomActive;
                          
                          return canEdit && (
                            <button className="btn btn-xs btn-ghost" onClick={() => setEditing(t)}>Edit</button>
                          );
                        })()}
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
