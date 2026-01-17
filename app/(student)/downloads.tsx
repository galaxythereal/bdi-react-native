import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    FlatList,
    Platform,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/context/ThemeContext';
import {
    getOfflineCourses,
    getOfflineStats,
    removeCourseOffline,
    deleteLessonDownload,
    clearAllOfflineData,
    getIsOnline,
    verifyDownloadStatuses,
    OfflineCourse,
    OfflineLesson,
    OfflineStats,
} from '../../src/features/offline/offlineManager';
import { BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT, SHADOWS, SPACING } from '../../src/lib/constants';

// ============================================================================
// HELPERS
// ============================================================================

const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ============================================================================
// COMPONENTS
// ============================================================================

interface LessonItemProps {
    lesson: OfflineLesson;
    courseId: string;
    onDelete: () => void;
    onPress: () => void;
    colors: any;
}

const LessonItem: React.FC<LessonItemProps> = ({ lesson, courseId, onDelete, onPress, colors }) => {
    const getIcon = () => {
        switch (lesson.content_type) {
            case 'video': return 'play-circle';
            case 'quiz': return 'help-circle';
            case 'text': return 'document-text';
            case 'audio': return 'musical-notes';
            case 'file': return 'document';
            case 'image': return 'image';
            default: return 'document';
        }
    };
    
    const getStatusColor = () => {
        switch (lesson.downloadStatus) {
            case 'completed': return '#10B981';
            case 'downloading': return '#3B82F6';
            case 'failed': return '#EF4444';
            default: return colors.textTertiary;
        }
    };
    
    const isDownloaded = lesson.downloadStatus === 'completed';
    
    return (
        <TouchableOpacity
            style={[styles.lessonItem, { backgroundColor: colors.surface }]}
            onPress={onPress}
            disabled={!isDownloaded}
        >
            <View style={[styles.lessonIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name={getIcon()} size={20} color={colors.primary} />
            </View>
            
            <View style={styles.lessonInfo}>
                <Text style={[styles.lessonTitle, { color: colors.text }]} numberOfLines={1}>
                    {lesson.title}
                </Text>
                <View style={styles.lessonMeta}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
                    <Text style={[styles.lessonStatus, { color: colors.textSecondary }]}>
                        {lesson.downloadStatus === 'completed' 
                            ? formatBytes(lesson.fileSize || 0)
                            : lesson.downloadStatus === 'downloading'
                                ? `${Math.round(lesson.downloadProgress * 100)}%`
                                : lesson.downloadStatus}
                    </Text>
                </View>
            </View>
            
            {isDownloaded && (
                <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                >
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
            )}
        </TouchableOpacity>
    );
};

interface CourseCardProps {
    course: OfflineCourse;
    onPress: () => void;
    onDelete: () => void;
    onDeleteLesson: (lessonId: string) => void;
    expanded: boolean;
    colors: any;
}

const CourseCard: React.FC<CourseCardProps> = ({ 
    course, 
    onPress, 
    onDelete, 
    onDeleteLesson,
    expanded, 
    colors 
}) => {
    const router = useRouter();
    const rotateAnim = useRef(new Animated.Value(expanded ? 1 : 0)).current;
    
    useEffect(() => {
        Animated.timing(rotateAnim, {
            toValue: expanded ? 1 : 0,
            duration: 200,
            useNativeDriver: true,
        }).start();
    }, [expanded]);
    
    const downloadedLessons = course.modules.reduce((total, mod) => 
        total + mod.lessons.filter(l => l.downloadStatus === 'completed').length, 0
    );
    const totalLessons = course.modules.reduce((total, mod) => total + mod.lessons.length, 0);
    
    const rotate = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '180deg'],
    });
    
    return (
        <View style={[styles.courseCard, { backgroundColor: colors.surface }, SHADOWS.md]}>
            <TouchableOpacity style={styles.courseHeader} onPress={onPress}>
                <View style={styles.courseInfo}>
                    <Text style={[styles.courseTitle, { color: colors.text }]} numberOfLines={2}>
                        {course.title}
                    </Text>
                    <View style={styles.courseMeta}>
                        <View style={styles.metaItem}>
                            <Ionicons name="cloud-download" size={14} color={colors.primary} />
                            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                                {downloadedLessons}/{totalLessons} lessons
                            </Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Ionicons name="folder" size={14} color={colors.primary} />
                            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                                {formatBytes(course.totalSize)}
                            </Text>
                        </View>
                    </View>
                    <Text style={[styles.downloadDate, { color: colors.textTertiary }]}>
                        Downloaded {formatDate(course.downloadedAt)}
                    </Text>
                </View>
                
                <View style={styles.courseActions}>
                    <TouchableOpacity
                        style={[styles.iconButton, { backgroundColor: colors.errorLight }]}
                        onPress={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                    >
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                    <Animated.View style={{ transform: [{ rotate }] }}>
                        <Ionicons name="chevron-down" size={24} color={colors.textSecondary} />
                    </Animated.View>
                </View>
            </TouchableOpacity>
            
            {expanded && (
                <View style={styles.lessonsContainer}>
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    {course.modules.map(module => (
                        <View key={module.id}>
                            {course.modules.length > 1 && (
                                <Text style={[styles.moduleName, { color: colors.textSecondary }]}>
                                    {module.title}
                                </Text>
                            )}
                            {module.lessons.map(lesson => (
                                <LessonItem
                                    key={lesson.id}
                                    lesson={lesson}
                                    courseId={course.id}
                                    colors={colors}
                                    onPress={() => router.push(`/course/${course.id}`)}
                                    onDelete={() => onDeleteLesson(lesson.id)}
                                />
                            ))}
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
};

// ============================================================================
// MAIN SCREEN
// ============================================================================

export default function DownloadsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    
    const [courses, setCourses] = useState<OfflineCourse[]>([]);
    const [stats, setStats] = useState<OfflineStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);
    
    // Tab bar height
    const TAB_BAR_HEIGHT = 56 + Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 24);
    
    // Animation
    const fadeAnim = useRef(new Animated.Value(0)).current;
    
    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );
    
    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
        }).start();
    }, []);
    
    const loadData = async () => {
        try {
            // First verify download statuses by checking actual files
            await verifyDownloadStatuses();
            
            const [coursesData, statsData] = await Promise.all([
                getOfflineCourses(),
                getOfflineStats(),
            ]);
            setCourses(coursesData);
            setStats(statsData);
        } catch (error) {
            console.error('Failed to load offline data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };
    
    const handleRefresh = () => {
        setRefreshing(true);
        loadData();
    };
    
    const handleDeleteCourse = (course: OfflineCourse) => {
        Alert.alert(
            'Delete Course',
            `Remove "${course.title}" and all its downloaded content? This will free up ${formatBytes(course.totalSize)}.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await removeCourseOffline(course.id);
                            loadData();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete course');
                        }
                    },
                },
            ]
        );
    };
    
    const handleDeleteLesson = (courseId: string, lessonId: string) => {
        Alert.alert(
            'Delete Lesson',
            'Remove this lesson\'s downloaded content?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteLessonDownload(courseId, lessonId);
                            loadData();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete lesson');
                        }
                    },
                },
            ]
        );
    };
    
    const handleClearAll = () => {
        if (courses.length === 0) return;
        
        Alert.alert(
            'Clear All Downloads',
            `This will delete all ${courses.length} downloaded courses and free up ${formatBytes(stats?.totalSize || 0)}. This cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear All',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await clearAllOfflineData();
                            loadData();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to clear downloads');
                        }
                    },
                },
            ]
        );
    };
    
    const toggleExpanded = (courseId: string) => {
        setExpandedCourseId(prev => prev === courseId ? null : courseId);
    };
    
    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="cloud-download-outline" size={48} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
                No Downloads Yet
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Download courses to watch them offline.{'\n'}
                Go to a course and tap the download button.
            </Text>
            <TouchableOpacity
                style={[styles.browseButton, { backgroundColor: colors.primary }]}
                onPress={() => router.push('/(student)/courses')}
            >
                <Text style={styles.browseButtonText}>Browse Courses</Text>
            </TouchableOpacity>
        </View>
    );
    
    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }
    
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <TouchableOpacity 
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Downloads</Text>
                {courses.length > 0 && (
                    <TouchableOpacity 
                        style={styles.clearButton}
                        onPress={handleClearAll}
                    >
                        <Text style={[styles.clearButtonText, { color: '#EF4444' }]}>Clear All</Text>
                    </TouchableOpacity>
                )}
            </View>
            
            {/* Stats Banner */}
            {stats && courses.length > 0 && (
                <Animated.View style={[
                    styles.statsBanner,
                    { backgroundColor: colors.surface, opacity: fadeAnim },
                    SHADOWS.sm
                ]}>
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: colors.primary }]}>
                            {stats.totalCourses}
                        </Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                            Courses
                        </Text>
                    </View>
                    <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: colors.primary }]}>
                            {stats.totalLessons}
                        </Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                            Lessons
                        </Text>
                    </View>
                    <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: colors.primary }]}>
                            {formatBytes(stats.totalSize)}
                        </Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                            Storage
                        </Text>
                    </View>
                    <View style={[
                        styles.onlineIndicator,
                        { backgroundColor: stats.isOnline ? '#10B981' : '#EF4444' }
                    ]}>
                        <Ionicons 
                            name={stats.isOnline ? 'wifi' : 'wifi-outline'} 
                            size={12} 
                            color="#fff" 
                        />
                    </View>
                </Animated.View>
            )}
            
            {/* Content */}
            {courses.length === 0 ? (
                renderEmptyState()
            ) : (
                <FlatList
                    data={courses}
                    keyExtractor={item => item.id}
                    contentContainerStyle={[
                        styles.listContent,
                        { paddingBottom: TAB_BAR_HEIGHT + SPACING.lg }
                    ]}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            tintColor={colors.primary}
                        />
                    }
                    renderItem={({ item }) => (
                        <CourseCard
                            course={item}
                            colors={colors}
                            expanded={expandedCourseId === item.id}
                            onPress={() => toggleExpanded(item.id)}
                            onDelete={() => handleDeleteCourse(item)}
                            onDeleteLesson={(lessonId) => handleDeleteLesson(item.id, lessonId)}
                        />
                    )}
                />
            )}
        </SafeAreaView>
    );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderBottomWidth: 1,
    },
    backButton: {
        padding: SPACING.xs,
    },
    headerTitle: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold as any,
        flex: 1,
        textAlign: 'center',
    },
    clearButton: {
        padding: SPACING.xs,
    },
    clearButtonText: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.semibold as any,
    },
    statsBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        marginHorizontal: SPACING.md,
        marginTop: SPACING.md,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        position: 'relative',
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statValue: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold as any,
    },
    statLabel: {
        fontSize: FONT_SIZE.xs,
        marginTop: 2,
    },
    statDivider: {
        width: 1,
        height: 32,
    },
    onlineIndicator: {
        position: 'absolute',
        top: -6,
        right: -6,
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContent: {
        padding: SPACING.md,
    },
    courseCard: {
        borderRadius: BORDER_RADIUS.lg,
        marginBottom: SPACING.md,
        overflow: 'hidden',
    },
    courseHeader: {
        flexDirection: 'row',
        padding: SPACING.md,
    },
    courseInfo: {
        flex: 1,
    },
    courseTitle: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold as any,
        marginBottom: SPACING.xs,
    },
    courseMeta: {
        flexDirection: 'row',
        gap: SPACING.md,
        marginBottom: SPACING.xs,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: FONT_SIZE.xs,
    },
    downloadDate: {
        fontSize: FONT_SIZE.xs,
    },
    courseActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    iconButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    lessonsContainer: {
        paddingHorizontal: SPACING.md,
        paddingBottom: SPACING.md,
    },
    divider: {
        height: 1,
        marginBottom: SPACING.sm,
    },
    moduleName: {
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.semibold as any,
        marginTop: SPACING.sm,
        marginBottom: SPACING.xs,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    lessonItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.sm,
        borderRadius: BORDER_RADIUS.md,
        marginBottom: SPACING.xs,
    },
    lessonIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.sm,
    },
    lessonInfo: {
        flex: 1,
    },
    lessonTitle: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.medium as any,
    },
    lessonMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
    },
    lessonStatus: {
        fontSize: FONT_SIZE.xs,
    },
    deleteButton: {
        padding: SPACING.xs,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: SPACING.xl,
    },
    emptyIcon: {
        width: 96,
        height: 96,
        borderRadius: 48,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.lg,
    },
    emptyTitle: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold as any,
        marginBottom: SPACING.sm,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: FONT_SIZE.md,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: SPACING.xl,
    },
    browseButton: {
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.full,
    },
    browseButtonText: {
        color: '#fff',
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold as any,
    },
});
