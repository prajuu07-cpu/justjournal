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
  15: { color: '#2563EB', bg: '#EFF6FF', rgb: '37, 99, 235' },   // Blue
  20: { color: '#D97706', bg: '#FEF3C7', rgb: '217, 119, 6' },   // Orange
  25: { color: '#7E22CE', bg: '#FAF5FF', rgb: '126, 34, 206' },  // Purple
};
const DEFAULT_COLOR = { color: '#4F46E5', bg: '#EEF2FF', rgb: '79, 70, 229' };

const MODEL_THEMES = {
  'Model 1': { wBg: '#FDF4FF', wBorder: '#E9D5FF', wText: '#7E22CE', wUl: '#9333EA' },
  'Model 2': { wBg: '#EEF2FF', wBorder: '#C7D2FE', wText: '#4F46E5', wUl: '#6366F1' }
};

function calcScore(cl, items) { return items.reduce((s,i)=>s+(cl[i.key]?i.weight:0),0); }
function calcGrade(sc) { return sc>=90?'A+':sc>=75?'A':'Draft'; }
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
  const { mode, practiceDefaults, updatePracticeDefaults } = useMode();
  const isEdit = !!editTrade?.id;


  const [model,  setModel]  = useState(editTrade?.model  || 'Model 1');
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

  const activeItems = model === 'Model 1' ? MODEL1_ITEMS : MODEL2_ITEMS;
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
        model: isPractice ? 'Practice Model' : model, 
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

  return (
    <div className="page">
      {limitModal && (
        <div className="lim-ov" onClick={()=>setLimitModal('')}>
          <div className="lim-box" onClick={e=>e.stopPropagation()}>
            <div className="lim-top"><div className="lim-icon">⚠️</div>
              <div className="lim-title">{limitModal==='weekly'?'Weekly Limit Reached':'Monthly Loss Limit Reached'}</div>
            </div>
            <div className="lim-body">
              <div className="lim-msg">{limitModal==='weekly'?'You have reached 2 trades this week. No more trades until next week.':limitModal==='monthly'?'You have 5 losing trades this month. Trading is blocked until next month.':''}</div>
              <button className="lim-dismiss" onClick={()=>setLimitModal('')}>Got it</button>
            </div>
          </div>
        </div>
      )}

      <div className="page-hd">
        <h1>{isEdit?'Edit Trade':'New Trade'}</h1>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-ghost" onClick={()=>onDone?onDone():nav('/journal')}>Cancel</button>
          <button className="btn btn-ghost" onClick={()=>save(false)} disabled={busy}>Save Draft</button>
          <button className="btn btn-ok"    onClick={()=>save(true)}  disabled={(mode !== 'practice' && (missing.length>0||score<75)) || busy}>Save Final</button>
        </div>
      </div>

      {err && <div className="err-box">{err}</div>}

      {mode !== 'practice' && (
        <div className="card">
          <div className="form-sec">Model</div>
          <div className="model-sel">
            {['Model 1','Model 2'].map(m=>(
              <button key={m} className={`mbtn${model===m?(m==='Model 1'?' sel-m1':' sel-m2'):''}`}
                onClick={()=>{if(!isEdit)setModel(m);}} disabled={isEdit}>{m}</button>
            ))}
          </div>
        </div>
      )}

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
                   style={{'--ici': col.color, '--ibg': col.bg, '--irgb': col.rgb}}>
                <div className="ci-box">{cl[item.key]&&<svg width="12" height="9" viewBox="0 0 12 9" fill="none"><path d="M1 4.5l3.5 3.5L11 1" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}</div>
                <span className="ci-lbl">{item.label}{(item.optional && item.key !== 'sync2H') && <span className="ci-opt"> (optional)</span>}</span>
                <span className="ci-pts">{item.weight}pts</span>
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
            <div className="q-tag" style={{background:score>=90?'#ede9fe':score>=75?'#e0f2fe':'#fff1f2',color:score>=90?'#7c3aed':score>=75?'#0284c7':'#e11d48'}}>{grade}</div>
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
    </div>
  );
}
