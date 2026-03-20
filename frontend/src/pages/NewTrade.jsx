import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useMode } from '../context/ModeContext';

const MODEL1_ITEMS = [
  { key:'drawDailyTP',  label:'Draw Daily TP',                              weight:5,  required:true },
  { key:'trigger',      label:'Daily Trigger Candle',                       weight:5,  required:true },
  { key:'prevMS',       label:'Mark 4H or 2H Previous MS',                  weight:15, required:true },
  { key:'sync2H',       label:'2H Timeframe Synch',                         weight:25, required:false },
  { key:'priceReached', label:'Price Reached Previous MS',                  weight:20, required:true },
  { key:'engulfing',    label:'Engulfing at Previous MS',                   weight:25, required:true },
  { key:'minRR',        label:'Minimum RR ≥ 2.5',                           weight:5,  required:true },
];

const MODEL2_ITEMS = [
  { key:'drawDailyTP',  label:'Draw Daily TP',                              weight:5,  required:true },
  { key:'sos',          label:'Identify 4H SOS / 2H 2nd SOS',               weight:5,  required:true },
  { key:'prevMS',       label:'Mark 4H / 2H Previous MS',                   weight:15, required:true },
  { key:'sync2H',       label:'2H Timeframe Synch',                         weight:25, required:false },
  { key:'priceReached', label:'Price Reached PMS',                          weight:20, required:true },
  { key:'engulfing',    label:'Engulfing at PMS',                           weight:25, required:true },
  { key:'minRR',        label:'Min RR 2.5',                                 weight:5,  required:true },
];

const WEIGHT_COLORS = {
  5:  { color: '#ec4899', bg: '#fdf2f8', rgb: '236, 72, 153' },   // Pink
  10: { color: '#ec4899', bg: '#fdf2f8', rgb: '236, 72, 153' },   // Pink (mapped to 5 style)
  15: { color: '#2563EB', bg: '#EFF6FF', rgb: '37, 99, 235' },   // Blue
  20: { color: '#D97706', bg: '#FEF3C7', rgb: '217, 119, 6' },   // Orange
  25: { color: '#7E22CE', bg: '#FAF5FF', rgb: '126, 34, 206' },  // Purple
};
const DEFAULT_COLOR = { color: '#4F46E5', bg: '#EEF2FF', rgb: '79, 70, 229' };

