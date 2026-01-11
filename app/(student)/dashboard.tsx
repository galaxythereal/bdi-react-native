import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { 
    ActivityIndicator, 
    Alert, 
    Animated, 
    FlatList, 
    Image, 
    RefreshControl, 
    StyleSheet, 
    Text, 
    TouchableOpacity, 
    View 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/features/auth/AuthContext';
import { fetchMyEnrollments } from '../../src/features/courses/courseService';
import { BORDER_RADIUS, COLORS, FONT_SIZE, FONT_WEIGHT, SHADOWS, SPACING } from '../../src/lib/constants';
import { Enrollment } from '../../src/types';

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
            delay: index * 100,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
        }).start();
    }, []);

    const scale = cardAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.95, 1],
    });

    const opacity = cardAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
    });

    return (
        <Animated.View
            style={[
                styles.courseCardWrapper,
                {
                    transform: [{ scale }],
                    opacity,
                },
            ]}
        >
            <TouchableOpacity 
                onPress={onPress}
                activeOpacity={0.92}
                style={styles.courseCard}
            >
                <View style={styles.thumbnailContainer}>
                        {course?.thumbnail_url ? (
                            <Image
                                source={{ uri: course.thumbnail_url }}
                                style={styles.thumbnail}
                                resizeMode="cover"
                            />
                        ) : (
                            <View style={styles.thumbnailPlaceholder}>
                                <View style={styles.placeholderIconContainer}>
                                    <Ionicons name="library" size={40} color={COLORS.primary} />
                                </View>
                            </View>
                        )}
                        <View style={styles.thumbnailOverlay} />
                        <View style={styles.progressBadge}>
                            <View style={styles.progressBadgeIcon}>
                                <Ionicons name="checkmark-circle" size={14} color={COLORS.surface} />
                            </View>
                            <Text style={styles.progressBadgeText}>{progress}%</Text>
                        </View>
                    </View>
                    
                    <View style={styles.courseInfo}>
                        <Text style={styles.courseTitle} numberOfLines={2}>
                            {course?.title || 'Untitled Course'}
                        </Text>
                        
                        {course?.description && (
                            <Text style={styles.courseDescription} numberOfLines={2}>
                                {course.description}
                            </Text>
                        )}
                        
                        <View style={styles.progressSection}>
                            <View style={styles.progressHeader}>
                                <View style={styles.progressHeaderLeft}>
                                    <Ionicons name="time-outline" size={14} color={COLORS.textSecondary} />
                                    <Text style={styles.progressLabel}>Your Progress</Text>
                                </View>
                                <Text style={styles.progressPercent}>{progress}%</Text>
                            </View>
                            <View style={styles.progressBarContainer}>
                                <View style={styles.progressBar}>
                                    <Animated.View 
                                        style={[
                                            styles.progressFill,
                                            { width: `${progress}%` }
                                        ]}
                                    />
                                </View>
                            </View>
                        </View>
                        
                        <TouchableOpacity 
                            style={styles.continueButton}
                            onPress={onPress}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.continueButtonText}>
                                {progress > 0 ? 'Continue Learning' : 'Start Course'}
                            </Text>
                            <Ionicons name="arrow-forward" size={18} color={COLORS.surface} />
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Animated.View>
    );
};

