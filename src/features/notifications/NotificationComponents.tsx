import React, { useCallback, useRef } from 'react';
import { 
    Animated, 
    StyleSheet, 
    Text, 
    TouchableOpacity, 
    View,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTheme } from '../../context/ThemeContext';
import { 
    Notification, 
    getNotificationIcon, 
    getNotificationColor,
    formatNotificationTime 
} from './notificationService';
import { BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, SHADOWS, SPACING } from '../../lib/constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface NotificationItemProps {
    notification: Notification;
    onPress: (notification: Notification) => void;
    onMarkAsRead: (id: string) => void;
    onDelete: (id: string) => void;
    index?: number;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
    notification,
    onPress,
    onMarkAsRead,
    onDelete,
    index = 0,
}) => {
    const { colors, isDark } = useTheme();
    const swipeableRef = useRef<Swipeable>(null);
    const animatedValue = useRef(new Animated.Value(0)).current;

    // Animate on mount
    React.useEffect(() => {
        Animated.spring(animatedValue, {
            toValue: 1,
            delay: index * 50,
            tension: 80,
            friction: 12,
            useNativeDriver: true,
        }).start();
    }, [index]);

    const iconName = getNotificationIcon(notification.type) as keyof typeof Ionicons.glyphMap;
    const iconColor = getNotificationColor(notification.type);
    const timeAgo = formatNotificationTime(notification.created_at);

    const handlePress = useCallback(() => {
        if (!notification.read) {
            onMarkAsRead(notification.id);
        }
        onPress(notification);
    }, [notification, onPress, onMarkAsRead]);

    const renderRightActions = (
        progress: Animated.AnimatedInterpolation<number>,
        dragX: Animated.AnimatedInterpolation<number>
    ) => {
        const translateX = dragX.interpolate({
            inputRange: [-160, 0],
            outputRange: [0, 160],
            extrapolate: 'clamp',
        });

        const opacity = progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 1],
        });

        return (
            <Animated.View 
                style={[
                    styles.rightActions, 
                    { transform: [{ translateX }], opacity }
                ]}
            >
                {!notification.read && (
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: colors.info }]}
                        onPress={() => {
                            swipeableRef.current?.close();
                            onMarkAsRead(notification.id);
                        }}
                    >
                        <Ionicons name="checkmark" size={22} color="#FFF" />
                        <Text style={styles.actionText}>Read</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.error }]}
                    onPress={() => {
                        swipeableRef.current?.close();
                        onDelete(notification.id);
                    }}
                >
                    <Ionicons name="trash-outline" size={22} color="#FFF" />
                    <Text style={styles.actionText}>Delete</Text>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    const scale = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0.95, 1],
    });

    const translateY = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [20, 0],
    });

    return (
        <Animated.View
            style={{
                transform: [{ scale }, { translateY }],
                opacity: animatedValue,
            }}
        >
            <Swipeable
                ref={swipeableRef}
                renderRightActions={renderRightActions}
                friction={2}
                rightThreshold={40}
                overshootRight={false}
            >
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handlePress}
                    style={[
                        styles.container,
                        {
                            backgroundColor: notification.read 
                                ? colors.surface 
                                : isDark 
                                    ? colors.surfaceElevated 
                                    : colors.backgroundSecondary,
                            borderLeftColor: notification.read ? 'transparent' : iconColor,
                            borderLeftWidth: notification.read ? 0 : 3,
                        },
                    ]}
                >
                    {/* Icon */}
                    <View style={[styles.iconContainer, { backgroundColor: iconColor + '15' }]}>
                        <Ionicons name={iconName} size={24} color={iconColor} />
                    </View>

                    {/* Content */}
                    <View style={styles.content}>
                        <View style={styles.header}>
                            <Text 
                                style={[
                                    styles.title, 
                                    { 
                                        color: colors.text,
                                        fontWeight: notification.read ? '500' : '700',
                                    }
                                ]}
                                numberOfLines={1}
                            >
                                {notification.title}
                            </Text>
                            <Text style={[styles.time, { color: colors.textTertiary }]}>
                                {timeAgo}
                            </Text>
                        </View>
                        <Text 
                            style={[
                                styles.message, 
                                { 
                                    color: notification.read ? colors.textTertiary : colors.textSecondary 
                                }
                            ]}
                            numberOfLines={2}
                        >
                            {notification.message}
                        </Text>
                    </View>

                    {/* Unread indicator */}
                    {!notification.read && (
                        <View style={[styles.unreadDot, { backgroundColor: iconColor }]} />
                    )}
                </TouchableOpacity>
            </Swipeable>
        </Animated.View>
    );
};

