import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useMode } from '../context/ModeContext';

const MODEL1_ITEMS = [
  { key:'drawDailyTP',  label:'Draw Daily TP',                              weight:5,  optional:false },
  { key:'trigger',      label:'Daily Trigger Candle',                       weight:5,  optional:false },
  { key:'prevMS',       label:'Mark 4H or 2H Previous MS',                  weight:15, optional:false },
  { key:'sync2H',       label:'2H Timeframe Synch',                         weight:25, optional:true },
  { key:'priceReached', label:'Price Reached Previous MS',                  weight:20, optional:false },
  { key:'engulfing',    label:'Engulfing at Previous MS',                   weight:25, optional:false },
  { key:'minRR',        label:'Minimum RR ≥ 2.5',                           weight:5,  optional:false },
];

const MODEL2_ITEMS = [
  { key:'drawDailyTP',  label:'Draw Daily TP',                              weight:5,  optional:false },
  { key:'sos',          label:'Identify 4H SOS / 2H 2nd SOS',               weight:5,  optional:false },
  { key:'prevMS',       label:'Mark 4H / 2H Previous MS',                   weight:15, optional:false },
  { key:'sync2H',       label:'2H Timeframe Synch',                         weight:25, optional:true },
  { key:'priceReached', label:'Price Reached PMS',                          weight:20, optional:false },
  { key:'engulfing',    label:'Engulfing at PMS',                           weight:25, optional:false },
  { key:'minRR',        label:'Min RR 2.5',                                 weight:5,  optional:false },
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
function calcGrade(sc) { return sc >= 75 ? 'Valid' : 'Avoid'; }
function getMissing(cl, items) { return items.filter(i=>!i.optional&&!cl[i.key]).map(i=>i.label); }

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
  const { mode, practiceDefaults, updatePracticeDefaults, customModels, deleteModel, userSettings } = useMode();
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
  const [rMult,  setRMult]  = useState(editTrade?.r_multiple || '');
  const [notes,  setNotes]  = useState(editTrade?.notes  || '');
  const [err,    setErr]    = useState('');
  const [limitModal, setLimitModal] = useState('');
  const [busy,   setBusy]   = useState(false);




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
            optional: false,
            notes: item.notes || ''
          };
        }
        // Fallback for legacy string items
        return {
          key: item,
          label: item,
          weight: 100 / custom.checklist.length,
          optional: false
        };
      });
    }
    return [];
  }, [model, customModels]);

  const theme = MODEL_THEMES[model] || MODEL_THEMES['Model 1'];

  const score   = useMemo(()=>calcScore(cl, activeItems),[cl, activeItems]);
  const grade   = calcGrade(score);
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

    if (asFinal && !isPractice) {
      if (missing.length) { setErr('Check all required items before saving as Final'); return; }
      if (score < 75)     { setErr('Score must be ≥75 to save as Final'); return; }
      if (grade === 'Draft' && !window.confirm('Grade is Draft — save anyway?')) return;
    }

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
        r_multiple: rm 
      };
      if (isEdit) await api.put(`/trades/${editTrade.id}`, payload);
      else        await api.post('/trades', payload);

      if (isPractice) {
        updatePracticeDefaults({ pair: pair.toUpperCase(), risk: risk, date: date });
      }

      if (onDone) onDone(); else nav('/journal');
    } catch(ex) {
      const lt = ex.response?.data?.limitType;
      if (lt) { setLimitModal(lt); playWarning(); }
      else setErr(ex.response?.data?.error || 'Failed to save trade');
    } finally { setBusy(false); }
  };

  const barColor = score>=90?'#7c3aed':score>=75?'#0284c7':score>=40?'#d97706':'#e11d48';

  const handleDeleteModel = async (m) => {
    if (window.confirm(`Are you sure you want to delete model "${m.name}"?`)) {
      const ok = await deleteModel(m._id || m.id);
      if (ok && model === m.name) {
        setModel(mode === 'practice' ? 'Practice' : 'Model 1');
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
    return list;
  }, [mode, customModels, model]);

  return (
    <div className="page">
      {limitModal && (
        <div className="lim-ov" onClick={()=>setLimitModal('')}>
          <div className="lim-box" onClick={e=>e.stopPropagation()}>
            <div className="lim-top"><div className="lim-icon">⚠️</div>
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
          {!isEdit && (
            <button className="btn btn-ghost btn-sm" onClick={() => setLimitModal('weekly')}>Check Limits</button>
          )}
          <button className="btn btn-ghost" onClick={() => onDone ? onDone() : nav('/journal')}>Cancel</button>
          <button className="btn btn-ghost" onClick={() => save(false)} disabled={busy}>Save Draft</button>
          <button className="btn btn-ok" onClick={() => save(true)} disabled={busy}>Save Final</button>
        </div>
      </div>

      {err && (
        <div className="err-box" style={{marginBottom:24, justifyContent: 'center'}}>
          <span>⚠️</span>
          {err}
        </div>
      )}

      {/* Model Selection - always visible */}
      <div className="card">
        <div className="form-sec">Model</div>
        <div className="field" style={{marginBottom: '0.5rem'}}>
          <div style={{display:'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap'}}>
            <div className="model-sel" style={{padding:0, gap: '4px', background: 'transparent', border:'none'}}>
              {modelBadges.map(m => (
                <div key={m.name} style={{display:'flex', alignItems:'center', position:'relative'}}>
                  <button 
                    className={`mbtn ${model === m.name ? (m.name === 'Model 1' ? 'sel-m1' : 'sel-m2') : ''}`}
                    style={{padding: '6px 12px', fontSize: '0.85rem'}}
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
                style={{padding: '4px 10px', fontSize: '0.8rem', border: '1px dashed #ccc'}}
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
              <label>Session</label>
              <input list="session-opts" value={session} onChange={e=>setSession(e.target.value)} placeholder="Select or type..." autoComplete="off"/>
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
                  <span className="ci-lbl">{item.label}{(item.optional && item.key !== 'sync2H') && <span className="ci-opt"> (optional)</span>}</span>
                  <span className="ci-pts">{Math.round(item.weight)}pts</span>
                </div>
              </div>
            );
          })}
          {missing.length>0&&(
            <div className="mand-warn" style={{ '--w-bg': theme.wBg, '--w-border': theme.wBorder, '--w-text': theme.wText, '--w-ul': theme.wUl }}>
              <div><strong>Required before Final:</strong><ul>{missing.map(l=><li key={l}>{l}</li>)}</ul></div>
            </div>
          )}
          <div className="sc-blk">
            <div className="sc-label">{model} · Setup Score</div>
            <div className="sc-n" style={{color:barColor}}>{score}</div>
            <div className="sc-bg"><div className="sc-fill" style={{width:`${score}%`,background:`linear-gradient(90deg,${barColor}88,${barColor})`}}/></div>
            <div className="q-tag" style={{
              background: score >= 75 ? '#DCFCE7' : '#FEE2E2', 
              color: score >= 75 ? '#166534' : '#991B1B',
              border: `1px solid ${score >= 75 ? '#BBF7D0' : '#FECACA'}`
            }}>
              {grade}
            </div>
          </div>
        </div>
      )}

      {(mode === 'practice' || score >= 75) && (
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

      {modelBadges.find(m => m.name === model && m._id && !m.isHistorical) && (
        <div style={{marginTop: '32px', textAlign: 'center', paddingBottom: '20px'}}>
          <button 
            className="del-model-btn" 
            onClick={() => handleDeleteModel(modelBadges.find(m => m.name === model))}
            style={{
              color: '#e11d48', fontSize: '0.85rem', fontWeight: 600, 
              background: 'none', border: 'none', padding: 12, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              opacity: 0.7, transition: 'opacity 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.opacity = 1}
            onMouseOut={e => e.currentTarget.style.opacity = 0.7}
          >
            🗑 Delete {model}
          </button>
        </div>
      )}
    </div>
  );
}
