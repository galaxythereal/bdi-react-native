import { Theme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Image,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/context/ThemeContext';
import { useLocalization } from '../../src/context/LocalizationContext';
import { useAuth } from '../../src/features/auth/AuthContext';
import { fetchMyEnrollments } from '../../src/features/courses/courseService';
import { Enrollment } from '../../src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - Theme.spacing.lg * 2 - CARD_GAP) / 2;

// Filter types
type FilterType = 'all' | 'in_progress' | 'completed' | 'not_started';

// Course Card Component
interface CourseCardProps {
    item: Enrollment;
    index: number;
    onPress: () => void;
}

const CourseCard: React.FC<CourseCardProps> = ({ item, index, onPress }) => {
    const { colors, isDark } = useTheme();
    const { t, getLocalizedText, isRTL } = useLocalization();
    const styles = useMemo(() => createStyles(colors, isDark, isRTL), [colors, isDark, isRTL]);
    const cardAnim = useRef(new Animated.Value(0)).current;
    const progress = Math.round(item.progress || 0);
    const diploma = item.diploma;

    useEffect(() => {
        Animated.spring(cardAnim, {
            toValue: 1,
            delay: index * 50,
            tension: 80,
            friction: 10,
            useNativeDriver: true,
        }).start();
    }, []);

    const scale = cardAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.9, 1],
    });

    const translateY = cardAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [20, 0],
    });

    const getProgressColor = () => {
        if (progress >= 100) return colors.success;
        if (progress >= 50) return colors.primary;
        if (progress > 0) return colors.warning;
        return colors.textTertiary;
    };

    const getStatusLabel = () => {
        if (progress >= 100) return t.completed;
        if (progress > 0) return t.inProgress;
        return t.notStarted;
    };

    return (
        <Animated.View
            style={[
                styles.cardWrapper,
                {
                    transform: [{ scale }, { translateY }],
                    opacity: cardAnim,
                },
            ]}
        >
            <TouchableOpacity
                onPress={onPress}
                activeOpacity={0.9}
                style={styles.card}
            >
                {/* Thumbnail */}
                <View style={styles.thumbnailContainer}>
                    {diploma?.thumbnail_url ? (
                        <Image
                            source={{ uri: diploma.thumbnail_url }}
                            style={styles.thumbnail}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={styles.thumbnailPlaceholder}>
                            <Ionicons name="school" size={28} color={colors.primary} />
                        </View>
                    )}
                    {/* Progress badge */}
                    <View style={[styles.progressBadge, { backgroundColor: getProgressColor() }]}>
                        <Text style={styles.progressBadgeText}>{progress}%</Text>
                    </View>
                    {/* Completed checkmark */}
                    {progress >= 100 && (
                        <View style={styles.completedBadge}>
                            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                        </View>
                    )}
                </View>

                {/* Info */}
                <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                        {getLocalizedText(diploma?.title, diploma?.title_ar) || t.untitledDiploma}
                    </Text>

                    {/* Status */}
                    <View style={styles.statusRow}>
                        <View style={[styles.statusDot, { backgroundColor: getProgressColor() }]} />
                        <Text style={[styles.statusText, { color: getProgressColor() }]}>
                            {getStatusLabel()}
                        </Text>
                    </View>

                    {/* Progress bar */}
                    <View style={styles.progressContainer}>
                        <View style={styles.progressBar}>
                            <View
                                style={[
                                    styles.progressFill,
                                    { width: `${progress}%`, backgroundColor: getProgressColor() }
                                ]}
                            />
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

// Filter Chip Component
interface FilterChipProps {
    label: string;
    count: number;
    active: boolean;
    onPress: () => void;
}

const FilterChip: React.FC<FilterChipProps> = ({ label, count, active, onPress }) => {
    const { colors, isDark } = useTheme();
    const { t, isRTL } = useLocalization();
    const styles = useMemo(() => createStyles(colors, isDark, isRTL), [colors, isDark, isRTL]);

    return (
        <TouchableOpacity
            style={[styles.filterChip, active && styles.filterChipActive]}
            onPress={onPress}
            activeOpacity={0.8}
        >
            <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {label}
            </Text>
            <View style={[styles.filterChipBadge, active && styles.filterChipBadgeActive]}>
                <Text style={[styles.filterChipCount, active && styles.filterChipCountActive]}>
                    {count}
                </Text>
            </View>
        </TouchableOpacity>
    );
};

export default function CoursesScreen() {
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<FilterType>('all');
    const { session } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const { colors, isDark } = useTheme();
    const { t, isRTL } = useLocalization();
    const styles = useMemo(() => createStyles(colors, isDark, isRTL), [colors, isDark, isRTL]);

    const loadData = async () => {
        try {
            const data = await fetchMyEnrollments();
            setEnrollments(data || []);

            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }).start();
        } catch (error: any) {
            console.error('Error loading enrollments:', error);
            Alert.alert(t.error, error.message || t.failedLoadCourses);
            setEnrollments([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Reload when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    // Filter enrollments
    const filteredEnrollments = enrollments.filter(e => {
        const progress = e.progress || 0;
        switch (filter) {
            case 'completed': return progress >= 100;
            case 'in_progress': return progress > 0 && progress < 100;
            case 'not_started': return progress === 0;
            default: return true;
        }
    });

    // Get counts for filters
    const counts = {
        all: enrollments.length,
        in_progress: enrollments.filter(e => (e.progress || 0) > 0 && (e.progress || 0) < 100).length,
        completed: enrollments.filter(e => (e.progress || 0) >= 100).length,
        not_started: enrollments.filter(e => (e.progress || 0) === 0).length,
    };

    // Tab bar height for bottom padding
    const TAB_BAR_HEIGHT = 56 + Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 24);

    if (loading && !refreshing) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t.loadingCourses}</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>{t.myCourses}</Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                    {enrollments.length} {enrollments.length === 1 ? t.course : t.courses} {t.enrolled}
                </Text>
            </Animated.View>

            {/* Filter chips */}
            {enrollments.length > 0 && (
                <View style={styles.filtersWrapper}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.filtersContainer}
                        bounces={false}
                    >
                        <FilterChip
                            label={t.all}
                            count={counts.all}
                            active={filter === 'all'}
                            onPress={() => setFilter('all')}
                        />
                        <FilterChip
                            label={t.inProgress}
                            count={counts.in_progress}
                            active={filter === 'in_progress'}
                            onPress={() => setFilter('in_progress')}
                        />
                        <FilterChip
                            label={t.completed}
                            count={counts.completed}
                            active={filter === 'completed'}
                            onPress={() => setFilter('completed')}
                        />
                        <FilterChip
                            label={t.notStarted}
                            count={counts.not_started}
                            active={filter === 'not_started'}
                            onPress={() => setFilter('not_started')}
                        />
                    </ScrollView>
                </View>
            )}

            <ScrollView
                showsVerticalScrollIndicator={false}
                scrollEnabled={true}
                scrollEventThrottle={16}
                bounces={true}
                alwaysBounceVertical={true}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.primary}
                        colors={[colors.primary]}
                    />
                }
                contentContainerStyle={[
                    styles.listContent,
                    { paddingBottom: TAB_BAR_HEIGHT + Theme.spacing.lg }
                ]}
            >
                {filteredEnrollments.length > 0 ? (
                    <View style={styles.coursesGrid}>
                        {filteredEnrollments.map((item, index) => {
                            const firstCourse = item.courses?.[0];
                            return (
                                <CourseCard
                                    key={item.id}
                                    item={item}
                                    index={index}
                                    onPress={() => router.push(`/course/${firstCourse?.id || item.diploma_id}`)}
                                />
                            );
                        })}
                    </View>
                ) : (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIconContainer}>
                            <Ionicons
                                name={
                                    filter === 'completed' ? 'trophy-outline' :
                                        filter === 'in_progress' ? 'hourglass-outline' :
                                            filter === 'not_started' ? 'flag-outline' :
                                                'library-outline'
                                }
                                size={48}
                                color={colors.textTertiary}
                            />
                        </View>
                        <Text style={styles.emptyTitle}>
                            {filter === 'all' ? t.noCourses :
                                filter === 'completed' ? t.noCompletedCourses :
                                    filter === 'in_progress' ? t.noCoursesInProgress :
                                        t.allCoursesStarted}
                        </Text>
                        <Text style={styles.emptyText}>
                            {filter === 'all'
                                ? t.enrollInCourses
                                : t.tryDifferentFilter}
                        </Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const createStyles = (colors: typeof Theme.colors.light, isDark: boolean, isRTL: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: Theme.spacing.md,
    },
    loadingText: {
        fontSize: Theme.fontSize.base,
        color: colors.textSecondary,
        marginTop: Theme.spacing.sm,
    },

    // Header
    header: {
        backgroundColor: colors.surface,
        paddingHorizontal: Theme.spacing.lg,
        paddingTop: Theme.spacing.md,
        paddingBottom: Theme.spacing.lg,
        ...Theme.shadows[isDark ? 'dark' : 'light'].sm,
    },
    headerTitle: {
        fontSize: Theme.fontSize['2xl'],
        fontWeight: Theme.fontWeight.bold,
        color: colors.text,
        marginBottom: 2,
        textAlign: isRTL ? 'right' : 'left',
    },
    headerSubtitle: {
        fontSize: Theme.fontSize.sm,
        color: colors.textSecondary,
        textAlign: isRTL ? 'right' : 'left',
    },

    // Filters
    filtersWrapper: {
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        zIndex: 10,
    },
    filtersContainer: {
        paddingHorizontal: Theme.spacing.lg,
        paddingVertical: Theme.spacing.md,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
    },
    filterChip: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        paddingHorizontal: Theme.spacing.md,
        paddingVertical: Theme.spacing.sm,
        borderRadius: Theme.borderRadius.round,
        borderWidth: 1,
        borderColor: colors.border,
        marginRight: isRTL ? 0 : Theme.spacing.sm,
        marginLeft: isRTL ? Theme.spacing.sm : 0,
        minHeight: 36,
    },
    filterChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    filterChipText: {
        fontSize: Theme.fontSize.sm,
        color: colors.textSecondary,
        fontWeight: Theme.fontWeight.medium,
        marginRight: isRTL ? 0 : Theme.spacing.xs,
        marginLeft: isRTL ? Theme.spacing.xs : 0,
        textAlign: isRTL ? 'right' : 'left',
    },
    filterChipTextActive: {
        color: '#fff',
    },
    filterChipBadge: {
        backgroundColor: colors.backgroundSecondary,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: Theme.borderRadius.sm,
    },
    filterChipBadgeActive: {
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    filterChipCount: {
        fontSize: 10,
        color: colors.textSecondary,
        fontWeight: Theme.fontWeight.bold,
    },
    filterChipCountActive: {
        color: '#fff',
    },

    // List
    listContent: {
        padding: Theme.spacing.lg,
    },

    // Course Grid
    coursesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: CARD_GAP,
    },
    cardWrapper: {
        width: CARD_WIDTH,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: Theme.borderRadius.lg,
        overflow: 'hidden',
        ...Theme.shadows[isDark ? 'dark' : 'light'].md,
    },
    thumbnailContainer: {
        position: 'relative',
        height: 100,
        backgroundColor: colors.backgroundSecondary,
    },
    thumbnail: {
        width: '100%',
        height: '100%',
    },
    thumbnailPlaceholder: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary + '10',
    },
    progressBadge: {
        position: 'absolute',
        top: Theme.spacing.xs,
        right: Theme.spacing.xs,
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: 3,
        borderRadius: Theme.borderRadius.sm,
    },
    progressBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: Theme.fontWeight.bold,
    },
    completedBadge: {
        position: 'absolute',
        top: Theme.spacing.xs,
        left: Theme.spacing.xs,
        backgroundColor: '#fff',
        borderRadius: 12,
    },
    cardInfo: {
        padding: Theme.spacing.sm,
    },
    cardTitle: {
        fontSize: Theme.fontSize.sm,
        fontWeight: Theme.fontWeight.semibold,
        color: colors.text,
        marginBottom: Theme.spacing.xs,
        lineHeight: 18,
        minHeight: 36,
        textAlign: isRTL ? 'right' : 'left',
    },
    statusRow: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: Theme.spacing.xs,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: 10,
        fontWeight: Theme.fontWeight.semibold,
    },
    progressContainer: {
        marginTop: 2,
    },
    progressBar: {
        height: 4,
        backgroundColor: colors.border,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },

    // Empty State
    emptyState: {
        padding: Theme.spacing['2xl'],
        alignItems: 'center',
        marginTop: Theme.spacing['2xl'],
    },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.backgroundSecondary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Theme.spacing.lg,
    },
    emptyTitle: {
        fontSize: Theme.fontSize.lg,
        fontWeight: Theme.fontWeight.bold,
        color: colors.text,
        marginBottom: Theme.spacing.xs,
    },
    emptyText: {
        fontSize: Theme.fontSize.sm,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
});
