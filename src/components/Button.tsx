import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, SHADOWS, SPACING } from '../lib/constants';
import { useTheme } from '../context/ThemeContext';

interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
    disabled?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    style?: any;
    textStyle?: any;
}

export const Button = ({
    title,
    onPress,
    variant = 'primary',
    size = 'md',
    isLoading = false,
    disabled = false,
    leftIcon,
    rightIcon,
    style,
    textStyle,
}: ButtonProps) => {
    const { colors } = useTheme();

    const getBackgroundColor = () => {
        if (disabled) return colors.border;
        if (variant === 'primary') return colors.primary;
        if (variant === 'secondary') return colors.secondary;
        if (variant === 'outline') return 'transparent';
        if (variant === 'ghost') return 'transparent';
        return colors.primary;
    };

    const getTextColor = () => {
        if (disabled) return colors.textTertiary;
        if (variant === 'primary') return colors.surface;
        if (variant === 'secondary') return colors.text;
        if (variant === 'outline') return colors.primary;
        if (variant === 'ghost') return colors.primary;
        return colors.surface;
    };

    const getBorderColor = () => {
        if (disabled) return colors.border;
        if (variant === 'outline') return colors.primary;
        return 'transparent';
    };

    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={onPress}
            disabled={disabled || isLoading}
            style={[
                styles.container,
                {
                    backgroundColor: getBackgroundColor(),
                    borderColor: getBorderColor(),
                    borderWidth: variant === 'outline' ? 1.5 : 0,
                    paddingVertical: size === 'sm' ? SPACING.sm : size === 'md' ? SPACING.md : SPACING.lg,
                    paddingHorizontal: size === 'sm' ? SPACING.md : size === 'md' ? SPACING.lg : SPACING.xl,
                    borderRadius: size === 'sm' ? BORDER_RADIUS.md : BORDER_RADIUS.lg,
                    ...(variant === 'primary' && !disabled ? SHADOWS.sm : {}),
                },
                style,
            ]}
        >
            {isLoading ? (
                <ActivityIndicator color={getTextColor()} />
            ) : (
                <View style={styles.content}>
                    {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
                    <Text
                        style={[
                            styles.text,
                            {
                                color: getTextColor(),
                                fontSize: size === 'sm' ? FONT_SIZE.sm : size === 'md' ? FONT_SIZE.md : FONT_SIZE.lg,
                                fontWeight: FONT_WEIGHT.bold,
                            },
                            textStyle,
                        ]}
                    >
                        {title}
                    </Text>
                    {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
                </View>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    text: {
        letterSpacing: 0.2,
    },
    iconLeft: {
        marginRight: 0,
    },
    iconRight: {
        marginLeft: 0,
    },
});
