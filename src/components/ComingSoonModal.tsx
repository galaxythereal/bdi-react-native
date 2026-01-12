import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../context/ThemeContext';
import { BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, SHADOWS, SPACING } from '../lib/constants';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ComingSoonModalProps {
    visible: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    icon?: keyof typeof Ionicons.glyphMap;
    estimatedDate?: string;
}

export const ComingSoonModal: React.FC<ComingSoonModalProps> = ({
    visible,
    onClose,
    title = 'Coming Soon',
    description = "We're working hard to bring you this feature. Stay tuned for updates!",
    icon = 'rocket-outline',
    estimatedDate,
}) => {
    const { colors, isDark } = useTheme();
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const bounceAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            // Reset animations
            scaleAnim.setValue(0.8);
            opacityAnim.setValue(0);
            bounceAnim.setValue(0);

            // Animate in
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    tension: 100,
                    friction: 8,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                // Bounce the icon
                Animated.loop(
                    Animated.sequence([
                        Animated.timing(bounceAnim, {
                            toValue: -8,
                            duration: 600,
                            useNativeDriver: true,
                        }),
                        Animated.timing(bounceAnim, {
                            toValue: 0,
                            duration: 600,
                            useNativeDriver: true,
                        }),
                    ])
                ).start();
            });
        }
    }, [visible]);

    const handleClose = () => {
        Animated.parallel([
            Animated.timing(scaleAnim, {
                toValue: 0.8,
                duration: 150,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }),
        ]).start(onClose);
    };

    const dynamicStyles = {
        overlay: {
            backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.6)',
        },
        modalContent: {
            backgroundColor: colors.surface,
            borderColor: colors.border,
        },
        iconContainer: {
            backgroundColor: colors.primary + '15',
        },
        title: {
            color: colors.text,
        },
        description: {
            color: colors.textSecondary,
        },
        dateContainer: {
            backgroundColor: colors.backgroundSecondary,
            borderColor: colors.border,
        },
        dateText: {
            color: colors.textTertiary,
        },
        button: {
            backgroundColor: colors.primary,
        },
        closeButton: {
            backgroundColor: colors.backgroundSecondary,
        },
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={handleClose}
        >
            <TouchableOpacity
                style={[styles.overlay, dynamicStyles.overlay]}
                activeOpacity={1}
                onPress={handleClose}
            >
                <Animated.View
                    style={[
                        styles.modalContainer,
                        {
                            opacity: opacityAnim,
                            transform: [{ scale: scaleAnim }],
                        },
                    ]}
                >
                    <TouchableOpacity activeOpacity={1}>
                        <View style={[styles.modalContent, dynamicStyles.modalContent]}>
                            {/* Close button */}
                            <TouchableOpacity
                                style={[styles.closeButton, dynamicStyles.closeButton]}
                                onPress={handleClose}
                            >
                                <Ionicons name="close" size={20} color={colors.textSecondary} />
                            </TouchableOpacity>

                            {/* Animated icon */}
                            <Animated.View
                                style={[
                                    styles.iconContainer,
                                    dynamicStyles.iconContainer,
                                    { transform: [{ translateY: bounceAnim }] },
                                ]}
                            >
                                <Ionicons name={icon} size={48} color={colors.primary} />
                            </Animated.View>

                            {/* Sparkles decoration */}
                            <View style={styles.sparklesContainer}>
                                <Ionicons name="sparkles" size={16} color={colors.secondary} style={styles.sparkle1} />
                                <Ionicons name="sparkles" size={12} color={colors.primary} style={styles.sparkle2} />
                                <Ionicons name="sparkles" size={14} color={colors.secondary} style={styles.sparkle3} />
                            </View>

                            {/* Title */}
                            <Text style={[styles.title, dynamicStyles.title]}>{title}</Text>

                            {/* Description */}
                            <Text style={[styles.description, dynamicStyles.description]}>
                                {description}
                            </Text>

                            {/* Estimated date */}
                            {estimatedDate && (
                                <View style={[styles.dateContainer, dynamicStyles.dateContainer]}>
                                    <Ionicons name="calendar-outline" size={16} color={colors.textTertiary} />
                                    <Text style={[styles.dateText, dynamicStyles.dateText]}>
                                        Expected: {estimatedDate}
                                    </Text>
                                </View>
                            )}

                            {/* Features list */}
                            <View style={styles.featuresList}>
                                <FeatureItem
                                    icon="notifications-outline"
                                    text="Get notified when it's ready"
                                    colors={colors}
                                />
                                <FeatureItem
                                    icon="flash-outline"
                                    text="Early access for active users"
                                    colors={colors}
                                />
                            </View>

                            {/* Action button */}
                            <TouchableOpacity
                                style={[styles.button, dynamicStyles.button]}
                                onPress={handleClose}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.buttonText}>Got it!</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </Animated.View>
            </TouchableOpacity>
        </Modal>
    );
};

interface FeatureItemProps {
    icon: keyof typeof Ionicons.glyphMap;
    text: string;
    colors: any;
}

const FeatureItem: React.FC<FeatureItemProps> = ({ icon, text, colors }) => (
    <View style={styles.featureItem}>
        <View style={[styles.featureIcon, { backgroundColor: colors.success + '15' }]}>
            <Ionicons name={icon} size={14} color={colors.success} />
        </View>
        <Text style={[styles.featureText, { color: colors.textSecondary }]}>{text}</Text>
    </View>
);

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.lg,
    },
    modalContainer: {
        width: '100%',
        maxWidth: 360,
    },
    modalContent: {
        borderRadius: BORDER_RADIUS.xl,
        padding: SPACING.xl,
        alignItems: 'center',
        borderWidth: 1,
        ...SHADOWS.xl,
    },
    closeButton: {
        position: 'absolute',
        top: SPACING.md,
        right: SPACING.md,
        width: 32,
        height: 32,
        borderRadius: BORDER_RADIUS.full,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: BORDER_RADIUS.full,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.lg,
        marginTop: SPACING.md,
    },
    sparklesContainer: {
        position: 'absolute',
        top: SPACING.xl,
        width: '100%',
        height: 100,
        alignItems: 'center',
    },
    sparkle1: {
        position: 'absolute',
        top: 10,
        left: '20%',
    },
    sparkle2: {
        position: 'absolute',
        top: 30,
        right: '15%',
    },
    sparkle3: {
        position: 'absolute',
        top: 60,
        left: '25%',
    },
    title: {
        fontSize: FONT_SIZE.xxl,
        fontWeight: FONT_WEIGHT.bold,
        marginBottom: SPACING.sm,
        textAlign: 'center',
    },
    description: {
        fontSize: FONT_SIZE.md,
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: SPACING.lg,
    },
    dateContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.full,
        borderWidth: 1,
        marginBottom: SPACING.lg,
    },
    dateText: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.medium,
    },
    featuresList: {
        width: '100%',
        marginBottom: SPACING.lg,
        gap: SPACING.sm,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    featureIcon: {
        width: 28,
        height: 28,
        borderRadius: BORDER_RADIUS.full,
        justifyContent: 'center',
        alignItems: 'center',
    },
    featureText: {
        fontSize: FONT_SIZE.sm,
        flex: 1,
    },
    button: {
        width: '100%',
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        alignItems: 'center',
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
    },
});

export default ComingSoonModal;