export default function DashboardScreen() {
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const { session } = useAuth();
    const router = useRouter();
    const fadeAnim = React.useRef(new Animated.Value(0)).current;

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await fetchMyEnrollments();
            console.log('Loaded enrollments:', data);
            setEnrollments(data || []);
            
            // Fade in animation
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }).start();
        } catch (error: any) {
            console.error('Error loading enrollments:', error);
            Alert.alert('Error', error.message || 'Failed to load courses. Please check your connection.');
            setEnrollments([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const renderCourseCard = ({ item, index }: { item: Enrollment; index: number }) => (
        <CourseCard item={item} index={index} onPress={() => router.push(`/course/${item.course_id}`)} />
    );

    if (loading && !refreshing) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Loading your courses...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
                <View style={styles.headerContent}>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.greeting}>Welcome back!</Text>
                        <Text style={styles.subtext}>
                            {enrollments.length > 0 
                                ? `${enrollments.length} ${enrollments.length === 1 ? 'course' : 'courses'} ready to continue`
                                : 'Start your learning journey today'
                            }
                        </Text>
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
            </Animated.View>

            <FlatList
                data={enrollments}
                renderItem={renderCourseCard}
                keyExtractor={(item) => item.id}
                contentContainerStyle={[
                    styles.listContent,
                    enrollments.length === 0 && styles.emptyListContent
                ]}
                refreshControl={
                    <RefreshControl 
                        refreshing={refreshing} 
                        onRefresh={onRefresh} 
                        tintColor={COLORS.primary}
                        colors={[COLORS.primary]}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIconContainer}>
                            <Ionicons name="library-outline" size={56} color={COLORS.textTertiary} />
                        </View>
                        <Text style={styles.emptyTitle}>No courses yet</Text>
                        <Text style={styles.emptyText}>
                            You haven't enrolled in any courses yet.{'\n'}
                            Check back later or contact your instructor.
                        </Text>
                    </View>
                }
                showsVerticalScrollIndicator={false}
            />
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
        fontWeight: FONT_WEIGHT.medium,
        marginTop: SPACING.md,
    },
    header: {
        backgroundColor: COLORS.surface,
        paddingBottom: SPACING.xl,
        ...SHADOWS.sm,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: SPACING.xl,
        paddingTop: SPACING.lg,
    },
    headerTextContainer: {
        flex: 1,
        paddingRight: SPACING.md,
    },
    greeting: {
        fontSize: FONT_SIZE.xxxl,
        fontWeight: FONT_WEIGHT.extrabold,
        color: COLORS.text,
        letterSpacing: -1.2,
        marginBottom: SPACING.xs,
        lineHeight: 44,
    },
    subtext: {
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
        lineHeight: 22,
        fontWeight: FONT_WEIGHT.medium,
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.md,
    },
    avatarText: {
        color: COLORS.surface,
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.extrabold,
    },
    listContent: {
        padding: SPACING.lg,
        paddingTop: SPACING.xl,
    },
    emptyListContent: {
        flexGrow: 1,
    },
    courseCardWrapper: {
        marginBottom: SPACING.xl,
    },
    courseCard: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.xl,
        overflow: 'hidden',
        ...SHADOWS.lg,
    },
    thumbnailContainer: {
        position: 'relative',
        height: 240,
        backgroundColor: COLORS.borderLight,
    },
    thumbnail: {
        width: '100%',
        height: '100%',
    },
    thumbnailPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: COLORS.backgroundSecondary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholderIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: COLORS.primary + '15',
        alignItems: 'center',
        justifyContent: 'center',
    },
    thumbnailOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 100,
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    progressBadge: {
        position: 'absolute',
        top: SPACING.lg,
        right: SPACING.lg,
        backgroundColor: COLORS.primary,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: 20,
        ...SHADOWS.md,
    },
    progressBadgeIcon: {
        marginRight: 2,
    },
    progressBadgeText: {
        color: COLORS.surface,
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.extrabold,
        letterSpacing: 0.3,
    },
    courseInfo: {
        padding: SPACING.xl,
    },
    courseTitle: {
        fontSize: FONT_SIZE.xxl,
        fontWeight: FONT_WEIGHT.extrabold,
        color: COLORS.text,
        marginBottom: SPACING.sm,
        lineHeight: 32,
        letterSpacing: -0.8,
    },
    courseDescription: {
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
        marginBottom: SPACING.lg,
        lineHeight: 22,
        fontWeight: FONT_WEIGHT.regular,
    },
    progressSection: {
        marginBottom: SPACING.lg,
        padding: SPACING.md,
        backgroundColor: COLORS.backgroundSecondary,
        borderRadius: BORDER_RADIUS.md,
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    progressHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    progressLabel: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
        fontWeight: FONT_WEIGHT.semibold,
    },
    progressPercent: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.primary,
        fontWeight: FONT_WEIGHT.extrabold,
    },
    progressBarContainer: {
        marginTop: SPACING.xs,
    },
    progressBar: {
        height: 8,
        backgroundColor: COLORS.border,
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: COLORS.primary,
        borderRadius: 4,
    },
    continueButton: {
        backgroundColor: COLORS.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.md + 2,
        paddingHorizontal: SPACING.lg,
        borderRadius: BORDER_RADIUS.md,
        gap: SPACING.sm,
        ...SHADOWS.sm,
    },
    continueButtonText: {
        color: COLORS.surface,
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
        letterSpacing: 0.2,
    },
    emptyState: {
        flex: 1,
        padding: SPACING.xxxl,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 400,
    },
    emptyIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: COLORS.backgroundSecondary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.xl,
    },
    emptyTitle: {
        fontSize: FONT_SIZE.xxl,
        fontWeight: FONT_WEIGHT.extrabold,
        color: COLORS.text,
        marginBottom: SPACING.md,
        letterSpacing: -0.5,
    },
    emptyText: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.md,
        textAlign: 'center',
        lineHeight: 24,
        maxWidth: 320,
        fontWeight: FONT_WEIGHT.regular,
    },
});
