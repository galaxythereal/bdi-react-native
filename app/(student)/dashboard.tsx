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

// Compact Course Card for Grid
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
            delay: index * 60,
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

    // Progress color based on completion
    const getProgressColor = () => {
        if (progress >= 100) return COLORS.success;
        if (progress >= 50) return COLORS.primary;
        return COLORS.warning;
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
                </View>
                
                {/* Info */}
                <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                        {course?.title || 'Untitled Course'}
                    </Text>
                    
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
                    
                    {/* Action text */}
                    <Text style={styles.actionText}>
                        {progress > 0 ? 'Continue' : 'Start'} →
                    </Text>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

// Stats Card Component
interface StatCardProps {
    icon: keyof typeof Ionicons.glyphMap;
    value: string | number;
    label: string;
    color: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, value, label, color }) => (
    <View style={styles.statCard}>
        <View style={[styles.statIconContainer, { backgroundColor: color + '15' }]}>
            <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
    </View>
);

export default function DashboardScreen() {
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
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

    // Reload data when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    // Calculate stats
    const totalCourses = enrollments.length;
    const avgProgress = totalCourses > 0 
        ? Math.round(enrollments.reduce((acc, e) => acc + (e.progress || 0), 0) / totalCourses)
        : 0;
    const completedCourses = enrollments.filter(e => e.progress >= 100).length;
    const inProgressCourses = enrollments.filter(e => e.progress > 0 && e.progress < 100).length;

    // Get greeting based on time
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    };

    const getUserName = () => {
        const email = session?.user.email || '';
        const name = email.split('@')[0];
        return name.charAt(0).toUpperCase() + name.slice(1);
    };

    if (loading && !refreshing) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Loading your dashboard...</Text>
                </View>
            </SafeAreaView>
        );
    }

    // Tab bar height for bottom padding
    const TAB_BAR_HEIGHT = 56 + Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 24);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
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
                contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + SPACING.lg }}
            >
                <Animated.View style={{ opacity: fadeAnim }}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerTop}>
                            <View style={styles.headerTextContainer}>
                                <Text style={styles.greeting}>{getGreeting()},</Text>
                                <Text style={styles.userName}>{getUserName()} 👋</Text>
                            </View>
                            <TouchableOpacity 
                                style={styles.avatar}
                                onPress={() => router.push('/(student)/profile')}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.avatarText}>
                                    {session?.user.email?.charAt(0).toUpperCase() || 'S'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                        
                        {/* Quick Stats */}
                        {totalCourses > 0 && (
                            <View style={styles.statsRow}>
                                <StatCard 
                                    icon="book" 
                                    value={totalCourses} 
                                    label="Courses" 
                                    color={COLORS.primary} 
                                />
                                <StatCard 
                                    icon="trending-up" 
                                    value={`${avgProgress}%`} 
                                    label="Progress" 
                                    color={COLORS.info} 
                                />
                                <StatCard 
                                    icon="checkmark-circle" 
                                    value={completedCourses} 
                                    label="Completed" 
                                    color={COLORS.success} 
                                />
                            </View>
                        )}
                    </View>

                    {/* Continue Learning Section */}
                    {inProgressCourses > 0 && (
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>Continue Learning</Text>
                                <TouchableOpacity onPress={() => router.push('/(student)/courses')}>
                                    <Text style={styles.seeAllText}>See All</Text>
                                </TouchableOpacity>
                            </View>
                            
                            {/* Featured course - most recent in progress */}
                            {(() => {
                                const inProgress = enrollments
                                    .filter(e => e.progress > 0 && e.progress < 100)
                                    .sort((a, b) => (b.progress || 0) - (a.progress || 0))[0];
                                const course = typeof inProgress?.course === 'object' ? inProgress.course : null;
                                if (!inProgress) return null;
                                
                                return (
                                    <TouchableOpacity 
                                        style={styles.featuredCard}
                                        onPress={() => router.push(`/course/${inProgress.course_id}`)}
                                        activeOpacity={0.9}
                                    >
                                        {course?.thumbnail_url ? (
                                            <Image
                                                source={{ uri: course.thumbnail_url }}
                                                style={styles.featuredImage}
                                                resizeMode="cover"
                                            />
                                        ) : (
                                            <View style={[styles.featuredImage, styles.featuredPlaceholder]}>
                                                <Ionicons name="library" size={48} color={COLORS.primary} />
                                            </View>
                                        )}
                                        <View style={styles.featuredOverlay}>
                                            <View style={styles.featuredContent}>
                                                <Text style={styles.featuredTitle} numberOfLines={2}>
                                                    {course?.title || 'Continue Course'}
                                                </Text>
                                                <View style={styles.featuredProgressRow}>
                                                    <View style={styles.featuredProgressBar}>
                                                        <View 
                                                            style={[
                                                                styles.featuredProgressFill,
                                                                { width: `${inProgress.progress}%` }
                                                            ]}
                                                        />
                                                    </View>
                                                    <Text style={styles.featuredProgressText}>
                                                        {Math.round(inProgress.progress || 0)}%
                                                    </Text>
                                                </View>
                                                <View style={styles.featuredButton}>
                                                    <Text style={styles.featuredButtonText}>Continue</Text>
                                                    <Ionicons name="play" size={16} color="#fff" />
                                                </View>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })()}
                        </View>
                    )}

                    {/* All Courses Section */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>
                                {totalCourses > 0 ? 'Your Courses' : 'Get Started'}
                            </Text>
                            {totalCourses > 2 && (
                                <TouchableOpacity onPress={() => router.push('/(student)/courses')}>
                                    <Text style={styles.seeAllText}>View All</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        
                        {totalCourses > 0 ? (
                            <View style={styles.coursesGrid}>
                                {enrollments.slice(0, 4).map((item, index) => (
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
                                    <Ionicons name="school-outline" size={48} color={COLORS.textTertiary} />
                                </View>
                                <Text style={styles.emptyTitle}>No courses yet</Text>
                                <Text style={styles.emptyText}>
                                    You haven't enrolled in any courses.{'\n'}
                                    Contact your instructor to get started.
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Motivational card */}
                    {totalCourses > 0 && avgProgress < 100 && (
                        <View style={styles.section}>
                            <View style={styles.motivationCard}>
                                <View style={styles.motivationIcon}>
                                    <Ionicons name="rocket" size={24} color={COLORS.primary} />
                                </View>
                                <View style={styles.motivationContent}>
                                    <Text style={styles.motivationTitle}>
                                        {avgProgress < 30 ? "Let's get started!" : 
                                         avgProgress < 70 ? "You're doing great!" : 
                                         "Almost there!"}
                                    </Text>
                                    <Text style={styles.motivationText}>
                                        {avgProgress < 30 ? "Begin your learning journey today" :
                                         avgProgress < 70 ? "Keep up the momentum" :
                                         "Finish strong and earn your certificates"}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    )}
                </Animated.View>
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
        paddingBottom: SPACING.xl,
        borderBottomLeftRadius: BORDER_RADIUS.xxl,
        borderBottomRightRadius: BORDER_RADIUS.xxl,
        ...SHADOWS.sm,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.lg,
    },
    headerTextContainer: {
        flex: 1,
    },
    greeting: {
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
        fontWeight: FONT_WEIGHT.medium,
    },
    userName: {
        fontSize: FONT_SIZE.xxl,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        marginTop: 2,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.md,
    },
    avatarText: {
        color: COLORS.surface,
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
    },
    
    // Stats
    statsRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    statCard: {
        flex: 1,
        backgroundColor: COLORS.backgroundSecondary,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        alignItems: 'center',
    },
    statIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.xs,
    },
    statValue: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
    },
    statLabel: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    
    // Section
    section: {
        paddingHorizontal: SPACING.lg,
        marginTop: SPACING.xl,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    sectionTitle: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
    },
    seeAllText: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.primary,
        fontWeight: FONT_WEIGHT.semibold,
    },
    
    // Featured Card (Continue Learning)
    featuredCard: {
        borderRadius: BORDER_RADIUS.xl,
        overflow: 'hidden',
        backgroundColor: COLORS.surface,
        ...SHADOWS.lg,
        marginTop: SPACING.xs,
    },
    featuredImage: {
        width: '100%',
        height: 200,
    },
    featuredPlaceholder: {
        backgroundColor: COLORS.primary + '15',
        alignItems: 'center',
        justifyContent: 'center',
    },
    featuredOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        paddingBottom: SPACING.lg,
        background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
        backgroundColor: 'rgba(0,0,0,0.75)',
    },
    featuredContent: {
        gap: SPACING.sm,
    },
    featuredTitle: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
        color: '#fff',
        lineHeight: 28,
    },
    featuredProgressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
    },
    featuredProgressBar: {
        flex: 1,
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    featuredProgressFill: {
        height: '100%',
        backgroundColor: COLORS.success,
        borderRadius: 3,
    },
    featuredProgressText: {
        fontSize: FONT_SIZE.md,
        color: '#fff',
        fontWeight: FONT_WEIGHT.bold,
        minWidth: 45,
    },
    featuredButton: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: COLORS.primary,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm + 2,
        borderRadius: BORDER_RADIUS.round,
        gap: SPACING.sm,
        marginTop: SPACING.xs,
    },
    featuredButtonText: {
        color: '#fff',
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
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
    progressContainer: {
        marginBottom: SPACING.xs,
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
    actionText: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.primary,
        fontWeight: FONT_WEIGHT.semibold,
    },
    
    // Empty State
    emptyState: {
        padding: SPACING.xxl,
        alignItems: 'center',
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
    
    // Motivation Card
    motivationCard: {
        flexDirection: 'row',
        backgroundColor: COLORS.primary + '10',
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        alignItems: 'center',
        gap: SPACING.md,
    },
    motivationIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    motivationContent: {
        flex: 1,
    },
    motivationTitle: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        marginBottom: 2,
    },
    motivationText: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
    },
});
