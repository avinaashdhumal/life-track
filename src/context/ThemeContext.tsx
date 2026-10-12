import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { useColorScheme as useNativeColorScheme } from 'react-native';
import tw from 'twrnc';
import { storageService } from '../services/StorageService';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  bg: string;
  bgHeader: string;
  card: string;
  cardSecondary: string;
  cardHover: string;
  border: string;
  borderLight: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textSubtle: string;
  inputBg: string;
  inputBorder: string;
  tabBarBg: string;
  tabBarBorder: string;
  badgeBg: string;
  primary: string;
  primaryBg: string;
  primaryBorder: string;
  primaryText: string;
  statusBarStyle: 'light-content' | 'dark-content';
  statusBarBg: string;
}

const darkColors: ThemeColors = {
  bg: '#09090b', // zinc-950
  bgHeader: '#18181b', // zinc-900
  card: '#18181b', // zinc-900
  cardSecondary: '#27272a', // zinc-800
  cardHover: '#3f3f46', // zinc-700
  border: '#27272a', // zinc-800
  borderLight: '#3f3f46', // zinc-700
  borderStrong: '#52525b', // zinc-600
  text: '#ffffff',
  textSecondary: '#e4e4e7', // zinc-200
  textMuted: '#a1a1aa', // zinc-400
  textSubtle: '#71717a', // zinc-500
  inputBg: '#18181b', // zinc-900
  inputBorder: '#27272a', // zinc-800
  tabBarBg: '#09090b', // zinc-950
  tabBarBorder: '#27272a', // zinc-800
  badgeBg: '#27272a', // zinc-800
  primary: '#6366f1', // indigo-500
  primaryBg: 'rgba(99, 102, 241, 0.15)',
  primaryBorder: 'rgba(99, 102, 241, 0.3)',
  primaryText: '#818cf8', // indigo-400
  statusBarStyle: 'light-content',
  statusBarBg: '#09090b'
};

const lightColors: ThemeColors = {
  bg: '#f8fafc', // slate-50
  bgHeader: '#ffffff', // white
  card: '#ffffff', // white
  cardSecondary: '#f1f5f9', // slate-100
  cardHover: '#e2e8f0', // slate-200
  border: '#e2e8f0', // slate-200
  borderLight: '#cbd5e1', // slate-300
  borderStrong: '#94a3b8', // slate-400
  text: '#0f172a', // slate-900
  textSecondary: '#334155', // slate-700
  textMuted: '#475569', // slate-600 (accessible contrast > 4.5:1)
  textSubtle: '#64748b', // slate-500
  inputBg: '#ffffff', // white
  inputBorder: '#cbd5e1', // slate-300
  tabBarBg: '#ffffff', // white
  tabBarBorder: '#e2e8f0', // slate-200
  badgeBg: '#f1f5f9', // slate-100
  primary: '#4f46e5', // indigo-600
  primaryBg: 'rgba(99, 102, 241, 0.12)',
  primaryBorder: 'rgba(99, 102, 241, 0.3)',
  primaryText: '#4338ca', // indigo-700
  statusBarStyle: 'dark-content',
  statusBarBg: '#ffffff'
};

interface ThemeContextValue {
  themeMode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  themeMode: 'dark',
  isDark: true,
  colors: darkColors,
  toggleTheme: () => {},
  setThemeMode: () => {}
});


export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const systemColorScheme = useNativeColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    // 1. Check storageService synchronous memory cache (immediate on render)
    const cachedSetting = storageService.getSyncSetting('themeMode');
    if (cachedSetting && ['light', 'dark', 'system'].includes(cachedSetting)) {
      return cachedSetting;
    }
    return 'dark'; // Default to dark as per existing theme
  });

  // Async hydration from persistent phone storage (AsyncStorage)
  useEffect(() => {
    storageService.getSettings().then((settings) => {
      if (settings.themeMode && ['light', 'dark', 'system'].includes(settings.themeMode)) {
        setThemeModeState(settings.themeMode);
      }
    }).catch(() => {
      // Ignore initial hydration errors
    });
  }, []);

  const isDark = useMemo(() => {
    if (themeMode === 'system') {
      return systemColorScheme === 'light' ? false : true;
    }
    return themeMode === 'dark';
  }, [themeMode, systemColorScheme]);

  useEffect(() => {
    try {
      const twAny = tw as unknown as { setColorScheme?: (scheme: 'light' | 'dark') => void };
      if (typeof twAny.setColorScheme === 'function') {
        twAny.setColorScheme(isDark ? 'dark' : 'light');
      }
    } catch {
      // ignore
    }
  }, [isDark]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    // Persist to phone persistent storage
    storageService.updateSettings({ themeMode: mode }).catch((err) => {
      console.warn('[ThemeContext] Failed to persist themeMode:', err);
    });
  };

  const toggleTheme = () => {
    setThemeMode(isDark ? 'light' : 'dark');
  };

  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        isDark,
        colors,
        toggleTheme,
        setThemeMode
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
