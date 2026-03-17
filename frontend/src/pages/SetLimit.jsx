import { useState, useEffect } from 'react';
import { useMode } from '../context/ModeContext';
import { useNavigate } from 'react-router-dom';

export default function SetLimit() {
  const { userSettings, updateSettings, mode } = useMode();
  const nav = useNavigate();
  
  const [weekly, setWeekly] = useState(userSettings.weekly_limit || 2);
  const [monthly, setMonthly] = useState(userSettings.monthly_loss_limit || 5);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setWeekly(userSettings.weekly_limit);
    setMonthly(userSettings.monthly_loss_limit);
  }, [userSettings]);

  const save = async () => {
    setBusy(true);
    setMsg('');
    const success = await updateSettings({
      weekly_limit: parseInt(weekly),
      monthly_loss_limit: parseInt(monthly)
    });
    if (success) {
      setMsg('Limits saved successfully!');
      setTimeout(() => setMsg(''), 3000);
    } else {
      setMsg('Failed to save limits.');
    }
    setBusy(false);
  };

  if (mode === 'practice') {
    return (
      <div className="page" style={{textAlign:'center', padding:'40px'}}>
        <div className="card">
          <h2>Limits Not Available</h2>
          <p style={{color:'#64748b'}}>Manual limits are only available in JustChill mode.</p>
          <button className="btn btn-ghost" onClick={() => nav('/')} style={{marginTop:20}}>Back to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-hd">
        <h1>Trading Limits</h1>
        <button className="btn btn-ok" onClick={save} disabled={busy}>Save Limits</button>
      </div>

      {msg && (
        <div style={{
          padding: '12px', 
          background: msg.includes('Failed') ? '#fef2f2' : '#f0fdf4', 
          color: msg.includes('Failed') ? '#991b1b' : '#166534',
          borderRadius: 8,
          marginBottom: 16,
          fontWeight: 600,
          textAlign: 'center'
        }}>
          {msg}
        </div>
      )}

      <div className="card">
        <div className="form-sec">Control Discipline</div>
        <p style={{fontSize:'0.9rem', color:'#64748b', marginBottom: '1.5rem'}}>
          Define your tolerance levels. The system will block new final trades in JustChill mode once these limits are reached.
        </p>

        <div className="g2">
          <div className="field">
            <label>Weekly Final Trade Limit</label>
            <input 
              type="number" 
              value={weekly} 
              onChange={e => setWeekly(e.target.value)}
              placeholder="e.g. 2"
            />
            <small style={{display:'block', marginTop:4, color:'#94a3b8'}}>
              Maximum number of completed trades per week.
            </small>
          </div>

          <div className="field">
            <label>Monthly Loss Limit</label>
            <input 
              type="number" 
              value={monthly} 
              onChange={e => setMonthly(e.target.value)}
              placeholder="e.g. 5"
            />
            <small style={{display:'block', marginTop:4, color:'#94a3b8'}}>
              Maximum number of losing trades allowed per month.
            </small>
          </div>
        </div>
      </div>

    </div>
  );
}
