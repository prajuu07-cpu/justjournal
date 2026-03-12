import { useState, useMemo } from 'react';

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

function calcScore(cl, items) { return items.reduce((s,i)=>s+(cl[i.key]?i.weight:0),0); }
function calcGrade(sc) { return sc>=90?'A+':sc>=75?'A':'Avoid'; }

export default function MobileChecklist() {
  const [model, setModel] = useState('Model 1');
  const [cl, setCl] = useState({});

  const items = model === 'Model 1' ? MODEL1_ITEMS : MODEL2_ITEMS;
  const score = useMemo(() => calcScore(cl, items), [cl, items]);
  const grade = calcGrade(score);

  const toggle = k => setCl(p => ({ ...p, [k]: !p[k] }));
  const reset = () => setCl({});

  const barColor = score >= 90 ? '#7c3aed' : score >= 75 ? '#0284c7' : score >= 40 ? '#d97706' : '#e11d48';

  return (
    <div>
      <div className="m-page-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Checklist</h1>
        <button className="m-btn m-btn-ghost" style={{ width: 'auto', padding: '8px 16px' }} onClick={reset}>Reset</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {['Model 1', 'Model 2'].map(m => (
          <button 
            key={m} 
            className={`m-nav-item ${model === m ? 'active' : ''}`}
            style={{ flex: 1, textAlign: 'center', border: '1px solid var(--m-border)' }}
            onClick={() => { setModel(m); setCl({}); }}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="m-stat-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
          <span className="m-stat-lbl">{model} Quality</span>
          <span style={{ fontSize: '2rem', fontWeight: 800, color: barColor }}>{grade}</span>
        </div>
        
        <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ height: '100%', width: `${score}%`, background: barColor, transition: 'width 0.3s ease' }}></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700 }}>
          <span>Score</span>
          <span>{score}/100</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map(i => (
          <div 
            key={i.key} 
            className="m-trade-card" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 12, 
              padding: 12,
              borderColor: cl[i.key] ? 'var(--m-primary)' : 'var(--m-border)',
              background: cl[i.key] ? 'rgba(99, 102, 241, 0.05)' : 'var(--m-card)'
            }}
            onClick={() => toggle(i.key)}
          >
            <div style={{ 
              width: 24, 
              height: 24, 
              borderRadius: 6, 
              border: '2.5px solid',
              borderColor: cl[i.key] ? 'var(--m-primary)' : '#cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: cl[i.key] ? 'var(--m-primary)' : 'transparent',
              flexShrink: 0
            }}>
              {cl[i.key] && <svg width="12" height="9" viewBox="0 0 12 9" fill="none"><path d="M1 4.5l3.5 3.5L11 1" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{i.label}</div>
              {i.optional && <div style={{ fontSize: '0.7rem', color: 'var(--m-text-muted)' }}>Optional</div>}
            </div>
            <div style={{ fontWeight: 800, color: 'var(--m-text-muted)', marginLeft: 'auto', fontSize: '0.85rem' }}>{i.weight}pts</div>
          </div>
        ))}
      </div>
    </div>
  );
}
