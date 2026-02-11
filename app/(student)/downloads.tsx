import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import Theme from '../../constants/theme';
import { useLocalization } from '../../src/context/LocalizationContext';
import { useTheme } from '../../src/context/ThemeContext';
import {
    clearAllOfflineData,
    deleteLessonDownload,
    getOfflineCourses,
    getOfflineStats,
    OfflineCourse,
    OfflineLesson,
    OfflineStats,
    removeCourseOffline,
    verifyDownloadStatuses
} from '../../src/features/offline/offlineManager';

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

const formatRelativeDate = (
    dateString: string,
    t: any,
    isRTL: boolean,
    formatDateFn: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => string
): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t.today;
    if (diffDays === 1) return t.yesterday;
    if (diffDays < 7) {
        return isRTL
            ? `${t.ago} ${diffDays} ${t.days}`
            : `${diffDays} ${t.days} ${t.ago}`;
    }

    return formatDateFn(date, { month: 'short', day: 'numeric' });
};

// ============================================================================
// COMPONENTS
// ============================================================================

interface LessonItemProps {
    lesson: OfflineLesson;
    courseId: string;
    onDelete: () => void;
    onPress: () => void;
    colors: typeof Theme.colors.light;
    isDark: boolean;
    styles: any;
}

const LessonItem: React.FC<LessonItemProps> = ({ lesson, courseId, onDelete, onPress, colors, styles }) => {
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
            case 'completed': return colors.success;
            case 'downloading': return colors.info;
            case 'failed': return colors.error;
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
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
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
    colors: typeof Theme.colors.light;
    isDark: boolean;
    styles: any;
}

