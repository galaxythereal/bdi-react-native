import { Theme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useRef, useState } from 'react';
import {
    Animated,
    StyleSheet,
    Text,
    TextInput,
    TextInputProps,
    TouchableOpacity,
    View,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface InputProps extends Omit<TextInputProps, 'style'> {
    label?: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    secureTextEntry?: boolean;
    error?: string;
    hint?: string;
    leftIcon?: keyof typeof Ionicons.glyphMap;
    rightIcon?: keyof typeof Ionicons.glyphMap;
    onRightIconPress?: () => void;
    disabled?: boolean;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'default' | 'filled' | 'outline';
    containerStyle?: any;
    inputStyle?: any;
}

export const Input = ({
    label,
    value,
    onChangeText,
    placeholder,
    secureTextEntry: initialSecureEntry,
    error,
    hint,
    leftIcon,
    rightIcon,
    onRightIconPress,
    disabled = false,
    size = 'md',
    variant = 'default',
    autoCapitalize = 'none',
    keyboardType = 'default',
    containerStyle,
    inputStyle,
    ...rest
}: InputProps) => {
    const { colors } = useTheme();
    const [isFocused, setIsFocused] = useState(false);
    const [isSecure, setIsSecure] = useState(initialSecureEntry);
    const focusAnim = useRef(new Animated.Value(0)).current;
    const inputRef = useRef<TextInput>(null);

    const handleFocus = useCallback(() => {
        setIsFocused(true);
        Animated.spring(focusAnim, {
            toValue: 1,
            tension: 80,
            friction: 10,
            useNativeDriver: false,
        }).start();
    }, [focusAnim]);

    const handleBlur = useCallback(() => {
        setIsFocused(false);
        Animated.spring(focusAnim, {
            toValue: 0,
            tension: 80,
            friction: 10,
            useNativeDriver: false,
        }).start();
    }, [focusAnim]);

    const toggleSecure = () => {
        setIsSecure(!isSecure);
    };

    const getInputHeight = () => {
        switch (size) {
            case 'sm': return 44;
            case 'lg': return 60;
            default: return 52;
        }
    };

    const getFontSize = () => {
        switch (size) {
            case 'sm': return Theme.fontSize.sm;
            case 'lg': return Theme.fontSize.lg;
            default: return Theme.fontSize.base;
        }
    };

    const borderColor = focusAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [
            error ? colors.error : colors.border,
            error ? colors.error : colors.primary
        ],
    });

    const shadowOpacity = focusAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.15],
    });

    const borderWidth = focusAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1.5, 2],
    });

    return (
        <View style={[styles.container, containerStyle]}>
            {label && (
                <Text style={[
                    styles.label,
                    { color: colors.text },
                    error && { color: colors.error },
                    isFocused && { color: colors.primary },
                ]}>
                    {label}
                </Text>
            )}

            <Animated.View
                style={[
                    styles.inputWrapper,
                    { backgroundColor: colors.surface },
                    variant === 'filled' && { backgroundColor: colors.backgroundSecondary, borderColor: 'transparent' },
                    variant === 'outline' && { backgroundColor: 'transparent' },
                    {
                        borderColor,
                        borderWidth,
                        shadowOpacity,
                        shadowColor: error ? colors.error : colors.primary,
                        shadowOffset: { width: 0, height: isFocused ? 4 : 0 },
                        shadowRadius: isFocused ? 12 : 0,
                        elevation: isFocused ? 3 : 0,
                    },
                    disabled && { backgroundColor: colors.backgroundSecondary, opacity: 0.6 },
                ]}
            >
                {leftIcon && (
                    <View style={styles.iconLeft}>
                        <Ionicons
                            name={leftIcon}
                            size={20}
                            color={isFocused ? colors.primary : colors.textSecondary}
                        />
                    </View>
                )}

                <TextInput
                    ref={inputRef}
                    style={[
                        styles.input,
                        { color: colors.text },
                        {
                            height: getInputHeight(),
                            fontSize: getFontSize(),
                        },
                        leftIcon && styles.inputWithLeftIcon,
                        (rightIcon || initialSecureEntry) && styles.inputWithRightIcon,
                        disabled && { color: colors.textTertiary },
                        inputStyle,
                    ]}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textSecondary}
                    secureTextEntry={isSecure}
                    autoCapitalize={autoCapitalize}
                    keyboardType={keyboardType}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    editable={!disabled}
                    {...rest}
                />

                {initialSecureEntry && (
                    <TouchableOpacity
                        style={styles.iconRight}
                        onPress={toggleSecure}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons
                            name={isSecure ? 'eye-outline' : 'eye-off-outline'}
                            size={20}
                            color={colors.textSecondary}
                        />
                    </TouchableOpacity>
                )}

                {rightIcon && !initialSecureEntry && (
                    <TouchableOpacity
                        style={styles.iconRight}
                        onPress={onRightIconPress}
                        disabled={!onRightIconPress}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons
                            name={rightIcon}
                            size={20}
                            color={colors.textSecondary}
                        />
                    </TouchableOpacity>
                )}
            </Animated.View>

            {(error || hint) && (
                <View style={styles.helperContainer}>
                    {error ? (
                        <View style={styles.errorContainer}>
                            <Ionicons name="alert-circle" size={14} color={colors.error} />
                            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                        </View>
                    ) : hint ? (
                        <Text style={[styles.hintText, { color: colors.textSecondary }]}>{hint}</Text>
                    ) : null}
                </View>
            )}
        </View>
    );
};

