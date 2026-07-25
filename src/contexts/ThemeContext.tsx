import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => Promise<void>;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, userProfile } = useAuth();
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('mamas_theme') as ThemeMode;
    if (saved && ['light', 'dark', 'system'].includes(saved)) {
      return saved;
    }
    return 'system';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  // Sync theme preference from user profile if available
  useEffect(() => {
    if (userProfile?.themePreference && userProfile.themePreference !== theme) {
      setThemeState(userProfile.themePreference);
      localStorage.setItem('mamas_theme', userProfile.themePreference);
    }
  }, [userProfile?.themePreference]);

  // Compute resolved theme
  useEffect(() => {
    const root = document.documentElement;
    let effectiveTheme: 'light' | 'dark' = 'light';

    if (theme === 'system') {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      effectiveTheme = systemDark ? 'dark' : 'light';
    } else {
      effectiveTheme = theme;
    }

    setResolvedTheme(effectiveTheme);

    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    localStorage.setItem('mamas_theme', theme);
  }, [theme]);

  // Listen to system media change if system theme is selected
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const effectiveTheme = e.matches ? 'dark' : 'light';
      setResolvedTheme(effectiveTheme);
      const root = document.documentElement;
      if (e.matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const setTheme = async (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem('mamas_theme', newTheme);

    // Save to Firestore if user is logged in
    if (currentUser) {
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
          themePreference: newTheme,
          updatedAt: Date.now()
        });
      } catch (err) {
        console.error("Error saving theme preference to Firestore:", err);
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
