// 2026 Design System - Warm, Emotional, Minimalist
export const COLORS = {
    // Primary - Warm Burgundy with emotional depth
    primary: '#8B1538', // Warmer, more vibrant burgundy
    primaryLight: '#B01E4A', // Lighter, warmer tone
    primaryDark: '#6B0F28', // Deeper, richer dark
    primaryGradient: ['#8B1538', '#A01E4A'], // Gradient for modern feel
    
    // Secondary - Warm Gold
    secondary: '#D4AF37', // Warmer gold
    secondaryLight: '#E5C158', // Softer gold
    secondaryDark: '#B8941F', // Deeper gold
    
    // Backgrounds - Airy and spacious
    background: '#FAFAFA', // Softer, warmer white
    backgroundSecondary: '#F5F5F7', // Subtle variation
    backgroundTertiary: '#F0F0F2', // Even softer
    
    // Surfaces - Clean and elevated
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceSubtle: '#FEFEFE',
    
    // Text - Better hierarchy
    text: '#0A0A0A', // Softer black
    textPrimary: '#1A1A1A',
    textSecondary: '#6B6B6B', // Warmer gray
    textTertiary: '#9B9B9B', // Softer gray
    textInverse: '#FFFFFF',
    
    // Borders - Subtle and refined
    border: '#E8E8E8', // Softer border
    borderLight: '#F2F2F2', // Very light
    borderSubtle: '#F8F8F8', // Almost invisible
    
    // Semantic colors - Warm and friendly
    error: '#E63946', // Warmer red
    success: '#2A9D8F', // Teal green
    warning: '#F77F00', // Warm orange
    info: '#219EBC', // Friendly blue
    
    // Accents
    accent: '#8B1538',
    accentLight: '#A01E4A',
};

export const SPACING = {
    xs: 6,
    sm: 12,
    md: 20,
    lg: 28,
    xl: 40,
    xxl: 56,
    xxxl: 80,
};

export const FONT_SIZE = {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 18,
    xl: 22,
    xxl: 28,
    xxxl: 36,
    display: 44,
};

export const FONT_WEIGHT = {
    light: '300' as '300',
    regular: '400' as '400',
    medium: '500' as '500',
    semibold: '600' as '600',
    bold: '700' as '700',
    extrabold: '800' as '800',
    black: '900' as '900',
};

export const BORDER_RADIUS = {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    xxl: 32,
    round: 9999,
};

export const SHADOWS = {
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 8,
    },
    xl: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 12,
    },
};
