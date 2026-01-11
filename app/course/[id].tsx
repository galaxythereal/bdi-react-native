import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    FlatList,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import RenderHtml from 'react-native-render-html';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QuizComponent, QuizData, QuizResult } from '../../src/components/QuizComponent';
import { fetchCourseContentWithOfflineSupport } from '../../src/features/courses/courseService';
import {
    deleteLessonDownload,
    downloadLessonVideo,
    getLocalLessonUri,
    isLessonDownloaded,
} from '../../src/features/offline/downloadManager';
import { BORDER_RADIUS, COLORS, FONT_SIZE, FONT_WEIGHT, SPACING } from '../../src/lib/constants';
import { CourseDetail, Lesson, Module } from '../../src/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FlattenedLesson extends Lesson {
    moduleIndex: number;
    lessonIndex: number;
    moduleTitle: string;
    totalInModule: number;
    description?: string | null;
    quiz_data?: any;
    blocks?: any[];
    video_provider?: 'youtube' | 'vimeo' | 'wistia' | 'direct';
}

// Helper function to convert video URLs to embeddable format
const getEmbedUrl = (url: string | null, provider: string = 'direct'): string | null => {
    if (!url) return null;
    
    if (provider === 'youtube') {
        // Handle various YouTube URL formats
        const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)?.[1];
        if (!videoId) return null;
        // Use youtube-nocookie for better privacy and fewer restrictions
        // Add origin parameter for playback permissions
        return `https://www.youtube-nocookie.com/embed/${videoId}?playsinline=1&rel=0&modestbranding=1&enablejsapi=1&origin=https://localhost`;
    }
    
    if (provider === 'vimeo') {
        const videoId = url.match(/vimeo\.com\/(\d+)/)?.[1];
        return videoId ? `https://player.vimeo.com/video/${videoId}?playsinline=1&byline=0&portrait=0` : null;
    }
    
    if (provider === 'wistia') {
        const videoId = url.match(/wistia\.com\/medias\/(\w+)/)?.[1];
        return videoId ? `https://fast.wistia.net/embed/iframe/${videoId}?playsinline=true` : null;
    }
    
    // For direct URLs, return as-is (will use native Video component)
    return url;
};

// Check if video requires WebView (embedded player)
const isEmbeddedVideo = (provider: string = 'direct'): boolean => {
    return ['youtube', 'vimeo', 'wistia'].includes(provider);
};

