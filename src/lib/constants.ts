// 2026 Design System - Modern, Clean, Professional
export const COLORS = {
    // Primary - Vibrant Red
    primary: '#db0011', // Vibrant red
    primaryLight: '#ff2d42', // Lighter red for hover states
    primaryDark: '#b0000e', // Deeper red for active states
    primaryGradient: ['#db0011', '#ff2d42'], // Gradient for modern feel
    
    // Secondary - Warm Gold
    secondary: '#D4AF37', // Warmer gold
    secondaryLight: '#E5C158', // Softer gold
    secondaryDark: '#B8941F', // Deeper gold
    
    // Backgrounds - Clean and modern
    background: '#FFFFFF', // Pure white
    backgroundSecondary: '#F8F9FA', // Subtle gray
    backgroundTertiary: '#F1F3F5', // Light gray
    
    // Surfaces - Clean and elevated
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceSubtle: '#FEFEFE',
    
    // Text - Better hierarchy
    text: '#0F0F0F', // Near black
    textPrimary: '#1A1A1A',
    textSecondary: '#6B7280', // Medium gray
    textTertiary: '#9CA3AF', // Light gray
    textInverse: '#FFFFFF',
    
    // Borders - Subtle and refined
    border: '#E5E7EB', // Light border
    borderLight: '#F3F4F6', // Very light
    borderSubtle: '#F9FAFB', // Almost invisible
    
    // Semantic colors - Warm and friendly
    error: '#E63946', // Warmer red
    success: '#2A9D8F', // Teal green
    warning: '#F77F00', // Warm orange
    info: '#219EBC', // Friendly blue
    
    // Accents
    accent: '#db0011',
    accentLight: '#ff2d42',
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
    full: 9999,
    round: 9999,
};

export const SHADOWS = {
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 4,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 8,
    },
    xl: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 28,
        elevation: 12,
    },
};
