import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useMode } from '../context/ModeContext';


const WEIGHT_COLORS = {
  5:  { color: '#ec4899', bg: '#fdf2f8', rgb: '236, 72, 153' },   // Pink
  10: { color: '#ec4899', bg: '#fdf2f8', rgb: '236, 72, 153' },   // Pink (mapped to 5 style)
  15: { color: '#2563EB', bg: '#EFF6FF', rgb: '37, 99, 235' },   // Blue
  20: { color: '#D97706', bg: '#FEF3C7', rgb: '217, 119, 6' },   // Orange
  25: { color: '#7E22CE', bg: '#FAF5FF', rgb: '126, 34, 206' },  // Purple
};
const DEFAULT_COLOR = { color: '#4F46E5', bg: '#EEF2FF', rgb: '79, 70, 229' };
const DEFAULT_THEME = { wBg: '#EEF2FF', wBorder: '#C7D2FE', wText: '#4F46E5', wUl: '#6366F1' };

function calcScore(cl, items) { 
  return items.reduce((s,i) => s + (cl[i.key] ? (i.weight || 0) : 0), 0); 
}
function calcGrade(sc) { 
  if (sc >= 90) return 'A+';
  if (sc >= 75) return 'A';
  if (sc >= 60) return 'B';
  if (sc >= 50) return 'C';
  return 'Avoid'; 
}
function getMissing(cl, items) { 
  return items.filter(i => i.required && !cl[i.key]).map(i => i.label); 
}

function playWarning() {
  try {
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    [0,0.22].forEach(off=>{
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.connect(g);g.connect(ctx.destination);
      o.type='square';
      o.frequency.setValueAtTime(off===0?640:520,ctx.currentTime+off);
      g.gain.setValueAtTime(0.15,ctx.currentTime+off);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+off+0.18);
      o.start(ctx.currentTime+off);o.stop(ctx.currentTime+off+0.18);
    });
  } catch{}
}

