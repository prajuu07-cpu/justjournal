import { useState, useEffect, useMemo } from 'react';
import { useMode } from '../context/ModeContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function Bin() {
  const { restoreModel, emptyBin, userSettings, mode } = useMode();
  const nav = useNavigate();
  const [binnedCustom, setBinnedCustom] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBin = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/custom-models/bin');
      setBinnedCustom(data);
    } catch (err) {
      console.error("Failed to fetch bin", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mode === 'practice') {
      nav('/trade-bin', { replace: true });
    }
  }, [mode, nav]);

  useEffect(() => {
    fetchBin();
  }, []);

  const binnedAll = useMemo(() => {
    const list = (userSettings.binned_models || []).map(name => ({ name, type: 'Built-in' }));
    binnedCustom.forEach(m => list.push({ ...m, type: 'Custom' }));
    return list;
  }, [userSettings.binned_models, binnedCustom]);

  const handleRestore = async (m) => {
    const ok = await restoreModel(m);
    if (ok) fetchBin();
  };

  const handleEmpty = async () => {
    if (window.confirm("Empty Bin? This will permanently delete all models in the bin.")) {
      const ok = await emptyBin();
      if (ok) setBinnedCustom([]);
    }
  };

  if (mode === 'practice') {
    return (
      <div className="page" style={{ textAlign: 'center', padding: '40px' }}>
        <div className="card">
          <h2>Bin Not Available</h2>
          <p style={{ color: '#64748b' }}>The model bin is only available in JustChill mode.</p>
          <button className="btn btn-ghost" onClick={() => nav('/')} style={{ marginTop: 20 }}>Back to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-hd">
        <h1>Model Bin</h1>
        <div className="header-btns">
          <button className="btn btn-danger" onClick={handleEmpty} disabled={binnedAll.length === 0}>Empty Bin</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Model Name</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {binnedAll.map(m => (
                <tr key={m.name || m._id}>
                  <td><strong>{m.name}</strong></td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-xs btn-ghost" style={{color: 'var(--indigo)'}} onClick={() => handleRestore(m)}>Restore</button>
                  </td>
                </tr>
              ))}
              {!loading && binnedAll.length === 0 && (
                <tr>
                  <td colSpan="2" style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>Your bin is empty.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
