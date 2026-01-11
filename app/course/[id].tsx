import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import RenderHtml from 'react-native-render-html';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchCourseContentWithOfflineSupport } from '../../src/features/courses/courseService';
import { deleteLessonDownload, downloadLessonVideo, getLocalLessonUri, isLessonDownloaded } from '../../src/features/offline/downloadManager';
import { BORDER_RADIUS, COLORS, FONT_SIZE, SPACING } from '../../src/lib/constants';
import { CourseDetail, Lesson } from '../../src/types';

export default function CoursePlayerScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const [course, setCourse] = useState<CourseDetail | null>(null);
    const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
    const [loading, setLoading] = useState(true);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [isDownloaded, setIsDownloaded] = useState(false);
    const videoRef = useRef<Video>(null);
    const { width } = useWindowDimensions();
    const router = useRouter();

    useEffect(() => {
        if (id) {
            loadCourseContent();
        }
    }, [id]);

    const loadCourseContent = async () => {
        try {
            setLoading(true);
            const data = await fetchCourseContentWithOfflineSupport(id!);
            setCourse(data);

            // Auto-select first lesson
            if (data.modules.length > 0 && data.modules[0].lessons.length > 0) {
                setCurrentLesson(data.modules[0].lessons[0]);
            }
        } catch (error) {
            console.error('Failed to load course:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (currentLesson?.content_type === 'video') {
            checkDownloadStatus();
        } else {
            setIsDownloaded(false);
        }
    }, [currentLesson]);

    const checkDownloadStatus = async () => {
        if (currentLesson) {
            const exists = await isLessonDownloaded(currentLesson.id);
            setIsDownloaded(exists);
        }
    };

    const handleLessonSelect = (lesson: Lesson) => {
        setCurrentLesson(lesson);
    };

    const handleDownload = async () => {
        if (!currentLesson || !currentLesson.video_url) return;

        if (isDownloaded) {
            await deleteLessonDownload(currentLesson.id);
            setIsDownloaded(false);
            return;
        }

        try {
            setIsDownloading(true);
            await downloadLessonVideo(currentLesson.id, currentLesson.video_url, (progress) => {
                setDownloadProgress(progress);
            });
            setIsDownloaded(true);
        } catch (error) {
            console.error('Download error:', error);
        } finally {
            setIsDownloading(false);
            setDownloadProgress(0);
        }
    };

    const getVideoSource = () => {
        if (isDownloaded && currentLesson) {
            return { uri: getLocalLessonUri(currentLesson.id) };
        }
        return { uri: currentLesson?.video_url || '' };
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    if (!course) {
        return (
            <View style={styles.centerContainer}>
                <Text>Course not found</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Player Area */}
            <View style={styles.playerContainer}>
                {currentLesson?.content_type === 'video' && currentLesson.video_url ? (
                    <Video
                        ref={videoRef}
                        style={styles.video}
                        source={getVideoSource()}
                        useNativeControls
                        resizeMode={ResizeMode.CONTAIN}
                        isLooping={false}
                    />
                ) : (
                    <View style={styles.placeholderContainer}>
                        {currentLesson?.content_type === 'text' ? (
                            <View style={styles.textHeader}>
                                <Text style={styles.textHeaderText}>Text Lesson</Text>
                            </View>
                        ) : currentLesson?.content_type === 'quiz' ? (
                            <View style={styles.textHeader}>
                                <Text style={styles.textHeaderText}>Quiz: {currentLesson.title}</Text>
                                <Text style={{ marginTop: 8, color: '#666' }}>Tap "Start Quiz" below</Text>
                            </View>
                        ) : (
                            <Text style={styles.placeholderText}>Select a lesson to start</Text>
                        )}
                    </View>
                )}
            </View>

            {/* Content Area */}
            <View style={styles.contentContainer}>
                <View style={styles.lessonHeader}>
                    <Text style={styles.lessonTitle}>{currentLesson?.title}</Text>
                    <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color={COLORS.text} />
                    </TouchableOpacity>
                </View>

                {currentLesson?.content_type === 'text' && currentLesson.content_html && (
                    <ScrollView style={styles.htmlContainer}>
                        <RenderHtml
                            contentWidth={width - SPACING.lg * 2}
                            source={{ html: currentLesson.content_html }}
                            tagsStyles={{
                                p: { fontSize: FONT_SIZE.md, color: COLORS.text, marginBottom: SPACING.md },
                                h1: { fontSize: FONT_SIZE.xl, color: COLORS.primary, marginBottom: SPACING.md },
                                h2: { fontSize: FONT_SIZE.lg, color: COLORS.text, marginBottom: SPACING.sm },
                            }}
                        />
                    </ScrollView>
                )}

                {/* Course Outline (if not reading text, or maybe below text? Let's use tabs or just a list below) */}
                {/* For simplicity in this version, simple list below player if not text, or togglable? */}
                {/* Let's show the list if it's a video lesson or just list always below? */}
                {/* Given standard mobile UX, usually there's a "Course" tab and "Discuss" tab, or just list below video. */}

                {currentLesson?.content_type !== 'text' && (
                    <ScrollView style={styles.moduleList}>
                        <Text style={styles.sectionHeader}>Course Content</Text>
                        {course.modules.map((module) => (
                            <View key={module.id} style={styles.moduleContainer}>
                                <Text style={styles.moduleTitle}>{module.title}</Text>
                                {module.lessons.map((lesson) => (
                                    <TouchableOpacity
                                        key={lesson.id}
                                        style={[
                                            styles.lessonItem,
                                            currentLesson?.id === lesson.id && styles.activeLessonItem
                                        ]}
                                        onPress={() => handleLessonSelect(lesson)}
                                    >
                                        <Ionicons
                                            name={lesson.content_type === 'video' ? 'play-circle-outline' : 'document-text-outline'}
                                            size={20}
                                            color={currentLesson?.id === lesson.id ? COLORS.primary : COLORS.textSecondary}
                                        />
                                        <Text
                                            style={[
                                                styles.lessonItemTitle,
                                                currentLesson?.id === lesson.id && styles.activeLessonText
                                            ]}
                                            numberOfLines={1}
                                        >
                                            {lesson.title}
                                        </Text>
                                        {/* Download Icon */}
                                        {lesson.content_type === 'video' && (
                                            <TouchableOpacity
                                                onPress={() => {
                                                    if (currentLesson?.id === lesson.id) handleDownload();
                                                    else {
                                                        // Quick download from list? For now just handle current lesson
                                                        handleLessonSelect(lesson);
                                                    }
                                                }}
                                                disabled={isDownloading && currentLesson?.id === lesson.id}
                                            >
                                                {isDownloading && currentLesson?.id === lesson.id ? (
                                                    <View style={{ width: 20, height: 20, justifyContent: 'center', alignItems: 'center' }}>
                                                        <Text style={{ fontSize: 8, color: COLORS.primary }}>{Math.round(downloadProgress * 100)}%</Text>
                                                    </View>
                                                ) : (
                                                    <Ionicons
                                                        name={isDownloaded && currentLesson?.id === lesson.id ? "checkmark-circle" : "download-outline"}
                                                        size={20}
                                                        color={isDownloaded && currentLesson?.id === lesson.id ? COLORS.success : COLORS.textSecondary}
                                                    />
                                                )}
                                            </TouchableOpacity>
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ))}
                    </ScrollView>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    playerContainer: {
        width: '100%',
        aspectRatio: 16 / 9,
        backgroundColor: '#000',
    },
    video: {
        flex: 1,
    },
    placeholderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f0f0f0',
    },
    placeholderText: {
        color: '#666',
    },
    textHeader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    textHeaderText: {
        fontWeight: 'bold',
        color: COLORS.primary,
    },
    contentContainer: {
        flex: 1,
    },
    lessonHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.md,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    lessonTitle: {
        fontSize: FONT_SIZE.md,
        fontWeight: 'bold',
        color: COLORS.text,
        flex: 1,
    },
    closeButton: {
        padding: SPACING.xs,
    },
    htmlContainer: {
        flex: 1,
        padding: SPACING.md,
    },
    moduleList: {
        flex: 1,
        padding: SPACING.md,
    },
    sectionHeader: {
        fontSize: FONT_SIZE.lg,
        fontWeight: 'bold',
        marginBottom: SPACING.md,
        color: COLORS.text,
    },
    moduleContainer: {
        marginBottom: SPACING.lg,
    },
    moduleTitle: {
        fontSize: FONT_SIZE.sm,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginBottom: SPACING.sm,
        textTransform: 'uppercase',
    },
    lessonItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    activeLessonItem: {
        backgroundColor: '#FFF0F5', // Light burgundy tint
        paddingHorizontal: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        borderBottomWidth: 0,
        borderLeftWidth: 3,
        borderLeftColor: COLORS.primary,
    },
    lessonItemTitle: {
        marginLeft: SPACING.sm,
        fontSize: FONT_SIZE.md,
        color: COLORS.text,
        flex: 1,
    },
    activeLessonText: {
        color: COLORS.primary,
        fontWeight: '600',
    },
});