// Search Input variant
interface SearchInputProps {
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    onClear?: () => void;
    onSubmit?: () => void;
    containerStyle?: any;
}

export const SearchInput: React.FC<SearchInputProps> = ({
    value,
    onChangeText,
    placeholder = 'Search...',
    onClear,
    onSubmit,
    containerStyle,
}) => {
    const { colors } = useTheme();

    const handleClear = () => {
        onChangeText('');
        onClear?.();
    };

    return (
        <View style={[styles.searchContainer, { backgroundColor: colors.backgroundSecondary }, containerStyle]}>
            <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.textSecondary}
                returnKeyType="search"
                onSubmitEditing={onSubmit}
            />
            {value.length > 0 && (
                <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
                    <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: Theme.spacing.lg,
    },
    label: {
        fontSize: Theme.fontSize.sm,
        fontWeight: Theme.fontWeight.semibold,
        marginBottom: Theme.spacing.sm,
        letterSpacing: 0.2,
    },
    labelError: {
        color: Theme.colors.light.error,
    },
    labelFocused: {
        color: Theme.colors.light.primary,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Theme.colors.light.surface,
        borderRadius: Theme.borderRadius.lg,
        overflow: 'hidden',
    },
    inputWrapperFilled: {
        backgroundColor: Theme.colors.light.backgroundSecondary,
        borderColor: 'transparent',
    },
    inputWrapperOutline: {
        backgroundColor: 'transparent',
    },
    inputWrapperDisabled: {
        backgroundColor: Theme.colors.light.backgroundSecondary,
        opacity: 0.6,
    },
    input: {
        flex: 1,
        paddingHorizontal: Theme.spacing.lg,
        fontSize: Theme.fontSize.base,
        fontWeight: Theme.fontWeight.normal,
    },
    inputWithLeftIcon: {
        paddingLeft: Theme.spacing.sm,
    },
    inputWithRightIcon: {
        paddingRight: Theme.spacing.sm,
    },
    inputDisabled: {
        color: Theme.colors.light.textSecondary,
    },
    iconLeft: {
        paddingLeft: Theme.spacing.md,
    },
    iconRight: {
        paddingRight: Theme.spacing.md,
    },
    helperContainer: {
        marginTop: Theme.spacing.xs,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.xs,
    },
    errorText: {
        fontSize: Theme.fontSize.xs,
        fontWeight: Theme.fontWeight.medium,
    },
    hintText: {
        fontSize: Theme.fontSize.xs,
        fontWeight: Theme.fontWeight.normal,
    },
    // Search Input styles
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Theme.colors.light.backgroundSecondary,
        borderRadius: Theme.borderRadius.lg,
        paddingHorizontal: Theme.spacing.md,
        height: 48,
    },
    searchIcon: {
        marginRight: Theme.spacing.sm,
    },
    searchInput: {
        flex: 1,
        fontSize: Theme.fontSize.base,
        height: '100%',
    },
    clearButton: {
        padding: Theme.spacing.xs,
    },
});
