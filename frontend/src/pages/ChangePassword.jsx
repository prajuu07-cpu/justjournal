import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useMode } from '../context/ModeContext';

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </svg>
);

export default function ChangePassword() {
  const { logout } = useAuth();
  const { mode } = useMode();
  const nav = useNavigate();

  // Security redirect: Block access in Practice mode
  useEffect(() => {
    if (mode === 'practice') {
      nav('/', { replace: true });
    }
  }, [mode, nav]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isFormValid = currentPassword && newPassword && confirmPassword;

  const getValidationMsg = () => {
    if (newPassword && !/^[a-zA-Z0-9]+$/.test(newPassword)) return 'Password must contain only letters and numbers.';
    if (newPassword && newPassword.length < 6) return 'Password must be at least 6 characters.';
    if (newPassword && confirmPassword && newPassword !== confirmPassword) return 'New password and confirm password do not match.';
    return '';
  };

  const validationMsg = getValidationMsg();

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!isFormValid || validationMsg) {
      setError('Please fill all required fields correctly.');
      return;
    }
    
    setBusy(true);
    setMsg('');
    setError('');

    try {
      const res = await api.put('/auth/change-password', {
        currentPassword,
        newPassword,
        confirmPassword
      });
      setMsg(res.data.message || 'Password updated successfully. Please use your new password for future logins.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // Log out user after briefly showing success message
      setTimeout(() => logout(), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update password.');
    } finally {
      setBusy(false);
    }
  };

  const eyeBtnStyle = {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    color: '#64748B'
  };

  return (
    <div className="page">
      <div className="page-hd">
        <h1>Change Password</h1>
      </div>

      {msg && (
        <div style={{ padding: '12px', background: '#f0fdf4', color: '#166534', borderRadius: 8, marginBottom: 16, fontWeight: 600 }}>
          {msg}
        </div>
      )}

      {error && (
        <div style={{ padding: '12px', background: '#fef2f2', color: '#991b1b', borderRadius: 8, marginBottom: 16, fontWeight: 600 }}>
          {error}
        </div>
      )}

      <div className="card" style={{ maxWidth: 500 }}>
        <form onSubmit={handleUpdate}>
          <div className="field" style={{ marginBottom: 16 }}>
            <label>Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              required
            />
          </div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label>New Password</label>
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Min 6 characters, letters & numbers"
                required
                style={{ paddingRight: '40px' }}
              />
              <button 
                type="button" 
                onClick={() => setShowNewPassword(!showNewPassword)} 
                style={eyeBtnStyle} 
                tabIndex="-1"
                aria-label="Toggle password visibility"
                title={showNewPassword ? "Hide password" : "Show password"}
              >
                {showNewPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label>Confirm New Password</label>
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                style={{ paddingRight: '40px' }}
              />
              <button 
                type="button" 
                onClick={() => setShowConfirmPassword(!showConfirmPassword)} 
                style={eyeBtnStyle} 
                tabIndex="-1"
                aria-label="Toggle password visibility"
                title={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          {validationMsg && (
            <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: 16 }}>
              {validationMsg}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || !isFormValid || !!validationMsg}
          >
            {busy ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
