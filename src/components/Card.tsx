import React from 'react';
import { StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { BORDER_RADIUS, SHADOWS, SPACING } from '../lib/constants';
import { useTheme } from '../context/ThemeContext';

interface CardProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    variant?: 'elevated' | 'outlined' | 'flat';
    onPress?: () => void;
}

export const Card = ({ children, style, variant = 'elevated', onPress }: CardProps) => {
    const { colors, isDark } = useTheme();
    
    const CardComponent = onPress ? TouchableOpacity : View;
    const cardProps = onPress ? { activeOpacity: 0.95, onPress } : {};
    
    return (
        <CardComponent
            {...cardProps}
            style={[
                styles.container,
                { backgroundColor: colors.surface },
                variant === 'elevated' && [
                    styles.elevated,
                    { 
                        borderColor: colors.borderLight,
                        shadowColor: isDark ? '#000' : '#000',
                        shadowOpacity: isDark ? 0.5 : 0.08,
                    }
                ],
                variant === 'outlined' && [styles.outlined, { borderColor: colors.border }],
                variant === 'flat' && { backgroundColor: colors.background },
                style,
            ]}
        >
            {children}
        </CardComponent>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: BORDER_RADIUS.xl,
        padding: SPACING.lg + SPACING.sm,
    },
    elevated: {
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 20,
        elevation: 4,
        borderWidth: 1,
    },
    outlined: {
        borderWidth: 1.5,
    },
});
