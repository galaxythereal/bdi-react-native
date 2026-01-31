import { Platform } from 'react-native';

const tintColorLight = '#db0011';
const tintColorDark = '#ff2d42';

// Base palette
const palette = {
  primary: {
    main: '#db0011',
    light: '#ff2d42',
    dark: '#b0000e',
    subtle: '#fff0f1',
  },
  secondary: {
    main: '#D4AF37',
    light: '#E5C158',
    dark: '#B8941F',
    subtle: '#fff9e6',
  },
  neutral: {
    white: '#FFFFFF',
    black: '#000000',
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
    950: '#030712',
  },
  semantic: {
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },
};

export interface ThemeColors {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  primarySubtle: string;
  primaryDisabled: string;

  secondary: string;
  secondaryLight: string;
  secondaryDark: string;

  // Semantic
  accent: string;
  tint: string;

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
  textDisabled: string;
  textOnPrimary: string;
  textOnAccent: string;

  // Borders
  border: string;
  borderLight: string;
  borderSubtle: string;

  // Icons
  icon: string;
  iconSecondary: string;
  tabIconDefault: string;
  tabIconSelected: string;

  // Status
  error: string;
  success: string;
  warning: string;
  info: string;
  link: string;

  // Tab Bar
  tabBackground: string;
  tabBorder: string;

  // Misc
  statusBar: 'light' | 'dark';
}

const lightColors: ThemeColors = {
  primary: palette.primary.main,
  primaryLight: palette.primary.light,
  primaryDark: palette.primary.dark,
  primarySubtle: palette.primary.subtle,
  primaryDisabled: '#f87171', // Light red for disabled state

  secondary: palette.secondary.main,
  secondaryLight: palette.secondary.light,
  secondaryDark: palette.secondary.dark,

  accent: palette.primary.main,
  tint: tintColorLight,

  background: palette.neutral.white,
  backgroundSecondary: palette.neutral[50], // Very light gray
  backgroundTertiary: palette.neutral[100],

  surface: palette.neutral.white,
  surfaceElevated: palette.neutral.white,
  surfaceSubtle: palette.neutral[50],

  text: palette.neutral[900],
  textPrimary: palette.neutral[900],
  textSecondary: palette.neutral[500],
  textTertiary: palette.neutral[400],
  textInverse: palette.neutral.white,
  textDisabled: palette.neutral[300],
  textOnPrimary: palette.neutral.white,
  textOnAccent: palette.neutral.white,

  border: palette.neutral[200],
  borderLight: palette.neutral[100],
  borderSubtle: palette.neutral[50],

  icon: palette.neutral[600],
  iconSecondary: palette.neutral[400],
  tabIconDefault: palette.neutral[400],
  tabIconSelected: tintColorLight,

  error: palette.semantic.error,
  success: palette.semantic.success,
  warning: palette.semantic.warning,
  info: palette.semantic.info,
  link: palette.semantic.info,

  tabBackground: palette.neutral.white,
  tabBorder: palette.neutral[200],

  statusBar: 'dark',
};

const darkColors: ThemeColors = {
  primary: tintColorDark, // Brighter red for dark mode
  // primaryLight: '#ff6666',
  primaryLight: '#db0011',
  primaryDark: '#db0011',
  primarySubtle: '#3c0005', // Very dark red
  primaryDisabled: '#7f1d1d', // Dark red for disabled state

  secondary: palette.secondary.light, // Brighter gold
  secondaryLight: '#F5D88A',
  secondaryDark: palette.secondary.main,

  accent: tintColorDark,
  tint: tintColorDark,

  background: '#0d0d0d', // Deep black
  backgroundSecondary: '#171717', // Slightly lighter
  backgroundTertiary: '#262626',

  surface: '#171717',
  surfaceElevated: '#262626',
  surfaceSubtle: '#1f1f1f',

  text: '#EDEDED', // High contrast off-white
  textPrimary: '#EDEDED',
  textSecondary: '#A1A1A1',
  textTertiary: '#737373',
  textInverse: '#171717',
  textDisabled: '#525252',
  textOnPrimary: '#FFFFFF',
  textOnAccent: '#171717',

  border: '#333333',
  borderLight: '#404040',
  borderSubtle: '#262626',

  icon: '#9BA1A6',
  iconSecondary: '#737373',
  tabIconDefault: '#737373',
  tabIconSelected: tintColorDark,

  error: '#f87171', // Lighter red
  success: '#4ade80', // Lighter green
  warning: '#fbbf24',
  info: '#60a5fa',
  link: '#60a5fa',

  tabBackground: '#0d0d0d',
  tabBorder: '#333333',

  statusBar: 'light',
};

export const Colors = {
  light: lightColors,
  dark: darkColors,
};

export type ColorScheme = 'light' | 'dark';

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
};

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  full: 9999,
  round: 9999,
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
});

export const FontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
  '6xl': 60,
};

export const FontWeight = {
  thin: '100' as '100',
  extralight: '200' as '200',
  light: '300' as '300',
  normal: '400' as '400',
  medium: '500' as '500',
  semibold: '600' as '600',
  bold: '700' as '700',
  extrabold: '800' as '800',
  black: '900' as '900',
};

export const Shadows = {
  light: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 10,
    },
  },
  dark: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 4,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 10,
      elevation: 10,
    },
  },
};

// Typography presets mapping
const Typography = {
  display: {
    d1: { fontSize: FontSize['6xl'], fontWeight: FontWeight.bold, lineHeight: FontSize['6xl'] * 1.2 },
    d2: { fontSize: FontSize['5xl'], fontWeight: FontWeight.bold, lineHeight: FontSize['5xl'] * 1.2 },
  },
  heading: {
    h1: { fontSize: FontSize['4xl'], fontWeight: FontWeight.bold, lineHeight: FontSize['4xl'] * 1.2 },
    h2: { fontSize: FontSize['3xl'], fontWeight: FontWeight.bold, lineHeight: FontSize['3xl'] * 1.2 },
    h3: { fontSize: FontSize['2xl'], fontWeight: FontWeight.semibold, lineHeight: FontSize['2xl'] * 1.3 },
    h4: { fontSize: FontSize.xl, fontWeight: FontWeight.semibold, lineHeight: FontSize.xl * 1.3 },
  },
  body: {
    large: { fontSize: FontSize.lg, fontWeight: FontWeight.normal, lineHeight: FontSize.lg * 1.5 },
    medium: { fontSize: FontSize.base, fontWeight: FontWeight.normal, lineHeight: FontSize.base * 1.5 },
    small: { fontSize: FontSize.sm, fontWeight: FontWeight.normal, lineHeight: FontSize.sm * 1.5 },
  },
  label: {
    large: { fontSize: FontSize.base, fontWeight: FontWeight.medium, lineHeight: FontSize.base * 1.4 },
    medium: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, lineHeight: FontSize.sm * 1.4 },
    small: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, lineHeight: FontSize.xs * 1.4 },
  },
};

// Unified Theme Object
export const Theme = {
  colors: Colors,
  spacing: Spacing,
  borderRadius: BorderRadius,
  typography: Typography,
  fontSize: FontSize,
  fontWeight: FontWeight,
  shadows: Shadows,
  fonts: Fonts,
};

export default Theme;