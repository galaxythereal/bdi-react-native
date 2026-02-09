import { Theme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { isThisWeek, isToday, isYesterday, parseISO } from 'date-fns';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    SectionList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalization } from '../../src/context/LocalizationContext';
import { useNotifications } from '../../src/context/NotificationContext';
import { useTheme } from '../../src/context/ThemeContext';
import { EmptyNotifications, NotificationItem } from '../../src/features/notifications/NotificationComponents';

// Helper to group notifications
const groupNotificationsByDate = (notifications: any[], labels: { today: string; yesterday: string; thisWeek: string; older: string }) => {
    if (!notifications) return [];

    const today: any[] = [];
    const yesterday: any[] = [];
    const thisWeek: any[] = [];
    const older: any[] = [];

    notifications.forEach(notification => {
        const date = parseISO(notification.created_at);
        if (isToday(date)) {
            today.push(notification);
        } else if (isYesterday(date)) {
            yesterday.push(notification);
        } else if (isThisWeek(date)) {
            thisWeek.push(notification);
        } else {
            older.push(notification);
        }
    });

    const sections = [];
    if (today.length > 0) sections.push({ title: labels.today, data: today });
    if (yesterday.length > 0) sections.push({ title: labels.yesterday, data: yesterday });
    if (thisWeek.length > 0) sections.push({ title: labels.thisWeek, data: thisWeek });
    if (older.length > 0) sections.push({ title: labels.older, data: older });

    return sections;
};

export default function NotificationsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const { t, isRTL } = useLocalization();
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
            <View style={[
                styles.header,
                { backgroundColor: colors.surface, borderBottomColor: colors.border },
                Theme.shadows[isDark ? 'dark' : 'light'].sm,
                isRTL && { flexDirection: 'row-reverse' },
            ]}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.back()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color={colors.text} />
                </TouchableOpacity>

                <View style={[styles.headerCenter, isRTL && { flexDirection: 'row-reverse' }] }>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>{t.notifications}</Text>
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
                        {t.loadingNotifications}
                    </Text>
                </View>
            ) : (
                <SectionList
                    sections={groupNotificationsByDate(notifications, {
                        today: t.today,
                        yesterday: t.yesterday,
                        thisWeek: t.thisWeek,
                        older: t.older,
                    })}
                    renderItem={renderNotification}
                    renderSectionHeader={({ section: { title, data } }) => (
                        data.length > 0 ? (
                            <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
                                <Text style={[styles.sectionTitle, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>{title}</Text>
                            </View>
                        ) : null
                    )}
                    keyExtractor={keyExtractor}
                    contentContainerStyle={[
                        styles.listContent,
                        { paddingBottom: TAB_BAR_HEIGHT + Theme.spacing.lg },
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
                    stickySectionHeadersEnabled={false}
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
        paddingHorizontal: Theme.spacing.md,
        paddingVertical: Theme.spacing.sm,
        borderBottomWidth: 1,

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
        gap: Theme.spacing.xs,
    },
    headerTitle: {
        fontSize: Theme.fontSize.lg,
        fontFamily: 'Inter-SemiBold',
        fontWeight: Theme.fontWeight.semibold as any,
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
        fontWeight: Theme.fontWeight.bold as any,
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
        gap: Theme.spacing.md,
    },
    loadingText: {
        fontSize: Theme.fontSize.sm,
        fontFamily: 'Inter-Regular',
    },
    listContent: {
        paddingTop: Theme.spacing.xs,
    },
    emptyListContent: {
        flex: 1,
    },
    sectionHeader: {
        paddingHorizontal: Theme.spacing.md,
        paddingVertical: Theme.spacing.sm,
        paddingTop: Theme.spacing.lg,
    },
    sectionTitle: {
        fontSize: Theme.fontSize.sm,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
});