export default function NewTrade({ editTrade, onDone }) {
  const nav = useNavigate();
  const { mode, switchMode, practiceDefaults, updatePracticeDefaults, customModels, deleteModel, restoreModel, updateSettings, userSettings, refreshData, loading } = useMode();
  const isEdit = !!editTrade?.id;
  const handleAddModel = () => {
    switchMode('practice');
    nav('/model-builder');
  };


  const [model,  setModel]  = useState(() => {
    if (editTrade?.model) return editTrade.model;
    if (mode === 'practice') return 'Practice';
    return ''; 
  });
  const [modelId, setModelId] = useState(editTrade?.model_id || null);
  const [pair,   setPair]   = useState(() => editTrade?.pair || (mode === 'practice' && !isEdit ? practiceDefaults.pair : ''));
  const [date,   setDate]   = useState(() => editTrade?.date || (mode === 'practice' && !isEdit && practiceDefaults.date ? practiceDefaults.date : new Date().toISOString().slice(0,10)));
  const [dir,    setDir]    = useState(editTrade?.direction || 'Buy');
  const [risk,   setRisk]   = useState(() => editTrade?.risk_percent?.toString() || (mode === 'practice' && !isEdit ? practiceDefaults.risk : ''));
  const [session,setSession]= useState(editTrade?.session || '');
  const [cl,     setCl]     = useState(() => {
    if (editTrade?.checklist) return typeof editTrade.checklist === 'string' ? JSON.parse(editTrade.checklist) : editTrade.checklist;
    return {};
  });
  const [result, setResult] = useState(editTrade?.result || '');
  const [rMult,  setRMult]  = useState(() => editTrade?.r_multiple || (mode === 'practice' && !isEdit && practiceDefaults.rMult ? practiceDefaults.rMult : ''));
  const [notes,  setNotes]  = useState(editTrade?.notes  || '');
  const [err,    setErr]    = useState('');
  const [limitModal, setLimitModal] = useState('');
  const [busy,   setBusy]   = useState(false);
  const [manualGrade, setManualGrade] = useState(() => editTrade?.grade || '');

  // Reset model if it's not valid for the current mode on mode switch
  useEffect(() => {
    if (isEdit) return;
    if (mode === 'practice') {
      setModel('Practice');
      setModelId(null);
    } else {
      // In JustChill, if current model is not a custom model for this mode, reset it
      const activeCustom = customModels.filter(m => (m.mode || 'justchill') === 'justchill');
      const currentValid = activeCustom.find(m => (modelId && m._id === modelId) || (!modelId && m.name === model));
      
      if (!currentValid) {
        if (activeCustom.length > 0) {
          setModel(activeCustom[0].name);
          setModelId(activeCustom[0]._id);
        } else {
          setModel('');
          setModelId(null);
        }
      }
    }
  }, [mode, customModels]);




  const activeItems = useMemo(() => {
    // Prefer custom model checklist by exact ID if available
    let custom = null;
    if (modelId) {
      custom = customModels.find(m => m._id === modelId);
    } else {
      // Fallback to name if no ID (for built-ins or historical)
      custom = customModels.find(m => m.name.toLowerCase() === model.toLowerCase());
    }

    if (custom && custom.checklist) {
      return custom.checklist.map(item => {
        // Handle new object structure
        if (typeof item === 'object' && item !== null) {
          return {
            key: item.label,
            label: item.label,
            weight: item.weight || 0,
            required: !!item.required,
            notes: item.notes || ''
          };
        }
        // Fallback for legacy string items
        return {
          key: item,
          label: item,
          weight: 100 / custom.checklist.length,
          required: false
        };
      });
    }

    return [];
  }, [modelId, customModels]);

  const theme = DEFAULT_THEME; // Fallback, but dynamicTheme usually handles this

  const score   = useMemo(()=>calcScore(cl, activeItems),[cl, activeItems]);
  const grade   = mode === 'practice' ? manualGrade : calcGrade(score);
  const missing = useMemo(()=>getMissing(cl, activeItems),[cl, activeItems]);

  const toggle = k => setCl(p=>({...p,[k]:!p[k]}));

  const save = async (asFinal) => {
    setErr('');
    if (!pair.trim()) { setErr('Pair is required'); return; }
    if (!date)        { setErr('Date is required'); return; }
    const rp = parseFloat(risk);
    if (isNaN(rp)||rp<=0||rp>5) { setErr('Risk % must be 0.01–5'); return; }
    if (!asFinal && result) { setErr('Save to final trades'); return; }

    const isPractice = mode === 'practice';
    if (isPractice && !manualGrade) { setErr('Please select a Grade'); return; }

    // No required checklist item or score limitations for final trades

    let rm=null, res_=result||null;
    if (asFinal && res_) {
      rm = res_==='Loss'?-1:res_==='Breakeven'?0:(parseFloat(rMult) || 0);
    }

    setBusy(true);
    try {
      const payload = { 
        pair: pair.toUpperCase(), 
        date, 
        session: isPractice ? session.trim() : null,
        direction: dir, 
        risk_percent: rp, 
        model: model, 
        model_id: modelId,
        checklist: isPractice ? {} : cl, 
        notes, 
        status: asFinal ? 'final' : 'draft', 
        result: res_, 
        r_multiple: rm,
        grade: grade
      };
      if (isEdit) await api.put(`/trades/${editTrade.id}`, payload);
      else        await api.post('/trades', payload);

      if (isPractice) {
        updatePracticeDefaults({ pair: pair.toUpperCase(), risk: risk, date: date, rMult: rMult });
      }

      if (onDone) onDone(); else nav('/journal');
    } catch(ex) {
      const lt = ex.response?.data?.limitType;
      const errorMsg = ex.response?.data?.error;
      if (lt) { setLimitModal({ type: lt, message: errorMsg }); playWarning(); }
      else setErr(ex.response?.data?.error || 'Failed to save trade');
    } finally { setBusy(false); }
  };

  const barColor = score>=90?'#7c3aed':score>=75?'#0284c7':score>=60?'#2563EB':score>=50?'#D97706':'#e11d48';

  const handleDeleteModel = async (modelName) => {
    if (!modelName) return;
    if (window.confirm(`Delete model "${modelName}"? This will move it to the Bin.`)) {
      setBusy(true);
      try {
        // Check if there is a custom model with this name
        const custom = customModels.find(m => m.name.toLowerCase() === modelName.toLowerCase());
        
        if (custom) {
          // It's a custom model, delete it from DB
          const ok = await deleteModel(custom._id || custom.id);
        } else {
          alert("Model not found.");
        }
      } catch (err) {
        console.error("Deletion failed", err);
        alert("Deletion failed. Please try again.");
      } finally {
        setBusy(false);
      }
    }
  };

  // ── Drag-and-drop reorder state (JustChill only) ────────────────────────
  const [orderedBadges, setOrderedBadges] = useState(null); // live order while dragging
  const [dragSrcIdx, setDragSrcIdx]       = useState(null); // index being dragged
  const [dropIdx, setDropIdx]             = useState(null); // current insertion point

  // Touch drag state stored in a ref to avoid re-renders mid-gesture
  const touchDragRef = useRef(null);
  // Set to true when a touch *drag* happened so onClick doesn't fire
  const touchStartedDrag = useRef(false);
  // Refs to each badge element so we can hit-test by position
  const badgeRefs = useRef([]);

  const modelBadges = useMemo(() => {
    let list = [];
    const activeCustom = customModels.filter(m => (m.mode || 'justchill') === mode);
    if (mode === 'practice') {
      list = [{ name: 'Practice' }, ...activeCustom];
    } else {
      list = [...activeCustom];
    }
    if (model && !list.find(m => m.name === model)) {
      if (isEdit) {
        list.push({ name: model, isHistorical: true });
      }
    }
    const hidden = userSettings.hidden_models || [];
    const filtered = list.filter(m => {
      if (m._id || m.id || m.isHistorical) return true;
      return !hidden.includes(m.name);
    });

    // Return all independent records as requested - no deduplication by name.
    return filtered;

    // Apply saved order
    const order = userSettings.model_order || [];
    base.sort((a, b) => {
      const ai = order.indexOf(a.name), bi = order.indexOf(b.name);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      if (a.name === 'Practice') return -1;
      if (b.name === 'Practice') return 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
    return base;
  }, [mode, customModels, model, userSettings.hidden_models, userSettings.model_order]);

  // The rendered list — uses live drag order when dragging, otherwise modelBadges
  const displayBadges = orderedBadges || modelBadges;

  // Auto-select first available model if current model is hidden/removed
  useEffect(() => {
    if (!isEdit && mode === 'justchill') {
      if (displayBadges.length === 0) {
        if (model !== '') setModel('');
      } else if (!displayBadges.find(m => m.name === model)) {
        setModel(displayBadges[0].name);
      }
    }
  }, [displayBadges, model, isEdit, mode]);

  const onDragStart = (e, idx) => {
    setDragSrcIdx(idx);
    setOrderedBadges([...modelBadges]);
    e.dataTransfer.effectAllowed = 'move';
    // transparent drag image so only CSS opacity gives feedback
    const blank = document.createElement('div');
    blank.style.cssText = 'width:1px;height:1px;opacity:0;position:fixed;top:-999px';
    document.body.appendChild(blank);
    e.dataTransfer.setDragImage(blank, 0, 0);
    setTimeout(() => document.body.removeChild(blank), 0);
  };

  const onDragOver = (e, overIdx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragSrcIdx === null || overIdx === dragSrcIdx) return;
    // Reorder live
    const next = [...orderedBadges];
    const [item] = next.splice(dragSrcIdx, 1);
    next.splice(overIdx, 0, item);
    setDragSrcIdx(overIdx);
    setOrderedBadges(next);
    setDropIdx(overIdx);
  };

  const onDragEnd = async () => {
    if (orderedBadges) {
      const newOrder = orderedBadges.map(m => m.name);
      await updateSettings({ ...userSettings, model_order: newOrder });
    }
    setDragSrcIdx(null);
    setDropIdx(null);
    setOrderedBadges(null);
  };

  // ── Touch drag handlers (mobile / tablet) ────────────────────────────────
  const onTouchStart = useCallback((e, idx) => {
    if (mode !== 'justchill') return;
    touchStartedDrag.current = false;
    touchDragRef.current = {
      srcIdx: idx,
      currentIdx: idx,
      list: [...modelBadges],
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
    };
  }, [mode, modelBadges]);

  const onTouchMove = useCallback((e) => {
    if (!touchDragRef.current) return;
    const td = touchDragRef.current;
    const touch = e.touches[0];

    // Only start reorder feedback after moving 6px (avoids accidental drags)
    const dx = touch.clientX - td.startX;
    const dy = touch.clientY - td.startY;
    if (!td.dragging && Math.sqrt(dx * dx + dy * dy) < 6) return;

    // Mark as dragging — prevents the scroll from firing AND suppresses onClick
    td.dragging = true;
    touchStartedDrag.current = true;
    e.preventDefault(); // stop page scroll while dragging badges

    // Initialise React state on first real move
    if (!td.stateInit) {
      td.stateInit = true;
      setDragSrcIdx(td.srcIdx);
      setOrderedBadges([...td.list]);
    }

    // Hit-test: find which badge the finger is over
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return;
    const overEl = badgeRefs.current.findIndex(ref => ref && (ref === el || ref.contains(el)));
    if (overEl === -1 || overEl === td.currentIdx) return;

    // Live reorder
    const next = [...td.list];
    const [moved] = next.splice(td.currentIdx, 1);
    next.splice(overEl, 0, moved);
    td.list = next;
    td.currentIdx = overEl;
    setDragSrcIdx(overEl);
    setOrderedBadges([...next]);
    setDropIdx(overEl);
  }, []);

  const onTouchEnd = useCallback(async () => {
    if (!touchDragRef.current) return;
    const td = touchDragRef.current;
    touchDragRef.current = null;

    if (td.dragging && td.list) {
      const newOrder = td.list.map(m => m.name);
      await updateSettings({ ...userSettings, model_order: newOrder });
    }
    setDragSrcIdx(null);
    setDropIdx(null);
    setOrderedBadges(null);
  }, [userSettings, updateSettings]);


  const dynamicTheme = useMemo(() => {
    const badge = modelBadges.find(m => m.name === model);
    if (badge?.color && model !== 'Practice') {
      return {
        wBg: badge.color.bg,
        wBorder: badge.color.border || badge.color.text,
        wText: badge.color.text,
        wUl: badge.color.text
      };
    }
    return DEFAULT_THEME;
  }, [model, modelBadges]);

  return (
    <div className="page">
      {limitModal && (
        <div className="lim-ov" onClick={()=>setLimitModal(null)}>
          <div className="lim-box" onClick={e=>e.stopPropagation()}>
            <div className="lim-top">
              <div className="lim-title">
                {limitModal.type === 'weekly' ? 'Weekly Limit Reached' : 
                 limitModal.type === 'weeklyLoss' ? 'Weekly Loss Limit Reached' : 
                 'Monthly Loss Limit Reached'}
              </div>
            </div>
            <div className="lim-body">
              <div className="lim-msg">
                {limitModal.message}
              </div>
              <button className="lim-dismiss" onClick={()=>setLimitModal(null)}>Got it</button>
            </div>
          </div>
        </div>
      )}

      <div className="page-hd">
        <h1>{isEdit ? 'Edit Trade' : 'New Trade'}</h1>
        <div className="hd-actions">
          <button 
            className="btn btn-ghost" 
            onClick={refreshData} 
            disabled={loading || busy}
            title="Refresh Models"
            style={{ padding: '8px' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'spin' : ''}>
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
            </svg>
          </button>
          <button className="btn btn-ghost" onClick={() => onDone ? onDone() : nav('/journal')}>Cancel</button>
          <button className="btn btn-ghost" onClick={() => save(false)} disabled={busy || loading || (mode === 'practice' && !manualGrade)}>Save Draft</button>
          <button className="btn btn-ok" onClick={() => save(true)} disabled={busy || loading || (mode === 'practice' && !manualGrade)}>Save Final</button>
        </div>
      </div>

      {loading && !displayBadges.length && (
        <div className="loading" style={{ margin: '20px 0' }}>Fetching models…</div>
      )}

      {err && (
        <div className="err-box" style={{marginBottom:24, justifyContent: 'center'}}>
          {err}
        </div>
      )}

      {/* Model Selection - always visible */}
      <div className="card">
        <div className="form-sec">Model</div>
        <div className="field" style={{marginBottom: '0.5rem'}}>
          <div style={{display:'flex', gap: '8px', alignItems: 'center', maxWidth: '100%', overflowX: 'auto', paddingBottom: '8px'}}>
            {displayBadges.length === 0 && mode === 'justchill' && (
              <div style={{ padding: '8px 0', width: '100%' }}>
                <button 
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleAddModel}
                  style={{ padding: '8px 16px', borderRadius: '8px' }}
                >
                  + Add Models from Practice Mode
                </button>
              </div>
            )}
            <div
              className="model-sel"
              style={{padding:0, margin: 0, gap: '8px', background: 'transparent', border:'none', flexWrap: 'nowrap'}}
            >
              {displayBadges.map((m, idx) => (
                <div
                  key={m.name}
                  ref={el => { badgeRefs.current[idx] = el; }}
                  draggable={mode === 'justchill'}
                  onDragStart={mode === 'justchill' ? (e) => onDragStart(e, idx) : undefined}
                  onDragOver={mode === 'justchill' ? (e) => onDragOver(e, idx) : undefined}
                  onDragEnd={mode === 'justchill' ? onDragEnd : undefined}
                  onTouchStart={mode === 'justchill' ? (e) => onTouchStart(e, idx) : undefined}
                  onTouchMove={mode === 'justchill' ? onTouchMove : undefined}
                  onTouchEnd={mode === 'justchill' ? onTouchEnd : undefined}
                  style={{
                    display:'flex', alignItems:'center', position:'relative',
                    height: '34px', flexShrink: 0,
                    transition: 'opacity 0.15s, transform 0.2s',
                    opacity: dragSrcIdx === idx ? 0.35 : 1,
                    cursor: mode === 'justchill' ? 'grab' : 'pointer',
                    transform: dragSrcIdx === idx ? 'scale(0.95)' : 'scale(1)',
                    touchAction: mode === 'justchill' ? 'none' : 'auto',
                  }}
                >
                  <button
                    className={`mbtn ${modelId ? (m._id === modelId ? 'sel-dynamic' : '') : (m.name === model ? 'sel-dynamic' : '')}`}
                    style={{
                      height: '34px',
                      padding: '0 12px',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      whiteSpace: 'nowrap',
                      pointerEvents: dragSrcIdx !== null ? 'none' : 'auto',
                      ...( (modelId ? m._id === modelId : m.name === model) ? (
                        m.name === 'Practice' ? {
                          backgroundColor: '#F1F5F9',
                          color: '#64748B',
                          borderColor: '#64748B',
                          borderWidth: '1px',
                          boxShadow: `0 4px 10px #CBD5E1`
                        } : (m.color ? {
                          backgroundColor: m.color.bg,
                          color: m.color.text,
                          borderColor: m.color.border || m.color.text,
                          boxShadow: `0 0 0 1px ${m.color.border || m.color.text} inset`
                        } : {})
                      ) : (
                        m.name === 'Practice' ? {
                          backgroundColor: '#F1F5F9',
                          color: '#64748B',
                          borderColor: '#CBD5E1',
                          borderWidth: '1px',
                        } : {}
                      ))
                    }}
                    onClick={() => {
                      if (dragSrcIdx !== null) return; // ignore clicks during mouse drag
                      if (touchStartedDrag.current) { touchStartedDrag.current = false; return; } // ignore clicks after touch drag
                      setModel(m.name);
                      setModelId(m._id || null);
                      if (m.notes && !notes) setNotes(m.notes);
                    }}
                  >
                    {m.name}
                  </button>
                </div>
              ))}
            </div>
            {mode === 'practice' && (
              <button 
                className="btn btn-ghost" 
                style={{
                  padding: '6px 12px', 
                  fontSize: '0.85rem', 
                  borderRadius: '12px',
                  border: '1px dashed var(--border2)',
                  backgroundColor: 'transparent',
                  color: 'var(--sub)',
                  height: '34px',
                  display: 'flex',
                  alignItems: 'center'
                }}
                onClick={() => nav('/model-builder')}
              >
                + Add Model
              </button>
            )}
          </div>

        </div>
      </div>

      {(mode === 'practice' || displayBadges.length > 0) && (
        <>
          <div className="card">
            <div className="form-sec">Trade Details</div>
            <div className="g2">
              <div className="field"><label>Pair *</label><input value={pair} onChange={e=>setPair(e.target.value.toUpperCase())} placeholder="EURUSD"/></div>
              <div className="field"><label>Date *</label><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
              <div className="field"><label>Direction</label>
                <select value={dir} onChange={e=>setDir(e.target.value)}><option>Buy</option><option>Sell</option></select>
              </div>
              <div className="field"><label>Risk % *</label><input type="number" value={risk} onChange={e=>setRisk(e.target.value)} placeholder="1.0" min="0.01" max="5" step="0.01"/></div>
              {mode === 'practice' && (
                <div className="field">
                  <div style={{display:'flex', gap: 12}}>
                    <div style={{flex: 2}}>
                      <label>Session</label>
                      <input list="session-opts" value={session} onChange={e=>setSession(e.target.value)} placeholder="Select or type..." autoComplete="off"/>
                    </div>
                    <div style={{flex: 1}}>
                      <label>Grade *</label>
                      <select value={manualGrade} onChange={e => setManualGrade(e.target.value)} className="fsel" style={{width: '100%', height: '42px'}}>
                        <option value="">Select</option>
                        {['A+', 'A', 'B', 'C'].map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                  </div>
                  <datalist id="session-opts">
                    <option value="London"/>
                    <option value="New York"/>
                    <option value="Asian"/>
                  </datalist>
                </div>
              )}
            </div>
          </div>

          {mode !== 'practice' && model && (
            <div className="card">
              <div className="form-sec">Checklist — {model}</div>
              {activeItems.map((item)=>{
                const col = WEIGHT_COLORS[item.weight] || DEFAULT_COLOR;
                return (
                  <div key={item.key} className={`ci${cl[item.key]?' on':''}`} onClick={()=>toggle(item.key)} 
                       style={{'--ici': col.color, '--ibg': col.bg, '--irgb': col.rgb, display:'flex', flexDirection:'column', alignItems:'flex-start', padding:'12px'}}>
                    <div style={{display:'flex', alignItems:'center', width:'100%', gap:10}}>
                      <div className="ci-box">{cl[item.key]&&<svg width="12" height="9" viewBox="0 0 12 9" fill="none"><path d="M1 4.5l3.5 3.5L11 1" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}</div>
                      <span className="ci-lbl">{item.label}</span>
                      <span className="ci-pts">{Math.round(item.weight)}pts</span>
                    </div>
                  </div>
                );
              })}
              

              <div className="sc-blk" style={{padding: '20px', borderRadius: '16px'}}>
                <div className="sc-label" style={{marginBottom: '12px', fontSize: '0.9rem', letterSpacing: '0.05em'}}>{model} · MODEL SCORE</div>
                
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom: '16px'}}>
                  <div>
                    <div style={{fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4}}>Total Points</div>
                    <div className="sc-n" style={{color:barColor, fontSize: '2.5rem', textAlign: 'left', lineHeight: 1, fontWeight: 900}}>{score}</div>
                  </div>
                  
                  <div style={{textAlign: 'right'}}>
                    <div style={{fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4}}>Grade</div>
                    <div style={{
                      background: barColor + '15', 
                      color: barColor,
                      border: `1.5px solid ${barColor}44`,
                      padding: '6px 20px', 
                      borderRadius: '12px',
                      fontSize: '1.5rem',
                      fontWeight: 900,
                      boxShadow: `0 4px 12px ${barColor}15`
                    }}>
                      {grade}
                    </div>
                  </div>
                </div>

                <div className="sc-bg" style={{height: '10px', borderRadius: '5px', background: '#f1f5f9', overflow:'hidden'}}>
                  <div className="sc-fill" style={{
                    width:`${Math.min(score, 100)}%`,
                    height: '100%',
                    background:`linear-gradient(90deg, ${barColor}ee, ${barColor})`,
                    boxShadow: `0 0 10px ${barColor}44`,
                    transition: 'width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
                  }}/>
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="form-sec">Result (optional — add after trade closes)</div>
            <div className="g2">
              <div className="field"><label>Outcome</label>
                <select value={result} onChange={e=>setResult(e.target.value)}>
                  <option value="">None</option><option>Win</option><option>Loss</option><option>Breakeven</option>
                </select>
              </div>
              {result==='Win'&&<div className="field"><label>R Multiple</label>
                <input 
                  type="number" 
                  value={rMult} 
                  onChange={e=>setRMult(e.target.value)} 
                  onKeyDown={e => {
                    if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                  }}
                  placeholder="2.5" 
                  min="0.01" 
                  step="0.01"
                />
              </div>}
            </div>
          </div>

          <div className="card">
            <div className="form-sec">Notes</div>
            <div className="field"><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} placeholder="Optional notes…" style={{resize:'vertical'}}/></div>
          </div>
        </>
      )}

      {model && model !== 'Practice' && !modelBadges.find(m => m.name === model)?.isHistorical && (
        <div style={{marginTop: '32px', textAlign: 'center', paddingBottom: '20px'}}>
          <button 
            className="del-model-btn" 
            onClick={() => handleDeleteModel(model)}
            style={{
              color: '#e11d48', fontSize: '0.85rem', fontWeight: 600, 
              background: 'none', border: 'none', padding: 12, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              opacity: 0.7, transition: 'opacity 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.opacity = 1}
            onMouseOut={e => e.currentTarget.style.opacity = 0.7}
          >
            Delete {model}
          </button>
        </div>
      )}
    </div>
  );
}
