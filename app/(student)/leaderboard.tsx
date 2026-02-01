/**
 * Leaderboard Screen
 * Shows course/diploma rankings with user's position
 */

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { Crown, Medal, Trophy, TrendingDown, TrendingUp, Minus, RefreshCw, ChevronRight } from 'lucide-react-native';
import React, { useCallback, useState, useRef } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    FlatList,
    Image,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/features/auth/AuthContext';
import { fetchMyEnrollments } from '../../src/features/courses/courseService';
import {
    getCourseLeaderboard,
    getUserLeaderboardPosition,
    LeaderboardEntry,
} from '../../src/features/leaderboard/leaderboardService';
import { Theme } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CourseLeaderboard {
    courseId: string;
    courseName: string;
    diplomaName: string;
    entries: LeaderboardEntry[];
    userPosition: LeaderboardEntry | null;
}

export default function LeaderboardScreen() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [leaderboards, setLeaderboards] = useState<CourseLeaderboard[]>([]);
    const [selectedCourseIndex, setSelectedCourseIndex] = useState(0);
    const [error, setError] = useState<string | null>(null);
    
    const { colors, isDark } = useTheme();
    const { session } = useAuth();
    const user = session?.user;
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const loadLeaderboards = useCallback(async () => {
        try {
            setError(null);
            
            // Get user's enrolled courses
            const enrollments = await fetchMyEnrollments();
            
            if (!enrollments || enrollments.length === 0) {
                setLeaderboards([]);
                setLoading(false);
                setRefreshing(false);
                return;
            }

            // Collect all courses from all diplomas
            const allCourses: { id: string; title: string; diplomaTitle: string }[] = [];
            
            for (const enrollment of enrollments) {
                if (enrollment.courses && enrollment.courses.length > 0) {
                    for (const course of enrollment.courses) {
                        allCourses.push({
                            id: course.id,
                            title: course.title,
                            diplomaTitle: enrollment.diploma?.title || 'Diploma',
                        });
                    }
                }
            }

            // Load leaderboard for each course
            const leaderboardData: CourseLeaderboard[] = [];
            
            for (const course of allCourses) {
                const [entries, userPosition] = await Promise.all([
                    getCourseLeaderboard(course.id, 50),
                    getUserLeaderboardPosition(course.id),
                ]);

                // Only include if there's any leaderboard data
                if (entries.length > 0 || userPosition) {
                    leaderboardData.push({
                        courseId: course.id,
                        courseName: course.title,
                        diplomaName: course.diplomaTitle,
                        entries,
                        userPosition,
                    });
                }
            }

            setLeaderboards(leaderboardData);
            
            // Animate content in
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }).start();
        } catch (err: any) {
            console.error('Error loading leaderboards:', err);
            setError(err.message || 'Failed to load leaderboards');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [fadeAnim]);

    useFocusEffect(
        useCallback(() => {
            loadLeaderboards();
        }, [loadLeaderboards])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadLeaderboards();
    }, [loadLeaderboards]);

    const getRankIcon = (rank: number) => {
        switch (rank) {
            case 1:
                return <Crown size={20} color="#FFD700" fill="#FFD700" />;
            case 2:
                return <Medal size={20} color="#C0C0C0" />;
            case 3:
                return <Medal size={20} color="#CD7F32" />;
            default:
                return null;
        }
    };

    const getRankChange = (entry: LeaderboardEntry) => {
        if (!entry.previous_rank) return null;
        
        const change = entry.previous_rank - entry.rank;
        if (change > 0) {
            return (
                <View style={styles.rankChange}>
                    <TrendingUp size={12} color="#22C55E" />
                    <Text style={[styles.rankChangeText, { color: '#22C55E' }]}>+{change}</Text>
                </View>
            );
        } else if (change < 0) {
            return (
                <View style={styles.rankChange}>
                    <TrendingDown size={12} color="#EF4444" />
                    <Text style={[styles.rankChangeText, { color: '#EF4444' }]}>{change}</Text>
                </View>
            );
        }
        return (
            <View style={styles.rankChange}>
                <Minus size={12} color={colors.textTertiary} />
            </View>
        );
    };

    const renderLeaderboardEntry = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
        const isCurrentUser = item.user_id === user?.id;
        const isTopThree = item.rank <= 3;

        return (
            <Animated.View
                style={[
                    styles.entryContainer,
                    {
                        backgroundColor: isCurrentUser
                            ? isDark ? colors.primaryLight + '20' : colors.primary + '10'
                            : colors.surface,
                        borderColor: isCurrentUser ? colors.primary : colors.border,
                        borderWidth: isCurrentUser ? 2 : 1,
                    },
                ]}
            >
                {/* Rank */}
                <View style={[
                    styles.rankContainer,
                    isTopThree && {
                        backgroundColor: item.rank === 1 ? '#FFD700' + '20'
                            : item.rank === 2 ? '#C0C0C0' + '20'
                            : '#CD7F32' + '20',
                    },
                ]}>
                    {isTopThree ? (
                        getRankIcon(item.rank)
                    ) : (
                        <Text style={[styles.rankText, { color: colors.text }]}>
                            #{item.rank}
                        </Text>
                    )}
                </View>

                {/* Avatar */}
                <View style={styles.avatarContainer}>
                    {item.avatar_url ? (
                        <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                    ) : (
                        <LinearGradient
                            colors={[colors.primary, colors.primaryDark || '#7C3AED']}
                            style={styles.avatarPlaceholder}
                        >
                            <Text style={styles.avatarInitial}>
                                {(item.full_name || 'U')[0].toUpperCase()}
                            </Text>
                        </LinearGradient>
                    )}
                </View>

                {/* Name & Stats */}
                <View style={styles.entryInfo}>
                    <Text
                        style={[
                            styles.entryName,
                            { color: colors.text },
                            isCurrentUser && { fontWeight: Theme.fontWeight.bold },
                        ]}
                        numberOfLines={1}
                    >
                        {item.full_name || 'Anonymous'}
                        {isCurrentUser && ' (You)'}
                    </Text>
                    <View style={styles.statsRow}>
                        <Text style={[styles.statText, { color: colors.textSecondary }]}>
                            {item.total_quizzes_completed} quizzes
                        </Text>
                        {item.total_perfect_scores > 0 && (
                            <View style={styles.perfectBadge}>
                                <Text style={styles.perfectText}>
                                    ⭐ {item.total_perfect_scores}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Score & Rank Change */}
                <View style={styles.scoreContainer}>
                    <Text style={[styles.scoreText, { color: colors.primary }]}>
                        {item.total_score.toLocaleString()}
                    </Text>
                    <Text style={[styles.scoreLabel, { color: colors.textTertiary }]}>pts</Text>
                    {getRankChange(item)}
                </View>
            </Animated.View>
        );
    };

    const currentLeaderboard = leaderboards[selectedCourseIndex];

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                        Loading leaderboards...
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <Trophy size={28} color={colors.primary} />
                <Text style={[styles.headerTitle, { color: colors.text }]}>Leaderboard</Text>
                <TouchableOpacity onPress={onRefresh} disabled={refreshing}>
                    <RefreshCw
                        size={24}
                        color={colors.textSecondary}
                        style={refreshing ? styles.spinning : undefined}
                    />
                </TouchableOpacity>
            </View>

            {error ? (
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
                    <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
                    <TouchableOpacity
                        style={[styles.retryButton, { backgroundColor: colors.primary }]}
                        onPress={onRefresh}
                    >
                        <Text style={styles.retryText}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            ) : leaderboards.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Trophy size={64} color={colors.textTertiary} />
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>
                        No Rankings Yet
                    </Text>
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                        Complete quizzes in your courses to appear on the leaderboard!
                    </Text>
                    <TouchableOpacity
                        style={[styles.startButton, { backgroundColor: colors.primary }]}
                        onPress={() => router.push('/courses')}
                    >
                        <Text style={styles.startButtonText}>Start Learning</Text>
                        <ChevronRight size={20} color="#FFF" />
                    </TouchableOpacity>
                </View>
            ) : (
                <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
                    {/* Course Selector */}
                    {leaderboards.length > 1 && (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.courseSelectorContent}
                            style={styles.courseSelector}
                        >
                            {leaderboards.map((lb, index) => (
                                <TouchableOpacity
                                    key={lb.courseId}
                                    style={[
                                        styles.courseTab,
                                        {
                                            backgroundColor: selectedCourseIndex === index
                                                ? colors.primary
                                                : colors.surface,
                                            borderColor: colors.border,
                                        },
                                    ]}
                                    onPress={() => setSelectedCourseIndex(index)}
                                >
                                    <Text
                                        style={[
                                            styles.courseTabText,
                                            {
                                                color: selectedCourseIndex === index
                                                    ? '#FFF'
                                                    : colors.text,
                                            },
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {lb.courseName}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}

                    {/* User Position Card */}
                    {currentLeaderboard?.userPosition && (
                        <View style={[styles.userPositionCard, { backgroundColor: colors.surface }]}>
                            <LinearGradient
                                colors={[colors.primary, colors.primaryDark || '#7C3AED']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.userPositionGradient}
                            >
                                <View style={styles.userPositionContent}>
                                    <View style={styles.userRankBig}>
                                        <Text style={styles.userRankNumber}>
                                            #{currentLeaderboard.userPosition.rank}
                                        </Text>
                                        <Text style={styles.userRankLabel}>Your Rank</Text>
                                    </View>
                                    <View style={styles.userStatsContainer}>
                                        <View style={styles.userStat}>
                                            <Text style={styles.userStatValue}>
                                                {currentLeaderboard.userPosition.total_score.toLocaleString()}
                                            </Text>
                                            <Text style={styles.userStatLabel}>Points</Text>
                                        </View>
                                        <View style={styles.userStatDivider} />
                                        <View style={styles.userStat}>
                                            <Text style={styles.userStatValue}>
                                                {currentLeaderboard.userPosition.total_quizzes_completed}
                                            </Text>
                                            <Text style={styles.userStatLabel}>Quizzes</Text>
                                        </View>
                                        <View style={styles.userStatDivider} />
                                        <View style={styles.userStat}>
                                            <Text style={styles.userStatValue}>
                                                {Math.round(currentLeaderboard.userPosition.average_score)}%
                                            </Text>
                                            <Text style={styles.userStatLabel}>Average</Text>
                                        </View>
                                    </View>
                                </View>
                            </LinearGradient>
                        </View>
                    )}

                    {/* Leaderboard List */}
                    <FlatList
                        data={currentLeaderboard?.entries || []}
                        keyExtractor={(item) => item.id}
                        renderItem={renderLeaderboardEntry}
                        contentContainerStyle={[
                            styles.listContent,
                            { paddingBottom: 100 + insets.bottom },
                        ]}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                tintColor={colors.primary}
                                colors={[colors.primary]}
                            />
                        }
                        ListEmptyComponent={
                            <View style={styles.noEntriesContainer}>
                                <Text style={[styles.noEntriesText, { color: colors.textSecondary }]}>
                                    No rankings available for this course yet.
                                </Text>
                            </View>
                        }
                    />
                </Animated.View>
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
        paddingHorizontal: Theme.spacing.lg,
        paddingVertical: Theme.spacing.md,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: Theme.fontSize.xl,
        fontWeight: Theme.fontWeight.bold,
        flex: 1,
        marginLeft: Theme.spacing.sm,
    },
    spinning: {
        opacity: 0.5,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: Theme.spacing.md,
        fontSize: Theme.fontSize.base,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: Theme.spacing.xl,
    },
    errorText: {
        marginTop: Theme.spacing.md,
        fontSize: Theme.fontSize.base,
        textAlign: 'center',
    },
    retryButton: {
        marginTop: Theme.spacing.lg,
        paddingHorizontal: Theme.spacing.xl,
        paddingVertical: Theme.spacing.md,
        borderRadius: Theme.borderRadius.lg,
    },
    retryText: {
        color: '#FFF',
        fontWeight: Theme.fontWeight.semibold,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: Theme.spacing.xl,
    },
    emptyTitle: {
        fontSize: Theme.fontSize.xl,
        fontWeight: Theme.fontWeight.bold,
        marginTop: Theme.spacing.lg,
    },
    emptyText: {
        fontSize: Theme.fontSize.base,
        textAlign: 'center',
        marginTop: Theme.spacing.sm,
        lineHeight: 22,
    },
    startButton: {
        marginTop: Theme.spacing.xl,
        paddingHorizontal: Theme.spacing.xl,
        paddingVertical: Theme.spacing.md,
        borderRadius: Theme.borderRadius.lg,
        flexDirection: 'row',
        alignItems: 'center',
    },
    startButtonText: {
        color: '#FFF',
        fontWeight: Theme.fontWeight.semibold,
        fontSize: Theme.fontSize.base,
    },
    content: {
        flex: 1,
    },
    courseSelector: {
        maxHeight: 50,
    },
    courseSelectorContent: {
        paddingHorizontal: Theme.spacing.lg,
        paddingVertical: Theme.spacing.sm,
        gap: Theme.spacing.sm,
    },
    courseTab: {
        paddingHorizontal: Theme.spacing.lg,
        paddingVertical: Theme.spacing.sm,
        borderRadius: Theme.borderRadius.full,
        borderWidth: 1,
        marginRight: Theme.spacing.sm,
    },
    courseTabText: {
        fontSize: Theme.fontSize.sm,
        fontWeight: Theme.fontWeight.medium,
    },
    userPositionCard: {
        margin: Theme.spacing.lg,
        borderRadius: Theme.borderRadius.xl,
        overflow: 'hidden',
        ...Theme.shadows.light.lg,
    },
    userPositionGradient: {
        padding: Theme.spacing.lg,
    },
    userPositionContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    userRankBig: {
        alignItems: 'center',
        marginRight: Theme.spacing.xl,
    },
    userRankNumber: {
        fontSize: 32,
        fontWeight: Theme.fontWeight.bold,
        color: '#FFF',
    },
    userRankLabel: {
        fontSize: Theme.fontSize.xs,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 2,
    },
    userStatsContainer: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    userStat: {
        alignItems: 'center',
    },
    userStatValue: {
        fontSize: Theme.fontSize.lg,
        fontWeight: Theme.fontWeight.bold,
        color: '#FFF',
    },
    userStatLabel: {
        fontSize: Theme.fontSize.xs,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 2,
    },
    userStatDivider: {
        width: 1,
        height: '80%',
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    listContent: {
        paddingHorizontal: Theme.spacing.lg,
    },
    entryContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Theme.spacing.md,
        paddingHorizontal: Theme.spacing.md,
        borderRadius: Theme.borderRadius.lg,
        marginBottom: Theme.spacing.sm,
    },
    rankContainer: {
        width: 40,
        height: 40,
        borderRadius: Theme.borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    rankText: {
        fontSize: Theme.fontSize.sm,
        fontWeight: Theme.fontWeight.bold,
    },
    avatarContainer: {
        marginLeft: Theme.spacing.sm,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    avatarPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInitial: {
        fontSize: Theme.fontSize.base,
        fontWeight: Theme.fontWeight.bold,
        color: '#FFF',
    },
    entryInfo: {
        flex: 1,
        marginLeft: Theme.spacing.md,
    },
    entryName: {
        fontSize: Theme.fontSize.base,
        fontWeight: Theme.fontWeight.medium,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    statText: {
        fontSize: Theme.fontSize.xs,
    },
    perfectBadge: {
        marginLeft: Theme.spacing.sm,
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    perfectText: {
        fontSize: 10,
        color: '#D97706',
        fontWeight: Theme.fontWeight.semibold,
    },
    scoreContainer: {
        alignItems: 'flex-end',
    },
    scoreText: {
        fontSize: Theme.fontSize.lg,
        fontWeight: Theme.fontWeight.bold,
    },
    scoreLabel: {
        fontSize: Theme.fontSize.xs,
    },
    rankChange: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    rankChangeText: {
        fontSize: Theme.fontSize.xs,
        fontWeight: Theme.fontWeight.semibold,
        marginLeft: 2,
    },
    noEntriesContainer: {
        paddingVertical: Theme.spacing.xl,
        alignItems: 'center',
    },
    noEntriesText: {
        fontSize: Theme.fontSize.base,
        textAlign: 'center',
    },
});
