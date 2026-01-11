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
            delay: index * 80,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
        }).start();
    }, []);

    const scale = cardAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.96, 1],
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
                        <View style={styles.progressBadge}>
                            <Ionicons name="checkmark-circle" size={14} color={COLORS.surface} />
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
                                <Text style={styles.progressLabel}>Progress</Text>
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
                    </View>
                </TouchableOpacity>
            </Animated.View>
    );
};

export default function CoursesScreen() {
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
                    <Text style={styles.loadingText}>Loading courses...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
                <View style={styles.headerContent}>
                    <View>
                        <Text style={styles.headerTitle}>My Courses</Text>
                        <Text style={styles.headerSubtitle}>
                            {enrollments.length} {enrollments.length === 1 ? 'course' : 'courses'} enrolled
                        </Text>
                    </View>
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
                            Enroll in courses from the dashboard{'\n'}
                            to see them here
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
        paddingHorizontal: SPACING.xl,
        paddingTop: SPACING.lg,
    },
    headerTitle: {
        fontSize: FONT_SIZE.xxxl,
        fontWeight: FONT_WEIGHT.extrabold,
        color: COLORS.text,
        marginBottom: SPACING.xs,
        letterSpacing: -1.2,
        lineHeight: 44,
    },
    headerSubtitle: {
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
        fontWeight: FONT_WEIGHT.medium,
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
        height: 220,
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
        lineHeight: 30,
        letterSpacing: -0.6,
    },
    courseDescription: {
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
        marginBottom: SPACING.lg,
        lineHeight: 22,
        fontWeight: FONT_WEIGHT.regular,
    },
    progressSection: {
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
