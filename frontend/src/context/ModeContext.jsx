import React, { createContext, useContext, useState, useEffect } from 'react';

const ModeContext = createContext();

export const useMode = () => useContext(ModeContext);

export const ModeProvider = ({ children }) => {
  const [mode, setMode] = useState(() => {
    return localStorage.getItem('tjp_active_mode') || 'justchill';
  });

  useEffect(() => {
    localStorage.setItem('tjp_active_mode', mode);
  }, [mode]);

  const switchMode = (newMode) => {
    localStorage.setItem('tjp_active_mode', newMode);
    setMode(newMode);
  };

  return (
    <ModeContext.Provider value={{ mode, switchMode }}>
      {children}
    </ModeContext.Provider>
  );
};
