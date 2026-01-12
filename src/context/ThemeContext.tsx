import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeColors {
    // Primary - Warm Burgundy with emotional depth
    primary: string;
    primaryLight: string;
    primaryDark: string;
    
    // Secondary - Warm Gold
    secondary: string;
    secondaryLight: string;
    secondaryDark: string;
    
    // Backgrounds
    background: string;
    backgroundSecondary: string;
    backgroundTertiary: string;
    
    // Surfaces
    surface: string;
    surfaceElevated: string;
    surfaceSubtle: string;
    
    // Text
    text: string;
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    textInverse: string;
    
    // Borders
    border: string;
    borderLight: string;
    borderSubtle: string;
    
    // Semantic
    error: string;
    success: string;
    warning: string;
    info: string;
    
    // Accents
    accent: string;
    accentLight: string;
    
    // Status Bar
    statusBar: 'light' | 'dark';
}

interface ThemeContextType {
    theme: ThemeMode;
    isDark: boolean;
    colors: ThemeColors;
    setTheme: (theme: ThemeMode) => void;
    toggleTheme: () => void;
}

const lightColors: ThemeColors = {
    primary: '#8B1538',
    primaryLight: '#B01E4A',
    primaryDark: '#6B0F28',
    
    secondary: '#D4AF37',
    secondaryLight: '#E5C158',
    secondaryDark: '#B8941F',
    
    background: '#FAFAFA',
    backgroundSecondary: '#F5F5F7',
    backgroundTertiary: '#F0F0F2',
    
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceSubtle: '#FEFEFE',
    
    text: '#0A0A0A',
    textPrimary: '#1A1A1A',
    textSecondary: '#6B6B6B',
    textTertiary: '#9B9B9B',
    textInverse: '#FFFFFF',
    
    border: '#E8E8E8',
    borderLight: '#F2F2F2',
    borderSubtle: '#F8F8F8',
    
    error: '#E63946',
    success: '#2A9D8F',
    warning: '#F77F00',
    info: '#219EBC',
    
    accent: '#8B1538',
    accentLight: '#A01E4A',
    
    statusBar: 'dark',
};

const darkColors: ThemeColors = {
    primary: '#C92A5A',
    primaryLight: '#E03D6E',
    primaryDark: '#8B1538',
    
    secondary: '#E5C158',
    secondaryLight: '#F5D88A',
    secondaryDark: '#D4AF37',
    
    background: '#0D0D0F',
    backgroundSecondary: '#141416',
    backgroundTertiary: '#1A1A1E',
    
    surface: '#1E1E22',
    surfaceElevated: '#252529',
    surfaceSubtle: '#2A2A2F',
    
    text: '#F5F5F5',
    textPrimary: '#E8E8E8',
    textSecondary: '#A0A0A0',
    textTertiary: '#707070',
    textInverse: '#0A0A0A',
    
    border: '#2E2E34',
    borderLight: '#3A3A42',
    borderSubtle: '#242428',
    
    error: '#FF6B6B',
    success: '#4ECDC4',
    warning: '#FFB347',
    info: '#64B5F6',
    
    accent: '#C92A5A',
    accentLight: '#E03D6E',
    
    statusBar: 'light',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@bdi_theme_mode';

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const systemColorScheme = useColorScheme();
    const [theme, setThemeState] = useState<ThemeMode>('system');
    const [isLoaded, setIsLoaded] = useState(false);

    // Load saved theme on mount
    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        try {
            const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
            if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
                setThemeState(savedTheme as ThemeMode);
            }
        } catch (error) {
            console.error('Error loading theme:', error);
        } finally {
            setIsLoaded(true);
        }
    };

    const setTheme = async (newTheme: ThemeMode) => {
        try {
            await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
            setThemeState(newTheme);
        } catch (error) {
            console.error('Error saving theme:', error);
        }
    };

    const toggleTheme = () => {
        if (theme === 'light') {
            setTheme('dark');
        } else if (theme === 'dark') {
            setTheme('system');
        } else {
            setTheme('light');
        }
    };

    // Determine if dark mode based on theme setting
    const isDark = theme === 'dark' || (theme === 'system' && systemColorScheme === 'dark');
    const colors = isDark ? darkColors : lightColors;

    return (
        <ThemeContext.Provider value={{ theme, isDark, colors, setTheme, toggleTheme }}>
            <StatusBar style={colors.statusBar} />
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = (): ThemeContextType => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

// Export color types for use in components
export type { ThemeColors, ThemeMode };
export { lightColors, darkColors };
