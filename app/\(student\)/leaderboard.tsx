import { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    RefreshControl,
    Pressable,
    Dimensions,
    ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/context/ThemeContext';
import Theme from '../../constants/theme';
import { getCourseLeaderboard, getUserLeaderboardPosition, LeaderboardEntry } from '../../src/features/leaderboard/leaderboardService';
import { supabase } from '../../src/lib/supabase';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface Achievement {
    id: string;
    user_id: string;
    achievement_type: string;
    earned_at: string;
}

export default function LeaderboardScreen() {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState<string>('');
    const [courses, setCourses] = useState<any[]>([]);
    const [userPosition, setUserPosition] = useState<LeaderboardEntry | null>(null);
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [userStats, setUserStats] = useState<any>(null);

    // Fetch user's courses and get first one
    useEffect(() => {
        fetchUserCourses();
    }, []);

    const fetchUserCourses = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('diploma_enrollments')
                .select('diploma_id, diplomas(id, title)')
                .eq('user_id', user.id)
                .limit(10);

            if (data && data.length > 0) {
                const courseIds = data.map((e: any) => e.diploma_id);
                setCourses(courseIds);
                if (courseIds.length > 0) {
                    setSelectedCourse(courseIds[0]);
                }
            }
        } catch (error) {
            console.error('Error fetching courses:', error);
        }
    };

    // Fetch leaderboard and user position
    useEffect(() => {
        if (selectedCourse) {
            fetchLeaderboardData();
        }
    }, [selectedCourse]);

    const fetchLeaderboardData = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch leaderboard for selected course
            const leaderboardData = await getCourseLeaderboard(selectedCourse);
            setLeaderboard(leaderboardData || []);

            // Fetch user's position
            const userPos = await getUserLeaderboardPosition(user.id, selectedCourse);
            setUserPosition(userPos);

            // Fetch user's achievements
            const { data: achData } = await supabase
                .from('user_achievements')
                .select('*')
                .eq('user_id', user.id)
                .order('earned_at', { ascending: false });

            setAchievements(achData || []);

            // Fetch user's stats
            const { data: statsData } = await supabase
                .from('user_points')
                .select('*')
                .eq('user_id', user.id)
                .single();

            setUserStats(statsData);
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchLeaderboardData();
        setRefreshing(false);
    };

    const getAchievementIcon = (type: string): string => {
        const icons: Record<string, string> = {
            'First Course': 'medal',
            'Quiz Master': 'brain',
            'Perfect Score': 'star',
            'Streak': 'fire',
            'All Done': 'check-circle',
            'Speed Demon': 'flash',
        };
        return icons[type] || 'award';
    };

    const renderLeaderboardItem = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
        const isCurrentUser = userPosition?.user_id === item.user_id;
        const medalColor = index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : colors.textTertiary;

        return (
            <Pressable
                style={[
                    styles.leaderboardItem,
                    {
                        backgroundColor: isCurrentUser ? colors.primary + '15' : colors.surface,
                        borderLeftWidth: isCurrentUser ? 4 : 0,
                        borderLeftColor: isCurrentUser ? colors.primary : 'transparent',
                    },
                ]}
            >
                <View style={styles.rankContainer}>
                    {index < 3 ? (
                        <MaterialCommunityIcons name="medal" size={24} color={medalColor} />
                    ) : (
                        <Text style={[styles.rankText, { color: colors.textTertiary }]}>
                            {item.rank}
                        </Text>
                    )}
                </View>

                <View style={styles.userInfo}>
                    <Text
                        style={[
                            styles.userName,
                            { color: colors.text, fontWeight: isCurrentUser ? '700' : '600' },
                        ]}
                        numberOfLines={1}
                    >
                        {item.full_name || `User ${item.user_id.slice(0, 8)}`}
                        {isCurrentUser && ' (You)'}
                    </Text>
                    <Text style={[styles.userScore, { color: colors.textSecondary }]}>
                        {item.total_quizzes_completed} quizzes • Avg: {item.average_score.toFixed(1)}%
                    </Text>
                </View>

                <View style={styles.scoreContainer}>
                    <Text style={[styles.totalScore, { color: colors.primary }]}>
                        {item.total_score}
                    </Text>
                    <Text style={[styles.scoreLabel, { color: colors.textTertiary }]}>
                        pts
                    </Text>
                </View>
            </Pressable>
        );
    };

    const renderAchievement = ({ item }: { item: Achievement }) => (
        <View
            style={[
                styles.achievementBadge,
                { backgroundColor: colors.surface, borderColor: colors.primary },
            ]}
        >
            <MaterialCommunityIcons
                name={getAchievementIcon(item.achievement_type)}
                size={24}
                color={colors.primary}
            />
            <Text
                style={[styles.achievementText, { color: colors.textSecondary }]}
                numberOfLines={1}
            >
                {item.achievement_type}
            </Text>
        </View>
    );

    const renderStatCard = (label: string, value: string | number, icon: string) => (
        <View
            style={[
                styles.statCard,
                { backgroundColor: colors.surface, borderColor: colors.primary + '30' },
            ]}
        >
            <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
            <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{label}</Text>
        </View>
    );

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: colors.background }]}
            contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 80 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            {/* Header */}
            <View style={styles.header}>
                <MaterialCommunityIcons name="podium" size={28} color={colors.primary} />
                <Text style={[styles.headerTitle, { color: colors.text }]}>Leaderboard</Text>
            </View>

            {/* User Stats Card */}
            {userPosition && (
                <View style={[styles.userCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary }]}>
                    <View style={styles.userCardContent}>
                        <View>
                            <Text style={[styles.userCardRank, { color: colors.primary }]}>
                                Rank #{userPosition.rank}
                            </Text>
                            <Text style={[styles.userCardScore, { color: colors.text }]}>
                                {userPosition.total_score} Points
                            </Text>
                        </View>
                        <View style={styles.userCardStats}>
                            {renderStatCard('Quizzes', userPosition.total_quizzes_completed, 'check-circle')}
                            {renderStatCard('Avg Score', `${userPosition.average_score.toFixed(0)}%`, 'target')}
                        </View>
                    </View>
                </View>
            )}

            {/* Course Selector */}
            {courses.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.courseSelector}>
                    {courses.map((courseId) => (
                        <Pressable
                            key={courseId}
                            onPress={() => setSelectedCourse(courseId)}
                            style={[
                                styles.coursePill,
                                {
                                    backgroundColor:
                                        selectedCourse === courseId ? colors.primary : colors.surface,
                                },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.coursePillText,
                                    {
                                        color:
                                            selectedCourse === courseId
                                                ? colors.textOnPrimary
                                                : colors.text,
                                    },
                                ]}
                            >
                                {courseId}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>
            )}

            {/* Achievements Section */}
            {achievements.length > 0 && (
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                        Achievements ({achievements.length})
                    </Text>
                    <FlatList
                        data={achievements.slice(0, 5)}
                        renderItem={renderAchievement}
                        keyExtractor={(item) => item.id}
                        scrollEnabled={false}
                        numColumns={3}
                        columnWrapperStyle={{ justifyContent: 'space-between' }}
                    />
                </View>
            )}

            {/* Leaderboard Section */}
            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Top Rankings
                </Text>
                <FlatList
                    data={leaderboard}
                    renderItem={renderLeaderboardItem}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                />
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Theme.spacing.lg,
        paddingVertical: Theme.spacing.lg,
        gap: Theme.spacing.md,
    },
    headerTitle: {
        fontSize: Theme.fontSize.lg,
        fontWeight: '700',
    },
    userCard: {
        marginHorizontal: Theme.spacing.lg,
        marginBottom: Theme.spacing.lg,
        padding: Theme.spacing.lg,
        borderRadius: Theme.borderRadius.lg,
        borderWidth: 1,
    },
    userCardContent: {
        gap: Theme.spacing.md,
    },
    userCardRank: {
        fontSize: Theme.fontSize.sm,
        fontWeight: '600',
    },
    userCardScore: {
        fontSize: Theme.fontSize.xl,
        fontWeight: '700',
        marginTop: Theme.spacing.xs,
    },
    userCardStats: {
        flexDirection: 'row',
        gap: Theme.spacing.sm,
    },
    statCard: {
        flex: 1,
        alignItems: 'center',
        padding: Theme.spacing.md,
        borderRadius: Theme.borderRadius.md,
        borderWidth: 1,
    },
    statValue: {
        fontSize: Theme.fontSize.lg,
        fontWeight: '700',
        marginTop: Theme.spacing.xs,
    },
    statLabel: {
        fontSize: Theme.fontSize.xs,
        marginTop: Theme.spacing.xs,
    },
    courseSelector: {
        paddingHorizontal: Theme.spacing.lg,
        marginBottom: Theme.spacing.lg,
        flexGrow: 0,
    },
    coursePill: {
        paddingHorizontal: Theme.spacing.md,
        paddingVertical: Theme.spacing.sm,
        borderRadius: Theme.borderRadius.full,
        marginRight: Theme.spacing.sm,
    },
    coursePillText: {
        fontSize: Theme.fontSize.sm,
        fontWeight: '600',
    },
    section: {
        paddingHorizontal: Theme.spacing.lg,
        marginBottom: Theme.spacing.xl,
    },
    sectionTitle: {
        fontSize: Theme.fontSize.md,
        fontWeight: '700',
        marginBottom: Theme.spacing.md,
    },
    leaderboardItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Theme.spacing.md,
        paddingHorizontal: Theme.spacing.md,
        marginBottom: Theme.spacing.sm,
        borderRadius: Theme.borderRadius.md,
    },
    rankContainer: {
        width: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rankText: {
        fontSize: Theme.fontSize.lg,
        fontWeight: '700',
    },
    userInfo: {
        flex: 1,
        marginLeft: Theme.spacing.md,
    },
    userName: {
        fontSize: Theme.fontSize.md,
        marginBottom: Theme.spacing.xs,
    },
    userScore: {
        fontSize: Theme.fontSize.xs,
    },
    scoreContainer: {
        alignItems: 'flex-end',
    },
    totalScore: {
        fontSize: Theme.fontSize.lg,
        fontWeight: '700',
    },
    scoreLabel: {
        fontSize: Theme.fontSize.xs,
        marginTop: Theme.spacing.xs,
    },
    achievementBadge: {
        width: '30%',
        aspectRatio: 1,
        borderRadius: Theme.borderRadius.lg,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Theme.spacing.md,
    },
    achievementText: {
        fontSize: Theme.fontSize.xs,
        marginTop: Theme.spacing.xs,
        textAlign: 'center',
    },
});
