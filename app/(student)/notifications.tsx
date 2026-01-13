import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications } from '../../src/context/NotificationContext';
import { useTheme } from '../../src/context/ThemeContext';
import { NotificationItem, EmptyNotifications } from '../../src/features/notifications/NotificationComponents';
import { BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, SHADOWS, SPACING } from '../../src/lib/constants';

export default function NotificationsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const {
        notifications,
        unreadCount,
        isLoading,
        refresh,
        markAsRead,
        markAllAsRead,
        removeNotification,
    } = useNotifications();
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await refresh();
        setRefreshing(false);
    }, [refresh]);

    const handleNotificationPress = useCallback(async (notification: any) => {
        // Mark as read when pressed
        if (!notification.read) {
            await markAsRead(notification.id);
        }

        // Navigate based on notification type/action_url
        if (notification.action_url) {
            // Parse and navigate to action_url
            const url = notification.action_url;
            if (url.startsWith('/course/')) {
                const courseId = url.replace('/course/', '');
                router.push(`/course/${courseId}`);
            } else if (url.includes('certificate')) {
                router.push('/(student)/certificates');
            } else if (url.includes('support')) {
                router.push('/(student)/support');
            }
        }
    }, [markAsRead, router]);

    const handleMarkAllRead = useCallback(async () => {
        if (unreadCount > 0) {
            await markAllAsRead();
        }
    }, [unreadCount, markAllAsRead]);

    const renderNotification = useCallback(({ item }: { item: any }) => (
        <NotificationItem
            notification={item}
            onPress={() => handleNotificationPress(item)}
            onMarkAsRead={() => markAsRead(item.id)}
            onDelete={() => removeNotification(item.id)}
        />
    ), [handleNotificationPress, markAsRead, removeNotification]);

    const keyExtractor = useCallback((item: any) => item.id, []);

    // Calculate bottom padding for tab bar
    const TAB_BAR_HEIGHT = 56 + Math.max(insets.bottom, 24);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <TouchableOpacity 
                    style={styles.backButton}
                    onPress={() => router.back()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                
                <View style={styles.headerCenter}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
                    {unreadCount > 0 && (
                        <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                            <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                        </View>
                    )}
                </View>

                {unreadCount > 0 ? (
                    <TouchableOpacity 
                        style={styles.markAllButton}
                        onPress={handleMarkAllRead}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="checkmark-done" size={22} color={colors.primary} />
                    </TouchableOpacity>
                ) : (
                    <View style={styles.placeholder} />
                )}
            </View>

            {/* Content */}
            {isLoading && notifications.length === 0 ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                        Loading notifications...
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    renderItem={renderNotification}
                    keyExtractor={keyExtractor}
                    contentContainerStyle={[
                        styles.listContent,
                        { paddingBottom: TAB_BAR_HEIGHT + SPACING.lg },
                        notifications.length === 0 && styles.emptyListContent,
                    ]}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={colors.primary}
                            colors={[colors.primary]}
                        />
                    }
                    ListEmptyComponent={<EmptyNotifications />}
                    showsVerticalScrollIndicator={false}
                    ItemSeparatorComponent={() => (
                        <View style={[styles.separator, { backgroundColor: colors.border }]} />
                    )}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderBottomWidth: 1,
        ...SHADOWS.sm,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerCenter: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.xs,
    },
    headerTitle: {
        fontSize: FONT_SIZE.lg,
        fontFamily: 'Inter-SemiBold',
        fontWeight: FONT_WEIGHT.semibold as any,
    },
    unreadBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        minWidth: 20,
        alignItems: 'center',
    },
    unreadBadgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontFamily: 'Inter-Bold',
        fontWeight: FONT_WEIGHT.bold as any,
    },
    markAllButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholder: {
        width: 40,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.md,
    },
    loadingText: {
        fontSize: FONT_SIZE.sm,
        fontFamily: 'Inter-Regular',
    },
    listContent: {
        paddingTop: SPACING.xs,
    },
    emptyListContent: {
        flex: 1,
    },
    separator: {
        height: 1,
        marginLeft: SPACING.lg + 48, // Align with content after icon
    },
});
