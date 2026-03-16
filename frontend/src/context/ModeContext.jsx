import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const ModeContext = createContext();

export const useMode = () => useContext(ModeContext);

export const ModeProvider = ({ children }) => {
  const [mode, setMode] = useState(() => {
    return localStorage.getItem('tjp_active_mode') || 'justchill';
  });

  const [practiceDefaults, setPracticeDefaults] = useState({ pair: '', risk: '', date: '' });
  const [customModels, setCustomModels] = useState([]);

  useEffect(() => {
    localStorage.setItem('tjp_active_mode', mode);
  }, [mode]);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const { data } = await api.get('/custom-models');
        setCustomModels(data);
      } catch (err) {
        console.error("Failed to fetch models", err);
      }
    };
    fetchModels();
  }, []);

  const switchMode = (newMode) => {
    localStorage.setItem('tjp_active_mode', newMode);
    setMode(newMode);
  };

  const updatePracticeDefaults = (newData) => {
    setPracticeDefaults(prev => ({ ...prev, ...newData }));
  };

  const addModel = (model) => {
    setCustomModels(prev => [...prev, model]);
  };

  const deleteModel = async (id) => {
    try {
      if (id.length > 10) { // Backend ID
        await api.delete(`/custom-models/${id}`);
      }
      setCustomModels(prev => prev.filter(m => m._id !== id && m.id !== id));
      return true;
    } catch (err) {
      console.error("Delete failed", err);
      return false;
    }
  };

  return (
    <ModeContext.Provider value={{ 
      mode, 
      switchMode, 
      practiceDefaults, 
      updatePracticeDefaults,
      customModels,
      addModel,
      deleteModel
    }}>
      {children}
    </ModeContext.Provider>
  );
};
