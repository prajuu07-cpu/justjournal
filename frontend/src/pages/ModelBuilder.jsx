import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMode } from '../context/ModeContext';
import api from '../services/api';

export default function ModelBuilder() {
  const nav = useNavigate();
  const { addModel, mode } = useMode();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [checklist, setChecklist] = useState([]);
  const [modelNotes, setModelNotes] = useState('');
  const [newItem, setNewItem] = useState({ label: '', weight: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [dupModal, setDupModal] = useState(false);
  const [dupName, setDupName] = useState('');

  // Trade Details state (mirrored for UI consistency)
  const [pair] = useState('EURUSD');
  const [date] = useState(new Date().toISOString().slice(0, 10));
  const [dir] = useState('Buy');
  const [risk] = useState('1.0');

  const addItem = () => {
    if (newItem.label.trim()) {
      const w = parseInt(newItem.weight) || 0;
      setChecklist([...checklist, { 
        label: newItem.label.trim(), 
        weight: w
      }]);
      setNewItem({ label: '', weight: '' });
    }
  };

  const removeItem = (idx) => {
    setChecklist(checklist.filter((_, i) => i !== idx));
  };

  const moveItem = (idx, dir) => {
    const next = [...checklist];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setChecklist(next);
  };

  const submit = async (overrideName = null) => {
    const finalName = typeof overrideName === 'string' ? overrideName : name;
    if (!finalName.trim()) return setErr('Model name is required');
    if (checklist.length === 0) return setErr('Add at least one checklist item');

    setBusy(true);
    setErr('');
    try {
      const { data } = await api.post('/custom-models', {
        name: finalName.trim(),
        checklist: checklist,
        notes: modelNotes.trim(),
        mode: 'justchill',
        createdFrom: 'practice'
      });
      addModel(data);
      if (dupModal) setDupModal(false);
      nav('/new-trade');
    } catch (ex) {
      if (ex.response?.data?.message === 'MODEL_EXISTS') {
        setDupName(finalName);
        setDupModal(true);
      } else {
        setErr('Failed to submit model');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page" style={{paddingBottom: 100}}>
      {dupModal && (
        <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.5)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center'}}>
          <div style={{background:'#fff', padding:24, borderRadius:12, width:'90%', maxWidth:400, boxShadow:'0 10px 25px rgba(0,0,0,0.1)'}}>
            <h3 style={{marginTop:0, marginBottom:12, color:'#1e293b'}}>Rename Model</h3>
            <p style={{marginTop:0, marginBottom:16, color:'#64748b', fontSize:'0.95rem'}}>Model name already exists. Please choose another name.</p>
            <input 
              autoFocus
              type="text" 
              value={dupName} 
              onChange={e => setDupName(e.target.value)} 
              style={{width:'100%', padding:'10px 12px', boxSizing: 'border-box', border:'1px solid #cbd5e1', borderRadius:8, marginBottom:20, outline:'none', fontSize:'1rem'}}
            />
            <div style={{display:'flex', gap:12, justifyContent:'flex-end'}}>
              <button className="btn btn-ghost" onClick={() => { setDupModal(false); nav('/new-trade'); }}>Cancel</button>
              <button className="btn btn-ok" onClick={() => submit(dupName)} disabled={!dupName.trim() || busy}>Submit</button>
            </div>
          </div>
        </div>
      )}

      {step === 1 ? (
        <>
          <div className="page-hd">
            <h1>Create Model</h1>
            <button className="btn btn-ghost" onClick={() => nav(-1)}>Cancel</button>
          </div>
          {err && <div className="err-box">{err}</div>}
          <div className="card">
            <div className="form-sec">Model Name</div>
            <div className="field">
              <label>Name *</label>
              <input 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder="e.g. Breakout Model"
                autoFocus
              />
            </div>
            <div style={{marginTop: '1.5rem'}}>
              <button className="btn btn-ok w100" onClick={() => name.trim() ? setStep(2) : setErr('Name is required')}>
                Continue
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="page-hd">
            <h1>Model Builder</h1>
            <div style={{display:'flex', gap:8}}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>Back</button>
              <button className="btn btn-ok" onClick={submit} disabled={busy}>Submit to JustChill</button>
            </div>
          </div>

          {err && <div className="err-box">{err}</div>}

          <div className="card">
            <div className="form-sec">Trade Details (Reference)</div>
            <div className="g2" style={{opacity: 0.7, pointerEvents: 'none'}}>
              <div className="field"><label>Pair</label><input value={pair} readOnly/></div>
              <div className="field"><label>Date</label><input type="date" value={date} readOnly/></div>
              <div className="field"><label>Direction</label><select value={dir} readOnly><option>Buy</option></select></div>
              <div className="field"><label>Risk %</label><input value={risk} readOnly/></div>
            </div>
          </div>

          <div className="card">
            <div className="form-sec">Checklist Builder — {name}</div>
            <div className="checklist-entry" style={{display:'flex', flexDirection:'column', gap:12, marginBottom: '2rem', padding: '16px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0'}}>
              <div style={{display:'flex', gap:10}}>
                <div className="field" style={{flex:3}}>
                  <label style={{fontSize: '0.75rem', color: '#64748b'}}>Item Label *</label>
                  <input 
                    value={newItem.label} 
                    onChange={e => setNewItem({...newItem, label: e.target.value})} 
                    placeholder="e.g. Daily TP Reached"
                    onKeyDown={e => e.key === 'Enter' && addItem()}
                    style={{background: '#fff'}}
                  />
                </div>
                <div className="field" style={{flex:1}}>
                  <label style={{fontSize: '0.75rem', color: '#64748b'}}>Points *</label>
                  <input 
                    type="number"
                    value={newItem.weight} 
                    onChange={e => setNewItem({...newItem, weight: e.target.value})} 
                    placeholder="pts"
                    style={{background: '#fff'}}
                  />
                </div>
                <div className="field" style={{flex:1}}/>
              </div>
              <button className="btn btn-ok" onClick={addItem} style={{width:'100%'}}>+ Add to Checklist</button>
            </div>

            <div className="checklist-preview">
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 12}}>
                <div style={{fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase'}}>Current Checklist</div>
                <div style={{fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary)'}}>Total: {checklist.reduce((s,i)=>s+i.weight, 0)} pts</div>
              </div>
              {checklist.map((item, i) => {
                const w = item.weight;
                const bg = w <= 5 ? '#fdf2f8' : w <= 15 ? '#EFF6FF' : w <= 20 ? '#FEF3C7' : '#FAF5FF';
                const color = w <= 5 ? '#ec4899' : w <= 15 ? '#2563EB' : w <= 20 ? '#D97706' : '#7E22CE';
                return (
                  <div key={i} className="ci-card" style={{display:'flex', flexDirection:'column', gap:6, padding: '14px', border: '1px solid #e2e8f0', borderRadius: 12, marginBottom: 10, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'}}>
                    <div style={{display:'flex', alignItems:'center', gap:10}}>
                      <div style={{flex:1, fontWeight:700, fontSize: '0.95rem'}}>
                        {item.label}
                      </div>
                      <div style={{fontSize:'0.85rem', color: color, fontWeight:800, background: bg, padding: '4px 8px', borderRadius: 6}}>{item.weight} pts</div>
                      <div style={{display:'flex', gap:4}}>
                        <button className="btn-icon" onClick={() => moveItem(i, -1)} disabled={i===0}>↑</button>
                        <button className="btn-icon" onClick={() => moveItem(i, 1)} disabled={i===checklist.length-1}>↓</button>
                        <button className="btn-icon" style={{color: '#e11d48', fontWeight: 700, fontSize: '0.7rem'}} onClick={() => removeItem(i)}>DEL</button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {checklist.length === 0 && <div style={{textAlign:'center', color:'#999', padding:'40px', background: '#f8fafc', borderRadius: 12, border: '2px dashed #e2e8f0'}}>No items added yet</div>}
            </div>
          </div>

          <div className="card">
            <div className="form-sec">General Model Notes</div>
            <div className="field" style={{marginBottom: 0}}>
              <textarea 
                value={modelNotes} 
                onChange={e => setModelNotes(e.target.value)} 
                placeholder="Default notes that will appear when this model is selected..."
                rows={3}
                style={{resize:'vertical', fontSize: '0.9rem'}}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
