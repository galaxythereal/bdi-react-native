import { Ionicons } from '@expo/vector-icons';
import React, { useState, useRef, useCallback } from 'react';
import { 
    StyleSheet, 
    Text, 
    TextInput, 
    View, 
    TouchableOpacity,
    Animated,
    TextInputProps,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { BORDER_RADIUS, COLORS, FONT_SIZE, FONT_WEIGHT, SHADOWS, SPACING } from '../lib/constants';

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
            case 'sm': return FONT_SIZE.sm;
            case 'lg': return FONT_SIZE.lg;
            default: return FONT_SIZE.md;
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
        outputRange: [0, 0.1],
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
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    variant === 'filled' && { backgroundColor: colors.backgroundSecondary, borderColor: 'transparent' },
                    variant === 'outline' && { backgroundColor: 'transparent' },
                    {
                        borderColor,
                        shadowOpacity,
                        shadowColor: error ? colors.error : colors.primary,
                        shadowOffset: { width: 0, height: 2 },
                        shadowRadius: 8,
                        elevation: isFocused ? 2 : 0,
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
                    placeholderTextColor={colors.textTertiary}
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
                placeholderTextColor={colors.textTertiary}
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
        marginBottom: SPACING.lg,
    },
    label: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.semibold,
        color: COLORS.text,
        marginBottom: SPACING.sm,
        letterSpacing: 0.2,
    },
    labelError: {
        color: COLORS.error,
    },
    labelFocused: {
        color: COLORS.primary,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        borderRadius: BORDER_RADIUS.lg,
        overflow: 'hidden',
    },
    inputWrapperFilled: {
        backgroundColor: COLORS.backgroundSecondary,
        borderColor: 'transparent',
    },
    inputWrapperOutline: {
        backgroundColor: 'transparent',
    },
    inputWrapperDisabled: {
        backgroundColor: COLORS.backgroundSecondary,
        opacity: 0.6,
    },
    input: {
        flex: 1,
        paddingHorizontal: SPACING.lg,
        fontSize: FONT_SIZE.md,
        color: COLORS.text,
        fontWeight: FONT_WEIGHT.regular,
    },
    inputWithLeftIcon: {
        paddingLeft: SPACING.sm,
    },
    inputWithRightIcon: {
        paddingRight: SPACING.sm,
    },
    inputDisabled: {
        color: COLORS.textTertiary,
    },
    iconLeft: {
        paddingLeft: SPACING.md,
    },
    iconRight: {
        paddingRight: SPACING.md,
    },
    helperContainer: {
        marginTop: SPACING.xs,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },
    errorText: {
        color: COLORS.error,
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.medium,
    },
    hintText: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.regular,
    },
    // Search Input styles
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.backgroundSecondary,
        borderRadius: BORDER_RADIUS.lg,
        paddingHorizontal: SPACING.md,
        height: 48,
    },
    searchIcon: {
        marginRight: SPACING.sm,
    },
    searchInput: {
        flex: 1,
        fontSize: FONT_SIZE.md,
        color: COLORS.text,
        height: '100%',
    },
    clearButton: {
        padding: SPACING.xs,
    },
});
