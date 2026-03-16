import React from 'react';
import { useMode } from '../context/ModeContext';
import '../styles/mode_switch.css';

export default function ModeSwitch() {
  const { mode, switchMode } = useMode();

  return (
    <div className="mode-switch-container">
      <div className="mode-toggle">
        <button 
          className={`mode-btn ${mode === 'justchill' ? 'active' : ''}`}
          onClick={() => switchMode('justchill')}
        >
          JustChill
        </button>
        <button 
          className={`mode-btn ${mode === 'practice' ? 'active' : ''}`}
          onClick={() => switchMode('practice')}
        >
          Practice
        </button>
        <div className={`mode-slider ${mode === 'practice' ? 'slide' : ''}`} />
      </div>
    </div>
  );
}