const CourseCard: React.FC<CourseCardProps> = ({
    course,
    onPress,
    onDelete,
    onDeleteLesson,
    expanded,
    colors,
    isDark,
    styles
}) => {
    const router = useRouter();
    const { t, isRTL, getLocalizedText, formatDate } = useLocalization();
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
        <View style={[styles.courseCard, { backgroundColor: colors.surface }, Theme.shadows[isDark ? 'dark' : 'light'].md]}>
            <TouchableOpacity style={styles.courseHeader} onPress={onPress}>
                <View style={styles.courseInfo}>
                    <Text style={[styles.courseTitle, { color: colors.text }]} numberOfLines={2}>
                        {getLocalizedText(course.title, course.title_ar)}
                    </Text>
                    <View style={styles.courseMeta}>
                        <View style={styles.metaItem}>
                            <Ionicons name="cloud-download" size={14} color={colors.primary} />
                            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                                {downloadedLessons}/{totalLessons} {t.lessons}
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
                        {t.downloadedOn} {formatRelativeDate(course.downloadedAt, t, isRTL, formatDate)}
                    </Text>
                </View>

                <View style={styles.courseActions}>
                    <TouchableOpacity
                        style={[styles.iconButton, { backgroundColor: colors.error + '20' }]}
                        onPress={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                    >
                        <Ionicons name="trash-outline" size={18} color={colors.error} />
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
                                    isDark={isDark}
                                    styles={styles}
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
    const { t, isRTL, formatDate, getLocalizedText } = useLocalization();
    const styles = useMemo(
        () => createStyles(colors, isDark, isRTL),
        [colors, isDark, isRTL]
    );

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
            console.error(t.failedLoadOfflineData, error);
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
            t.deleteCourseTitle,
            t.removeCourseMessage
                .replace('{title}', getLocalizedText(course.title, course.title_ar))
                .replace('{size}', formatBytes(course.totalSize)),
            [
                { text: t.cancel, style: 'cancel' },
                {
                    text: t.delete,
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await removeCourseOffline(course.id);
                            loadData();
                        } catch (error) {
                            Alert.alert(t.error, t.failedDeleteCourse);
                        }
                    },
                },
            ]
        );
    };

    const handleDeleteLesson = (courseId: string, lessonId: string) => {
        Alert.alert(
            t.deleteLessonTitle,
            t.removeLessonMessage,
            [
                { text: t.cancel, style: 'cancel' },
                {
                    text: t.delete,
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteLessonDownload(courseId, lessonId);
                            loadData();
                        } catch (error) {
                            Alert.alert(t.error, t.failedDeleteLesson);
                        }
                    },
                },
            ]
        );
    };

    const handleClearAll = () => {
        if (courses.length === 0) return;

        Alert.alert(
            t.clearAllDownloadsTitle,
            t.clearAllDownloadsMessage
                .replace('{count}', String(courses.length))
                .replace('{size}', formatBytes(stats?.totalSize || 0)),
            [
                { text: t.cancel, style: 'cancel' },
                {
                    text: t.clearAllAction,
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await clearAllOfflineData();
                            loadData();
                        } catch (error) {
                            Alert.alert(t.error, t.failedClearDownloads);
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
                {t.noDownloadsYet}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                {t.downloadOfflineHint}{'\n'}
                {t.goToCourseDownload}
            </Text>
            <TouchableOpacity
                style={[styles.browseButton, { backgroundColor: colors.primary }]}
                onPress={() => router.push('/(student)/courses')}
            >
                <Text style={styles.browseButtonText}>{t.browseCourses}</Text>
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
                    <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>{t.downloads}</Text>
                {courses.length > 0 && (
                    <TouchableOpacity
                        style={styles.clearButton}
                        onPress={handleClearAll}
                    >
                        <Text style={[styles.clearButtonText, { color: colors.error }]}>{t.clearAllAction}</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Stats Banner */}
            {stats && courses.length > 0 && (
                <Animated.View style={[
                    styles.statsBanner,
                    { backgroundColor: colors.surface, opacity: fadeAnim },
                    Theme.shadows[isDark ? 'dark' : 'light'].sm
                ]}>
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: colors.primary }]}>
                            {stats.totalCourses}
                        </Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                            {t.courses}
                        </Text>
                    </View>
                    <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: colors.primary }]}>
                            {stats.totalLessons}
                        </Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                            {t.lessons}
                        </Text>
                    </View>
                    <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: colors.primary }]}>
                            {formatBytes(stats.totalSize)}
                        </Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                            {t.storageLabel}
                        </Text>
                    </View>
                    <View style={[
                        styles.onlineIndicator,
                        { backgroundColor: stats.isOnline ? colors.success : colors.error }
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
                        { paddingBottom: TAB_BAR_HEIGHT + Theme.spacing.lg }
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
                            isDark={isDark}
                            styles={styles}
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

function createStyles(colors: typeof Theme.colors.light, isDark: boolean, isRTL: boolean) {
    return StyleSheet.create({
        container: {
            flex: 1,
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
        },
        header: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: Theme.spacing.md,
            paddingVertical: Theme.spacing.sm,
            borderBottomWidth: 1,
        },
        backButton: {
            padding: Theme.spacing.xs,
        },
        headerTitle: {
            fontSize: Theme.fontSize.lg,
            fontWeight: Theme.fontWeight.bold,
            flex: 1,
            textAlign: 'center',
        },
        clearButton: {
            padding: Theme.spacing.xs,
        },
        clearButtonText: {
            fontSize: Theme.fontSize.sm,
            fontWeight: Theme.fontWeight.semibold,
        },
        statsBanner: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-around',
            marginHorizontal: Theme.spacing.md,
            marginTop: Theme.spacing.md,
            padding: Theme.spacing.md,
            borderRadius: Theme.borderRadius.lg,
            position: 'relative',
        },
        statItem: {
            alignItems: 'center',
            flex: 1,
        },
        statValue: {
            fontSize: Theme.fontSize.xl,
            fontWeight: Theme.fontWeight.bold,
        },
        statLabel: {
            fontSize: Theme.fontSize.xs,
            marginTop: 2,
        },
        statDivider: {
            width: 1,
            height: 32,
        },
        onlineIndicator: {
            position: 'absolute',
            top: -6,
            right: isRTL ? undefined : -6,
            left: isRTL ? -6 : undefined,
            width: 24,
            height: 24,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
        },
        listContent: {
            padding: Theme.spacing.md,
        },
        courseCard: {
            borderRadius: Theme.borderRadius.lg,
            marginBottom: Theme.spacing.md,
            overflow: 'hidden',
        },
        courseHeader: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            padding: Theme.spacing.md,
        },
        courseInfo: {
            flex: 1,
        },
        courseTitle: {
            fontSize: Theme.fontSize.base,
            fontWeight: Theme.fontWeight.semibold,
            marginBottom: Theme.spacing.xs,
            textAlign: isRTL ? 'right' : 'left',
        },
        courseMeta: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: Theme.spacing.md,
            marginBottom: Theme.spacing.xs,
        },
        metaItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        metaText: {
            fontSize: Theme.fontSize.xs,
        },
        downloadDate: {
            fontSize: Theme.fontSize.xs,
            textAlign: isRTL ? 'right' : 'left',
        },
        courseActions: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: Theme.spacing.sm,
        },
        iconButton: {
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
        },
        lessonsContainer: {
            paddingHorizontal: Theme.spacing.md,
            paddingBottom: Theme.spacing.md,
        },
        divider: {
            height: 1,
            marginBottom: Theme.spacing.sm,
        },
        moduleName: {
            fontSize: Theme.fontSize.xs,
            fontWeight: Theme.fontWeight.semibold,
            marginTop: Theme.spacing.md,
            marginBottom: Theme.spacing.xs,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            textAlign: isRTL ? 'right' : 'left',
        },
        lessonItem: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            padding: Theme.spacing.sm,
            borderRadius: Theme.borderRadius.md,
            marginBottom: Theme.spacing.xs,
        },
        lessonIcon: {
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: isRTL ? 0 : Theme.spacing.sm,
            marginLeft: isRTL ? Theme.spacing.sm : 0,
        },
        lessonInfo: {
            flex: 1,
        },
        lessonTitle: {
            fontSize: Theme.fontSize.sm,
            fontWeight: Theme.fontWeight.medium,
            textAlign: isRTL ? 'right' : 'left',
        },
        lessonMeta: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            marginTop: 2,
        },
        statusDot: {
            width: 6,
            height: 6,
            borderRadius: 3,
            marginRight: isRTL ? 0 : 6,
            marginLeft: isRTL ? 6 : 0,
        },
        lessonStatus: {
            fontSize: Theme.fontSize.xs,
            textAlign: isRTL ? 'right' : 'left',
        },
        deleteButton: {
            padding: Theme.spacing.xs,
        },
        emptyState: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: Theme.spacing.xl,
        },
        emptyIcon: {
            width: 96,
            height: 96,
            borderRadius: 48,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: Theme.spacing.lg,
        },
        emptyTitle: {
            fontSize: Theme.fontSize.xl,
            fontWeight: Theme.fontWeight.bold,
            marginBottom: Theme.spacing.sm,
            textAlign: 'center',
        },
        emptySubtitle: {
            fontSize: Theme.fontSize.base,
            textAlign: 'center',
            lineHeight: 22,
            marginBottom: Theme.spacing.xl,
        },
        browseButton: {
            paddingHorizontal: Theme.spacing.xl,
            paddingVertical: Theme.spacing.md,
            borderRadius: Theme.borderRadius.lg,
            marginBottom: Theme.spacing.md,
        },
        browseButtonText: {
            color: '#fff',
            fontSize: Theme.fontSize.base,
            fontWeight: Theme.fontWeight.semibold as any,
        },
    });
}

