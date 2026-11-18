import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getStorage, setStorage } from '../utils/storage';

// 只是界面偏好，不属于记录数据，也不进备份
const PREFS_KEY = 'accounting_prefs';

const DEFAULT_PREFS = {
  // 去向滚轮在左还是在右：'left' | 'right'
  railSide: 'left',
};

function normalizePrefs(value) {
  const prefs = value && typeof value === 'object' ? value : {};
  return {
    railSide: prefs.railSide === 'right' ? 'right' : 'left',
  };
}

export function usePrefs() {
  const [prefs, setPrefs] = useState(() => normalizePrefs(getStorage(PREFS_KEY, DEFAULT_PREFS)));

  useEffect(() => {
    setStorage(PREFS_KEY, prefs);
  }, [prefs]);

  const updatePrefs = useCallback((patch) => {
    setPrefs((current) => normalizePrefs({ ...current, ...patch }));
  }, []);

  return { prefs, updatePrefs };
}

export const PrefsContext = createContext(DEFAULT_PREFS);

export function usePrefsContext() {
  return useContext(PrefsContext);
}