export default function CoursePlayerScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    // Core state
    const [course, setCourse] = useState<CourseDetail | null>(null);
    const [allLessons, setAllLessons] = useState<FlattenedLesson[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // UI state
    const [showSidebar, setShowSidebar] = useState(false);
    const [showQuiz, setShowQuiz] = useState(false);
    const [quizData, setQuizData] = useState<QuizData | null>(null);

    // Video state
    const [isPlaying, setIsPlaying] = useState(false);
    const [isBuffering, setIsBuffering] = useState(false);
    const [videoProgress, setVideoProgress] = useState(0);
    const [videoDuration, setVideoDuration] = useState(0);
    const [showControls, setShowControls] = useState(true);

    // Download state
    const [downloadStates, setDownloadStates] = useState<Map<string, {
        isDownloaded: boolean;
        isDownloading: boolean;
        progress: number;
    }>>(new Map());

    // Refs
    const videoRef = useRef<Video>(null);
    const controlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Current lesson
    const currentLesson = allLessons[currentIndex] || null;

    useEffect(() => {
        if (id) {
            loadCourseContent();
        }
    }, [id]);

    // Auto-hide controls
    useEffect(() => {
        if (showControls && isPlaying) {
            controlsTimeout.current = setTimeout(() => {
                setShowControls(false);
            }, 3000);
        }
        return () => {
            if (controlsTimeout.current) {
                clearTimeout(controlsTimeout.current);
            }
        };
    }, [showControls, isPlaying]);

    const loadCourseContent = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await fetchCourseContentWithOfflineSupport(id!);
            setCourse(data);

            // Flatten all lessons for easy navigation
            const flattened: FlattenedLesson[] = [];
            data.modules.forEach((module: Module, moduleIndex: number) => {
                module.lessons.forEach((lesson: Lesson, lessonIndex: number) => {
                    flattened.push({
                        ...lesson,
                        moduleIndex,
                        lessonIndex,
                        moduleTitle: module.title,
                        totalInModule: module.lessons.length,
                    });
                });
            });
            setAllLessons(flattened);

            // Check download status for video lessons
            for (const lesson of flattened) {
                if (lesson.content_type === 'video') {
                    const exists = await isLessonDownloaded(lesson.id);
                    setDownloadStates(prev => {
                        const newMap = new Map(prev);
                        newMap.set(lesson.id, { isDownloaded: exists, isDownloading: false, progress: exists ? 1 : 0 });
                        return newMap;
                    });
                }
            }
        } catch (err: any) {
            console.error('Failed to load course:', err);
            setError(err.message || 'Failed to load course content');
        } finally {
            setLoading(false);
        }
    };

    const toggleSidebar = () => {
        setShowSidebar(!showSidebar);
    };

    const selectLesson = (index: number) => {
        setCurrentIndex(index);
        setShowSidebar(false);
        setShowQuiz(false);
        setIsPlaying(false);
        setVideoProgress(0);
        setVideoDuration(0);

        const lesson = allLessons[index];
        if (lesson?.content_type === 'quiz' && lesson.quiz_data) {
            prepareQuiz(lesson);
        }
    };

    const prepareQuiz = (lesson: FlattenedLesson) => {
        const quiz = lesson.quiz_data || {
            id: lesson.id,
            title: lesson.title,
            description: 'Test your knowledge',
            time_limit: 15,
            passing_score: 70,
            allow_retry: true,
            questions: [
                {
                    id: '1',
                    question: 'Sample question for this lesson',
                    type: 'multiple_choice' as const,
                    options: ['Option A', 'Option B', 'Option C', 'Option D'],
                    correct_answer: 0,
                    explanation: 'This is the explanation.',
                    points: 1,
                },
            ],
        };
        setQuizData(quiz);
    };

    const navigateLesson = (direction: 'next' | 'prev') => {
        const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
        if (newIndex >= 0 && newIndex < allLessons.length) {
            selectLesson(newIndex);
        }
    };

    const handleVideoPlaybackStatus = (status: AVPlaybackStatus) => {
        if (!status.isLoaded) {
            setIsBuffering(true);
            return;
        }
        
        setIsBuffering(status.isBuffering);
        setIsPlaying(status.isPlaying);
        setVideoProgress(status.positionMillis || 0);
        setVideoDuration(status.durationMillis || 0);

        if (status.didJustFinish) {
            setIsPlaying(false);
            if (currentIndex < allLessons.length - 1) {
                setTimeout(() => navigateLesson('next'), 1500);
            }
        }
    };

    const togglePlayPause = async () => {
        if (!videoRef.current) return;
        if (isPlaying) {
            await videoRef.current.pauseAsync();
        } else {
            await videoRef.current.playAsync();
        }
    };

    const seekVideo = async (position: number) => {
        if (videoRef.current) {
            await videoRef.current.setPositionAsync(position);
        }
    };

    const handleDownload = async (lessonId: string, videoUrl: string) => {
        if (!videoUrl) return;

        setDownloadStates(prev => {
            const newMap = new Map(prev);
            newMap.set(lessonId, { isDownloaded: false, isDownloading: true, progress: 0 });
            return newMap;
        });

        try {
            await downloadLessonVideo(lessonId, videoUrl, (progress) => {
                setDownloadStates(prev => {
                    const newMap = new Map(prev);
                    newMap.set(lessonId, { isDownloaded: false, isDownloading: true, progress });
                    return newMap;
                });
            });

            setDownloadStates(prev => {
                const newMap = new Map(prev);
                newMap.set(lessonId, { isDownloaded: true, isDownloading: false, progress: 1 });
                return newMap;
            });
        } catch (err) {
            console.error('Download error:', err);
            setDownloadStates(prev => {
                const newMap = new Map(prev);
                newMap.set(lessonId, { isDownloaded: false, isDownloading: false, progress: 0 });
                return newMap;
            });
        }
    };

    const getVideoSource = () => {
        if (!currentLesson) return null;
        const state = downloadStates.get(currentLesson.id);
        if (state?.isDownloaded) {
            return { uri: getLocalLessonUri(currentLesson.id) };
        }
        return currentLesson.video_url ? { uri: currentLesson.video_url } : null;
    };

    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const getLessonIcon = (type: string) => {
        const iconMap: Record<string, string> = {
            video: 'play-circle',
            text: 'document-text',
            quiz: 'help-circle',
            file: 'document-attach',
            image: 'image',
        };
        return iconMap[type] || 'document';
    };

    const handleQuizComplete = (result: QuizResult) => {
        console.log('Quiz completed:', result);
        setShowQuiz(false);
        if (currentIndex < allLessons.length - 1) {
            setTimeout(() => navigateLesson('next'), 1000);
        }
    };

    // Loading state
    if (loading) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <StatusBar barStyle="light-content" />
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading course...</Text>
            </View>
        );
    }

    // Error state
    if (error || !course) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <StatusBar barStyle="light-content" />
                <Ionicons name="cloud-offline-outline" size={64} color={COLORS.textTertiary} />
                <Text style={styles.errorTitle}>Unable to Load Course</Text>
                <Text style={styles.errorText}>{error || 'Course not found'}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={loadCourseContent}>
                    <Text style={styles.retryButtonText}>Try Again</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
                    <Text style={styles.backLinkText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Quiz fullscreen view
    if (showQuiz && quizData) {
        return (
            <View style={[styles.container, { paddingTop: insets.top, backgroundColor: COLORS.background }]}>
                <StatusBar barStyle="dark-content" />
                <QuizComponent
                    quiz={quizData}
                    onComplete={handleQuizComplete}
                    onCancel={() => setShowQuiz(false)}
                />
            </View>
        );
    }

    const videoSource = getVideoSource();
    const downloadState = currentLesson ? downloadStates.get(currentLesson.id) : null;
    const progressPercent = videoDuration > 0 ? (videoProgress / videoDuration) * 100 : 0;
    
    // Get embed URL for YouTube/Vimeo/Wistia or direct URL
    const videoProvider = currentLesson?.video_provider || 'direct';
    const embedUrl = currentLesson?.video_url ? getEmbedUrl(currentLesson.video_url, videoProvider) : null;
    const useEmbeddedPlayer = isEmbeddedVideo(videoProvider);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            {/* Video/Content Area */}
            <View style={[styles.mediaContainer, { paddingTop: insets.top }]}>
                {currentLesson?.content_type === 'video' && embedUrl ? (
                    useEmbeddedPlayer ? (
                        /* Embedded video player (YouTube, Vimeo, Wistia) */
                        <View style={styles.videoWrapper}>
                            <WebView
                                source={{ uri: embedUrl }}
                                style={styles.video}
                                allowsFullscreenVideo={true}
                                allowsInlineMediaPlayback={true}
                                mediaPlaybackRequiresUserAction={false}
                                javaScriptEnabled={true}
                                domStorageEnabled={true}
                                startInLoadingState={true}
                                renderLoading={() => (
                                    <View style={styles.bufferingOverlay}>
                                        <ActivityIndicator size="large" color="#fff" />
                                    </View>
                                )}
                            />
                            {/* Back button overlay for embedded videos */}
                            <View style={styles.embeddedTopBar}>
                                <TouchableOpacity 
                                    style={styles.topBarButton}
                                    onPress={() => router.back()}
                                >
                                    <Ionicons name="arrow-back" size={24} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : videoSource ? (
                        /* Native video player (direct URLs) */
                        <Pressable 
                            style={styles.videoWrapper}
                            onPress={() => setShowControls(!showControls)}
                        >
                            <Video
                                ref={videoRef}
                                source={videoSource}
                                style={styles.video}
                                resizeMode={ResizeMode.CONTAIN}
                                onPlaybackStatusUpdate={handleVideoPlaybackStatus}
                                shouldPlay={false}
                                useNativeControls={false}
                            />

                            {/* Buffering indicator */}
                            {isBuffering && (
                                <View style={styles.bufferingOverlay}>
                                    <ActivityIndicator size="large" color="#fff" />
                                </View>
                            )}

                            {/* Video Controls Overlay */}
                            {showControls && (
                                <View style={styles.controlsOverlay}>
                                    {/* Top bar */}
                                    <View style={styles.topBar}>
                                        <TouchableOpacity 
                                            style={styles.topBarButton}
                                            onPress={() => router.back()}
                                        >
                                            <Ionicons name="arrow-back" size={24} color="#fff" />
                                        </TouchableOpacity>
                                        <View style={styles.topBarRight}>
                                            {currentLesson.video_url && !useEmbeddedPlayer && (
                                                <TouchableOpacity 
                                                    style={styles.topBarButton}
                                                    onPress={() => {
                                                        if (downloadState?.isDownloaded) {
                                                            deleteLessonDownload(currentLesson.id);
                                                            setDownloadStates(prev => {
                                                                const newMap = new Map(prev);
                                                                newMap.set(currentLesson.id, { isDownloaded: false, isDownloading: false, progress: 0 });
                                                                return newMap;
                                                            });
                                                        } else if (!downloadState?.isDownloading) {
                                                            handleDownload(currentLesson.id, currentLesson.video_url!);
                                                        }
                                                    }}
                                                >
                                                    {downloadState?.isDownloading ? (
                                                        <ActivityIndicator size="small" color="#fff" />
                                                    ) : (
                                                        <Ionicons 
                                                            name={downloadState?.isDownloaded ? "checkmark-circle" : "cloud-download-outline"} 
                                                            size={24} 
                                                            color={downloadState?.isDownloaded ? COLORS.success : "#fff"} 
                                                        />
                                                    )}
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>

                                    {/* Center play button */}
                                    <TouchableOpacity 
                                        style={styles.centerPlayButton}
                                        onPress={togglePlayPause}
                                    >
                                        <View style={styles.playButtonCircle}>
                                            <Ionicons 
                                                name={isPlaying ? "pause" : "play"} 
                                                size={36} 
                                                color="#fff" 
                                            />
                                        </View>
                                    </TouchableOpacity>

                                    {/* Bottom controls */}
                                    <View style={styles.bottomControls}>
                                        <View style={styles.progressContainer}>
                                            <TouchableOpacity 
                                                style={styles.progressBar}
                                                onPress={(e) => {
                                                    const { locationX } = e.nativeEvent;
                                                    const percent = locationX / (SCREEN_WIDTH - 32);
                                                    seekVideo(percent * videoDuration);
                                                }}
                                            >
                                                <View style={styles.progressTrack}>
                                                    <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
                                                </View>
                                            </TouchableOpacity>
                                        </View>

                                        <View style={styles.timeRow}>
                                            <Text style={styles.timeText}>
                                                {formatTime(videoProgress)} / {formatTime(videoDuration)}
                                            </Text>
                                            <View style={styles.bottomRightControls}>
                                                <TouchableOpacity 
                                                    style={styles.skipButton}
                                                    onPress={() => seekVideo(Math.max(0, videoProgress - 10000))}
                                                >
                                                    <Ionicons name="play-back" size={20} color="#fff" />
                                                </TouchableOpacity>
                                                <TouchableOpacity 
                                                    style={styles.skipButton}
                                                    onPress={() => seekVideo(Math.min(videoDuration, videoProgress + 10000))}
                                                >
                                                    <Ionicons name="play-forward" size={20} color="#fff" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            )}
                        </Pressable>
                    ) : null
                ) : (
                    /* Non-video content placeholder */
                    <View style={styles.contentPlaceholder}>
                        <TouchableOpacity 
                            style={styles.backButtonAlt}
                            onPress={() => router.back()}
                        >
                            <Ionicons name="arrow-back" size={24} color="#fff" />
                        </TouchableOpacity>
                        <View style={styles.placeholderContent}>
                            <View style={styles.placeholderIcon}>
                                <Ionicons 
                                    name={getLessonIcon(currentLesson?.content_type || 'document') as any}
                                    size={56}
                                    color={COLORS.primary}
                                />
                            </View>
                            <Text style={styles.placeholderTitle}>{currentLesson?.title}</Text>
                            <Text style={styles.placeholderSubtitle}>
                                {currentLesson?.content_type === 'quiz' ? 'Interactive Quiz' : 
                                 currentLesson?.content_type === 'text' ? 'Reading Material' : 'Content'}
                            </Text>
                        </View>
                    </View>
                )}
            </View>

            {/* Main Content Area */}
            <View style={styles.contentArea}>
                {/* Lesson Header */}
                <View style={styles.lessonHeader}>
                    <View style={styles.lessonInfo}>
                        <Text style={styles.moduleLabel}>
                            {currentLesson?.moduleTitle} • Lesson {(currentLesson?.lessonIndex || 0) + 1}/{currentLesson?.totalInModule}
                        </Text>
                        <Text style={styles.lessonTitle} numberOfLines={2}>
                            {currentLesson?.title}
                        </Text>
                    </View>
                    <TouchableOpacity 
                        style={styles.outlineButton}
                        onPress={toggleSidebar}
                    >
                        <Ionicons name="list" size={24} color={COLORS.primary} />
                    </TouchableOpacity>
                </View>

                {/* Content based on lesson type */}
                <ScrollView 
                    style={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContentInner}
                >
                    {currentLesson?.content_type === 'text' && currentLesson.content_html && (
                        <View style={styles.textContent}>
                            <RenderHtml
                                contentWidth={SCREEN_WIDTH - SPACING.lg * 2}
                                source={{ html: currentLesson.content_html }}
                                tagsStyles={htmlStyles}
                            />
                        </View>
                    )}

                    {currentLesson?.content_type === 'quiz' && (
                        <View style={styles.quizPrompt}>
                            <View style={styles.quizIcon}>
                                <Ionicons name="help-circle" size={64} color={COLORS.primary} />
                            </View>
                            <Text style={styles.quizTitle}>Knowledge Check</Text>
                            <Text style={styles.quizDescription}>
                                Test your understanding of the material covered in this section.
                            </Text>
                            <TouchableOpacity 
                                style={styles.startQuizButton}
                                onPress={() => {
                                    if (currentLesson) prepareQuiz(currentLesson);
                                    setShowQuiz(true);
                                }}
                            >
                                <Text style={styles.startQuizButtonText}>Start Quiz</Text>
                                <Ionicons name="arrow-forward" size={20} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    )}

                    {currentLesson?.content_type === 'video' && (
                        <View style={styles.videoDescription}>
                            <Text style={styles.descriptionTitle}>About this lesson</Text>
                            <Text style={styles.descriptionText}>
                                {currentLesson.description || 'Watch the video above to learn about this topic.'}
                            </Text>
                            
                            {currentLesson.video_url && (
                                <View style={styles.videoActions}>
                                    <TouchableOpacity 
                                        style={[
                                            styles.actionButton,
                                            downloadState?.isDownloaded && styles.actionButtonActive
                                        ]}
                                        onPress={() => {
                                            if (downloadState?.isDownloaded) {
                                                deleteLessonDownload(currentLesson.id);
                                                setDownloadStates(prev => {
                                                    const newMap = new Map(prev);
                                                    newMap.set(currentLesson.id, { isDownloaded: false, isDownloading: false, progress: 0 });
                                                    return newMap;
                                                });
                                            } else if (!downloadState?.isDownloading) {
                                                handleDownload(currentLesson.id, currentLesson.video_url!);
                                            }
                                        }}
                                        disabled={downloadState?.isDownloading}
                                    >
                                        {downloadState?.isDownloading ? (
                                            <>
                                                <ActivityIndicator size="small" color={COLORS.primary} />
                                                <Text style={styles.actionButtonText}>
                                                    {Math.round((downloadState.progress || 0) * 100)}%
                                                </Text>
                                            </>
                                        ) : (
                                            <>
                                                <Ionicons 
                                                    name={downloadState?.isDownloaded ? "checkmark-circle" : "cloud-download-outline"} 
                                                    size={20} 
                                                    color={downloadState?.isDownloaded ? COLORS.success : COLORS.primary} 
                                                />
                                                <Text style={[
                                                    styles.actionButtonText,
                                                    downloadState?.isDownloaded && styles.actionButtonTextActive
                                                ]}>
                                                    {downloadState?.isDownloaded ? 'Downloaded' : 'Download'}
                                                </Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Blocks display for complex lessons */}
                    {currentLesson?.blocks && currentLesson.blocks.length > 0 && (
                        <View style={styles.blocksContainer}>
                            {currentLesson.blocks.map((block: any, index: number) => {
                                // Skip the primary video block (already displayed above)
                                if (block.type === 'video' && index === 0 && currentLesson.content_type === 'video') {
                                    return null;
                                }
                                
                                // Skip the primary quiz block (handled separately)
                                if (block.type === 'quiz' && currentLesson.content_type === 'quiz') {
                                    return null;
                                }
                                
                                return (
                                    <View key={block.id || index} style={styles.blockItem}>
                                        {block.type === 'text' && block.content?.html && (
                                            <RenderHtml
                                                contentWidth={SCREEN_WIDTH - SPACING.lg * 2}
                                                source={{ html: block.content.html }}
                                                tagsStyles={htmlStyles}
                                            />
                                        )}
                                        
                                        {block.type === 'video' && block.content?.url && (
                                            <View style={styles.additionalVideoBlock}>
                                                <Text style={styles.blockTitle}>{block.title || 'Video'}</Text>
                                                {isEmbeddedVideo(block.content?.provider) ? (
                                                    <View style={styles.embeddedVideoContainer}>
                                                        <WebView
                                                            source={{ uri: getEmbedUrl(block.content.url, block.content.provider || 'direct') || '' }}
                                                            style={styles.embeddedVideo}
                                                            allowsFullscreenVideo={true}
                                                            allowsInlineMediaPlayback={true}
                                                            javaScriptEnabled={true}
                                                        />
                                                    </View>
                                                ) : (
                                                    <Video
                                                        source={{ uri: block.content.url }}
                                                        style={styles.blockVideo}
                                                        resizeMode={ResizeMode.CONTAIN}
                                                        useNativeControls={true}
                                                    />
                                                )}
                                            </View>
                                        )}
                                        
                                        {block.type === 'image' && block.content?.url && (
                                            <View style={styles.imageBlock}>
                                                <Text style={styles.blockTitle}>{block.title || ''}</Text>
                                                <View style={styles.imageContainer}>
                                                    <View style={styles.imagePlaceholder}>
                                                        <Ionicons name="image" size={48} color={COLORS.textTertiary} />
                                                        <Text style={styles.imageCaption}>{block.content.caption || block.content.alt || 'Image'}</Text>
                                                    </View>
                                                </View>
                                            </View>
                                        )}
                                        
                                        {block.type === 'file' && block.content?.url && (
                                            <TouchableOpacity style={styles.fileBlock}>
                                                <Ionicons name="document-attach" size={24} color={COLORS.primary} />
                                                <View style={styles.fileInfo}>
                                                    <Text style={styles.fileName}>{block.content.filename || block.title || 'Download File'}</Text>
                                                    <Text style={styles.fileAction}>Tap to download</Text>
                                                </View>
                                                <Ionicons name="cloud-download-outline" size={20} color={COLORS.textSecondary} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </ScrollView>

                {/* Navigation Footer */}
                <View style={[styles.navigationFooter, { paddingBottom: insets.bottom + SPACING.sm }]}>
                    <TouchableOpacity 
                        style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
                        onPress={() => navigateLesson('prev')}
                        disabled={currentIndex === 0}
                    >
                        <Ionicons 
                            name="chevron-back" 
                            size={20} 
                            color={currentIndex === 0 ? COLORS.textTertiary : COLORS.text} 
                        />
                        <Text style={[
                            styles.navButtonText,
                            currentIndex === 0 && styles.navButtonTextDisabled
                        ]}>Previous</Text>
                    </TouchableOpacity>

                    <View style={styles.progressIndicator}>
                        <Text style={styles.progressText}>
                            {currentIndex + 1} / {allLessons.length}
                        </Text>
                    </View>

                    <TouchableOpacity 
                        style={[
                            styles.navButton, 
                            styles.navButtonNext,
                            currentIndex === allLessons.length - 1 && styles.navButtonDisabled
                        ]}
                        onPress={() => navigateLesson('next')}
                        disabled={currentIndex === allLessons.length - 1}
                    >
                        <Text style={[
                            styles.navButtonText,
                            styles.navButtonTextNext,
                            currentIndex === allLessons.length - 1 && styles.navButtonTextDisabled
                        ]}>
                            {currentIndex === allLessons.length - 1 ? 'Complete' : 'Next'}
                        </Text>
                        <Ionicons 
                            name="chevron-forward" 
                            size={20} 
                            color={currentIndex === allLessons.length - 1 ? COLORS.textTertiary : '#fff'} 
                        />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Course Outline Sidebar (Modal) */}
            <Modal
                visible={showSidebar}
                animationType="slide"
                transparent={true}
                onRequestClose={toggleSidebar}
            >
                <View style={styles.sidebarOverlay}>
                    <Pressable style={styles.sidebarBackdrop} onPress={toggleSidebar} />
                    <View style={[styles.sidebar, { paddingBottom: insets.bottom }]}>
                        <View style={styles.sidebarHeader}>
                            <Text style={styles.sidebarTitle}>Course Content</Text>
                            <TouchableOpacity onPress={toggleSidebar} style={styles.closeSidebar}>
                                <Ionicons name="close" size={24} color={COLORS.text} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.courseProgress}>
                            <View style={styles.courseProgressBar}>
                                <View style={[
                                    styles.courseProgressFill, 
                                    { width: `${((currentIndex + 1) / allLessons.length) * 100}%` }
                                ]} />
                            </View>
                            <Text style={styles.courseProgressText}>
                                {currentIndex + 1} of {allLessons.length} lessons completed
                            </Text>
                        </View>

                        <FlatList
                            data={course.modules}
                            keyExtractor={(item) => item.id}
                            showsVerticalScrollIndicator={false}
                            renderItem={({ item: module, index: moduleIndex }) => (
                                <View style={styles.moduleSection}>
                                    <View style={styles.moduleSectionHeader}>
                                        <Text style={styles.moduleSectionNumber}>Module {moduleIndex + 1}</Text>
                                        <Text style={styles.moduleSectionTitle}>{module.title}</Text>
                                    </View>
                                    {module.lessons.map((lesson: Lesson, lessonIndex: number) => {
                                        const flatIndex = allLessons.findIndex(l => l.id === lesson.id);
                                        const isActive = flatIndex === currentIndex;
                                        const isCompleted = flatIndex < currentIndex;
                                        const dState = downloadStates.get(lesson.id);

                                        return (
                                            <TouchableOpacity
                                                key={lesson.id}
                                                style={[
                                                    styles.sidebarLesson,
                                                    isActive && styles.sidebarLessonActive
                                                ]}
                                                onPress={() => selectLesson(flatIndex)}
                                            >
                                                <View style={[
                                                    styles.lessonStatusIcon,
                                                    isCompleted && styles.lessonStatusCompleted,
                                                    isActive && styles.lessonStatusActive
                                                ]}>
                                                    {isCompleted ? (
                                                        <Ionicons name="checkmark" size={14} color="#fff" />
                                                    ) : (
                                                        <Ionicons 
                                                            name={getLessonIcon(lesson.content_type) as any}
                                                            size={14}
                                                            color={isActive ? '#fff' : COLORS.textSecondary}
                                                        />
                                                    )}
                                                </View>
                                                <View style={styles.sidebarLessonInfo}>
                                                    <Text style={[
                                                        styles.sidebarLessonTitle,
                                                        isActive && styles.sidebarLessonTitleActive
                                                    ]} numberOfLines={2}>
                                                        {lesson.title}
                                                    </Text>
                                                    <View style={styles.sidebarLessonMeta}>
                                                        <Text style={styles.sidebarLessonType}>
                                                            {lesson.content_type.charAt(0).toUpperCase() + lesson.content_type.slice(1)}
                                                        </Text>
                                                        {dState?.isDownloaded && (
                                                            <Ionicons name="cloud-done" size={12} color={COLORS.success} />
                                                        )}
                                                    </View>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const htmlStyles: any = {
    body: {
        fontSize: FONT_SIZE.md,
        color: COLORS.text,
        lineHeight: 26,
    },
    p: {
        marginBottom: SPACING.md,
    },
    h1: {
        fontSize: FONT_SIZE.xxl,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        marginBottom: SPACING.lg,
        marginTop: SPACING.lg,
    },
    h2: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        marginBottom: SPACING.md,
        marginTop: SPACING.lg,
    },
    h3: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.semibold,
        color: COLORS.text,
        marginBottom: SPACING.sm,
        marginTop: SPACING.md,
    },
    ul: {
        marginBottom: SPACING.md,
    },
    li: {
        marginBottom: SPACING.xs,
    },
    a: {
        color: COLORS.primary,
    },
    blockquote: {
        borderLeftWidth: 4,
        borderLeftColor: COLORS.primary,
        paddingLeft: SPACING.md,
        marginVertical: SPACING.md,
        fontStyle: 'italic',
        color: COLORS.textSecondary,
    },
    code: {
        backgroundColor: COLORS.backgroundSecondary,
        paddingHorizontal: SPACING.xs,
        paddingVertical: 2,
        borderRadius: BORDER_RADIUS.xs,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: FONT_SIZE.sm,
    },
    pre: {
        backgroundColor: COLORS.backgroundSecondary,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        overflow: 'hidden',
    },
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    centerContent: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xl,
    },
    loadingText: {
        marginTop: SPACING.md,
        color: COLORS.textSecondary,
        fontSize: FONT_SIZE.md,
    },
    errorTitle: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        marginTop: SPACING.lg,
    },
    errorText: {
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginTop: SPACING.sm,
    },
    retryButton: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        marginTop: SPACING.xl,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
    },
    backLink: {
        marginTop: SPACING.md,
    },
    backLinkText: {
        color: COLORS.primary,
        fontSize: FONT_SIZE.md,
    },

    // Media Container
    mediaContainer: {
        backgroundColor: '#000',
        width: '100%',
        aspectRatio: 16 / 9,
    },
    videoWrapper: {
        flex: 1,
        backgroundColor: '#000',
    },
    video: {
        flex: 1,
        backgroundColor: '#000',
    },
    bufferingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    controlsOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'space-between',
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.md,
    },
    topBarButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    topBarRight: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    embeddedTopBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: SPACING.md,
        flexDirection: 'row',
        justifyContent: 'flex-start',
        zIndex: 10,
    },
    centerPlayButton: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    playButtonCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    bottomControls: {
        padding: SPACING.md,
    },
    progressContainer: {
        marginBottom: SPACING.sm,
    },
    progressBar: {
        height: 24,
        justifyContent: 'center',
    },
    progressTrack: {
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 2,
    },
    progressFill: {
        height: '100%',
        backgroundColor: COLORS.primary,
        borderRadius: 2,
    },
    timeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    timeText: {
        color: '#fff',
        fontSize: FONT_SIZE.sm,
    },
    bottomRightControls: {
        flexDirection: 'row',
        gap: SPACING.md,
    },
    skipButton: {
        padding: SPACING.xs,
    },

    // Content Placeholder (non-video)
    contentPlaceholder: {
        flex: 1,
        backgroundColor: COLORS.primary,
    },
    backButtonAlt: {
        position: 'absolute',
        top: SPACING.md,
        left: SPACING.md,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    placeholderContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xl,
    },
    placeholderIcon: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    placeholderTitle: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        color: '#fff',
        textAlign: 'center',
    },
    placeholderSubtitle: {
        fontSize: FONT_SIZE.sm,
        color: 'rgba(255,255,255,0.8)',
        marginTop: SPACING.xs,
    },

    // Content Area
    contentArea: {
        flex: 1,
        backgroundColor: COLORS.background,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        marginTop: -20,
    },
    lessonHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: SPACING.lg,
        paddingTop: SPACING.xl,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    lessonInfo: {
        flex: 1,
        marginRight: SPACING.md,
    },
    moduleLabel: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.primary,
        fontWeight: FONT_WEIGHT.medium,
        marginBottom: SPACING.xs,
    },
    lessonTitle: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        lineHeight: 24,
    },
    outlineButton: {
        width: 44,
        height: 44,
        borderRadius: BORDER_RADIUS.md,
        backgroundColor: COLORS.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Scroll Content
    scrollContent: {
        flex: 1,
    },
    scrollContentInner: {
        padding: SPACING.lg,
        paddingBottom: SPACING.xxxl,
    },
    textContent: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
    },

    // Quiz
    quizPrompt: {
        alignItems: 'center',
        padding: SPACING.xxl,
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
    },
    quizIcon: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: COLORS.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.lg,
    },
    quizTitle: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        marginBottom: SPACING.sm,
    },
    quizDescription: {
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginBottom: SPACING.xl,
    },
    startQuizButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        gap: SPACING.sm,
    },
    startQuizButtonText: {
        color: '#fff',
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
    },

    // Video Description
    videoDescription: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
    },
    descriptionTitle: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
        color: COLORS.text,
        marginBottom: SPACING.sm,
    },
    descriptionText: {
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
        lineHeight: 24,
    },
    videoActions: {
        flexDirection: 'row',
        marginTop: SPACING.lg,
        gap: SPACING.md,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.md,
        gap: SPACING.xs,
    },
    actionButtonActive: {
        backgroundColor: COLORS.success + '15',
    },
    actionButtonText: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.text,
    },
    actionButtonTextActive: {
        color: COLORS.success,
    },

    // Blocks
    blocksContainer: {
        marginTop: SPACING.lg,
    },
    blockItem: {
        marginBottom: SPACING.md,
    },

    // Navigation Footer
    navigationFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        backgroundColor: COLORS.surface,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    navButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        gap: SPACING.xs,
    },
    navButtonNext: {
        backgroundColor: COLORS.primary,
    },
    navButtonDisabled: {
        opacity: 0.5,
    },
    navButtonText: {
        fontSize: FONT_SIZE.md,
        color: COLORS.text,
        fontWeight: FONT_WEIGHT.medium,
    },
    navButtonTextNext: {
        color: '#fff',
    },
    navButtonTextDisabled: {
        color: COLORS.textTertiary,
    },
    progressIndicator: {
        paddingHorizontal: SPACING.md,
    },
    progressText: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
        fontWeight: FONT_WEIGHT.medium,
    },

    // Sidebar
    sidebarOverlay: {
        flex: 1,
        flexDirection: 'row',
    },
    sidebarBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sidebar: {
        width: SCREEN_WIDTH * 0.85,
        maxWidth: 400,
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: 20,
        borderBottomLeftRadius: 20,
    },
    sidebarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.lg,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    sidebarTitle: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
    },
    closeSidebar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    courseProgress: {
        padding: SPACING.lg,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    courseProgressBar: {
        height: 6,
        backgroundColor: COLORS.border,
        borderRadius: 3,
        marginBottom: SPACING.sm,
    },
    courseProgressFill: {
        height: '100%',
        backgroundColor: COLORS.primary,
        borderRadius: 3,
    },
    courseProgressText: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.textSecondary,
    },
    moduleSection: {
        paddingVertical: SPACING.md,
    },
    moduleSectionHeader: {
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
    },
    moduleSectionNumber: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.primary,
        fontWeight: FONT_WEIGHT.semibold,
        marginBottom: 2,
    },
    moduleSectionTitle: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
        color: COLORS.text,
    },
    sidebarLesson: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.lg,
        marginHorizontal: SPACING.sm,
        borderRadius: BORDER_RADIUS.md,
    },
    sidebarLessonActive: {
        backgroundColor: COLORS.primary + '15',
    },
    lessonStatusIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.md,
    },
    lessonStatusCompleted: {
        backgroundColor: COLORS.success,
    },
    lessonStatusActive: {
        backgroundColor: COLORS.primary,
    },
    sidebarLessonInfo: {
        flex: 1,
    },
    sidebarLessonTitle: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.text,
        lineHeight: 20,
    },
    sidebarLessonTitleActive: {
        fontWeight: FONT_WEIGHT.semibold,
        color: COLORS.primary,
    },
    sidebarLessonMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        marginTop: 2,
    },
    sidebarLessonType: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.textTertiary,
    },
    
    // Additional Block styles for video/image/file blocks
    blockTitle: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
        color: COLORS.text,
        marginBottom: SPACING.sm,
    },
    additionalVideoBlock: {
        marginVertical: SPACING.sm,
    },
    embeddedVideoContainer: {
        aspectRatio: 16 / 9,
        borderRadius: BORDER_RADIUS.lg,
        overflow: 'hidden',
        backgroundColor: '#000',
    },
    embeddedVideo: {
        flex: 1,
    },
    blockVideo: {
        aspectRatio: 16 / 9,
        borderRadius: BORDER_RADIUS.lg,
        backgroundColor: '#000',
    },
    imageBlock: {
        marginVertical: SPACING.sm,
    },
    imageContainer: {
        borderRadius: BORDER_RADIUS.lg,
        overflow: 'hidden',
        backgroundColor: COLORS.backgroundSecondary,
    },
    imagePlaceholder: {
        aspectRatio: 16 / 10,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.backgroundSecondary,
    },
    imageCaption: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
        marginTop: SPACING.sm,
        textAlign: 'center',
    },
    fileBlock: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
        backgroundColor: COLORS.backgroundSecondary,
        borderRadius: BORDER_RADIUS.lg,
        gap: SPACING.md,
    },
    fileInfo: {
        flex: 1,
    },
    fileName: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.medium,
        color: COLORS.text,
    },
    fileAction: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.primary,
        marginTop: 2,
    },
});
