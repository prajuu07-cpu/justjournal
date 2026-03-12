import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function MobileNewTrade() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    pair: '',
    model: 'Model 1',
    grade: 'A',
    direction: 'Long',
    entry_price: '',
    stop_loss: '',
    risk_percent: '1.0',
    status: 'draft'
  });
  const [submitting, setSubmitting] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/trades', form);
      nav('/journal');
    } catch (ex) {
      alert(ex.response?.data?.error || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="m-page-hd">
        <h1>Log Trade</h1>
      </div>

      <form onSubmit={save} className="m-stat-card" style={{ padding: 20 }}>
        <div className="m-field">
          <label>Setup Details</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} required />
            <input type="text" placeholder="Pair (e.g. BTC-USD)" value={form.pair} onChange={e => setForm({...form, pair: e.target.value})} required />
          </div>
        </div>

        <div className="m-field">
          <label>Strategy & Direction</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <select value={form.model} onChange={e => setForm({...form, model: e.target.value})}>
              <option>Model 1</option>
              <option>Model 2</option>
            </select>
            <select value={form.direction} onChange={e => setForm({...form, direction: e.target.value})}>
              <option>Long</option>
              <option>Short</option>
            </select>
          </div>
        </div>

        <div className="m-field">
          <label>Risk Management (%)</label>
          <input type="number" step="0.1" value={form.risk_percent} onChange={e => setForm({...form, risk_percent: e.target.value})} required />
        </div>

        <div className="m-field">
          <label>Entry & Stop</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <input type="number" step="0.00001" placeholder="Entry" value={form.entry_price} onChange={e => setForm({...form, entry_price: e.target.value})} required />
            <input type="number" step="0.00001" placeholder="Stop Loss" value={form.stop_loss} onChange={e => setForm({...form, stop_loss: e.target.value})} required />
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <button type="submit" className="m-btn" disabled={submitting}>
            {submitting ? 'Saving…' : 'Finalize & Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
