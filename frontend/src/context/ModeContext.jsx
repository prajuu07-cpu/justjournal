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
  const [userSettings, setUserSettings] = useState({ 
    weekly_limit: 2, 
    monthly_loss_limit: 5, 
    hidden_models: [], 
    binned_models: [], 
    archived_models: [] 
  });

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
    const fetchSettings = async () => {
      try {
        const { data } = await api.get('/settings');
        setUserSettings(data);
      } catch (err) {
        console.error("Failed to fetch settings", err);
      }
    };
    fetchModels();
    fetchSettings();
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

  const restoreModel = async (m) => {
    try {
      if (typeof m === 'string' || !m._id) { // Built-in name or historical
        const name = typeof m === 'string' ? m : m.name;
        const newHidden = (userSettings.hidden_models || []).filter(h => h !== name);
        const newBinned = (userSettings.binned_models || []).filter(h => h !== name);
        const newArchived = (userSettings.archived_models || []).filter(h => h !== name);
        await updateSettings({ 
          ...userSettings, 
          hidden_models: newHidden, 
          binned_models: newBinned,
          archived_models: newArchived
        });
      } else {
        await api.post(`/custom-models/${m._id}/restore`);
        const { data } = await api.get('/custom-models');
        setCustomModels(data);
      }
      return true;
    } catch (err) {
      console.error("Restore failed", err);
      return false;
    }
  };

  const emptyBin = async () => {
    try {
      await api.delete('/custom-models/bin');
      // Ensure all binned models are also in hidden_models and archived
      const binned = userSettings.binned_models || [];
      const currentHidden = userSettings.hidden_models || [];
      const nextHidden = [...new Set([...currentHidden, ...binned])];
      const archived = [...new Set([...(userSettings.archived_models || []), ...binned])];
      
      await updateSettings({ 
        ...userSettings, 
        hidden_models: nextHidden, 
        binned_models: [], 
        archived_models: archived 
      });
      
      const { data } = await api.get('/custom-models');
      setCustomModels(data);
      return true;
    } catch (err) {
      console.error("Empty bin failed", err);
      return false;
    }
  };

  const updateSettings = async (newSettings) => {
    try {
      const { data } = await api.post('/settings', newSettings);
      // Use the data returned from server if possible to ensure we have all defaults
      const updated = { ...newSettings, ...data.settings }; 
      setUserSettings(prev => ({ ...prev, ...updated }));
      return true;
    } catch (err) {
      console.error("Failed to update settings", err);
      alert("Error updating settings: " + (err.response?.data?.error || "Unknown error"));
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
      deleteModel,
      restoreModel,
      emptyBin,
      userSettings,
      updateSettings
    }}>
      {children}
    </ModeContext.Provider>
  );
};
