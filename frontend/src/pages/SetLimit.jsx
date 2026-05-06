import { useState, useEffect } from 'react';
import { useMode } from '../context/ModeContext';
import { useNavigate } from 'react-router-dom';

export default function SetLimit() {
  const { userSettings, updateSettings, mode } = useMode();
  const nav = useNavigate();
  
  const [weekly, setWeekly] = useState(userSettings.weekly_limit || 2);
  const [weeklyEnabled, setWeeklyEnabled] = useState(userSettings.weekly_limit_enabled ?? true);
  const [weeklyLoss, setWeeklyLoss] = useState(userSettings.weekly_loss_limit || 2);
  const [weeklyLossEnabled, setWeeklyLossEnabled] = useState(userSettings.weekly_loss_limit_enabled ?? true);
  const [monthly, setMonthly] = useState(userSettings.monthly_loss_limit || 5);
  const [monthlyEnabled, setMonthlyEnabled] = useState(userSettings.monthly_loss_limit_enabled ?? true);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
 
  useEffect(() => {
    setWeekly(userSettings.weekly_limit ?? 2);
    setWeeklyEnabled(userSettings.weekly_limit_enabled ?? true);
    setWeeklyLoss(userSettings.weekly_loss_limit ?? 2);
    setWeeklyLossEnabled(userSettings.weekly_loss_limit_enabled ?? true);
    setMonthly(userSettings.monthly_loss_limit ?? 5);
    setMonthlyEnabled(userSettings.monthly_loss_limit_enabled ?? true);
  }, [userSettings]);

  const isValidPositiveInteger = (val) => {
    const num = Number(val);
    return Number.isInteger(num) && num > 0;
  };

  const save = async () => {
    setError('');
    setMsg('');

    // Only validate if enabled
    if (weeklyEnabled && !isValidPositiveInteger(weekly)) {
      setError('Please enter a valid weekly trade limit.');
      return;
    }
    if (weeklyLossEnabled && !isValidPositiveInteger(weeklyLoss)) {
      setError('Please enter a valid weekly loss limit.');
      return;
    }
    if (monthlyEnabled && !isValidPositiveInteger(monthly)) {
      setError('Please enter a valid monthly loss limit.');
      return;
    }

    setBusy(true);
    const success = await updateSettings({
      weekly_limit: parseInt(weekly, 10),
      weekly_limit_enabled: weeklyEnabled,
      weekly_loss_limit: parseInt(weeklyLoss, 10),
      weekly_loss_limit_enabled: weeklyLossEnabled,
      monthly_loss_limit: parseInt(monthly, 10),
      monthly_loss_limit_enabled: monthlyEnabled
    });
    
    if (success) {
      setMsg('Trading limits updated successfully.');
      setTimeout(() => setMsg(''), 3000);
    } else {
      setError('Failed to save limits.');
    }
    setBusy(false);
  };

  if (mode === 'practice') {
    return (
      <div className="page" style={{textAlign:'center', padding:'40px'}}>
        <div className="card">
          <h2>Limits Not Available</h2>
          <p style={{color:'#64748b'}}>Manual limits are only available in Journal mode.</p>
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
          background: '#f0fdf4', 
          color: '#166534',
          borderRadius: 8,
          marginBottom: 16,
          fontWeight: 600,
          textAlign: 'center'
        }}>
          {msg}
        </div>
      )}

      {error && (
        <div style={{
          padding: '12px', 
          background: '#fef2f2', 
          color: '#991b1b',
          borderRadius: 8,
          marginBottom: 16,
          fontWeight: 600,
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}

      <div className="card">
        <div className="form-sec">Control Discipline</div>
        <p style={{fontSize:'0.9rem', color:'var(--text)', marginBottom: '1.5rem', fontWeight: 500}}>
          Define your tolerance levels. The system will block new final trades in Journal mode once these limits are reached.
        </p>

        <div className="g2" style={{ marginBottom: '16px' }}>
          <div className={`field ${!weeklyEnabled ? 'disabled' : ''}`}>
            <div className="field-head">
              <label style={{color: 'var(--text)', fontWeight: 700}}>Weekly Trade Limit</label>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={weeklyEnabled} 
                  onChange={e => setWeeklyEnabled(e.target.checked)} 
                />
                <span className="slider"></span>
              </label>
            </div>
            <input 
              type="number" 
              value={weekly} 
              onChange={e => setWeekly(e.target.value)}
              placeholder="e.g. 2"
              min="1"
              disabled={!weeklyEnabled}
            />
            <small style={{display:'block', marginTop:4, color:'#64748b'}}>
              Max number of trades allowed per week
            </small>
          </div>

          <div className={`field ${!weeklyLossEnabled ? 'disabled' : ''}`}>
            <div className="field-head">
              <label style={{color: 'var(--text)', fontWeight: 700}}>Weekly Loss Limit</label>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={weeklyLossEnabled} 
                  onChange={e => setWeeklyLossEnabled(e.target.checked)} 
                />
                <span className="slider"></span>
              </label>
            </div>
            <input 
              type="number" 
              value={weeklyLoss} 
              onChange={e => setWeeklyLoss(e.target.value)}
              placeholder="e.g. 2"
              min="1"
              disabled={!weeklyLossEnabled}
            />
            <small style={{display:'block', marginTop:4, color:'#64748b'}}>
              Max number of losing trades allowed per week
            </small>
          </div>
        </div>

        <div className="g2">
          <div className={`field ${!monthlyEnabled ? 'disabled' : ''}`}>
            <div className="field-head">
              <label style={{color: 'var(--text)', fontWeight: 700}}>Monthly Loss Limit</label>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={monthlyEnabled} 
                  onChange={e => setMonthlyEnabled(e.target.checked)} 
                />
                <span className="slider"></span>
              </label>
            </div>
            <input 
              type="number" 
              value={monthly} 
              onChange={e => setMonthly(e.target.value)}
              placeholder="e.g. 5"
              min="1"
              disabled={!monthlyEnabled}
            />
            <small style={{display:'block', marginTop:4, color:'#94a3b8'}}>
              Max number of losing trades allowed per month
            </small>
          </div>
        </div>
      </div>

    </div>
  );
}
