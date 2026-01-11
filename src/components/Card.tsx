import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { BORDER_RADIUS, COLORS, SPACING } from '../lib/constants';

interface CardProps {
    children: React.ReactNode;
    style?: ViewStyle;
    variant?: 'elevated' | 'outlined' | 'flat';
    onPress?: () => void; // TODO: Implement touchable if needed
}

export const Card = ({ children, style, variant = 'elevated' }: CardProps) => {
    return (
        <View
            style={[
                styles.container,
                variant === 'elevated' && styles.elevated,
                variant === 'outlined' && styles.outlined,
                variant === 'flat' && styles.flat,
                style,
            ]}
        >
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.xl,
        padding: SPACING.lg + SPACING.sm,
    },
    elevated: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 3,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    outlined: {
        borderWidth: 1.5,
        borderColor: COLORS.border,
    },
    flat: {
        backgroundColor: COLORS.background,
    },
});
