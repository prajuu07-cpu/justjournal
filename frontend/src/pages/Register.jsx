import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ email:'', username:'', password:'' });
  const [err,  setErr]  = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async e => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await register(form.email, form.username, form.password); nav('/'); }
    catch(ex){ setErr(ex.response?.data?.error || 'Registration failed'); }
    finally{ setBusy(false); }
  };

  return (
    <div className="m-layout" style={{ justifyContent: 'center', paddingBottom: 0 }}>
      <div className="m-content" style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40, marginTop: 40 }}>
          <h1 className="m-header-logo" style={{ fontSize: '36px', marginBottom: 8 }}>Trading Journal</h1>
          <p style={{ color: 'var(--m-sub)', fontSize: '15px' }}>Master your psychology, track your progress.</p>
        </div>

        <div className="m-card" style={{ padding: '32px 24px' }}>
          <h2 style={{ fontSize: '20px', marginBottom: 24, fontWeight: 700 }}>Join the Journal</h2>
          
          {err && <div className="err-box" style={{ borderRadius: '12px', marginBottom: 20 }}>{err}</div>}
          
          <form onSubmit={submit}>
            <div className="field" style={{ marginBottom: 20 }}>
              <label style={{ color: 'var(--m-sub)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Email Address</label>
              <input 
                type="email" 
                autoFocus 
                value={form.email} 
                onChange={e=>setForm(p=>({...p,email:e.target.value}))} 
                placeholder="name@email.com" 
                required
                style={{ width: '100%', padding: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--m-border)', borderRadius: '12px', color: '#fff', fontSize: '15px' }}
              />
            </div>
            <div className="field" style={{ marginBottom: 20 }}>
              <label style={{ color: 'var(--m-sub)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Choose Username</label>
              <input 
                value={form.username} 
                onChange={e=>setForm(p=>({...p,username:e.target.value}))} 
                placeholder="trader_name" 
                required
                style={{ width: '100%', padding: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--m-border)', borderRadius: '12px', color: '#fff', fontSize: '15px' }}
              />
            </div>
            <div className="field" style={{ marginBottom: 32 }}>
              <label style={{ color: 'var(--m-sub)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Security Password</label>
              <input 
                type="password" 
                value={form.password} 
                onChange={e=>setForm(p=>({...p,password:e.target.value}))} 
                placeholder="••••••••" 
                required
                style={{ width: '100%', padding: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--m-border)', borderRadius: '12px', color: '#fff', fontSize: '15px' }}
              />
            </div>
            <button className="m-glass-btn" style={{ width: '100%', padding: '16px', background: 'var(--m-primary)', borderColor: 'var(--m-primary)', fontSize: '16px' }} disabled={busy}>
              {busy ? 'Creating...' : 'Get Started'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <p style={{ color: 'var(--m-sub)', fontSize: '14px' }}>
              Already a member? <Link to="/login" style={{ color: 'var(--m-primary)', fontWeight: 600, textDecoration: 'none' }}>Sign In</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