// Notification Badge Component (for header/tab)
interface NotificationBadgeProps {
    count: number;
    size?: 'small' | 'medium';
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({ 
    count, 
    size = 'small' 
}) => {
    const { colors } = useTheme();
    
    if (count === 0) return null;

    const displayCount = count > 99 ? '99+' : count.toString();
    const isSmall = size === 'small';

    return (
        <View 
            style={[
                styles.badge,
                {
                    backgroundColor: colors.error,
                    minWidth: isSmall ? 16 : 20,
                    height: isSmall ? 16 : 20,
                    borderRadius: isSmall ? 8 : 10,
                    paddingHorizontal: isSmall ? 4 : 6,
                },
            ]}
        >
            <Text 
                style={[
                    styles.badgeText,
                    { fontSize: isSmall ? 10 : 12 },
                ]}
            >
                {displayCount}
            </Text>
        </View>
    );
};

// Notification Bell Button Component
interface NotificationBellProps {
    count: number;
    onPress: () => void;
    color?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
    count,
    onPress,
    color,
}) => {
    const { colors } = useTheme();
    const scaleAnim = useRef(new Animated.Value(1)).current;

    // Pulse animation when count changes
    React.useEffect(() => {
        if (count > 0) {
            Animated.sequence([
                Animated.timing(scaleAnim, {
                    toValue: 1.2,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 3,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [count]);

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            style={styles.bellContainer}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <Ionicons 
                    name={count > 0 ? 'notifications' : 'notifications-outline'} 
                    size={24} 
                    color={color || colors.text} 
                />
                {count > 0 && (
                    <View style={styles.bellBadge}>
                        <NotificationBadge count={count} size="small" />
                    </View>
                )}
            </Animated.View>
        </TouchableOpacity>
    );
};

// Empty State Component
interface EmptyNotificationsProps {
    title?: string;
    message?: string;
}

export const EmptyNotifications: React.FC<EmptyNotificationsProps> = ({
    title = 'No notifications',
    message = "You're all caught up! We'll notify you when something new happens.",
}) => {
    const { colors, isDark } = useTheme();

    return (
        <View style={styles.emptyContainer}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.backgroundTertiary }]}>
                <Ionicons 
                    name="notifications-off-outline" 
                    size={48} 
                    color={colors.textTertiary} 
                />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.emptyMessage, { color: colors.textTertiary }]}>{message}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
        marginHorizontal: SPACING.md,
        marginVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.lg,
        ...SHADOWS.sm,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: BORDER_RADIUS.full,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.md,
    },
    content: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    title: {
        fontSize: FONT_SIZE.md,
        fontFamily: 'Inter-SemiBold',
        flex: 1,
        marginRight: SPACING.sm,
    },
    time: {
        fontSize: FONT_SIZE.xs,
        fontFamily: 'Inter-Regular',
    },
    message: {
        fontSize: FONT_SIZE.sm,
        fontFamily: 'Inter-Regular',
        lineHeight: 18,
    },
    unreadDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginLeft: SPACING.sm,
    },
    rightActions: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: SPACING.md,
    },
    actionButton: {
        width: 70,
        height: '85%',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: BORDER_RADIUS.md,
        marginLeft: SPACING.xs,
    },
    actionText: {
        color: '#FFF',
        fontSize: FONT_SIZE.xs,
        fontFamily: 'Inter-Medium',
        marginTop: 2,
    },
    badge: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeText: {
        color: '#FFF',
        fontFamily: 'Inter-Bold',
    },
    bellContainer: {
        position: 'relative',
        padding: SPACING.xs,
    },
    bellBadge: {
        position: 'absolute',
        top: -2,
        right: -2,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.xxl,
    },
    emptyIcon: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.lg,
    },
    emptyTitle: {
        fontSize: FONT_SIZE.lg,
        fontFamily: 'Inter-SemiBold',
        marginBottom: SPACING.sm,
        textAlign: 'center',
    },
    emptyMessage: {
        fontSize: FONT_SIZE.md,
        fontFamily: 'Inter-Regular',
        textAlign: 'center',
        lineHeight: 22,
    },
});
