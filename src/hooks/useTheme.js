import { useState, useEffect } from 'react';
import { getStorage, setStorage } from '../utils/storage';

const THEME_KEY = 'accounting_theme';
const DEFAULT_THEME = 'nightsakura';

export const THEMES = [
  { id: 'nightsakura', name: '夜樱', color: '#f2b5c8' },
  { id: 'inkgold',     name: '墨金', color: '#d4b078' },
  { id: 'deepsea',     name: '深海', color: '#6cc4e8' },
  { id: 'moss',        name: '苔',   color: '#a8cc88' },
  { id: 'dawn',        name: '拂晓', color: '#c88a7a' },
  { id: 'frostmoon',   name: '霜月', color: '#7a9eb8' },
  { id: 'cloudpaper',  name: '云笺', color: '#a088b8' },
  { id: 'whitepeach',  name: '白桃', color: '#d4889e' },
];

export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    const saved = getStorage(THEME_KEY, DEFAULT_THEME);
    return THEMES.some(t => t.id === saved) ? saved : DEFAULT_THEME;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    setStorage(THEME_KEY, theme);
  }, [theme]);

  const setTheme = (id) => {
    if (THEMES.some(t => t.id === id)) {
      setThemeState(id);
    }
  };

  return { theme, setTheme, themes: THEMES };
}
