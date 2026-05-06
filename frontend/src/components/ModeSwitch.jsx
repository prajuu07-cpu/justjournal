import { useMode } from '../context/ModeContext';
import { useNavigate } from 'react-router-dom';
import '../styles/mode_switch.css';

export default function ModeSwitch() {
  const { mode, switchMode } = useMode();
  const nav = useNavigate();

  const handleSwitch = (newMode) => {
    if (newMode !== mode) {
      switchMode(newMode);
      nav('/');
    }
  };

  return (
    <div className="mode-switch-container">
      <div className="mode-toggle">
        <button 
          className={`mode-btn ${mode === 'justchill' ? 'active' : ''}`}
          onClick={() => handleSwitch('justchill')}
        >
          Journal
        </button>
        <button 
          className={`mode-btn ${mode === 'practice' ? 'active' : ''}`}
          onClick={() => handleSwitch('practice')}
        >
          Practice
        </button>
        <div className={`mode-slider ${mode === 'practice' ? 'slide' : ''}`} />
      </div>
    </div>
  );
}
