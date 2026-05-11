import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

type Theme = 'light' | 'dark' | 'auto';

// 6 Functional Colors based on Page4 design system
interface FunctionalColors {
  primary: string;      // Hauptfarbe - CTAs, aktive Elemente, Navigation
  secondary: string;    // Akzentfarbe - Sekundäre Buttons, Filter, Highlights
  success: string;      // Erfolg - Bestätigungen, Checkboxes, positive Aktionen
  warning: string;      // Warnung - Achtung-Hinweise, wichtige Benachrichtigungen
  danger: string;        // Fehler/Gefahr - Fehlermeldungen, Löschen-Buttons
  neutral: string;      // Neutral - Hintergründe, Text, Rahmen
}

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  colors: ColorScheme;
  functionalColors: FunctionalColors;
  setFunctionalColors: (colors: FunctionalColors) => void;
}

interface ColorScheme {
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  subText: string;
  border: string;
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  muted: string;
  input: string;
}

// Default functional colors (Page4 inspired)
const defaultFunctionalColors: FunctionalColors = {
  primary: '#488fe0',     // Blau
  secondary: '#8B5CF6',   // Lila
  success: '#34C759',     // Grün
  warning: '#FF9500',     // Orange
  danger: '#FF3B30',      // Rot
  neutral: '#6B7280',     // Grau
};

const lightColors: ColorScheme = {
  background: '#f8f9fa',
  card: '#ffffff',
  text: '#333333',
  textSecondary: '#666666',
  subText: '#999999',
  border: '#e9ecef',
  primary: '#007AFF',
  secondary: '#8B5CF6',
  success: '#34C759',
  warning: '#FF9500',
  danger: '#FF3B30',
  info: '#5AC8FA',
  muted: '#adb5bd',
  input: '#f0f2f5',
};

const darkColors: ColorScheme = {
  background: '#000000',
  card: '#1c1c1e',
  text: '#ffffff',
  textSecondary: '#98989d',
  subText: '#636366',
  border: '#38383a',
  primary: '#0A84FF',
  secondary: '#A78BFA',
  success: '#30D158',
  warning: '#FF9F0A',
  danger: '#FF453A',
  info: '#64D2FF',
  muted: '#636366',
  input: '#2c2c2e',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [theme, setThemeState] = useState<Theme>('auto');
  const [isDark, setIsDark] = useState(systemColorScheme === 'dark');
  const [functionalColors, setFunctionalColorsState] = useState<FunctionalColors>(defaultFunctionalColors);

  useEffect(() => {
    loadTheme();
    loadFunctionalColors();
  }, []);

  useEffect(() => {
    if (theme === 'auto') {
      setIsDark(systemColorScheme === 'dark');
    } else {
      setIsDark(theme === 'dark');
    }
  }, [theme, systemColorScheme]);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('app_theme');
      if (savedTheme) {
        setThemeState(savedTheme as Theme);
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    }
  };

  const loadFunctionalColors = async () => {
    try {
      const savedColors = await AsyncStorage.getItem('functional_colors');
      if (savedColors) {
        setFunctionalColorsState(JSON.parse(savedColors));
      }
    } catch (error) {
      console.error('Error loading functional colors:', error);
    }
  };

  const setTheme = async (newTheme: Theme) => {
    try {
      await AsyncStorage.setItem('app_theme', newTheme);
      setThemeState(newTheme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const setFunctionalColors = async (colors: FunctionalColors) => {
    try {
      await AsyncStorage.setItem('functional_colors', JSON.stringify(colors));
      setFunctionalColorsState(colors);
    } catch (error) {
      console.error('Error saving functional colors:', error);
    }
  };

  const toggleTheme = () => {
    const newTheme = isDark ? 'light' : 'dark';
    setTheme(newTheme);
  };

  // functionalColors (admin-configurable in Settings) override the static
  // light/dark palette for semantic roles (primary, secondary, etc.) so that
  // the brand colour applies consistently across both themes.
  const baseColors = isDark ? darkColors : lightColors;
  const colors: ColorScheme = {
    ...baseColors,
    primary: functionalColors.primary,
    secondary: functionalColors.secondary,
    success: functionalColors.success,
    warning: functionalColors.warning,
    danger: functionalColors.danger,
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, setTheme, colors, functionalColors, setFunctionalColors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
