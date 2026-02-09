import { Theme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Linking,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalization } from '../../src/context/LocalizationContext';
import { useTheme } from '../../src/context/ThemeContext';
import { fetchMyBatches, fetchUpcomingLiveSessions } from '../../src/features/diplomas/diplomaService';
import { Batch, LiveSession } from '../../src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Helper to format date/time and relative labels
const getTimeUntil = (dateString: string, t: any, formatNumber?: (value: number) => string): string => {
    const now = new Date();
    const sessionDate = new Date(dateString);
    const diff = sessionDate.getTime() - now.getTime();

    if (diff < 0) return t?.started || 'Started';

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    const formatValue = (value: number) => (formatNumber ? formatNumber(value) : value.toString());

    if (days > 0) return `${t?.in || 'In'} ${formatValue(days)} ${t?.days || 'days'}`;
    if (hours > 0) return `${t?.in || 'In'} ${formatValue(hours)} ${t?.hours || 'hours'}`;
    if (minutes > 0) return `${t?.in || 'In'} ${formatValue(minutes)} ${t?.minutes || 'minutes'}`;
    return t?.startingNow || 'Starting now';
};

// Session Card Component
interface SessionCardProps {
    session: LiveSession;
    index: number;
    onJoin: () => void;
}

const SessionCard: React.FC<SessionCardProps> = ({ session, index, onJoin }) => {
    const { colors, isDark } = useTheme();
    const { t, formatDate, formatTime, getLocalizedText, formatNumber } = useLocalization();
    const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
    const cardAnim = useRef(new Animated.Value(0)).current;
    const sessionDate = new Date(session.scheduled_at);
    const date = formatDate(sessionDate, { weekday: 'short', month: 'short', day: 'numeric' });
    const time = formatTime(sessionDate, { hour: 'numeric', minute: '2-digit', hour12: true });
    const isToday = new Date().toDateString() === sessionDate.toDateString();
    const isTomorrow = new Date(Date.now() + 86400000).toDateString() === sessionDate.toDateString();
    const isLive = session.status === 'live';

    useEffect(() => {
        Animated.spring(cardAnim, {
            toValue: 1,
            delay: index * 60,
            tension: 80,
            friction: 10,
            useNativeDriver: true,
        }).start();
    }, []);

    const getPlatformIcon = (platform: string): keyof typeof Ionicons.glyphMap => {
        switch (platform) {
            case 'zoom': return 'videocam';
            case 'google_meet': return 'logo-google';
            case 'teams': return 'people';
            default: return 'videocam';
        }
    };

    const getPlatformColor = (platform: string): string => {
        switch (platform) {
            case 'zoom': return '#2D8CFF';
            case 'google_meet': return '#00897B';
            case 'teams': return '#5558AF';
            default: return colors.primary;
        }
    };

    return (
        <Animated.View
            style={[
                styles.sessionCard,
                {
                    transform: [{ scale: cardAnim }],
                    opacity: cardAnim,
                },
                isLive && styles.sessionCardLive,
            ]}
        >
            <TouchableOpacity
                onPress={session.meeting_url ? onJoin : undefined}
                activeOpacity={session.meeting_url ? 0.8 : 1}
                style={styles.sessionCardContent}
            >
                {/* Live Indicator */}
                {isLive && (
                    <View style={styles.liveIndicator}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveText}>{t.liveNow}</Text>
                    </View>
                )}

                {/* Date/Time Section */}
                <View style={styles.dateTimeSection}>
                    <View style={styles.dateBox}>
                        <Text style={styles.dayText}>
                            {isToday ? t.today : isTomorrow ? t.tomorrow : date}
                        </Text>
                        <Text style={styles.timeText}>{time}</Text>
                    </View>
                    <View style={[styles.timeUntilBadge, isLive && styles.timeUntilBadgeLive]}>
                        <Text style={[styles.timeUntilText, isLive && styles.timeUntilTextLive]}>
                            {isLive ? t.joinNow : getTimeUntil(session.scheduled_at, t, formatNumber)}
                        </Text>
                    </View>
                </View>

                {/* Session Info */}
                <View style={styles.sessionInfo}>
                    <Text style={styles.sessionTitle} numberOfLines={2}>
                        {getLocalizedText(session.title, session.title_ar)}
                    </Text>

                    {getLocalizedText(session.description, session.description_ar) && (
                        <Text style={styles.sessionDescription} numberOfLines={2}>
                            {getLocalizedText(session.description, session.description_ar)}
                        </Text>
                    )}

                    {/* Meta Info */}
                    <View style={styles.metaRow}>
                        <View style={styles.metaItem}>
                            <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                            <Text style={styles.metaText}>{session.duration_minutes} {t.minutes}</Text>
                        </View>

                        <View style={styles.metaItem}>
                            <Ionicons
                                name={getPlatformIcon(session.meeting_platform || 'other')}
                                size={14}
                                color={getPlatformColor(session.meeting_platform || 'other')}
                            />
                            <Text style={[styles.metaText, { color: getPlatformColor(session.meeting_platform || 'other') }]}>
                                {(session.meeting_platform || 'other').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </Text>
                        </View>
                    </View>

                    {/* Batch Name */}
                    {session.batch && (
                        <View style={styles.batchTag}>
                            <Ionicons name="people-outline" size={12} color={colors.primary} />
                            <Text style={styles.batchTagText}>
                                {getLocalizedText(session.batch.name, session.batch.name_ar)}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Join Button */}
                {session.meeting_url && (
                    <TouchableOpacity
                        style={[styles.joinButton, isLive && styles.joinButtonLive]}
                        onPress={onJoin}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="videocam" size={18} color="#fff" />
                        <Text style={styles.joinButtonText}>{isLive ? t.joinNow : t.joinSession}</Text>
                    </TouchableOpacity>
                )}
            </TouchableOpacity>
        </Animated.View>
    );
};

// Batch Card Component
interface BatchCardProps {
    batch: Batch;
    index: number;
    onPress: () => void;
}

const BatchCard: React.FC<BatchCardProps> = ({ batch, index, onPress }) => {
    const { colors, isDark } = useTheme();
    const { t, getLocalizedText, formatDate } = useLocalization();
    const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
    const cardAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.spring(cardAnim, {
            toValue: 1,
            delay: index * 60,
            tension: 80,
            friction: 10,
            useNativeDriver: true,
        }).start();
    }, []);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return colors.success;
            case 'upcoming': return colors.warning;
            case 'completed': return colors.textSecondary;
            default: return colors.textTertiary;
        }
    };

    return (
        <Animated.View
            style={[
                styles.batchCard,
                { transform: [{ scale: cardAnim }], opacity: cardAnim },
            ]}
        >
            <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
                <View style={styles.batchHeader}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(batch.status) }]} />
                    <Text style={styles.batchStatus}>
                        {t[batch.status as keyof typeof t] || batch.status}
                    </Text>
                </View>

                <Text style={styles.batchName}>
                    {getLocalizedText(batch.name, batch.name_ar)}
                </Text>

                {batch.diploma && (
                    <Text style={styles.batchDiploma}>
                        {getLocalizedText(batch.diploma.title, batch.diploma.title_ar)}
                    </Text>
                )}

                <View style={styles.batchMeta}>
                    <View style={styles.batchMetaItem}>
                        <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                        <Text style={styles.batchMetaText}>
                            {formatDate(new Date(batch.start_date))}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

