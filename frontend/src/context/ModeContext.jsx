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
    weekly_loss_limit: 2,
    monthly_loss_limit: 5, 
    hidden_models: [], 
    binned_models: [], 
    archived_models: [],
    model_order: []
  });

  useEffect(() => {
    localStorage.setItem('tjp_active_mode', mode);
  }, [mode]);

  const refreshData = async () => {
    if (!localStorage.getItem('tjp_token')) return;
    try {
      const [{ data: models }, { data: settings }] = await Promise.all([
        api.get('/custom-models'),
        api.get('/settings')
      ]);
      setCustomModels(models);
      setUserSettings(settings);
    } catch (err) {
      console.error("Failed to refresh data", err);
    }
  };

  useEffect(() => {
    localStorage.setItem('tjp_active_mode', mode);
  }, [mode]);

  useEffect(() => {
    refreshData();
  }, []);

  // ── Auto-update: poll /health every 5 min, reload if version changed ────────
  useEffect(() => {
    let knownVersion = null;

    const checkVersion = async () => {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.version) return;
        if (knownVersion === null) {
          knownVersion = data.version;          // store on first check
        } else if (knownVersion !== data.version) {
          window.location.reload(true);          // new deploy → hard reload
        }
      } catch (_) {
        // network unavailable — skip silently
      }
    };

    checkVersion();                             // immediate check on mount
    const id = setInterval(checkVersion, 5 * 60 * 1000); // then every 5 min
    return () => clearInterval(id);
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

  const restoreModel = async (m, forceReplace = false) => {
    try {
      const name = typeof m === 'string' ? m : m.name;
      const lowerName = name.toLowerCase();

      // Check for collision with an active model
      if (!forceReplace) {
        const isBuiltIn = lowerName === 'model 1' || lowerName === 'model 2';
        const isBuiltInActive = isBuiltIn && !(userSettings.hidden_models || []).includes(name);
        
        // Custom models that are not deleted and are not the one we're restoring
        const customActive = customModels.some(c => 
          c.name.toLowerCase() === lowerName && 
          !c.is_deleted && 
          (typeof m === 'string' || c._id !== m._id)
        );

        if (isBuiltInActive || customActive) {
          return 'COLLISION';
        }
      } else {
        // If forceReplace, delete the colliding active custom model (if any)
        const collidingCustom = customModels.find(c => 
          c.name.toLowerCase() === lowerName && 
          !c.is_deleted && 
          (typeof m === 'string' || c._id !== m._id)
        );
        if (collidingCustom) {
          await deleteModel(collidingCustom._id || collidingCustom.id);
        }

        // Also hide the built-in model if it was active
        const isBuiltIn = lowerName === 'model 1' || lowerName === 'model 2';
        if (isBuiltIn) {
          const currentlyHidden = userSettings.hidden_models || [];
          if (!currentlyHidden.includes(name)) {
            await updateSettings({
              ...userSettings,
              hidden_models: [...currentlyHidden, name]
            });
          }
        }
      }

      if (typeof m === 'string' || !m._id) { // Built-in name or historical
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
      updateSettings,
      refreshData
    }}>
      {children}
    </ModeContext.Provider>
  );
};
