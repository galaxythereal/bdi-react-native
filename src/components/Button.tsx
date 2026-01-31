import { Theme } from '@/constants/theme';
import React, { useRef } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
    const { colors, isDark } = useTheme();
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const getBackgroundColor = () => {
        if (disabled) return colors.primaryDisabled || colors.border;
        if (variant === 'primary') return colors.primary;
        if (variant === 'secondary') return colors.accent;
        if (variant === 'outline') return 'transparent';
        if (variant === 'ghost') return 'transparent';
        return colors.primary;
    };

    const getTextColor = () => {
        if (disabled) return colors.textDisabled;
        if (variant === 'primary') return colors.textOnPrimary;
        if (variant === 'secondary') return colors.textOnAccent;
        if (variant === 'outline') return colors.primary;
        if (variant === 'ghost') return colors.primary;
        return colors.surface;
    };

    const getBorderColor = () => {
        if (disabled) return colors.border;
        if (variant === 'outline') return colors.primary;
        return 'transparent';
    };

    const handlePressIn = () => {
        if (!disabled && !isLoading) {
            Animated.spring(scaleAnim, {
                toValue: 0.96,
                useNativeDriver: true,
                tension: 300,
                friction: 20,
            }).start();
        }
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 300,
            friction: 20,
        }).start();
    };

    const getShadowStyle = () => {
        if (disabled) return {};
        const shadows = isDark ? Theme.shadows.dark : Theme.shadows.light;
        if (variant === 'primary') return shadows.md;
        if (variant === 'secondary') return shadows.sm;
        return {};
    };

    return (
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
                activeOpacity={1}
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={disabled || isLoading}
                style={[
                    styles.container,
                    {
                        backgroundColor: getBackgroundColor(),
                        borderColor: getBorderColor(),
                        borderWidth: variant === 'outline' ? 1.5 : 0,
                        paddingVertical: size === 'sm' ? Theme.spacing.sm : size === 'md' ? Theme.spacing.base : Theme.spacing.lg,
                        paddingHorizontal: size === 'sm' ? Theme.spacing.md : size === 'md' ? Theme.spacing.lg : Theme.spacing.xl,
                        borderRadius: size === 'sm' ? Theme.borderRadius.md : Theme.borderRadius.lg,
                        opacity: disabled ? 0.6 : 1,
                        ...getShadowStyle(),
                    },
                    style,
                ]}
            >
                {isLoading ? (
                    <ActivityIndicator color={getTextColor()} size="small" />
                ) : (
                    <View style={styles.content}>
                        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
                        <Text
                            style={[
                                styles.text,
                                {
                                    color: getTextColor(),
                                    fontSize: size === 'sm' ? Theme.fontSize.sm : size === 'md' ? Theme.fontSize.base : Theme.fontSize.lg,
                                    fontWeight: Theme.fontWeight.semibold,
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
        </Animated.View>
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
        gap: Theme.spacing.sm,
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