// Main Screen
export default function LiveSessionsScreen() {
    const [sessions, setSessions] = useState<LiveSession[]>([]);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'sessions' | 'batches'>('sessions');
    const router = useRouter();
    const { colors, isDark } = useTheme();
    const { t, getLocalizedText } = useLocalization();
    const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

    const loadData = useCallback(async () => {
        try {
            const [sessionsData, batchesData] = await Promise.all([
                fetchUpcomingLiveSessions(),
                fetchMyBatches(),
            ]);
            setSessions(sessionsData);
            setBatches(batchesData);
        } catch (error) {
            console.error('Error loading live sessions:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleJoinSession = (session: LiveSession) => {
        if (!session.meeting_url) {
            Alert.alert(t.error, t.noMeetingLink);
            return;
        }

        Alert.alert(
            t.joinSession,
            `${t.joinQuestion} "${getLocalizedText(session.title, session.title_ar)}"?`,
            [
                { text: t.cancel, style: 'cancel' },
                {
                    text: t.join,
                    onPress: () => Linking.openURL(session.meeting_url!)
                },
            ]
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>{t.loadingSessions}</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{t.liveSessions}</Text>
                <Text style={styles.headerSubtitle}>
                    {sessions.filter(s => s.status === 'live').length > 0
                        ? `${sessions.filter(s => s.status === 'live').length} ${t.liveNow.toLowerCase()}`
                        : `${sessions.length} ${t.upcoming}`
                    }
                </Text>
            </View>

            {/* Tabs */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'sessions' && styles.tabActive]}
                    onPress={() => setActiveTab('sessions')}
                >
                    <Ionicons
                        name="videocam"
                        size={18}
                        color={activeTab === 'sessions' ? colors.primary : colors.textSecondary}
                    />
                    <Text style={[styles.tabText, activeTab === 'sessions' && styles.tabTextActive]}>
                        {t.sessionsTab}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tab, activeTab === 'batches' && styles.tabActive]}
                    onPress={() => setActiveTab('batches')}
                >
                    <Ionicons
                        name="people"
                        size={18}
                        color={activeTab === 'batches' ? colors.primary : colors.textSecondary}
                    />
                    <Text style={[styles.tabText, activeTab === 'batches' && styles.tabTextActive]}>
                        {t.myBatches}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                scrollEnabled={true}
                scrollEventThrottle={16}
                bounces={true}
                alwaysBounceVertical={true}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.primary}
                    />
                }
                showsVerticalScrollIndicator={false}
            >
                {activeTab === 'sessions' ? (
                    sessions.length > 0 ? (
                        sessions.map((session, index) => (
                            <SessionCard
                                key={session.id}
                                session={session}
                                index={index}
                                onJoin={() => handleJoinSession(session)}
                            />
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <Ionicons name="videocam-off-outline" size={64} color={colors.textTertiary} />
                            <Text style={styles.emptyTitle}>{t.noSessions}</Text>
                            <Text style={styles.emptySubtitle}>{t.noSessionsSubtitle}</Text>
                        </View>
                    )
                ) : (
                    batches.length > 0 ? (
                        batches.map((batch, index) => (
                            <BatchCard
                                key={batch.id}
                                batch={batch}
                                index={index}
                                onPress={() => {
                                    // Batch detail - navigation removed (WhatsApp group removed for Apple compliance)
                                }}
                            />
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <Ionicons name="people-outline" size={64} color={colors.textTertiary} />
                            <Text style={styles.emptyTitle}>{t.noBatches}</Text>
                            <Text style={styles.emptySubtitle}>{t.noBatchesSubtitle}</Text>
                        </View>
                    )
                )}

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const createStyles = (colors: typeof Theme.colors.light, isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    loadingText: {
        marginTop: Theme.spacing.md,
        fontSize: Theme.fontSize.base,
        color: colors.textSecondary,
    },
    header: {
        paddingHorizontal: Theme.spacing.lg,
        paddingVertical: Theme.spacing.md,
    },
    headerTitle: {
        fontSize: Theme.fontSize['2xl'],
        fontWeight: Theme.fontWeight.bold,
        color: colors.text,
    },
    headerSubtitle: {
        fontSize: Theme.fontSize.base,
        color: colors.textSecondary,
        marginTop: Theme.spacing.xs,
    },
    tabContainer: {
        flexDirection: 'row',
        marginHorizontal: Theme.spacing.lg,
        backgroundColor: colors.surface,
        borderRadius: Theme.borderRadius.md,
        padding: Theme.spacing.xs,
        ...Theme.shadows[isDark ? 'dark' : 'light'].sm,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Theme.spacing.sm,
        borderRadius: Theme.borderRadius.sm,
        gap: Theme.spacing.xs,
    },
    tabActive: {
        backgroundColor: colors.backgroundSecondary,
    },
    tabText: {
        fontSize: Theme.fontSize.base,
        fontWeight: Theme.fontWeight.medium,
        color: colors.textSecondary,
    },
    tabTextActive: {
        color: colors.primary,
        fontWeight: Theme.fontWeight.semibold,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: Theme.spacing.lg,
    },

    // Session Card Styles
    sessionCard: {
        backgroundColor: colors.surface,
        borderRadius: Theme.borderRadius.lg,
        marginBottom: Theme.spacing.md,
        overflow: 'hidden',
        ...Theme.shadows[isDark ? 'dark' : 'light'].md,
    },
    sessionCardLive: {
        borderWidth: 2,
        borderColor: colors.error,
    },
    sessionCardContent: {
        padding: Theme.spacing.md,
    },
    liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Theme.spacing.sm,
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.error,
        marginRight: Theme.spacing.xs,
    },
    liveText: {
        fontSize: Theme.fontSize.xs,
        fontWeight: Theme.fontWeight.bold,
        color: colors.error,
        letterSpacing: 1,
    },
    dateTimeSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Theme.spacing.sm,
    },
    dateBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.sm,
    },
    dayText: {
        fontSize: Theme.fontSize.base,
        fontWeight: Theme.fontWeight.semibold,
        color: colors.text,
    },
    timeText: {
        fontSize: Theme.fontSize.base,
        color: colors.textSecondary,
    },
    timeUntilBadge: {
        backgroundColor: colors.backgroundSecondary,
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: Theme.spacing.xs,
        borderRadius: Theme.borderRadius.full,
    },
    timeUntilBadgeLive: {
        backgroundColor: colors.error,
    },
    timeUntilText: {
        fontSize: Theme.fontSize.xs,
        fontWeight: Theme.fontWeight.semibold,
        color: colors.textSecondary,
    },
    timeUntilTextLive: {
        color: '#fff',
    },
    sessionInfo: {
        marginBottom: Theme.spacing.md,
    },
    sessionTitle: {
        fontSize: Theme.fontSize.lg,
        fontWeight: Theme.fontWeight.bold,
        color: colors.text,
        marginBottom: Theme.spacing.xs,
    },
    sessionDescription: {
        fontSize: Theme.fontSize.sm,
        color: colors.textSecondary,
        lineHeight: 20,
        marginBottom: Theme.spacing.sm,
    },
    metaRow: {
        flexDirection: 'row',
        gap: Theme.spacing.md,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.xs,
    },
    metaText: {
        fontSize: Theme.fontSize.sm,
        color: colors.textSecondary,
    },
    batchTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary + '10',
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: Theme.spacing.xs,
        borderRadius: Theme.borderRadius.full,
        alignSelf: 'flex-start',
        marginTop: Theme.spacing.sm,
        gap: Theme.spacing.xs,
    },
    batchTagText: {
        fontSize: Theme.fontSize.xs,
        fontWeight: Theme.fontWeight.medium,
        color: colors.primary,
    },
    joinButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        paddingVertical: Theme.spacing.sm,
        borderRadius: Theme.borderRadius.md,
        gap: Theme.spacing.xs,
    },
    joinButtonLive: {
        backgroundColor: colors.error,
    },
    joinButtonText: {
        fontSize: Theme.fontSize.base,
        fontWeight: Theme.fontWeight.semibold,
        color: '#fff',
    },

    // Batch Card Styles
    batchCard: {
        backgroundColor: colors.surface,
        borderRadius: Theme.borderRadius.lg,
        padding: Theme.spacing.md,
        marginBottom: Theme.spacing.md,
        ...Theme.shadows[isDark ? 'dark' : 'light'].md,
    },
    batchHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Theme.spacing.sm,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: Theme.spacing.xs,
    },
    batchStatus: {
        fontSize: Theme.fontSize.xs,
        fontWeight: Theme.fontWeight.semibold,
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    batchName: {
        fontSize: Theme.fontSize.lg,
        fontWeight: Theme.fontWeight.bold,
        color: colors.text,
        marginBottom: Theme.spacing.xs,
    },
    batchDiploma: {
        fontSize: Theme.fontSize.sm,
        color: colors.primary,
        marginBottom: Theme.spacing.sm,
    },
    batchMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    batchMetaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.xs,
    },
    batchMetaText: {
        fontSize: Theme.fontSize.sm,
        color: colors.textSecondary,
    },
    whatsappBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#25D36610',
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: Theme.spacing.xs,
        borderRadius: Theme.borderRadius.full,
        gap: Theme.spacing.xs,
    },
    whatsappBadgeText: {
        fontSize: Theme.fontSize.xs,
        fontWeight: Theme.fontWeight.medium,
        color: '#25D366',
    },

    // Empty State
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Theme.spacing['3xl'],
    },
    emptyTitle: {
        fontSize: Theme.fontSize.lg,
        fontWeight: Theme.fontWeight.bold,
        color: colors.text,
        marginTop: Theme.spacing.md,
    },
    emptySubtitle: {
        fontSize: Theme.fontSize.base,
        color: colors.textSecondary,
        marginTop: Theme.spacing.xs,
        textAlign: 'center',
    },
});



   