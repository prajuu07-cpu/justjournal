import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { formatDate } from '../utils/dateHelper';
import { useMode } from '../context/ModeContext';

export default function TradeBin() {
  const { mode } = useMode();
  const navigate = useNavigate();
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [showRestorePairModal, setShowRestorePairModal] = useState(false);
  const [pairNameToRestore, setPairNameToRestore] = useState('');
  const restoreRef = useRef(null);

  useEffect(() => {
    if (mode === 'justchill') {
      navigate('/bin', { replace: true });
    }
  }, [mode, navigate]);

  const fetchTrades = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/trades/bin');
      setTrades(data.trades);
    } catch (ex) {
      setErr(ex.response?.data?.error || 'Failed to load binned trades');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);

  useEffect(() => {
    if (!restoreOpen) return;
    const handleClickOutside = (e) => {
      if (restoreRef.current && !restoreRef.current.contains(e.target)) {
        setRestoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [restoreOpen]);

  const restore = async (id) => {
    try {
      await api.post(`/trades/${id}/restore`);
      fetchTrades();
    } catch (ex) {
      setErr(ex.response?.data?.error || 'Failed to restore trade');
    }
  };

  const restoreByGrade = async (grade) => {
    try {
      await api.post('/trades/bin/restore-by-grade', null, { params: { grade, mode } });
      fetchTrades();
      setRestoreOpen(false);
    } catch (ex) {
      setErr(ex.response?.data?.error || 'Failed to restore trades by grade');
    }
  };

  const restoreByPair = () => {
    setPairNameToRestore('');
    setShowRestorePairModal(true);
  };

  const confirmRestoreByPair = async () => {
    if (!pairNameToRestore.trim()) return;
    try {
      await api.post('/trades/bin/restore-by-pair', null, { params: { pair: pairNameToRestore.trim().toUpperCase(), mode } });
      setShowRestorePairModal(false);
      fetchTrades();
    } catch (ex) {
      setErr(ex.response?.data?.error || 'Failed to restore trades by pair');
    }
  };

  const permanentDelete = async (id) => {
    if (!window.confirm('Permanently delete this trade? This cannot be undone.')) return;
    try {
      await api.delete(`/trades/${id}/permanent`);
      fetchTrades();
    } catch (ex) {
      setErr(ex.response?.data?.error || 'Failed to delete trade permanently');
    }
  };

  const emptyBin = async () => {
    if (!window.confirm('Empty bin? All trades here will be permanently deleted.')) return;
    try {
      await api.delete('/trades/bin/empty');
      fetchTrades();
    } catch (ex) {
      setErr(ex.response?.data?.error || 'Failed to empty bin');
    }
  };

  const GRADE_ORDER = { 'A+': 1, 'A': 2, 'B': 3, 'C': 4, 'D': 5 };
  const uniqueGrades = [...new Set(trades.map(t => t.grade).filter(g => g && g !== 'Draft' && g !== 'Avoid'))]
    .sort((a, b) => (GRADE_ORDER[a] || 99) - (GRADE_ORDER[b] || 99));

  if (mode !== 'practice') {
    return (
      <div className="page" style={{ textAlign: 'center', padding: '100px 20px' }}>
        <h2>Available in Practice Mode Only</h2>
        <p style={{ color: '#64748b' }}>Switch to Practice mode to use the Trade Bin.</p>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-hd">
        <h1>Bin</h1>
        <div className="header-btns">
          {mode === 'practice' && (
            <>
              {uniqueGrades.length > 0 && (
                <div ref={restoreRef} style={{ position: 'relative' }}>
                  <button
                    className="btn btn-outline"
                    onClick={() => setRestoreOpen(o => !o)}
                  >
                    Restore Grade ▾
                  </button>
                  {restoreOpen && (
                    <div 
                      className="dropdown-menu"
                      style={{
                        position: 'absolute', top: '110%', left: 0,
                        background: 'var(--card)', border: '1px solid var(--border2)',
                        borderRadius: 12, boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                        zIndex: 100, minWidth: 180, overflow: 'hidden'
                      }}
                    >
                      {uniqueGrades.map(g => (
                        <button
                          key={g}
                          style={{ display:'block', width:'100%', padding:'12px 16px', textAlign:'left',
                            background:'none', border:'none', cursor:'pointer', fontSize:14,
                            color:'var(--indigo)', fontWeight:600, borderBottom: g !== uniqueGrades[uniqueGrades.length-1] ? '1px solid var(--border)' : 'none' }}
                          onMouseOver={e => e.currentTarget.style.background='var(--card-bg-alt)'}
                          onMouseOut={e => e.currentTarget.style.background='none'}
                          onClick={() => restoreByGrade(g)}
                        >
                          Restore All Grade {g}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button className="btn btn-outline" onClick={restoreByPair}>Restore By Pair</button>
            </>
          )}
          <button 
            className="btn btn-danger" 
            onClick={emptyBin}
            disabled={trades.length === 0}
          >
            Empty Bin
          </button>
        </div>
      </div>

      {err && <div className="err-box">{err}</div>}

      {loading ? (
        <div className="loading">Loading…</div>
      ) : trades.length === 0 ? (
        <div className="empty">
          Your trade bin is empty.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>PAIR</th>
                  <th>MODEL</th>
                  <th>GRADE</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {trades.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontSize: '0.85rem', color: '#64748b' }}>{formatDate(t.date)}</td>
                    <td style={{ fontWeight: 700 }}>{t.pair}</td>
                    <td>
                      <span className="pill" style={{ 
                        background: 'var(--card-bg-alt)', 
                        color: t.model_color || 'var(--indigo)' 
                      }}>
                        {t.model}
                      </span>
                    </td>
                    <td>
                      <span className={`pill ${
                        t.grade === 'A+' ? 'pAp' : 
                        t.grade === 'A' ? 'pA' : 
                        t.grade === 'B' ? 'pB' : 
                        t.grade === 'C' ? 'pC' : 
                        'pDft'
                      }`}>
                        {t.grade || 'Draft'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button className="btn btn-xs btn-ghost" style={{ color: 'var(--indigo)' }} onClick={() => restore(t.id)}>
                          Restore
                        </button>
                        <button className="btn btn-xs btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => permanentDelete(t.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {showRestorePairModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginBottom: '12px' }}>Restore trades by Pair</h3>
            <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '20px' }}>
              Type the pair name to restore all matching trades from the bin.
            </p>
            <input 
              type="text" 
              className="fsel" 
              placeholder="e.g. BTCUSDT" 
              style={{ width: '100%', marginBottom: '24px' }}
              value={pairNameToRestore}
              onChange={(e) => setPairNameToRestore(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowRestorePairModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmRestoreByPair}>Restore trades</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
