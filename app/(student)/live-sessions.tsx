import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Linking,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BORDER_RADIUS, COLORS, FONT_SIZE, FONT_WEIGHT, SHADOWS, SPACING } from '../../src/lib/constants';
import { LiveSession, Batch } from '../../src/types';
import { fetchUpcomingLiveSessions, fetchMyBatches } from '../../src/features/diplomas/diplomaService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Helper to format date/time
const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
        date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
        isToday: new Date().toDateString() === date.toDateString(),
        isTomorrow: new Date(Date.now() + 86400000).toDateString() === date.toDateString(),
    };
};

// Time until session
const getTimeUntil = (dateString: string): string => {
    const now = new Date();
    const sessionDate = new Date(dateString);
    const diff = sessionDate.getTime() - now.getTime();

    if (diff < 0) return 'Started';

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `In ${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `In ${hours} hour${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `In ${minutes} min${minutes > 1 ? 's' : ''}`;
    return 'Starting now';
};

// Session Card Component
interface SessionCardProps {
    session: LiveSession;
    index: number;
    onJoin: () => void;
}

const SessionCard: React.FC<SessionCardProps> = ({ session, index, onJoin }) => {
    const cardAnim = useRef(new Animated.Value(0)).current;
    const { date, time, isToday, isTomorrow } = formatDateTime(session.scheduled_at);
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
            default: return COLORS.primary;
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
                        <Text style={styles.liveText}>LIVE NOW</Text>
                    </View>
                )}

                {/* Date/Time Section */}
                <View style={styles.dateTimeSection}>
                    <View style={styles.dateBox}>
                        <Text style={styles.dayText}>
                            {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : date}
                        </Text>
                        <Text style={styles.timeText}>{time}</Text>
                    </View>
                    <View style={[styles.timeUntilBadge, isLive && styles.timeUntilBadgeLive]}>
                        <Text style={[styles.timeUntilText, isLive && styles.timeUntilTextLive]}>
                            {isLive ? 'Join Now' : getTimeUntil(session.scheduled_at)}
                        </Text>
                    </View>
                </View>

                {/* Session Info */}
                <View style={styles.sessionInfo}>
                    <Text style={styles.sessionTitle} numberOfLines={2}>{session.title}</Text>

                    {session.description && (
                        <Text style={styles.sessionDescription} numberOfLines={2}>
                            {session.description}
                        </Text>
                    )}

                    {/* Meta Info */}
                    <View style={styles.metaRow}>
                        <View style={styles.metaItem}>
                            <Ionicons name="time-outline" size={14} color={COLORS.textSecondary} />
                            <Text style={styles.metaText}>{session.duration_minutes} min</Text>
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
                            <Ionicons name="people-outline" size={12} color={COLORS.primary} />
                            <Text style={styles.batchTagText}>{session.batch.name}</Text>
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
                        <Text style={styles.joinButtonText}>{isLive ? 'Join Now' : 'Join Session'}</Text>
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
            case 'active': return COLORS.success;
            case 'upcoming': return COLORS.warning;
            case 'completed': return COLORS.textSecondary;
            default: return COLORS.textTertiary;
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
                        {batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
                    </Text>
                </View>

                <Text style={styles.batchName}>{batch.name}</Text>

                {batch.diploma && (
                    <Text style={styles.batchDiploma}>{batch.diploma.title}</Text>
                )}

                <View style={styles.batchMeta}>
                    <View style={styles.batchMetaItem}>
                        <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
                        <Text style={styles.batchMetaText}>
                            {new Date(batch.start_date).toLocaleDateString()}
                        </Text>
                    </View>

                    {batch.whatsapp_group_link && (
                        <TouchableOpacity
                            style={styles.whatsappBadge}
                            onPress={() => Linking.openURL(batch.whatsapp_group_link!)}
                        >
                            <Ionicons name="logo-whatsapp" size={14} color="#25D366" />
                            <Text style={styles.whatsappBadgeText}>Group</Text>
                        </TouchableOpacity>
                    )}
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
            Alert.alert('No Meeting Link', 'The meeting link is not yet available.');
            return;
        }

        Alert.alert(
            'Join Session',
            `You're about to join "${session.title}". This will open your browser.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Join',
                    onPress: () => Linking.openURL(session.meeting_url!)
                },
            ]
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading sessions...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Live Sessions</Text>
                <Text style={styles.headerSubtitle}>
                    {sessions.filter(s => s.status === 'live').length > 0
                        ? `${sessions.filter(s => s.status === 'live').length} live now`
                        : `${sessions.length} upcoming`
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
                        color={activeTab === 'sessions' ? COLORS.primary : COLORS.textSecondary}
                    />
                    <Text style={[styles.tabText, activeTab === 'sessions' && styles.tabTextActive]}>
                        Sessions
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tab, activeTab === 'batches' && styles.tabActive]}
                    onPress={() => setActiveTab('batches')}
                >
                    <Ionicons
                        name="people"
                        size={18}
                        color={activeTab === 'batches' ? COLORS.primary : COLORS.textSecondary}
                    />
                    <Text style={[styles.tabText, activeTab === 'batches' && styles.tabTextActive]}>
                        My Batches
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={COLORS.primary}
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
                            <Ionicons name="videocam-off-outline" size={64} color={COLORS.textTertiary} />
                            <Text style={styles.emptyTitle}>No Upcoming Sessions</Text>
                            <Text style={styles.emptySubtitle}>
                                When live sessions are scheduled, they'll appear here
                            </Text>
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
                                    // Navigate to batch detail or show more info
                                    if (batch.whatsapp_group_link) {
                                        Linking.openURL(batch.whatsapp_group_link);
                                    }
                                }}
                            />
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <Ionicons name="people-outline" size={64} color={COLORS.textTertiary} />
                            <Text style={styles.emptyTitle}>No Batches</Text>
                            <Text style={styles.emptySubtitle}>
                                You're not enrolled in any batch programs
                            </Text>
                        </View>
                    )
                )}

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
    },
    loadingText: {
        marginTop: SPACING.md,
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
    },
    header: {
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
    },
    headerTitle: {
        fontSize: FONT_SIZE.xxl,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
    },
    headerSubtitle: {
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
        marginTop: SPACING.xs,
    },
    tabContainer: {
        flexDirection: 'row',
        marginHorizontal: SPACING.lg,
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.xs,
        ...SHADOWS.sm,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.sm,
        gap: SPACING.xs,
    },
    tabActive: {
        backgroundColor: COLORS.backgroundSecondary,
    },
    tabText: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.medium,
        color: COLORS.textSecondary,
    },
    tabTextActive: {
        color: COLORS.primary,
        fontWeight: FONT_WEIGHT.semibold,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: SPACING.lg,
    },

    // Session Card Styles
    sessionCard: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        marginBottom: SPACING.md,
        overflow: 'hidden',
        ...SHADOWS.md,
    },
    sessionCardLive: {
        borderWidth: 2,
        borderColor: COLORS.error,
    },
    sessionCardContent: {
        padding: SPACING.md,
    },
    liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.error,
        marginRight: SPACING.xs,
    },
    liveText: {
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.error,
        letterSpacing: 1,
    },
    dateTimeSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    dateBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    dayText: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
        color: COLORS.text,
    },
    timeText: {
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
    },
    timeUntilBadge: {
        backgroundColor: COLORS.backgroundSecondary,
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.full,
    },
    timeUntilBadgeLive: {
        backgroundColor: COLORS.error,
    },
    timeUntilText: {
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.semibold,
        color: COLORS.textSecondary,
    },
    timeUntilTextLive: {
        color: '#fff',
    },
    sessionInfo: {
        marginBottom: SPACING.md,
    },
    sessionTitle: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        marginBottom: SPACING.xs,
    },
    sessionDescription: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
        lineHeight: 20,
        marginBottom: SPACING.sm,
    },
    metaRow: {
        flexDirection: 'row',
        gap: SPACING.md,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },
    metaText: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
    },
    batchTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary + '10',
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.full,
        alignSelf: 'flex-start',
        marginTop: SPACING.sm,
        gap: SPACING.xs,
    },
    batchTagText: {
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.medium,
        color: COLORS.primary,
    },
    joinButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.primary,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.md,
        gap: SPACING.xs,
    },
    joinButtonLive: {
        backgroundColor: COLORS.error,
    },
    joinButtonText: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
        color: '#fff',
    },

    // Batch Card Styles
    batchCard: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        ...SHADOWS.md,
    },
    batchHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: SPACING.xs,
    },
    batchStatus: {
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.semibold,
        color: COLORS.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    batchName: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        marginBottom: SPACING.xs,
    },
    batchDiploma: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.primary,
        marginBottom: SPACING.sm,
    },
    batchMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    batchMetaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },
    batchMetaText: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
    },
    whatsappBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#25D36610',
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.full,
        gap: SPACING.xs,
    },
    whatsappBadgeText: {
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.medium,
        color: '#25D366',
    },

    // Empty State
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.xxxl,
    },
    emptyTitle: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        marginTop: SPACING.md,
    },
    emptySubtitle: {
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
        marginTop: SPACING.xs,
        textAlign: 'center',
    },
});
