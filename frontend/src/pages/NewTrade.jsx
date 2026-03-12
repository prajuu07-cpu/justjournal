import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

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
  const isEdit = !!editTrade?.id;


  const [model,  setModel]  = useState(editTrade?.model  || 'Model 1');
  const [pair,   setPair]   = useState(editTrade?.pair   || '');
  const [date,   setDate]   = useState(editTrade?.date   || new Date().toISOString().slice(0,10));
  const [dir,    setDir]    = useState(editTrade?.direction || 'Buy');
  const [risk,   setRisk]   = useState(editTrade?.risk_percent || '');
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

    if (asFinal && missing.length) { setErr('Check all required items before saving as Final'); return; }
    if (asFinal && score < 75)     { setErr('Score must be ≥75 to save as Final'); return; }
    if (asFinal && grade==='Draft' && !window.confirm('Grade is Draft — save anyway?')) return;

    let rm=null, res_=result||null;
    if (asFinal && res_) {
      rm = res_==='Loss'?-1:res_==='Breakeven'?0:parseFloat(rMult);
      if (res_==='Win'&&(isNaN(rm)||rm<=0)){ setErr('Win needs a positive R multiple'); return; }
    }

    setBusy(true);
    try {
      const payload = { pair:pair.toUpperCase(), date, direction:dir, risk_percent:rp, model, checklist:cl, notes, status:asFinal?'final':'draft', result:res_, r_multiple:rm };
      if (isEdit) await api.put(`/trades/${editTrade.id}`, payload);
      else        await api.post('/trades', payload);
      if (onDone) onDone(); else nav('/journal');
    } catch(ex) {
      const lt = ex.response?.data?.limitType;
      if (lt) { setLimitModal(lt); playWarning(); }
      else setErr(ex.response?.data?.error || 'Failed to save trade');
    } finally { setBusy(false); }
  };

  const barColor = score>=90?'#7c3aed':score>=75?'#0284c7':score>=40?'#d97706':'#e11d48';

  return (
    <div className="m-page-fade">
      {limitModal && (
        <div className="lim-ov" onClick={()=>setLimitModal('')}>
          <div className="m-card lim-box" onClick={e=>e.stopPropagation()} style={{ background: '#0f172a', borderColor: 'var(--m-warning)' }}>
            <div className="lim-top"><div className="lim-icon">⚠️</div>
              <div className="lim-title" style={{ color: '#fff' }}>{limitModal==='weekly'?'Weekly Limit':'Monthly Loss Limit'}</div>
            </div>
            <div className="lim-body">
              <div className="lim-msg" style={{ color: 'var(--m-sub)' }}>{limitModal==='weekly'?'You have reached 2 trades this week. No more trades until next week.':limitModal==='monthly'?'You have 5 losing trades this month. Trading is blocked until next month.':''}</div>
              <button className="m-glass-btn" style={{ width: '100%', marginTop: 20 }} onClick={()=>setLimitModal('')}>Got it</button>
            </div>
          </div>
        </div>
      )}

      <div className="page-hd">
        <h1>{isEdit?'Edit Trade':'Add Trade'}</h1>
        <div style={{display:'flex',gap:8}}>
          <button className="m-glass-btn" onClick={()=>onDone?onDone():nav('/journal')} style={{ fontSize: '12px', padding: '8px 12px' }}>Cancel</button>
          <button className="m-glass-btn" onClick={()=>save(false)} disabled={busy} style={{ fontSize: '12px', padding: '8px 12px' }}>Draft</button>
          <button className="m-glass-btn" onClick={()=>save(true)} disabled={missing.length>0||score<75||busy} 
                  style={{ fontSize: '12px', padding: '8px 12px', background: (missing.length>0||score<75) ? 'transparent' : 'var(--m-success)', borderColor: (missing.length>0||score<75) ? 'var(--m-border)' : 'var(--m-success)', color: '#fff' }}>
            Final
          </button>
        </div>
      </div>

      {err && <div className="err-box" style={{ borderRadius: '16px' }}>{err}</div>}

      <div className="m-card">
        <div className="m-stat-label">System Model</div>
        <div className="model-sel" style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {['Model 1','Model 2'].map(m=>(
            <button key={m} 
              className="m-glass-btn"
              style={{ 
                flex: 1, 
                fontSize: '13px',
                background: model === m ? (m === 'Model 1' ? 'var(--purple)' : 'var(--indigo)') : 'transparent',
                borderColor: model === m ? (m === 'Model 1' ? 'var(--purple)' : 'var(--indigo)') : 'var(--m-border)'
              }}
              onClick={()=>{if(!isEdit)setModel(m);}} disabled={isEdit}>
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="m-card">
        <div className="m-stat-label">Trade Execution</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <div className="field">
            <label style={{ color: 'var(--m-sub)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Pair</label>
            <input className="m-input" value={pair} onChange={e=>setPair(e.target.value.toUpperCase())} placeholder="e.g. BTCUSD" 
                   style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--m-border)', borderRadius: '12px', color: '#fff' }}/>
          </div>
          <div className="field">
            <label style={{ color: 'var(--m-sub)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Date</label>
            <input className="m-input" type="date" value={date} onChange={e=>setDate(e.target.value)}
                   style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--m-border)', borderRadius: '12px', color: '#fff' }}/>
          </div>
          <div className="field">
            <label style={{ color: 'var(--m-sub)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Direction</label>
            <select value={dir} onChange={e=>setDir(e.target.value)}
                    style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--m-border)', borderRadius: '12px', color: '#fff' }}>
              <option style={{ background: '#1e293b' }}>Buy</option>
              <option style={{ background: '#1e293b' }}>Sell</option>
            </select>
          </div>
          <div className="field">
            <label style={{ color: 'var(--m-sub)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Risk %</label>
            <input className="m-input" type="number" value={risk} onChange={e=>setRisk(e.target.value)} placeholder="0.5" 
                   style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--m-border)', borderRadius: '12px', color: '#fff' }}/>
          </div>
        </div>
      </div>

      <div className="m-card">
        <div className="m-stat-label">Strategy Checklist · {model}</div>
        <div style={{ marginTop: 12 }}>
          {activeItems.map((item)=>{
            return (
              <div key={item.key} className={`m-glass-btn ci${cl[item.key]?' on':''}`} 
                   onClick={()=>toggle(item.key)} 
                   style={{ 
                     justifyContent: 'flex-start', 
                     marginBottom: 8, 
                     padding: '16px',
                     background: cl[item.key] ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)',
                     borderColor: cl[item.key] ? 'var(--m-primary)' : 'var(--m-border)',
                     transition: '0.2s'
                   }}>
                <div style={{ 
                  width: 20, height: 20, borderRadius: 6, border: '2px solid', 
                  borderColor: cl[item.key] ? 'var(--m-primary)' : 'var(--m-sub)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 12,
                  background: cl[item.key] ? 'var(--m-primary)' : 'transparent'
                }}>
                  {cl[item.key] && <span style={{ color: '#fff', fontSize: '12px', fontWeight: 900 }}>✓</span>}
                </div>
                <span style={{ flex: 1, fontSize: '14px', fontWeight: 500, color: cl[item.key] ? '#fff' : 'var(--m-sub)' }}>{item.label}</span>
                <span style={{ fontSize: '11px', fontWeight: 700, opacity: 0.6 }}>{item.weight}pts</span>
              </div>
            );
          })}
        </div>

        {missing.length>0 && (
          <div style={{ marginTop: 16, padding: '12px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', marginBottom: 4 }}>Required for Final:</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: '13px', color: 'var(--m-sub)' }}>
              {missing.map(l=><li key={l}>{l}</li>)}
            </ul>
          </div>
        )}

        <div className="sc-blk" style={{ marginTop: 24 }}>
          <div className="m-stat-grid">
            <div style={{ gridColumn: 'span 2' }}>
              <div className="sc-label" style={{ color: 'var(--m-sub)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Setup Quality Score</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                <div className="sc-n" style={{ color: barColor, fontSize: '32px', fontWeight: 800 }}>{score}</div>
                <div className="m-pill" style={{ 
                  background: score>=75 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', 
                  color: score>=75 ? '#34d399' : '#f87171',
                  padding: '4px 12px', fontSize: '12px'
                }}>
                  Grade {grade}
                </div>
              </div>
              <div className="sc-bg" style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, marginTop: 12, overflow: 'hidden' }}>
                <div className="sc-fill" style={{ height: '100%', width: `${score}%`, background: barColor, borderRadius: 4, transition: '0.3s' }}/>
              </div>
            </div>
          </div>
        </div>
      </div>

      {score >= 75 && (
        <div className="m-card">
          <div className="m-stat-label">Trade Result</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div className="field">
              <label style={{ color: 'var(--m-sub)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Outcome</label>
              <select value={result} onChange={e=>setResult(e.target.value)}
                      style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--m-border)', borderRadius: '12px', color: '#fff' }}>
                <option value="" style={{ background: '#1e293b' }}>None</option>
                <option style={{ background: '#1e293b' }}>Win</option>
                <option style={{ background: '#1e293b' }}>Loss</option>
                <option style={{ background: '#1e293b' }}>Breakeven</option>
              </select>
            </div>
            {result==='Win' && (
              <div className="field">
                <label style={{ color: 'var(--m-sub)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>R Multiple</label>
                <input className="m-input" type="number" value={rMult} onChange={e=>setRMult(e.target.value)} placeholder="2.5" 
                       style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--m-border)', borderRadius: '12px', color: '#fff' }}/>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="m-card">
        <div className="m-stat-label">Analysis Notes</div>
        <textarea 
          value={notes} 
          onChange={e=>setNotes(e.target.value)} 
          rows={4} 
          placeholder="What did you see in the charts?" 
          style={{ 
            width: '100%', padding: '16px', marginTop: 12,
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--m-border)', 
            borderRadius: '16px', color: '#fff', fontSize: '14px', resize: 'none' 
          }}
        />
      </div>
    </div>
  );
}
