import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BORDER_RADIUS, SPACING } from '../lib/constants';
import { useTheme } from '../context/ThemeContext';

interface CardProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    variant?: 'elevated' | 'outlined' | 'flat';
    onPress?: () => void; // TODO: Implement touchable if needed
}

export const Card = ({ children, style, variant = 'elevated' }: CardProps) => {
    const { colors, isDark } = useTheme();
    
    return (
        <View
            style={[
                styles.container,
                { backgroundColor: colors.surface },
                variant === 'elevated' && [
                    styles.elevated,
                    { 
                        borderColor: colors.borderLight,
                        shadowOpacity: isDark ? 0.3 : 0.08,
                    }
                ],
                variant === 'outlined' && [styles.outlined, { borderColor: colors.border }],
                variant === 'flat' && { backgroundColor: colors.background },
                style,
            ]}
        >
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: BORDER_RADIUS.xl,
        padding: SPACING.lg + SPACING.sm,
    },
    elevated: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 16,
        elevation: 3,
        borderWidth: 1,
    },
    outlined: {
        borderWidth: 1.5,
    },
});
