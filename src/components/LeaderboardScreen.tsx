/**
 * Leaderboard Screen Component
 * Displays course leaderboard with rankings and user position
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    Image,
    TouchableOpacity,
    RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Theme from '../../constants/theme';
import { useTheme } from '../context/ThemeContext';
import {
    getCourseLeaderboard,
    getUserLeaderboardPosition,
    LeaderboardEntry,
    getCourseSettings,
} from '../features/leaderboard/leaderboardService';

interface LeaderboardProps {
    courseId: string;
    onClose?: () => void;
}

export const LeaderboardScreen: React.FC<LeaderboardProps> = ({ courseId, onClose }) => {
    const { colors, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [userPosition, setUserPosition] = useState<LeaderboardEntry | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isEnabled, setIsEnabled] = useState(true);

    useEffect(() => {
        loadLeaderboard();
    }, [courseId]);

    const loadLeaderboard = async () => {
        try {
            setLoading(true);

            // Check if leaderboard is enabled
            const settings = await getCourseSettings(courseId);
            if (!settings || !settings.leaderboard_enabled || settings.leaderboard_visibility === 'hidden') {
                setIsEnabled(false);
                setLoading(false);
                return;
            }

            const [boardData, userPos] = await Promise.all([
                getCourseLeaderboard(courseId, 100),
                getUserLeaderboardPosition(courseId),
            ]);

            setLeaderboard(boardData);
            setUserPosition(userPos);
            setIsEnabled(true);
        } catch (error) {
            console.error('Error loading leaderboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadLeaderboard();
        setRefreshing(false);
    };

    const getRankColor = (rank: number) => {
        if (rank === 1) return '#FFD700'; // Gold
        if (rank === 2) return '#C0C0C0'; // Silver
        if (rank === 3) return '#CD7F32'; // Bronze
        return colors.textSecondary;
    };

    const getRankIcon = (rank: number) => {
        if (rank === 1) return 'trophy';
        if (rank === 2) return 'medal';
        if (rank === 3) return 'ribbon';
        return 'person';
    };

    const renderLeaderboardItem = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
        const isCurrentUser = userPosition?.user_id === item.user_id;
        const rankChanged = item.previous_rank !== null && item.previous_rank !== item.rank;
        const rankUp = rankChanged && item.previous_rank! > item.rank;

        return (
            <View style={[
                styles.leaderboardItem,
                isCurrentUser && styles.currentUserItem,
                item.rank <= 3 && styles.topThreeItem,
            ]}>
                {/* Rank Badge */}
                <View style={[
                    styles.rankBadge,
                    item.rank <= 3 && styles.topRankBadge,
                ]}>
                    <Text style={[
                        styles.rankText,
                        { color: getRankColor(item.rank) }
                    ]}>
                        {item.rank}
                    </Text>
                    {item.rank <= 3 && (
                        <Ionicons 
                            name={getRankIcon(item.rank) as any} 
                            size={12} 
                            color={getRankColor(item.rank)} 
                        />
                    )}
                </View>

                {/* Avatar */}
                <View style={styles.avatarContainer}>
                    {item.avatar_url ? (
                        <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary + '20' }]}>
                            <Ionicons name="person" size={24} color={colors.primary} />
                        </View>
                    )}
                    {isCurrentUser && (
                        <View style={styles.youBadge}>
                            <Text style={styles.youBadgeText}>YOU</Text>
                        </View>
                    )}
                </View>

                {/* User Info */}
                <View style={styles.userInfo}>
                    <Text style={styles.userName} numberOfLines={1}>
                        {item.full_name || 'User'}
                    </Text>
                    <View style={styles.statsRow}>
                        <Ionicons name="trophy-outline" size={12} color={colors.textSecondary} />
                        <Text style={styles.statsText}>
                            {item.total_quizzes_completed} quizzes
                        </Text>
                        <Text style={styles.statsDivider}>•</Text>
                        <Text style={styles.statsText}>
                            {item.average_score.toFixed(0)}% avg
                        </Text>
                    </View>
                </View>

                {/* Score */}
                <View style={styles.scoreContainer}>
                    <Text style={styles.scoreText}>{item.total_score}</Text>
                    <Text style={styles.scoreLabel}>pts</Text>
                    {rankChanged && (
                        <View style={[styles.rankChange, rankUp && styles.rankUp]}>
                            <Ionicons 
                                name={rankUp ? 'arrow-up' : 'arrow-down'} 
                                size={10} 
                                color={rankUp ? colors.success : colors.error} 
                            />
                        </View>
                    )}
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Leaderboard</Text>
                    {onClose && (
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                    )}
                </View>
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading rankings...</Text>
                </View>
            </View>
        );
    }

    if (!isEnabled) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Leaderboard</Text>
                    {onClose && (
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                    )}
                </View>
                <View style={styles.centerContent}>
                    <Ionicons name="eye-off-outline" size={64} color={colors.textTertiary} />
                    <Text style={styles.disabledTitle}>Leaderboard Disabled</Text>
                    <Text style={styles.disabledText}>
                        The leaderboard is not available for this course.
                    </Text>
                </View>
            </View>
        );
    }

    if (leaderboard.length === 0) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Leaderboard</Text>
                    {onClose && (
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                    )}
                </View>
                <View style={styles.centerContent}>
                    <Ionicons name="trophy-outline" size={64} color={colors.textTertiary} />
                    <Text style={styles.emptyTitle}>No Rankings Yet</Text>
                    <Text style={styles.emptyText}>
                        Complete quizzes to appear on the leaderboard!
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Leaderboard</Text>
                    <Text style={styles.headerSubtitle}>
                        {leaderboard.length} {leaderboard.length === 1 ? 'participant' : 'participants'}
                    </Text>
                </View>
                {onClose && (
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color={colors.text} />
                    </TouchableOpacity>
                )}
            </View>

            {/* User Position Card (if not in top 10) */}
            {userPosition && userPosition.rank > 10 && (
                <View style={styles.userPositionCard}>
                    <Text style={styles.userPositionTitle}>Your Position</Text>
                    {renderLeaderboardItem({ item: userPosition, index: userPosition.rank - 1 })}
                </View>
            )}

            {/* Leaderboard List */}
            <FlatList
                data={leaderboard}
                renderItem={renderLeaderboardItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        colors={[colors.primary]}
                        tintColor={colors.primary}
                    />
                }
                ItemSeparatorComponent={() => <View style={styles.separator} />}
            />

            {/* Bottom Info */}
            <View style={styles.footer}>
                <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.footerText}>
                    Rankings update after each quiz. Only first attempts count.
                </Text>
            </View>
        </View>
    );
};

