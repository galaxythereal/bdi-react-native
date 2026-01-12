import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { useAuth } from '../../src/features/auth/AuthContext';
import { fetchMyEnrollments } from '../../src/features/courses/courseService';
import { BORDER_RADIUS, COLORS, FONT_SIZE, FONT_WEIGHT, SHADOWS, SPACING } from '../../src/lib/constants';
import { Enrollment } from '../../src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - SPACING.lg * 2 - CARD_GAP) / 2;

// Filter types
type FilterType = 'all' | 'in_progress' | 'completed' | 'not_started';

// Course Card Component
interface CourseCardProps {
    item: Enrollment;
    index: number;
    onPress: () => void;
}

const CourseCard: React.FC<CourseCardProps> = ({ item, index, onPress }) => {
    const cardAnim = useRef(new Animated.Value(0)).current;
    const progress = Math.round(item.progress || 0);
    const course = typeof item.course === 'object' ? item.course : null;

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
        if (progress >= 100) return COLORS.success;
        if (progress >= 50) return COLORS.primary;
        if (progress > 0) return COLORS.warning;
        return COLORS.textTertiary;
    };

    const getStatusLabel = () => {
        if (progress >= 100) return 'Completed';
        if (progress > 0) return 'In Progress';
        return 'Not Started';
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
                    {course?.thumbnail_url ? (
                        <Image
                            source={{ uri: course.thumbnail_url }}
                            style={styles.thumbnail}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={styles.thumbnailPlaceholder}>
                            <Ionicons name="book" size={28} color={COLORS.primary} />
                        </View>
                    )}
                    {/* Progress badge */}
                    <View style={[styles.progressBadge, { backgroundColor: getProgressColor() }]}>
                        <Text style={styles.progressBadgeText}>{progress}%</Text>
                    </View>
                    {/* Completed checkmark */}
                    {progress >= 100 && (
                        <View style={styles.completedBadge}>
                            <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                        </View>
                    )}
                </View>
                
                {/* Info */}
                <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                        {course?.title || 'Untitled Course'}
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

const FilterChip: React.FC<FilterChipProps> = ({ label, count, active, onPress }) => (
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

export default function CoursesScreen() {
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<FilterType>('all');
    const { session } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const fadeAnim = useRef(new Animated.Value(0)).current;

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
            Alert.alert('Error', error.message || 'Failed to load courses.');
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
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Loading courses...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
                <Text style={styles.headerTitle}>My Courses</Text>
                <Text style={styles.headerSubtitle}>
                    {enrollments.length} {enrollments.length === 1 ? 'course' : 'courses'} enrolled
                </Text>
            </Animated.View>

            {/* Filter chips */}
            {enrollments.length > 0 && (
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filtersContainer}
                >
                    <FilterChip 
                        label="All" 
                        count={counts.all} 
                        active={filter === 'all'} 
                        onPress={() => setFilter('all')} 
                    />
                    <FilterChip 
                        label="In Progress" 
                        count={counts.in_progress} 
                        active={filter === 'in_progress'} 
                        onPress={() => setFilter('in_progress')} 
                    />
                    <FilterChip 
                        label="Completed" 
                        count={counts.completed} 
                        active={filter === 'completed'} 
                        onPress={() => setFilter('completed')} 
                    />
                    <FilterChip 
                        label="Not Started" 
                        count={counts.not_started} 
                        active={filter === 'not_started'} 
                        onPress={() => setFilter('not_started')} 
                    />
                </ScrollView>
            )}

            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl 
                        refreshing={refreshing} 
                        onRefresh={onRefresh} 
                        tintColor={COLORS.primary}
                        colors={[COLORS.primary]}
                    />
                }
                contentContainerStyle={[
                    styles.listContent,
                    { paddingBottom: TAB_BAR_HEIGHT + SPACING.lg }
                ]}
            >
                {filteredEnrollments.length > 0 ? (
                    <View style={styles.coursesGrid}>
                        {filteredEnrollments.map((item, index) => (
                            <CourseCard
                                key={item.id}
                                item={item}
                                index={index}
                                onPress={() => router.push(`/course/${item.course_id}`)}
                            />
                        ))}
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
                                color={COLORS.textTertiary} 
                            />
                        </View>
                        <Text style={styles.emptyTitle}>
                            {filter === 'all' ? 'No courses yet' :
                             filter === 'completed' ? 'No completed courses' :
                             filter === 'in_progress' ? 'No courses in progress' :
                             'All courses started!'}
                        </Text>
                        <Text style={styles.emptyText}>
                            {filter === 'all' 
                                ? 'Enroll in courses to start learning'
                                : 'Try selecting a different filter'}
                        </Text>
                    </View>
                )}
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
        gap: SPACING.md,
    },
    loadingText: {
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
        marginTop: SPACING.sm,
    },
    
    // Header
    header: {
        backgroundColor: COLORS.surface,
        paddingHorizontal: SPACING.lg,
        paddingTop: SPACING.md,
        paddingBottom: SPACING.lg,
        ...SHADOWS.sm,
    },
    headerTitle: {
        fontSize: FONT_SIZE.xxl,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        marginBottom: 2,
    },
    headerSubtitle: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
    },
    
    // Filters
    filtersContainer: {
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        gap: SPACING.sm,
        flexDirection: 'row',
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.round,
        gap: SPACING.xs,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginRight: SPACING.sm,
    },
    filterChipActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    filterChipText: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
        fontWeight: FONT_WEIGHT.medium,
    },
    filterChipTextActive: {
        color: '#fff',
    },
    filterChipBadge: {
        backgroundColor: COLORS.backgroundSecondary,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: BORDER_RADIUS.sm,
    },
    filterChipBadgeActive: {
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    filterChipCount: {
        fontSize: 10,
        color: COLORS.textSecondary,
        fontWeight: FONT_WEIGHT.bold,
    },
    filterChipCountActive: {
        color: '#fff',
    },
    
    // List
    listContent: {
        padding: SPACING.lg,
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
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        overflow: 'hidden',
        ...SHADOWS.md,
    },
    thumbnailContainer: {
        position: 'relative',
        height: 100,
        backgroundColor: COLORS.backgroundSecondary,
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
        backgroundColor: COLORS.primary + '10',
    },
    progressBadge: {
        position: 'absolute',
        top: SPACING.xs,
        right: SPACING.xs,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 3,
        borderRadius: BORDER_RADIUS.sm,
    },
    progressBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: FONT_WEIGHT.bold,
    },
    completedBadge: {
        position: 'absolute',
        top: SPACING.xs,
        left: SPACING.xs,
        backgroundColor: '#fff',
        borderRadius: 12,
    },
    cardInfo: {
        padding: SPACING.sm,
    },
    cardTitle: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.semibold,
        color: COLORS.text,
        marginBottom: SPACING.xs,
        lineHeight: 18,
        minHeight: 36,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: SPACING.xs,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: 10,
        fontWeight: FONT_WEIGHT.semibold,
    },
    progressContainer: {
        marginTop: 2,
    },
    progressBar: {
        height: 4,
        backgroundColor: COLORS.border,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    
    // Empty State
    emptyState: {
        padding: SPACING.xxl,
        alignItems: 'center',
        marginTop: SPACING.xxl,
    },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: COLORS.backgroundSecondary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.lg,
    },
    emptyTitle: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        marginBottom: SPACING.xs,
    },
    emptyText: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
});
