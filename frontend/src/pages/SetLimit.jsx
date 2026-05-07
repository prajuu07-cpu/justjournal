import { useState, useEffect } from 'react';
import { useMode } from '../context/ModeContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function SetLimit() {
  const { mode, updateSettings } = useMode();
  const nav = useNavigate();
  
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [loadingModels, setLoadingModels] = useState(true);
  const [loadingLimits, setLoadingLimits] = useState(false);

  const [weekly, setWeekly] = useState('');
  const [weeklyEnabled, setWeeklyEnabled] = useState(false);
  const [weeklyLoss, setWeeklyLoss] = useState('');
  const [weeklyLossEnabled, setWeeklyLossEnabled] = useState(false);
  const [monthly, setMonthly] = useState('');
  const [monthlyEnabled, setMonthlyEnabled] = useState(false);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      setLoadingModels(true);
      const { data } = await api.get('/settings/models');
      setModels(data.models || []);
      if (data.models && data.models.length > 0) {
        setSelectedModel(data.models[0]);
      }
    } catch (err) {
      console.error("Failed to fetch models", err);
      setError("Failed to load models. Please try again.");
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    if (selectedModel) {
      fetchLimits(selectedModel);
    }
  }, [selectedModel]);

  const fetchLimits = async (modelName) => {
    try {
      setLoadingLimits(true);
      const { data } = await api.get(`/settings?model=${encodeURIComponent(modelName)}`);
      setWeekly(data.weekly_limit || '');
      setWeeklyEnabled(data.weekly_limit_enabled ?? false);
      setWeeklyLoss(data.weekly_loss_limit || '');
      setWeeklyLossEnabled(data.weekly_loss_limit_enabled ?? false);
      setMonthly(data.monthly_loss_limit || '');
      setMonthlyEnabled(data.monthly_loss_limit_enabled ?? false);
    } catch (err) {
      console.error("Failed to fetch limits", err);
      setError("Failed to load limits for selected model.");
    } finally {
      setLoadingLimits(false);
    }
  };

  const isValidPositiveInteger = (val) => {
    if (val === '') return true; // Allow empty if disabled
    const num = Number(val);
    return Number.isInteger(num) && num > 0;
  };

  const save = async () => {
    setError('');
    setMsg('');

    if (!selectedModel) {
      setError('Please select a model.');
      return;
    }

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
      model: selectedModel,
      weekly_limit: weekly !== '' ? parseInt(weekly, 10) : 0,
      weekly_limit_enabled: weeklyEnabled,
      weekly_loss_limit: weeklyLoss !== '' ? parseInt(weeklyLoss, 10) : 0,
      weekly_loss_limit_enabled: weeklyLossEnabled,
      monthly_loss_limit: monthly !== '' ? parseInt(monthly, 10) : 0,
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
        {selectedModel && (
          <button className="btn btn-ok" onClick={save} disabled={busy}>Save Limits</button>
        )}
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

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="form-sec">Select Model</div>
        <div className="field">
          <label style={{color: 'var(--text)', fontWeight: 700}}>Active Trading Model</label>
          <div style={{ position: 'relative' }}>
            <select 
              value={selectedModel} 
              onChange={e => setSelectedModel(e.target.value)}
              disabled={loadingModels || models.length === 0}
              className="fsel"
              style={{ width: '100%', padding: '12px' }}
            >
              {loadingModels ? (
                <option>Loading models...</option>
              ) : models.length === 0 ? (
                <option>No models available</option>
              ) : (
                models.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))
              )}
            </select>
            {loadingModels && (
              <div style={{ 
                position: 'absolute', right: 40, top: '50%', transform: 'translateY(-50%)',
                fontSize: '0.8rem', color: '#64748b' 
              }}>
                Fetching...
              </div>
            )}
          </div>
          {models.length === 0 && !loadingModels && (
            <small style={{ color: '#ef4444', marginTop: 4, display: 'block' }}>
              Add trades to your journal to see models here.
            </small>
          )}
        </div>
      </div>

      {selectedModel && (
        <div className={`card ${!selectedModel || loadingLimits ? 'disabled' : ''}`} style={{ position: 'relative' }}>
          {loadingLimits && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.6)', 
              zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 12
            }}>
              <div className="loading">Loading limits...</div>
            </div>
          )}
        <div className="form-sec">Control Discipline</div>
        <p style={{fontSize:'0.9rem', color:'var(--text)', marginBottom: '1.5rem', fontWeight: 500}}>
          Define your tolerance levels for <strong>{selectedModel || 'selected model'}</strong>. The system will block new final trades in Journal mode once these limits are reached.
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
    )}

    </div>
  );
}