const createStyles = (colors: typeof Theme.colors.light, isDark: boolean) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: Theme.spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
        },
        headerTitle: {
            fontSize: Theme.fontSize.xl,
            fontWeight: Theme.fontWeight.bold,
            color: colors.text,
        },
        headerSubtitle: {
            fontSize: Theme.fontSize.sm,
            color: colors.textSecondary,
            marginTop: 2,
        },
        closeButton: {
            padding: Theme.spacing.sm,
        },
        centerContent: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: Theme.spacing.xl,
        },
        loadingText: {
            marginTop: Theme.spacing.md,
            fontSize: Theme.fontSize.base,
            color: colors.textSecondary,
        },
        disabledTitle: {
            fontSize: Theme.fontSize.xl,
            fontWeight: Theme.fontWeight.bold,
            color: colors.text,
            marginTop: Theme.spacing.lg,
        },
        disabledText: {
            fontSize: Theme.fontSize.base,
            color: colors.textSecondary,
            textAlign: 'center',
            marginTop: Theme.spacing.sm,
        },
        emptyTitle: {
            fontSize: Theme.fontSize.xl,
            fontWeight: Theme.fontWeight.bold,
            color: colors.text,
            marginTop: Theme.spacing.lg,
        },
        emptyText: {
            fontSize: Theme.fontSize.base,
            color: colors.textSecondary,
            textAlign: 'center',
            marginTop: Theme.spacing.sm,
        },
        userPositionCard: {
            backgroundColor: colors.surface,
            marginHorizontal: Theme.spacing.lg,
            marginTop: Theme.spacing.md,
            borderRadius: Theme.borderRadius.lg,
            padding: Theme.spacing.md,
            borderWidth: 2,
            borderColor: colors.primary + '40',
        },
        userPositionTitle: {
            fontSize: Theme.fontSize.sm,
            fontWeight: Theme.fontWeight.semibold,
            color: colors.primary,
            marginBottom: Theme.spacing.sm,
        },
        listContent: {
            padding: Theme.spacing.lg,
        },
        leaderboardItem: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderRadius: Theme.borderRadius.lg,
            padding: Theme.spacing.md,
        },
        currentUserItem: {
            backgroundColor: colors.primary + '10',
            borderWidth: 2,
            borderColor: colors.primary,
        },
        topThreeItem: {
            borderLeftWidth: 4,
            borderLeftColor: '#FFD700',
        },
        rankBadge: {
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: colors.backgroundSecondary,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: Theme.spacing.md,
        },
        topRankBadge: {
            backgroundColor: '#FFD70020',
        },
        rankText: {
            fontSize: Theme.fontSize.lg,
            fontWeight: Theme.fontWeight.bold,
        },
        avatarContainer: {
            position: 'relative',
            marginRight: Theme.spacing.md,
        },
        avatar: {
            width: 50,
            height: 50,
            borderRadius: 25,
        },
        avatarPlaceholder: {
            width: 50,
            height: 50,
            borderRadius: 25,
            justifyContent: 'center',
            alignItems: 'center',
        },
        youBadge: {
            position: 'absolute',
            bottom: -4,
            right: -4,
            backgroundColor: colors.primary,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 8,
        },
        youBadgeText: {
            fontSize: 8,
            fontWeight: Theme.fontWeight.bold,
            color: '#fff',
        },
        userInfo: {
            flex: 1,
        },
        userName: {
            fontSize: Theme.fontSize.base,
            fontWeight: Theme.fontWeight.semibold,
            color: colors.text,
            marginBottom: 2,
        },
        statsRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        statsText: {
            fontSize: Theme.fontSize.xs,
            color: colors.textSecondary,
        },
        statsDivider: {
            fontSize: Theme.fontSize.xs,
            color: colors.textTertiary,
        },
        scoreContainer: {
            alignItems: 'flex-end',
        },
        scoreText: {
            fontSize: Theme.fontSize.xl,
            fontWeight: Theme.fontWeight.bold,
            color: colors.primary,
        },
        scoreLabel: {
            fontSize: Theme.fontSize.xs,
            color: colors.textSecondary,
        },
        rankChange: {
            marginTop: 2,
        },
        rankUp: {
            transform: [{ rotate: '0deg' }],
        },
        separator: {
            height: Theme.spacing.sm,
        },
        footer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Theme.spacing.sm,
            padding: Theme.spacing.lg,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        footerText: {
            flex: 1,
            fontSize: Theme.fontSize.xs,
            color: colors.textSecondary,
        },
    });
