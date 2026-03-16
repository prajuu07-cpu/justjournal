import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMode } from '../context/ModeContext';
import api from '../services/api';

export default function ModelBuilder() {
  const nav = useNavigate();
  const { addModel } = useMode();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [checklist, setChecklist] = useState([]);
  const [newItem, setNewItem] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // Trade Details state (mirrored for UI consistency)
  const [pair] = useState('EURUSD');
  const [date] = useState(new Date().toISOString().slice(0, 10));
  const [dir] = useState('Buy');
  const [risk] = useState('1.0');
  const [session] = useState('London');

  const addItem = () => {
    if (newItem.trim()) {
      setChecklist([...checklist, newItem.trim()]);
      setNewItem('');
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

  const submit = async () => {
    if (!name.trim()) return setErr('Model name is required');
    if (checklist.length === 0) return setErr('Add at least one checklist item');

    setBusy(true);
    try {
      const { data } = await api.post('/custom-models', {
        name: name.trim(),
        checklist: checklist,
        createdFrom: 'practice'
      });
      addModel(data);
      nav('/new-trade');
    } catch (ex) {
      setErr('Failed to submit model');
    } finally {
      setBusy(false);
    }
  };

  if (step === 1) {
    return (
      <div className="page">
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
      </div>
    );
  }

  return (
    <div className="page">
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
          <div className="field"><label>Session</label><input value={session} readOnly/></div>
        </div>
      </div>

      <div className="card">
        <div className="form-sec">Checklist Builder — {name}</div>
        <div className="field" style={{display:'flex', gap:8, marginBottom: '1rem'}}>
          <input 
            value={newItem} 
            onChange={e => setNewItem(e.target.value)} 
            placeholder="Add checklist item..."
            onKeyDown={e => e.key === 'Enter' && addItem()}
          />
          <button className="btn btn-ghost" onClick={addItem}>Add</button>
        </div>

        <div className="checklist-preview">
          {checklist.map((item, i) => (
            <div key={i} className="ci" style={{display:'flex', alignItems:'center', gap:10, padding: '10px 12px', border: '1px solid #eee', borderRadius: 8, marginBottom: 8}}>
              <div style={{flex:1}}>{item}</div>
              <div style={{display:'flex', gap:4}}>
                <button className="btn-icon" onClick={() => moveItem(i, -1)} disabled={i===0}>↑</button>
                <button className="btn-icon" onClick={() => moveItem(i, 1)} disabled={i===checklist.length-1}>↓</button>
                <button className="btn-icon" style={{color: '#e11d48'}} onClick={() => removeItem(i)}>🗑</button>
              </div>
            </div>
          ))}
          {checklist.length === 0 && <div style={{textAlign:'center', color:'#999', padding:'20px'}}>No items added yet</div>}
        </div>
      </div>
    </div>
  );
}