const MODEL_THEMES = {
  'Model 1': { wBg: '#FDF4FF', wBorder: '#E9D5FF', wText: '#7E22CE', wUl: '#9333EA' },
  'Model 2': { wBg: '#EEF2FF', wBorder: '#C7D2FE', wText: '#4F46E5', wUl: '#6366F1' }
};

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
  const { mode, practiceDefaults, updatePracticeDefaults, customModels, deleteModel, restoreModel, updateSettings, userSettings } = useMode();
  const isEdit = !!editTrade?.id;


  const [model,  setModel]  = useState(() => {
    if (editTrade?.model) return editTrade.model;
    if (mode === 'practice') return 'Practice';
    return 'Model 1';
  });
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
    if (isEdit) return; // Don't reset if we are editing an existing trade
    if (mode === 'practice') {
      setModel('Practice');
    } else {
      // For JustChill, default back to Model 1 if the current model is not found in JustChill list
      const isCustomInMode = customModels.some(m => m.name === model && (m.mode || 'justchill') === 'justchill');
      const isBuiltin = model === 'Model 1' || model === 'Model 2';
      if (!isBuiltin && !isCustomInMode) {
        setModel('Model 1');
      }
    }
  }, [mode]);




  const activeItems = useMemo(() => {
    if (model === 'Model 1') return MODEL1_ITEMS;
    if (model === 'Model 2') return MODEL2_ITEMS;
    const custom = customModels.find(m => m.name === model);
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
  }, [model, customModels]);

  const theme = MODEL_THEMES[model] || MODEL_THEMES['Model 1'];

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
      rm = res_==='Loss'?-1:res_==='Breakeven'?0:parseFloat(rMult);
      if (res_==='Win'&&(isNaN(rm)||rm<=0)){ setErr('Win needs a positive R multiple'); return; }
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
      if (lt) { setLimitModal(lt); playWarning(); }
      else setErr(ex.response?.data?.error || 'Failed to save trade');
    } finally { setBusy(false); }
  };

  const barColor = score>=90?'#7c3aed':score>=75?'#0284c7':score>=60?'#2563EB':score>=50?'#D97706':'#e11d48';

  const handleDeleteModel = async (modelName) => {
    if (!modelName) return;
    if (window.confirm(`Delete model "${modelName}"? This will move it to the Bin.`)) {
      setBusy(true);
      try {
        if (modelName === 'Model 1' || modelName === 'Model 2') {
          // Robustly merge hidden and binned arrays
          const hidden = Array.from(new Set([...(userSettings.hidden_models || []), modelName]));
          const binned = Array.from(new Set([...(userSettings.binned_models || []), modelName]));
          
          const ok = await updateSettings({ 
            ...userSettings, 
            hidden_models: hidden, 
            binned_models: binned 
          });
          
          if (ok) {
            const nextModel = mode === 'practice' ? 'Practice' : (modelName === 'Model 1' ? 'Model 2' : 'Model 1');
            setModel(nextModel);
          }
        } else {
          const custom = customModels.find(m => m.name === modelName);
          if (!custom) {
            alert("Model not found in custom list.");
            return;
          }
          const ok = await deleteModel(custom._id || custom.id);
          if (ok) {
            setModel(mode === 'practice' ? 'Practice' : 'Model 1');
          }
        }
      } catch (err) {
        console.error("Deletion failed", err);
        alert("Deletion failed. Please try again.");
      } finally {
        setBusy(false);
      }
    }
  };

  const modelBadges = useMemo(() => {
    let list = [];
    const activeCustom = customModels.filter(m => (m.mode || 'justchill') === mode);
    
    if (mode === 'practice') {
      list = [{name: 'Practice'}, ...activeCustom];
    } else {
      list = [{name: 'Model 1'}, {name: 'Model 2'}, ...activeCustom];
    }
    
    // Add current model if it's missing (deleted/historical)
    if (model && !list.find(m => m.name === model)) {
      list.push({ name: model, isHistorical: true });
    }
    // Filter out hidden models
    const hidden = userSettings.hidden_models || [];
    const filtered = list.filter(m => !hidden.includes(m.name));

    // Deduplicate by name (case-insensitive)
    const unique = [];
    const seen = new Set();
    filtered.forEach(m => {
      const lowerName = m.name.toLowerCase();
      if (!seen.has(lowerName)) {
        unique.push(m);
        seen.add(lowerName);
      }
    });
    return unique;
  }, [mode, customModels, model, userSettings.hidden_models]);

  // Dynamic color for "Required before Final" box
  const dynamicTheme = useMemo(() => {
    const badge = modelBadges.find(m => m.name === model);
    if (badge?.color) {
      return {
        wBg: badge.color.bg,
        wBorder: badge.color.border || badge.color.text,
        wText: badge.color.text,
        wUl: badge.color.text
      };
    }
    return MODEL_THEMES[model] || MODEL_THEMES['Model 1'];
  }, [model, modelBadges]);

  return (
    <div className="page">
      {limitModal && (
        <div className="lim-ov" onClick={()=>setLimitModal('')}>
          <div className="lim-box" onClick={e=>e.stopPropagation()}>
            <div className="lim-top">
              <div className="lim-title">{limitModal==='weekly'?'Weekly Limit Reached':'Monthly Loss Limit Reached'}</div>
            </div>
            <div className="lim-body">
              <div className="lim-msg">
                {limitModal === 'weekly' 
                  ? `You have reached ${userSettings.weekly_limit} trades this week. No more trades until next week.`
                  : limitModal === 'monthly' 
                    ? `You have reached ${userSettings.monthly_loss_limit} losing trades this month. Trading is blocked until next month.`
                    : ''
                }
              </div>
              <button className="lim-dismiss" onClick={()=>setLimitModal('')}>Got it</button>
            </div>
          </div>
        </div>
      )}

      <div className="page-hd">
        <h1>{isEdit ? 'Edit Trade' : 'New Trade'}</h1>
        <div className="hd-actions">
          <button className="btn btn-ghost" onClick={() => onDone ? onDone() : nav('/journal')}>Cancel</button>
          <button className="btn btn-ghost" onClick={() => save(false)} disabled={busy || (mode === 'practice' && !manualGrade)}>Save Draft</button>
          <button className="btn btn-ok" onClick={() => save(true)} disabled={busy || (mode === 'practice' && !manualGrade)}>Save Final</button>
        </div>
      </div>

      {err && (
        <div className="err-box" style={{marginBottom:24, justifyContent: 'center'}}>
          {err}
        </div>
      )}

      {/* Model Selection - always visible */}
      <div className="card">
        <div className="form-sec">Model</div>
        <div className="field" style={{marginBottom: '0.5rem'}}>
          <div style={{display:'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap'}}>
            <div className="model-sel" style={{padding:0, margin: 0, gap: '4px', background: 'transparent', border:'none'}}>
              {modelBadges.map(m => (
                <div key={m.name} style={{display:'flex', alignItems:'center', position:'relative', height: '34px'}}>
                  <button 
                    className={`mbtn ${model === m.name ? (m.name === 'Model 1' ? 'sel-m1' : (m.name === 'Model 2' ? 'sel-m2' : '')) : ''}`}
                    style={{
                      height: '34px',
                      padding: '0 12px', 
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      ...(m.name === 'Practice' && model === m.name ? {
                        backgroundColor: '#F1F5F9',
                        color: '#64748B',
                        borderColor: '#64748B',
                        borderWidth: '1px',
                        boxShadow: `0 4px 10px #CBD5E1`
                      } : m.name === 'Practice' ? {
                        backgroundColor: '#F1F5F9',
                        color: '#64748B',
                        borderColor: '#CBD5E1',
                        borderWidth: '1px',
                      } : m.name.toLowerCase() === 'model 3' && model === m.name ? {
                        backgroundColor: '#FDF2F8',
                        color: '#DB2777',
                        borderColor: '#DB2777',
                        borderWidth: '1px',
                        boxShadow: `0 4px 10px #FCE7F3`
                      } : (m.color && model === m.name ? {
                        backgroundColor: m.color.bg,
                        color: m.color.text,
                        borderColor: m.color.text,
                        borderWidth: '1px',
                        boxShadow: `0 4px 10px ${m.color.border}`
                      } : {}))
                    }}
                    onClick={() => {
                      setModel(m.name);
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

      {mode !== 'practice' && (
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
          


          {/* Removed Required before Final box */}

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

      {(mode === 'practice' || score >= 50) && (
        <div className="card">
          <div className="form-sec">Result (optional — add after trade closes)</div>
          <div className="g2">
            <div className="field"><label>Outcome</label>
              <select value={result} onChange={e=>setResult(e.target.value)}>
                <option value="">None</option><option>Win</option><option>Loss</option><option>Breakeven</option>
              </select>
            </div>
            {result==='Win'&&<div className="field"><label>R Multiple</label><input type="number" value={rMult} onChange={e=>setRMult(e.target.value)} placeholder="2.5" min="0.01" step="0.01"/></div>}
          </div>
        </div>
      )}

      <div className="card">
        <div className="form-sec">Notes</div>
        <div className="field"><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} placeholder="Optional notes…" style={{resize:'vertical'}}/></div>
      </div>

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
