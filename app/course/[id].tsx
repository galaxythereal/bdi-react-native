import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cacheDirectory, documentDirectory, EncodingType, getInfoAsync, readAsStringAsync } from 'expo-file-system/legacy';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import RenderHtml from 'react-native-render-html';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import Theme from '../../constants/theme';
import { AudioPlayer } from '../../src/components/AudioPlayer';
import { QuizComponent, QuizData, QuizResult } from '../../src/components/QuizComponent';
import { useTheme } from '../../src/context/ThemeContext';
import { fetchCourseContentWithOfflineSupport, updateEnrollmentProgress } from '../../src/features/courses/courseService';
import {
    deleteLessonDownload,
    downloadLessonContent,
    downloadLessonVideo,
    getLocalLessonUri,
    isLessonDownloaded,
} from '../../src/features/offline/downloadManager';
import {
    checkIsOnline,
    CourseDownloadProgress,
    downloadCourseForOffline,
    getOfflineCourse,
    syncOfflineData
} from '../../src/features/offline/offlineManager';
import { CourseDetail, Lesson } from '../../src/types';

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

// Extract video ID from various YouTube URL formats


// Generate custom HTML video player for YouTube with full control


// Helper function to convert video URLs to embeddable format
const getEmbedUrl = (url: string | null, provider: string = 'direct'): string | null => {
    if (!url) return null;

    if (provider === 'youtube') {
        // Handle various YouTube URL formats including playlists
        let videoId: string | undefined = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)?.[1];

        // Also try to get video ID from URLs with list parameters
        if (!videoId) {
            try {
                const urlObj = new URL(url);
                videoId = urlObj.searchParams.get('v') || undefined;
            } catch (e) {
                // Invalid URL, continue with undefined
            }
        }

        if (!videoId) return null;

        // Use youtube.com/embed for best compatibility (not youtube-nocookie which can have issues)
        // Important parameters:
        // - autoplay=0: Don't autoplay (user controls)
        // - playsinline=1: Play inline on iOS
        // - rel=0: Don't show related videos from other channels
        // - modestbranding=1: Minimal YouTube branding
        // - fs=1: Allow fullscreen
        // - controls=1: Show player controls
        return `https://www.youtube.com/embed/${videoId}?autoplay=0&playsinline=1&rel=0&modestbranding=1&fs=1&controls=1`;
    }

    if (provider === 'vimeo') {
        const videoId = url.match(/vimeo\.com\/(\d+)/)?.[1];
        return videoId ? `https://player.vimeo.com/video/${videoId}?playsinline=1&byline=0&portrait=0&title=0` : null;
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
    const { colors, isDark } = useTheme();
    const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
    const htmlStyles = useMemo(() => createHtmlStyles(colors), [colors]);

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

    const [videoError, setVideoError] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);


    // Download state
    const [downloadStates, setDownloadStates] = useState<Map<string, {
        isDownloaded: boolean;
        isDownloading: boolean;
        progress: number;
    }>>(new Map());

    // Offline course download state
    const [isOnline, setIsOnline] = useState(true);
    const [isCourseDownloaded, setIsCourseDownloaded] = useState(false);
    const [isCourseDownloading, setIsCourseDownloading] = useState(false);
    const [courseDownloadProgress, setCourseDownloadProgress] = useState(0);
    const [courseDownloadStatus, setCourseDownloadStatus] = useState<string>('');

    // PDF viewer state
    const [pdfViewerVisible, setPdfViewerVisible] = useState(false);
    const [currentPdfUri, setCurrentPdfUri] = useState<string | null>(null);
    const [currentPdfLocalPath, setCurrentPdfLocalPath] = useState<string | null>(null);
    const [currentPdfTitle, setCurrentPdfTitle] = useState<string>('');
    const [pdfBase64, setPdfBase64] = useState<string | null>(null);
    const [pdfLoading, setPdfLoading] = useState(true);

    // File download progress state
    const [fileDownloadProgress, setFileDownloadProgress] = useState<{
        filename: string;
        progress: number;
        visible: boolean;
    }>({ filename: '', progress: 0, visible: false });



    // Refs
    // videoRef removed
    const webViewRef = useRef<WebView>(null);
    const audioPlayerRef = useRef<any>(null);

    const isTransitioning = useRef<boolean>(false);
    const lessonChangeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Current lesson
    const currentLesson = allLessons[currentIndex] || null;

    // --- VIDEO PLAYER LOGIC START ---

    // Get embed URL for YouTube/Vimeo/Wistia or direct URL
    const videoProvider = currentLesson?.video_provider || 'direct';
    const useEmbeddedPlayer = isEmbeddedVideo(videoProvider);

    // For direct videos, check multiple sources for offline video
    const getDirectVideoSource = () => {
        if (!currentLesson?.video_url) return null;

        if (currentLesson.video_url.startsWith('file://')) {
            console.log('Using local video path from offline course:', currentLesson.video_url);
            return { uri: currentLesson.video_url };
        }

        const state = downloadStates.get(currentLesson.id);
        if (state?.isDownloaded) {
            const localUri = getLocalLessonUri(currentLesson.id);
            console.log('Using legacy downloaded video:', localUri);
            return { uri: localUri };
        }

        return { uri: currentLesson.video_url };
    };

    const directVideoSource = !useEmbeddedPlayer ? getDirectVideoSource() : null;

    // Initialize video player
    const player = useVideoPlayer(directVideoSource?.uri ?? null, player => {
        player.loop = false;
    });

    // Handle video events
    useEffect(() => {
        if (!player) return;

        const statusSubscription = player.addListener('statusChange', (payload) => {
            setIsBuffering(payload.status === 'loading');
            if (payload.status === 'error') {
                setVideoError(payload.error?.message || 'Playback error');
            } else if (payload.status === 'readyToPlay') {
                setVideoError(null);
            }
        });

        const playingSubscription = player.addListener('playingChange', (payload) => {
            setIsPlaying(payload.isPlaying);
        });

        const timeUpdateSubscription = player.addListener('timeUpdate', (payload) => {
            setVideoProgress(payload.currentTime * 1000);
            setVideoDuration(player.duration * 1000);
        });

        const endSubscription = player.addListener('playToEnd', () => {
            setIsPlaying(false);
            if (currentIndex < allLessons.length - 1) {
                setTimeout(() => navigateLesson('next'), 1500);
            }
        });

        return () => {
            statusSubscription.remove();
            playingSubscription.remove();
            timeUpdateSubscription.remove();
            endSubscription.remove();
        };
    }, [player, currentIndex, allLessons.length, id]);
    // --- VIDEO PLAYER LOGIC END ---

    // Save progress and last lesson position when viewing a lesson
    useEffect(() => {
        if (id && allLessons.length > 0 && currentIndex >= 0) {
            // Update progress based on current position (even if not completed)
            // This ensures progress is at least showing which lesson user has started
            const progressLessons = Math.max(currentIndex, 1); // At least 1 if they've started
            updateEnrollmentProgress(id, progressLessons, allLessons.length);

            // Save the current lesson index for resume functionality
            AsyncStorage.setItem(`course_${id}_lastLesson`, String(currentIndex)).catch(e => {
                console.warn('Failed to save last lesson position:', e);
            });
        }
    }, [id, currentIndex, allLessons.length]);

    useEffect(() => {
        if (id) {
            loadCourseContent();
        }

        // Cleanup function - unload media when leaving the screen
        return () => {
            // Clear any pending lesson change timeout
            if (lessonChangeTimeout.current) {
                clearTimeout(lessonChangeTimeout.current);
            }
            // Pause video player if active
            if (player) {
                player.pause();
            }
        };
    }, [id, player]);

    // Stop all media playback (used when changing lessons)
    const stopAllMedia = async (fullUnload: boolean = false) => {
        // Skip if already transitioning (debounce)
        if (isTransitioning.current && !fullUnload) {
            return;
        }

        // Stop video
        if (player) {
            player.pause();
        }

        // Stop WebView (YouTube/embedded) by injecting pause script
        if (webViewRef.current) {
            try {
                webViewRef.current.injectJavaScript(`
                    if (typeof player !== 'undefined' && player.pauseVideo) {
                        player.pauseVideo();
                    }
                    var videos = document.getElementsByTagName('video');
                    for (var i = 0; i < videos.length; i++) {
                        videos[i].pause();
                    }
                    var iframes = document.getElementsByTagName('iframe');
                    for (var i = 0; i < iframes.length; i++) {
                        try {
                            iframes[i].contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
                        } catch(e) {}
                    }
                    true;
                `);
            } catch (e) {
                // Ignore WebView errors
            }
        }
    };

    // Check online status and if course is downloaded, sync when online
    useEffect(() => {
        let wasOffline = !isOnline;

        const checkOfflineStatus = async () => {
            const online = await checkIsOnline();

            // If we just came online, sync offline data
            if (online && wasOffline) {
                console.log('Back online - syncing offline data...');
                try {
                    const result = await syncOfflineData();
                    if (result.synced > 0) {
                        console.log(`Synced ${result.synced} items`);
                    }
                } catch (e) {
                    console.warn('Sync failed:', e);
                }
            }

            wasOffline = !online;
            setIsOnline(online);

            if (id) {
                const offlineCourse = await getOfflineCourse(id);
                setIsCourseDownloaded(!!offlineCourse);
            }
        };

        checkOfflineStatus();
        // Recheck periodically
        const interval = setInterval(checkOfflineStatus, 30000);
        return () => clearInterval(interval);
    }, [id]);

    // Note: stopAllMedia is now called directly in selectLesson with proper debouncing
    // This prevents race conditions when switching lessons rapidly

    // Auto-hide controls


    const loadCourseContent = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await fetchCourseContentWithOfflineSupport(id!);
            setCourse(data);

            // Flatten all lessons for easy navigation
            const flattened: FlattenedLesson[] = [];
            const chapters = data.chapters || [];
            chapters.forEach((chapter: any, moduleIndex: number) => {
                (chapter.lessons || []).forEach((lesson: Lesson, lessonIndex: number) => {
                    flattened.push({
                        ...lesson,
                        moduleIndex,
                        lessonIndex,
                        moduleTitle: chapter.title,
                        totalInModule: (chapter.lessons || []).length,
                    });
                });
            });
            setAllLessons(flattened);

            // Restore last accessed lesson position
            try {
                const savedIndex = await AsyncStorage.getItem(`course_${id}_lastLesson`);
                if (savedIndex !== null) {
                    const index = parseInt(savedIndex, 10);
                    if (index >= 0 && index < flattened.length) {
                        setCurrentIndex(index);
                    }
                }
            } catch (e) {
                console.warn('Failed to restore last lesson position:', e);
            }

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

    // Download entire course for offline use
    const handleDownloadCourse = async () => {
        if (!course || !id) return;

        if (isCourseDownloaded) {
            // Show confirmation to delete
            Alert.alert(
                'Remove Download',
                'This will remove the downloaded course and all its content from your device. You can download it again later.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                // Use the imported deleteOfflineCourse
                                const { deleteOfflineCourse: deleteCourse } = await import('../../src/features/offline/offlineManager');
                                await deleteCourse(id);
                                setIsCourseDownloaded(false);
                                setCourseDownloadProgress(0);
                                Alert.alert('Removed', 'Course has been removed from offline storage.');
                            } catch (error) {
                                console.error('Error removing course:', error);
                                Alert.alert('Error', 'Failed to remove course. Please try again.');
                            }
                        }
                    }
                ]
            );
            return;
        }

        setIsCourseDownloading(true);
        setCourseDownloadProgress(0);
        setCourseDownloadStatus('Preparing...');

        try {
            await downloadCourseForOffline(
                course,
                (progress: CourseDownloadProgress) => {
                    setCourseDownloadProgress(progress.progress);
                    if (progress.currentLesson) {
                        setCourseDownloadStatus(
                            `${progress.currentLesson} (${progress.completedLessons}/${progress.totalLessons})`
                        );
                    }
                }
            );

            setIsCourseDownloaded(true);
            setCourseDownloadStatus('');
            Alert.alert(
                'Download Complete',
                'Course is now available offline! You can access it from the Downloads tab.',
                [{ text: 'OK' }]
            );
        } catch (error: any) {
            console.error('Error downloading course:', error);
            Alert.alert('Download Failed', error.message || 'Failed to download course. Please try again.');
        } finally {
            setIsCourseDownloading(false);
        }
    };

    const selectLesson = (index: number) => {
        // Prevent rapid lesson changes that cause decoder conflicts
        if (isTransitioning.current) {
            // Cancel previous transition and start new one
            if (lessonChangeTimeout.current) {
                clearTimeout(lessonChangeTimeout.current);
            }
        }

        isTransitioning.current = true;

        // Stop current media first (just pause, don't fully unload)
        stopAllMedia(false);

        // Small delay to let the video component unmount cleanly before creating new one
        lessonChangeTimeout.current = setTimeout(() => {
            setCurrentIndex(index);
            setShowSidebar(false);
            setShowQuiz(false);
            setIsPlaying(false);
            setVideoProgress(0);
            setVideoDuration(0);
            setVideoError(null); // Reset video error when changing lessons
            setIsBuffering(true); // Show buffering for new video

            const lesson = allLessons[index];
            if (lesson?.content_type === 'quiz' && lesson.quiz_data) {
                prepareQuiz(lesson);
            }

            // Mark transition complete after a short delay for rendering
            setTimeout(() => {
                isTransitioning.current = false;
            }, 100);
        }, 50);
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

    const navigateLesson = async (direction: 'next' | 'prev') => {
        const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
        if (newIndex >= 0 && newIndex < allLessons.length) {
            // Update progress when moving forward (completing a lesson)
            if (direction === 'next' && id) {
                // Calculate progress: current lesson index + 1 completed
                const completedLessons = currentIndex + 1;
                const totalLessons = allLessons.length;
                await updateEnrollmentProgress(id, completedLessons, totalLessons);
            }
            selectLesson(newIndex);
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

    // Open PDF for offline viewing
    const openPdfViewer = async (localPath: string, remoteUrl: string, title: string) => {
        try {
            setPdfLoading(true);
            setCurrentPdfUri(remoteUrl);
            setCurrentPdfLocalPath(localPath);
            setCurrentPdfTitle(title);
            setPdfViewerVisible(true);

            // Read file as base64
            const base64Content = await readAsStringAsync(localPath, {
                encoding: EncodingType.Base64
            });
            setPdfBase64(base64Content);
            setPdfLoading(false);
        } catch (err) {
            console.error('Failed to load PDF:', err);
            setPdfLoading(false);
            Alert.alert(
                'PDF Error',
                'Could not load the PDF file. Try sharing it to another app.',
                [
                    { text: 'Close', onPress: () => setPdfViewerVisible(false) },
                    {
                        text: 'Share',
                        onPress: async () => {
                            const canShare = await isAvailableAsync();
                            if (canShare) {
                                await shareAsync(localPath, { mimeType: 'application/pdf' });
                            }
                        }
                    }
                ]
            );
        }
    };

    // Handle file download (for file blocks - PDFs, documents, etc.)
    const handleFileDownload = async (url: string, filename: string) => {
        try {
            // Sanitize filename
            const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
            const isPdf = safeFilename.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('.pdf');
            const localPath = (documentDirectory || cacheDirectory || '') + safeFilename;

            // Check if file already exists locally
            let fileExists = false;
            try {
                const info = await getInfoAsync(localPath);
                fileExists = info.exists;
            } catch (e) {
                fileExists = false;
            }

            if (fileExists && isPdf) {
                // File exists, offer to view or re-download
                Alert.alert(
                    'PDF Available',
                    `"${filename}" is already downloaded.`,
                    [
                        { text: 'Cancel', style: 'cancel' },
                        {
                            text: 'View',
                            onPress: () => {
                                // Use local file path for offline viewing
                                openPdfViewer(localPath, url, filename);
                            },
                        },
                        {
                            text: 'Share/Open',
                            onPress: async () => {
                                const canShare = await isAvailableAsync();
                                if (canShare) {
                                    await shareAsync(localPath, {
                                        mimeType: 'application/pdf',
                                        dialogTitle: `Open ${filename}`,
                                    });
                                }
                            },
                        },
                        {
                            text: 'Re-download',
                            onPress: () => downloadFile(url, safeFilename, localPath, isPdf),
                        },
                    ]
                );
            } else if (fileExists) {
                // Non-PDF file exists, share it
                const canShare = await isAvailableAsync();
                if (canShare) {
                    await shareAsync(localPath, {
                        mimeType: 'application/octet-stream',
                        dialogTitle: `Open ${filename}`,
                    });
                } else {
                    Alert.alert('File Ready', `File is available at: ${localPath}`);
                }
            } else {
                // File doesn't exist, download it
                Alert.alert(
                    isPdf ? 'Download PDF' : 'Download File',
                    `Download "${filename}"?`,
                    [
                        { text: 'Cancel', style: 'cancel' },
                        {
                            text: 'Download',
                            onPress: () => downloadFile(url, safeFilename, localPath, isPdf),
                        },
                    ]
                );
            }
        } catch (err) {
            console.error('File download error:', err);
            Alert.alert('Error', 'Unable to process file');
        }
    };

    // Download file with progress - using expo-file-system
    const downloadFile = async (url: string, filename: string, localPath: string, isPdf: boolean) => {
        try {
            // Show progress indicator
            setFileDownloadProgress({ filename, progress: 0.05, visible: true });

            // Clean up URL - handle potential issues
            let cleanUrl = url.trim();

            // If URL doesn't have protocol, add https
            if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
                cleanUrl = 'https://' + cleanUrl;
            }

            console.log('downloadFile: Downloading from', cleanUrl, 'to', localPath);

            // Use expo-file-system downloadAsync with progress callback
            const downloadResumable = (await import('expo-file-system/legacy')).createDownloadResumable(
                cleanUrl,
                localPath,
                {
                    headers: {
                        'Accept': 'application/pdf,application/octet-stream,*/*',
                        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
                    },
                },
                (downloadProgress) => {
                    const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
                    console.log(`Downloading: ${filename} (${Math.round(progress * 100)}%)`);
                    setFileDownloadProgress(prev => ({ ...prev, progress: Math.min(0.99, progress) }));
                }
            );

            const result = await downloadResumable.downloadAsync();

            if (result && result.uri) {
                console.log('File saved to:', result.uri);
                setFileDownloadProgress({ filename: 'Complete', progress: 1, visible: true });

                // Brief delay to show complete status
                await new Promise(resolve => setTimeout(resolve, 500));
                setFileDownloadProgress({ filename: '', progress: 0, visible: false });

                // Success - open or share the file
                if (isPdf) {
                    Alert.alert(
                        'Download Complete',
                        'PDF downloaded successfully.',
                        [
                            { text: 'Later', style: 'cancel' },
                            {
                                text: 'View Now',
                                onPress: () => {
                                    // Use local file for offline viewing
                                    openPdfViewer(result.uri, cleanUrl, filename);
                                },
                            },
                            {
                                text: 'Share/Open',
                                onPress: async () => {
                                    const canShare = await isAvailableAsync();
                                    if (canShare) {
                                        await shareAsync(result.uri, {
                                            mimeType: 'application/pdf',
                                            dialogTitle: `Open ${filename}`,
                                        });
                                    }
                                },
                            },
                        ]
                    );
                } else {
                    const canShare = await isAvailableAsync();
                    if (canShare) {
                        await shareAsync(result.uri, {
                            mimeType: 'application/octet-stream',
                            dialogTitle: `Open ${filename}`,
                        });
                    } else {
                        Alert.alert('Download Complete', `File saved: ${filename}`);
                    }
                }
            } else {
                throw new Error('Download failed - no result');
            }
        } catch (err: any) {
            console.error('Download error:', err);
            setFileDownloadProgress({ filename: '', progress: 0, visible: false });

            // Provide more helpful error messages
            let errorMessage = 'Could not download file.';
            const errStr = String(err.message || err);
            if (errStr.includes('Network request failed') || errStr.includes('INTERNAL_ERROR') || errStr.includes('stream was reset')) {
                errorMessage = 'Network error. The file server may be unavailable.';
            } else if (errStr.includes('SSL') || errStr.includes('certificate')) {
                errorMessage = 'SSL certificate error.';
            } else if (errStr.includes('404')) {
                errorMessage = 'File not found on the server.';
            } else if (errStr.includes('403')) {
                errorMessage = 'Access denied.';
            }

            // Offer to open in browser as fallback
            Alert.alert(
                'Download Failed',
                `${errorMessage}\n\nWould you like to open this file in your browser instead?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Open in Browser',
                        onPress: async () => {
                            try {
                                await Linking.openURL(url);
                            } catch (e) {
                                Alert.alert('Error', 'Could not open browser');
                            }
                        },
                    },
                ]
            );
        }
    };



    // Handle downloading entire lesson with all blocks
    const handleDownloadLesson = async () => {
        if (!currentLesson) return;
        handleFullLessonDownload(currentLesson.id);
    };

    // Handle downloading entire lesson by ID
    const handleFullLessonDownload = async (lessonId: string) => {
        const lesson = allLessons.find(l => l.id === lessonId) || currentLesson;
        if (!lesson) return;

        // Check if already downloading
        const state = downloadStates.get(lessonId);
        if (state?.isDownloading) return;

        Alert.alert(
            'Download Lesson',
            `Download "${lesson.title}" for offline viewing? This will download all content including videos, PDFs, and other files.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Download',
                    onPress: async () => {
                        setDownloadStates(prev => {
                            const newMap = new Map(prev);
                            newMap.set(lessonId, { isDownloaded: false, isDownloading: true, progress: 0 });
                            return newMap;
                        });

                        try {
                            const result = await downloadLessonContent(
                                lessonId,
                                {
                                    video_url: lesson.video_url || undefined,
                                    blocks: lesson.blocks,
                                },
                                (progress, currentFile) => {
                                    console.log(`Downloading: ${currentFile} (${Math.round(progress * 100)}%)`);
                                    setDownloadStates(prev => {
                                        const newMap = new Map(prev);
                                        newMap.set(lessonId, { isDownloaded: false, isDownloading: true, progress });
                                        return newMap;
                                    });
                                }
                            );

                            const successCount = result.files.filter(f => f.success).length;
                            const totalCount = result.files.length;

                            setDownloadStates(prev => {
                                const newMap = new Map(prev);
                                newMap.set(lessonId, { isDownloaded: successCount > 0, isDownloading: false, progress: 1 });
                                return newMap;
                            });

                            if (successCount === 0 && totalCount === 0) {
                                Alert.alert('No Content', 'This lesson has no downloadable content.');
                            } else {
                                Alert.alert(
                                    'Download Complete',
                                    `Downloaded ${successCount}/${totalCount} files (${Math.round(result.totalSize / 1024 / 1024 * 100) / 100} MB)`
                                );
                            }
                        } catch (err: any) {
                            console.error('Lesson download error:', err);
                            setDownloadStates(prev => {
                                const newMap = new Map(prev);
                                newMap.set(lessonId, { isDownloaded: false, isDownloading: false, progress: 0 });
                                return newMap;
                            });
                            Alert.alert('Download Error', err.message || 'Failed to download lesson');
                        }
                    },
                },
            ]
        );
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

    const handleQuizComplete = async (result: QuizResult) => {
        console.log('Quiz completed:', result);
        // Update progress when quiz is completed (regardless of pass/fail - user completed the lesson)
        if (id) {
            const completedLessons = currentIndex + 1;
            await updateEnrollmentProgress(id, completedLessons, allLessons.length);

            // Save quiz attempt for offline sync if offline
            const online = await checkIsOnline();
            if (!online && currentLesson) {
                try {
                    const { saveQuizAttemptOffline } = await import('../../src/features/offline/offlineManager');
                    await saveQuizAttemptOffline({
                        lessonId: currentLesson.id,
                        courseId: id,
                        quizId: quizData?.id || currentLesson.id,
                        answers: result.answers || {},
                        score: result.score,
                        passed: result.passed,
                        completedAt: new Date().toISOString(),
                        synced: false,
                    });
                    console.log('Quiz attempt saved for offline sync');
                } catch (e) {
                    console.warn('Failed to save quiz attempt offline:', e);
                }
            }
        }
        // Don't auto-close - let user see results and click Continue
        // The quiz component shows results and has a Continue button that calls onCancel
    };

    // Loading state
    if (loading) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <StatusBar barStyle="light-content" />
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading course...</Text>
            </View>
        );
    }

    // Error state
    if (error || !course) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <StatusBar barStyle="light-content" />
                <Ionicons name="cloud-offline-outline" size={64} color={colors.textTertiary} />
                <Text style={styles.errorTitle}>Unable to Load Course</Text>
                <Text style={styles.errorText}>{error || 'Course not found'}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={loadCourseContent}>
                    <Text style={styles.retryButtonText}>Try Again</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.backLink} onPress={async () => {
                    await stopAllMedia(true);
                    router.back();
                }}>
                    <Text style={styles.backLinkText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Handle quiz cancel/continue - close quiz and optionally navigate
    const handleQuizCancel = () => {
        setShowQuiz(false);
        // Navigate to next lesson after closing quiz results
        if (currentIndex < allLessons.length - 1) {
            setTimeout(() => navigateLesson('next'), 500);
        }
    };

    // Quiz fullscreen view
    if (showQuiz && quizData) {
        return (
            <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
                <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
                <QuizComponent
                    quiz={quizData}
                    onComplete={handleQuizComplete}
                    onCancel={handleQuizCancel}
                />
            </View>
        );
    }



    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            {/* Video/Content Area - Only show for video content */}
            {currentLesson?.content_type === 'video' && currentLesson?.video_url ? (
                <View style={[styles.mediaContainer]}>
                    {/* Safe area spacer for video */}
                    <View style={{ height: insets.top, backgroundColor: '#000' }} />
                    {directVideoSource ? (
                        <View style={styles.videoWrapper}>
                            {videoError ? (
                                <View style={styles.videoErrorContainer}>
                                    <Ionicons name="alert-circle" size={48} color={colors.error} />
                                    <Text style={styles.videoErrorTitle}>Video Unavailable</Text>
                                    <Text style={styles.videoErrorText}>{videoError}</Text>
                                    <TouchableOpacity
                                        style={styles.videoRetryButton}
                                        onPress={() => {
                                            setVideoError(null);
                                            setIsBuffering(true);
                                        }}
                                    >
                                        <Ionicons name="refresh" size={18} color="#fff" />
                                        <Text style={styles.videoRetryText}>Retry</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <VideoView
                                    style={styles.video}
                                    player={player}
                                    contentFit="contain"
                                    allowsFullscreen
                                    allowsPictureInPicture
                                    nativeControls
                                />
                            )}
                            <TouchableOpacity
                                style={[styles.embeddedBackButton, { top: 10, left: 10 }]}
                                onPress={async () => {
                                    await stopAllMedia(true);
                                    router.back();
                                }}
                            >
                                <Ionicons name="arrow-back" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    ) : useEmbeddedPlayer && embedUrl ? (
                        <View style={styles.embeddedVideoWrapper}>
                            <WebView
                                source={{ uri: embedUrl }}
                                style={styles.embeddedWebView}
                                allowsFullscreenVideo={true}
                                javaScriptEnabled={true}
                                domStorageEnabled={true}
                            />
                            <TouchableOpacity
                                style={styles.embeddedBackButton}
                                onPress={async () => {
                                    await stopAllMedia(true);
                                    router.back();
                                }}
                            >
                                <Ionicons name="arrow-back" size={22} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.videoErrorContainer}>
                            <Text style={{ color: 'white', marginBottom: 20 }}>Video source not supported.</Text>
                            <TouchableOpacity
                                style={styles.videoRetryButton}
                                onPress={async () => {
                                    await stopAllMedia(true);
                                    router.back();
                                }}
                            >
                                <Ionicons name="arrow-back" size={18} color="#fff" />
                                <Text style={styles.videoRetryText}>Go Back</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            ) : (
                /* Non-video header area (quiz, text, etc.) */
                <View style={[styles.nonVideoHeader, { paddingTop: insets.top }]}>
                    <TouchableOpacity
                        style={styles.backButtonAlt}
                        onPress={async () => {
                            await stopAllMedia(true);
                            router.back();
                        }}
                    >
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.headerContent}>
                        <View style={styles.headerIconContainer}>
                            <Ionicons
                                name={currentLesson?.content_type === 'quiz' ? 'school' : getLessonIcon(currentLesson?.content_type || 'document') as any}
                                size={32}
                                color="#fff"
                            />
                        </View>
                        <Text style={styles.headerTitle} numberOfLines={2}>{currentLesson?.title}</Text>
                        <Text style={styles.headerSubtitle}>
                            {currentLesson?.content_type === 'quiz' ? 'Interactive Quiz' :
                                currentLesson?.content_type === 'text' ? 'Reading Material' : 'Lesson Content'}
                        </Text>
                    </View>
                </View>
            )}

            {/* Main Content Area */}
            <View style={styles.contentArea}>
                {/* Offline indicator */}
                {!isOnline && (
                    <View style={styles.offlineIndicator}>
                        <Ionicons name="cloud-offline" size={16} color={colors.warning} />
                        <Text style={styles.offlineIndicatorText}>Offline Mode</Text>
                    </View>
                )}

                {/* Course download progress bar */}
                {isCourseDownloading && (
                    <View style={styles.courseDownloadBanner}>
                        <View style={styles.courseDownloadInfo}>
                            <Ionicons name="cloud-download" size={18} color="#fff" />
                            <View style={styles.courseDownloadTexts}>
                                <Text style={styles.courseDownloadTitle}>Downloading Course...</Text>
                                <Text style={styles.courseDownloadStatus} numberOfLines={1}>
                                    {courseDownloadStatus || 'Preparing...'}
                                </Text>
                            </View>
                            <Text style={styles.courseDownloadPercent}>{Math.round(courseDownloadProgress * 100)}%</Text>
                        </View>
                        <View style={styles.courseDownloadProgressBg}>
                            <View style={[styles.courseDownloadProgressFill, { width: `${courseDownloadProgress * 100}%` }]} />
                        </View>
                    </View>
                )}

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
                    <View style={styles.lessonHeaderButtons}>
                        {/* Download Course Button */}
                        <TouchableOpacity
                            style={[
                                styles.downloadCourseButton,
                                isCourseDownloaded && styles.downloadCourseButtonActive,
                                isCourseDownloading && styles.downloadCourseButtonDownloading
                            ]}
                            onPress={handleDownloadCourse}
                            disabled={isCourseDownloading}
                        >
                            {isCourseDownloading ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                                <Ionicons
                                    name={isCourseDownloaded ? "checkmark-circle" : "cloud-download-outline"}
                                    size={22}
                                    color={isCourseDownloaded ? colors.success : colors.primary}
                                />
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.outlineButton}
                            onPress={toggleSidebar}
                        >
                            <Ionicons name="list" size={24} color={colors.primary} />
                        </TouchableOpacity>
                    </View>
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
                                contentWidth={SCREEN_WIDTH - Theme.spacing.lg * 2}
                                source={{ html: currentLesson.content_html }}
                                tagsStyles={htmlStyles}
                            />
                        </View>
                    )}

                    {currentLesson?.content_type === 'quiz' && (
                        <View style={styles.quizPrompt}>
                            <View style={styles.quizCard}>
                                <View style={styles.quizIcon}>
                                    <Ionicons name="school" size={48} color={colors.primary} />
                                </View>
                                <Text style={styles.quizTitle}>{currentLesson.quiz_data?.title || 'Knowledge Check'}</Text>
                                <Text style={styles.quizDescription}>
                                    {currentLesson.quiz_data?.description || 'Test your understanding of the material covered in this section.'}
                                </Text>

                                <View style={styles.quizStats}>
                                    <View style={styles.quizStatItem}>
                                        <Ionicons name="help-circle-outline" size={20} color={colors.textSecondary} />
                                        <Text style={styles.quizStatText}>
                                            {currentLesson.quiz_data?.questions?.length || 0} Questions
                                        </Text>
                                    </View>
                                    {currentLesson.quiz_data?.time_limit && (
                                        <View style={styles.quizStatItem}>
                                            <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
                                            <Text style={styles.quizStatText}>
                                                {currentLesson.quiz_data.time_limit} min
                                            </Text>
                                        </View>
                                    )}
                                    <View style={styles.quizStatItem}>
                                        <Ionicons name="ribbon-outline" size={20} color={colors.textSecondary} />
                                        <Text style={styles.quizStatText}>
                                            {currentLesson.quiz_data?.passing_score || 70}% to pass
                                        </Text>
                                    </View>
                                </View>

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
                                                <ActivityIndicator size="small" color={colors.primary} />
                                                <Text style={styles.actionButtonText}>
                                                    {Math.round((downloadState.progress || 0) * 100)}%
                                                </Text>
                                            </>
                                        ) : (
                                            <>
                                                <Ionicons
                                                    name={downloadState?.isDownloaded ? "checkmark-circle" : "cloud-download-outline"}
                                                    size={20}
                                                    color={downloadState?.isDownloaded ? colors.success : colors.primary}
                                                />
                                                <Text style={[
                                                    styles.actionButtonText,
                                                    downloadState?.isDownloaded && styles.actionButtonTextActive
                                                ]}>
                                                    {downloadState?.isDownloaded ? 'Downloaded' : 'Download Video'}
                                                </Text>
                                            </>
                                        )}
                                    </TouchableOpacity>

                                    {/* Download All Content button */}
                                    {currentLesson.blocks && currentLesson.blocks.length > 0 && (
                                        <TouchableOpacity
                                            style={styles.actionButton}
                                            onPress={() => handleFullLessonDownload(currentLesson.id)}
                                            disabled={downloadState?.isDownloading}
                                        >
                                            <Ionicons
                                                name="download-outline"
                                                size={20}
                                                color={colors.primary}
                                            />
                                            <Text style={styles.actionButtonText}>
                                                Download All
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </View>
                    )}

                    {/* Download section for non-video lessons */}
                    {currentLesson && currentLesson.content_type !== 'video' && currentLesson.blocks && currentLesson.blocks.length > 0 && (
                        <View style={styles.downloadSection}>
                            <TouchableOpacity
                                style={styles.downloadAllButton}
                                onPress={() => handleFullLessonDownload(currentLesson.id)}
                                disabled={downloadState?.isDownloading}
                            >
                                {downloadState?.isDownloading ? (
                                    <>
                                        <ActivityIndicator size="small" color="#fff" />
                                        <Text style={styles.downloadAllButtonText}>
                                            Downloading... {Math.round((downloadState.progress || 0) * 100)}%
                                        </Text>
                                    </>
                                ) : (
                                    <>
                                        <Ionicons name="cloud-download-outline" size={22} color="#fff" />
                                        <Text style={styles.downloadAllButtonText}>
                                            Download Lesson Content
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Blocks display for complex lessons */}
                    {currentLesson?.blocks && currentLesson.blocks.length > 0 && (
                        <View style={styles.blocksContainer}>
                            {currentLesson.blocks.map((block: any, index: number) => {
                                // Skip the primary video block (already displayed in video area)
                                if (block.type === 'video' && index === 0 && currentLesson.content_type === 'video') {
                                    return null;
                                }

                                // Skip the primary quiz block ONLY if quiz is the first block (shown in main quiz prompt)
                                if (block.type === 'quiz' && index === 0 && currentLesson.content_type === 'quiz') {
                                    return null;
                                }

                                return (
                                    <View key={block.id || index} style={styles.blockItem}>
                                        {block.type === 'text' && (block.content?.html || block.content?.text || block.content) && (
                                            <View style={styles.textBlockContainer}>
                                                {block.title && <Text style={styles.textBlockTitle}>{block.title}</Text>}
                                                <RenderHtml
                                                    contentWidth={SCREEN_WIDTH - Theme.spacing.lg * 2 - 32}
                                                    source={{
                                                        html: block.content?.html ||
                                                            (typeof block.content === 'string' ? `<div>${block.content}</div>` :
                                                                block.content?.text ? `<div>${block.content.text}</div>` :
                                                                    '<p>No content</p>')
                                                    }}
                                                    tagsStyles={htmlStyles}
                                                    defaultTextProps={{
                                                        selectable: true,
                                                    }}
                                                    enableExperimentalMarginCollapsing={true}
                                                />
                                            </View>
                                        )}

                                        {block.type === 'video' && block.content?.url && (
                                            <View style={styles.additionalVideoBlock}>
                                                <Text style={styles.blockTitle}>{block.title || 'Video'}</Text>
                                                {block.content?.provider === 'youtube' || isEmbeddedVideo(block.content?.provider) ? (
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
                                                    <VideoBlock
                                                        url={block.content.url}
                                                        style={styles.blockVideo}
                                                    />
                                                )}
                                            </View>
                                        )}

                                        {block.type === 'image' && block.content?.url && (
                                            <View style={styles.imageBlock}>
                                                {block.title && <Text style={styles.blockTitle}>{block.title}</Text>}
                                                <Image
                                                    source={{ uri: block.content.url }}
                                                    style={styles.blockImage}
                                                    resizeMode="contain"
                                                />
                                                {(block.content.caption || block.content.alt) && (
                                                    <Text style={styles.imageCaption}>{block.content.caption || block.content.alt}</Text>
                                                )}
                                            </View>
                                        )}

                                        {block.type === 'file' && block.content?.url && (
                                            <TouchableOpacity
                                                style={styles.fileBlock}
                                                onPress={() => handleFileDownload(block.content.url, block.content.filename || block.title || 'file')}
                                            >
                                                <Ionicons name="document-attach" size={24} color={colors.primary} />
                                                <View style={styles.fileInfo}>
                                                    <Text style={styles.fileName}>{block.content.filename || block.title || 'Download File'}</Text>
                                                    <Text style={styles.fileAction}>Tap to download</Text>
                                                </View>
                                                <Ionicons name="cloud-download-outline" size={20} color={colors.textSecondary} />
                                            </TouchableOpacity>
                                        )}

                                        {/* Audio block with custom player */}
                                        {block.type === 'audio' && block.content?.url && (
                                            <View style={styles.audioBlock}>
                                                <Text style={styles.blockTitle}>{block.title || 'Audio'}</Text>
                                                <AudioPlayer
                                                    uri={block.content.url}
                                                    title={block.title || 'Audio'}
                                                />
                                            </View>
                                        )}

                                        {/* Quiz block - show inline quiz card when NOT the primary quiz prompt */}
                                        {block.type === 'quiz' && !(index === 0 && currentLesson.content_type === 'quiz') && (
                                            <View style={styles.inlineQuizCard}>
                                                <View style={styles.inlineQuizHeader}>
                                                    <Ionicons name="school" size={24} color={colors.primary} />
                                                    <Text style={styles.inlineQuizTitle}>{block.title || 'Quiz'}</Text>
                                                </View>
                                                <Text style={styles.inlineQuizDesc}>
                                                    {block.content?.questions?.length || 0} questions
                                                </Text>
                                                <TouchableOpacity
                                                    style={[styles.inlineQuizButton, { flexDirection: 'row', gap: 8 }]}
                                                    onPress={() => {
                                                        // Prepare quiz data from this block
                                                        const quizContent = block.content || {};
                                                        const preparedQuiz = {
                                                            id: block.id,
                                                            title: quizContent.title || block.title || 'Quiz',
                                                            description: 'Test your knowledge',
                                                            time_limit: quizContent.time_limit || 15,
                                                            passing_score: quizContent.passing_score || 70,
                                                            allow_retry: true,
                                                            questions: (quizContent.questions || []).map((q: any, idx: number) => {
                                                                // Determine question type - keep multiple_select as-is
                                                                let questionType: 'multiple_choice' | 'multiple_select' | 'true_false' | 'short_answer' = 'multiple_choice';
                                                                if (q.question_type === 'multiple_select') {
                                                                    questionType = 'multiple_select';
                                                                } else if (q.question_type === 'numeric' || q.question_type === 'text') {
                                                                    questionType = 'short_answer';
                                                                } else if (q.question_type === 'true_false') {
                                                                    questionType = 'true_false';
                                                                } else if (q.question_type) {
                                                                    questionType = q.question_type;
                                                                }

                                                                // Get correct answer(s)
                                                                let correctAnswer: string | number | number[];
                                                                if (q.question_type === 'text' || q.question_type === 'numeric') {
                                                                    correctAnswer = q.correct_text_answer || '';
                                                                } else if (q.question_type === 'multiple_select') {
                                                                    // Get all indices of correct options
                                                                    correctAnswer = (q.options || [])
                                                                        .map((opt: any, i: number) => opt.correct === true ? i : -1)
                                                                        .filter((i: number) => i !== -1);
                                                                } else {
                                                                    correctAnswer = (q.options || []).findIndex((opt: any) => opt.correct === true);
                                                                }

                                                                return {
                                                                    id: q.id || `${block.id}_q${idx + 1}`,
                                                                    question: q.question || 'Question',
                                                                    type: questionType,
                                                                    options: (q.options || []).map((opt: any) => opt.text || opt),
                                                                    correct_answer: correctAnswer,
                                                                    explanation: q.explanation,
                                                                    points: q.points || 1,
                                                                };
                                                            }),
                                                        };
                                                        setQuizData(preparedQuiz);
                                                        setShowQuiz(true);
                                                    }}
                                                >
                                                    <Text style={styles.inlineQuizButtonText}>Take Quiz</Text>
                                                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </ScrollView>

                {/* Navigation Footer */}
                <View style={[styles.navigationFooter, { paddingBottom: insets.bottom + Theme.spacing.sm }]}>
                    <TouchableOpacity
                        style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
                        onPress={() => navigateLesson('prev')}
                        disabled={currentIndex === 0}
                    >
                        <Ionicons
                            name="chevron-back"
                            size={20}
                            color={currentIndex === 0 ? colors.textTertiary : colors.text}
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

                    {currentIndex === allLessons.length - 1 ? (
                        <TouchableOpacity
                            style={[styles.navButton, styles.navButtonComplete]}
                            onPress={async () => {
                                // Mark course as complete (100%)
                                if (id) {
                                    await updateEnrollmentProgress(id, allLessons.length, allLessons.length);
                                }
                                Alert.alert(
                                    'Course Completed! 🎉',
                                    'Congratulations! You have completed this course.',
                                    [
                                        { text: 'Stay Here', style: 'cancel' },
                                        { text: 'Go to Dashboard', onPress: () => router.back() },
                                    ]
                                );
                            }}
                        >
                            <Text style={[styles.navButtonText, styles.navButtonTextComplete]}>
                                Complete
                            </Text>
                            <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={[styles.navButton, styles.navButtonNext]}
                            onPress={() => navigateLesson('next')}
                        >
                            <Text style={[styles.navButtonText, styles.navButtonTextNext]}>
                                Next
                            </Text>
                            <Ionicons name="chevron-forward" size={20} color="#fff" />
                        </TouchableOpacity>
                    )}
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
                                <Ionicons name="close" size={24} color={colors.text} />
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
                            data={course.chapters}
                            keyExtractor={(item) => item.id}
                            showsVerticalScrollIndicator={false}
                            renderItem={({ item: chapter, index: moduleIndex }) => (
                                <View style={styles.moduleSection}>
                                    <View style={styles.moduleSectionHeader}>
                                        <Text style={styles.moduleSectionNumber}>Chapter {moduleIndex + 1}</Text>
                                        <Text style={styles.moduleSectionTitle}>{chapter.title}</Text>
                                    </View>
                                    {(chapter.lessons || []).map((lesson: Lesson, lessonIndex: number) => {
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
                                                            color={isActive ? '#fff' : colors.textSecondary}
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
                                                        {dState?.isDownloading && (
                                                            <View style={styles.downloadStatusContainer}>
                                                                <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 4 }} />
                                                                <Text style={styles.downloadProgressText}>{Math.round(dState.progress * 100)}%</Text>
                                                            </View>
                                                        )}
                                                        {dState?.isDownloaded && !dState?.isDownloading && (
                                                            <View style={styles.downloadStatusContainer}>
                                                                <Ionicons name="cloud-done" size={14} color={colors.success} />
                                                                <Text style={[styles.downloadProgressText, { color: colors.success }]}>Saved</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                </View>
                                                {/* Download button for individual lesson */}
                                                {!dState?.isDownloaded && !dState?.isDownloading && (
                                                    <TouchableOpacity
                                                        style={styles.sidebarDownloadBtn}
                                                        onPress={(e) => {
                                                            e.stopPropagation();
                                                            handleFullLessonDownload(lesson.id);
                                                        }}
                                                    >
                                                        <Ionicons name="cloud-download-outline" size={18} color={colors.textSecondary} />
                                                    </TouchableOpacity>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}
                        />
                    </View>
                </View>
            </Modal>



            {/* PDF Viewer Modal - Native PDF viewer for offline support */}
            <Modal
                visible={pdfViewerVisible}
                animationType="slide"
                onRequestClose={() => setPdfViewerVisible(false)}
            >
                <View style={styles.pdfViewerContainer}>
                    {/* Header */}
                    <View style={[styles.pdfHeader, { paddingTop: insets.top }]}>
                        <TouchableOpacity
                            style={styles.pdfCloseButton}
                            onPress={() => {
                                setPdfViewerVisible(false);
                                setCurrentPdfLocalPath(null);
                                setPdfBase64(null);
                            }}
                        >
                            <Ionicons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                        <View style={styles.pdfTitleContainer}>
                            <Text style={styles.pdfTitle} numberOfLines={1}>{currentPdfTitle}</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.pdfShareButton}
                            onPress={async () => {
                                if (currentPdfLocalPath) {
                                    const canShare = await isAvailableAsync();
                                    if (canShare) {
                                        await shareAsync(currentPdfLocalPath, {
                                            mimeType: 'application/pdf',
                                            dialogTitle: `Share ${currentPdfTitle}`,
                                        });
                                    }
                                } else if (currentPdfUri) {
                                    await Linking.openURL(currentPdfUri);
                                }
                            }}
                        >
                            <Ionicons name="share-outline" size={24} color={colors.primary} />
                        </TouchableOpacity>
                    </View>

                    {/* PDF Content - Native offline viewer using pdf.js */}
                    <View style={styles.pdfContent}>
                        {pdfLoading && (
                            <View style={styles.pdfLoadingOverlay}>
                                <ActivityIndicator size="large" color={colors.primary} />
                                <Text style={styles.pdfLoadingText}>Loading PDF...</Text>
                            </View>
                        )}

                        {pdfBase64 ? (
                            // Native PDF viewer using pdf.js embedded in WebView
                            // pdf.js gets cached after first load for offline use
                            <WebView
                                source={{
                                    html: `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { 
            width: 100%; 
            height: 100%; 
            background: #1a1a2e; 
            overflow: auto;
            -webkit-overflow-scrolling: touch;
        }
        #pdf-container {
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 10px;
            gap: 10px;
        }
        canvas {
            display: block;
            max-width: 100%;
            height: auto;
            background: white;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            border-radius: 4px;
        }
        #loading {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #6366f1;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 16px;
            text-align: center;
        }
        #error {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #ef4444;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 14px;
            text-align: center;
            padding: 20px;
            max-width: 90%;
        }
        #error button {
            margin-top: 15px;
            padding: 12px 24px;
            background: #6366f1;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            cursor: pointer;
        }
        .page-num {
            color: #888;
            font-size: 12px;
            margin-top: 5px;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        }
    </style>
</head>
<body>
    <div id="loading">Loading PDF viewer...</div>
    <div id="pdf-container"></div>
    <script>
        // Load pdf.js dynamically (gets cached for offline use)
        function loadScript(url) {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = url;
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        
        const loadingDiv = document.getElementById('loading');
        const container = document.getElementById('pdf-container');
        
        async function initPdf() {
            try {
                await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                
                const base64Data = "${pdfBase64}";
                const pdfData = atob(base64Data);
                const uint8Array = new Uint8Array(pdfData.length);
                for (let i = 0; i < pdfData.length; i++) {
                    uint8Array[i] = pdfData.charCodeAt(i);
                }
                
                const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;
                loadingDiv.style.display = 'none';
                const totalPages = pdf.numPages;
                
                for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                    const page = await pdf.getPage(pageNum);
                    const scale = window.devicePixelRatio * 1.5;
                    const viewport = page.getViewport({ scale });
                    
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    canvas.style.width = '100%';
                    canvas.style.height = 'auto';
                    
                    await page.render({
                        canvasContext: context,
                        viewport: viewport
                    }).promise;
                    
                    container.appendChild(canvas);
                    
                    const pageLabel = document.createElement('div');
                    pageLabel.className = 'page-num';
                    pageLabel.textContent = 'Page ' + pageNum + ' of ' + totalPages;
                    container.appendChild(pageLabel);
                }
                
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'loaded', pages: totalPages }));
            } catch (error) {
                loadingDiv.innerHTML = '<div id="error">' +
                    '<p>Unable to render PDF in-app.</p>' +
                    '<p style="font-size:12px;margin-top:8px;color:#888;">The PDF is downloaded and available offline.</p>' +
                    '<button onclick="window.ReactNativeWebView.postMessage(JSON.stringify({type:\\'openExternal\\'}))">Open in External App</button>' +
                    '</div>';
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: error.message }));
            }
        }
        
        initPdf();
    </script>
</body>
</html>
                                    `,
                                    baseUrl: 'https://localhost',
                                }}
                                style={styles.pdfWebView}
                                originWhitelist={['*']}
                                javaScriptEnabled={true}
                                domStorageEnabled={true}
                                allowFileAccess={true}
                                mixedContentMode="always"
                                onLoadStart={() => setPdfLoading(true)}
                                onMessage={(event) => {
                                    try {
                                        const data = JSON.parse(event.nativeEvent.data);
                                        if (data.type === 'loaded') {
                                            setPdfLoading(false);
                                        } else if (data.type === 'error') {
                                            setPdfLoading(false);
                                            console.error('PDF.js error:', data.message);
                                        } else if (data.type === 'openExternal') {
                                            // User wants to open in external app
                                            if (currentPdfLocalPath) {
                                                (async () => {
                                                    const canShare = await isAvailableAsync();
                                                    if (canShare) {
                                                        await shareAsync(currentPdfLocalPath, {
                                                            mimeType: 'application/pdf',
                                                            dialogTitle: `Open ${currentPdfTitle}`,
                                                        });
                                                    }
                                                })();
                                            }
                                        }
                                    } catch (e) {
                                        console.error('Message parse error:', e);
                                    }
                                }}
                                onError={(e) => {
                                    setPdfLoading(false);
                                    Alert.alert(
                                        'PDF Error',
                                        'Could not render PDF. Try sharing it to another app.',
                                        [
                                            { text: 'Close', onPress: () => setPdfViewerVisible(false) },
                                            {
                                                text: 'Share',
                                                onPress: async () => {
                                                    if (currentPdfLocalPath) {
                                                        const canShare = await isAvailableAsync();
                                                        if (canShare) {
                                                            await shareAsync(currentPdfLocalPath, {
                                                                mimeType: 'application/pdf',
                                                            });
                                                        }
                                                    }
                                                }
                                            },
                                        ]
                                    );
                                }}
                            />
                        ) : (
                            <View style={styles.pdfEmptyState}>
                                <Ionicons name="document-text-outline" size={64} color={colors.textSecondary} />
                                <Text style={styles.pdfEmptyText}>No PDF loaded</Text>
                                <Text style={styles.pdfEmptySubtext}>Download a PDF first to view it offline</Text>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

            {/* File Download Progress Overlay */}
            {fileDownloadProgress.visible && (
                <View style={styles.downloadProgressOverlay}>
                    <View style={styles.downloadProgressCard}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.downloadProgressTitle}>Downloading...</Text>
                        <Text style={styles.downloadProgressFilename} numberOfLines={1}>
                            {fileDownloadProgress.filename}
                        </Text>
                        <View style={styles.downloadProgressBarContainer}>
                            <View
                                style={[
                                    styles.downloadProgressBar,
                                    { width: `${Math.round(fileDownloadProgress.progress * 100)}%` }
                                ]}
                            />
                        </View>
                        <Text style={styles.downloadProgressPercent}>
                            {Math.round(fileDownloadProgress.progress * 100)}%
                        </Text>
                    </View>
                </View>
            )}
        </View>
    );
}

function VideoBlock({ url, style }: { url: string; style: any }) {
    const player = useVideoPlayer(url, player => {
        player.loop = false;
    });

    return (
        <VideoView
            style={style}
            player={player}
            allowsFullscreen
            allowsPictureInPicture
            contentFit="contain"
            nativeControls
        />
    );
}

const createHtmlStyles = (colors: any): any => ({
    body: {
        fontSize: Theme.fontSize.base,
        color: colors.text,
        lineHeight: 28,
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    p: {
        marginBottom: Theme.spacing.md,
        marginTop: 0,
        lineHeight: 28,
    },
    h1: {
        fontSize: 28,
        fontWeight: '700',
        color: colors.text,
        marginBottom: Theme.spacing.lg,
        marginTop: Theme.spacing.xl,
        lineHeight: 36,
    },
    h2: {
        fontSize: 24,
        fontWeight: '700',
        color: colors.text,
        marginBottom: Theme.spacing.md,
        marginTop: Theme.spacing.lg,
        lineHeight: 32,
    },
    h3: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.text,
        marginBottom: Theme.spacing.sm,
        marginTop: Theme.spacing.md,
        lineHeight: 28,
    },
    h4: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
        marginBottom: Theme.spacing.sm,
        marginTop: Theme.spacing.md,
        lineHeight: 26,
    },
    h5: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginBottom: Theme.spacing.xs,
        marginTop: Theme.spacing.sm,
    },
    h6: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: Theme.spacing.xs,
        marginTop: Theme.spacing.sm,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    ul: {
        marginBottom: Theme.spacing.md,
        marginTop: Theme.spacing.sm,
        paddingLeft: Theme.spacing.md,
    },
    ol: {
        marginBottom: Theme.spacing.md,
        marginTop: Theme.spacing.sm,
        paddingLeft: Theme.spacing.md,
    },
    li: {
        marginBottom: Theme.spacing.xs,
        lineHeight: 26,
    },
    a: {
        color: colors.primary,
        textDecorationLine: 'underline',
    },
    strong: {
        fontWeight: '700',
        color: colors.text,
    },
    b: {
        fontWeight: '700',
        color: colors.text,
    },
    em: {
        fontStyle: 'italic',
    },
    i: {
        fontStyle: 'italic',
    },
    blockquote: {
        borderLeftWidth: 4,
        borderLeftColor: colors.primary,
        paddingLeft: Theme.spacing.md,
        paddingVertical: Theme.spacing.sm,
        marginVertical: Theme.spacing.md,
        backgroundColor: `${colors.primary}10`,
        borderRadius: Theme.borderRadius.sm,
        marginLeft: 0,
        marginRight: 0,
    },
    code: {
        backgroundColor: colors.backgroundSecondary,
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 4,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: Theme.fontSize.sm,
        color: colors.primary,
    },
    pre: {
        backgroundColor: colors.backgroundSecondary,
        padding: Theme.spacing.md,
        borderRadius: Theme.borderRadius.md,
        overflow: 'scroll',
        marginVertical: Theme.spacing.md,
    },
    img: {
        marginVertical: Theme.spacing.md,
        borderRadius: Theme.borderRadius.md,
    },
    table: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: Theme.borderRadius.md,
        marginVertical: Theme.spacing.md,
    },
    th: {
        backgroundColor: colors.backgroundSecondary,
        padding: Theme.spacing.sm,
        fontWeight: '600',
    },
    td: {
        padding: Theme.spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    hr: {
        backgroundColor: colors.border,
        height: 1,
        marginVertical: Theme.spacing.lg,
    },
    mark: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 2,
    },
});

function createStyles(colors: typeof Theme.colors.light, isDark: boolean) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: '#000',
        },
        centerContent: {
            justifyContent: 'center',
            alignItems: 'center',
            padding: Theme.spacing.xl,
        },
        loadingText: {
            marginTop: Theme.spacing.md,
            color: colors.textSecondary,
            fontSize: Theme.fontSize.base,
        },
        errorTitle: {
            fontSize: Theme.fontSize.xl,
            fontWeight: Theme.fontWeight.bold,
            color: colors.text,
            marginTop: Theme.spacing.lg,
        },
        errorText: {
            fontSize: Theme.fontSize.base,
            color: colors.textSecondary,
            textAlign: 'center',
            marginTop: Theme.spacing.sm,
        },
        retryButton: {
            backgroundColor: colors.primary,
            paddingHorizontal: Theme.spacing.xl,
            paddingVertical: Theme.spacing.md,
            borderRadius: Theme.borderRadius.md,
            marginTop: Theme.spacing.xl,
        },
        retryButtonText: {
            color: '#fff',
            fontSize: Theme.fontSize.base,
            fontWeight: Theme.fontWeight.semibold,
        },
        backLink: {
            marginTop: Theme.spacing.md,
        },
        backLinkText: {
            color: colors.primary,
            fontSize: Theme.fontSize.base,
        },

        // Media Container - video player area
        mediaContainer: {
            backgroundColor: '#000',
            width: '100%',
            overflow: 'hidden',
        },
        videoWrapper: {
            width: '100%',
            aspectRatio: 16 / 9,
            backgroundColor: '#000',
            position: 'relative',
            overflow: 'hidden',
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


        // World-class embedded video player styles (YouTube, Vimeo, etc.)
        embeddedVideoWrapper: {
            width: '100%',
            aspectRatio: 16 / 9,
            backgroundColor: '#000',
            position: 'relative',
            overflow: 'hidden',
        },
        embeddedWebView: {
            flex: 1,
            backgroundColor: '#000',
        },
        embeddedLoadingOverlay: {
            ...StyleSheet.absoluteFillObject,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#000',
        },
        embeddedLoadingText: {
            color: 'rgba(255,255,255,0.8)',
            fontSize: 14,
            marginTop: 12,
            fontWeight: '500',
        },
        embeddedBackButton: {
            position: 'absolute',
            top: 12,
            left: 12,
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: 'rgba(0,0,0,0.7)',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 100,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.5,
            shadowRadius: 4,
            elevation: 5,
        },



        // Netflix/YouTube style bottom controls


        // Video Error
        videoErrorContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#000',
            padding: Theme.spacing.xl,
        },
        videoErrorTitle: {
            color: '#fff',
            fontSize: Theme.fontSize.lg,
            fontWeight: Theme.fontWeight.bold,
            marginTop: Theme.spacing.md,
        },
        videoErrorText: {
            color: 'rgba(255,255,255,0.7)',
            fontSize: Theme.fontSize.sm,
            textAlign: 'center',
            marginTop: Theme.spacing.xs,
            maxWidth: 280,
        },
        videoRetryButton: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.primary,
            paddingHorizontal: Theme.spacing.lg,
            paddingVertical: Theme.spacing.sm,
            borderRadius: Theme.borderRadius.md,
            marginTop: Theme.spacing.lg,
            gap: Theme.spacing.xs,
        },
        videoRetryText: {
            color: '#fff',
            fontWeight: Theme.fontWeight.semibold,
        },

        // Content Placeholder (non-video) - edX/Udemy style header
        contentPlaceholder: {
            flex: 1,
            backgroundColor: '#1a1a2e',
            justifyContent: 'center',
            alignItems: 'center',
        },

        // Non-video header (for quiz, text content)
        nonVideoHeader: {
            backgroundColor: '#1a1a2e',
            paddingBottom: Theme.spacing.xl + 20,
            paddingHorizontal: Theme.spacing.lg,
        },
        backButtonAlt: {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: 'rgba(255,255,255,0.15)',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: Theme.spacing.md,
        },
        headerContent: {
            alignItems: 'center',
            paddingTop: Theme.spacing.md,
        },
        headerIconContainer: {
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: 'rgba(255,255,255,0.1)',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: Theme.spacing.md,
        },
        headerTitle: {
            fontSize: Theme.fontSize.xl,
            fontWeight: Theme.fontWeight.bold,
            color: '#fff',
            textAlign: 'center',
            marginBottom: Theme.spacing.xs,
        },
        headerSubtitle: {
            fontSize: Theme.fontSize.sm,
            color: 'rgba(255,255,255,0.7)',
        },
        placeholderContent: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: Theme.spacing.xl,
        },
        placeholderIcon: {
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: 'rgba(255,255,255,0.1)',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: Theme.spacing.md,
        },
        placeholderTitle: {
            fontSize: Theme.fontSize.lg,
            fontWeight: Theme.fontWeight.bold,
            color: '#fff',
            textAlign: 'center',
            marginTop: Theme.spacing.sm,
        },
        placeholderSubtitle: {
            fontSize: Theme.fontSize.sm,
            color: 'rgba(255,255,255,0.6)',
            marginTop: Theme.spacing.xs,
        },

        // Content Area
        contentArea: {
            flex: 1,
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            marginTop: -20,
        },
        lessonHeader: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            padding: Theme.spacing.lg,
            paddingTop: Theme.spacing.xl + 4,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        lessonInfo: {
            flex: 1,
            marginRight: Theme.spacing.md,
        },
        moduleLabel: {
            fontSize: Theme.fontSize.xs,
            color: colors.primary,
            fontWeight: Theme.fontWeight.medium,
            marginBottom: Theme.spacing.xs,
        },
        lessonTitle: {
            fontSize: Theme.fontSize.lg,
            fontWeight: Theme.fontWeight.bold,
            color: colors.text,
            lineHeight: 24,
        },
        outlineButton: {
            width: 44,
            height: 44,
            borderRadius: Theme.borderRadius.md,
            backgroundColor: colors.primary + '15',
            justifyContent: 'center',
            alignItems: 'center',
        },

        // Scroll Content
        scrollContent: {
            flex: 1,
        },
        scrollContentInner: {
            padding: Theme.spacing.lg,
            paddingBottom: Theme.spacing['3xl'],
            flexGrow: 1,
        },
        textContent: {
            backgroundColor: colors.surface,
            borderRadius: Theme.borderRadius.lg,
            padding: Theme.spacing.lg,
        },

        // Text block container for rich HTML content
        textBlockContainer: {
            backgroundColor: colors.surface,
            borderRadius: Theme.borderRadius.lg,
            padding: Theme.spacing.lg,
            marginVertical: Theme.spacing.sm,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
        },
        textBlockTitle: {
            fontSize: Theme.fontSize.lg,
            fontWeight: Theme.fontWeight.bold,
            color: colors.text,
            marginBottom: Theme.spacing.md,
            paddingBottom: Theme.spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },

        // Quiz
        quizPrompt: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingVertical: Theme.spacing.xl,
        },
        quizIcon: {
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: colors.primary + '15',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: Theme.spacing.md,
        },
        quizTitle: {
            fontSize: Theme.fontSize.xl,
            fontWeight: Theme.fontWeight.bold,
            color: colors.text,
            marginBottom: Theme.spacing.xs,
            textAlign: 'center',
        },
        quizDescription: {
            fontSize: Theme.fontSize.base,
            color: colors.textSecondary,
            textAlign: 'center',
            marginBottom: Theme.spacing.lg,
            paddingHorizontal: Theme.spacing.md,
        },
        quizCard: {
            backgroundColor: colors.surface,
            borderRadius: Theme.borderRadius.xl,
            padding: Theme.spacing.xl,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 4,
        },
        quizStats: {
            flexDirection: 'row',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: Theme.spacing.lg,
            marginBottom: Theme.spacing.xl,
            paddingVertical: Theme.spacing.md,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: colors.border,
            width: '100%',
        },
        quizStatItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Theme.spacing.xs,
        },
        quizStatText: {
            fontSize: Theme.fontSize.sm,
            color: colors.textSecondary,
        },
        startQuizButton: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.primary,
            paddingHorizontal: Theme.spacing.xl,
            paddingVertical: Theme.spacing.md,
            borderRadius: Theme.borderRadius.lg,
            gap: Theme.spacing.sm,
            minWidth: 180,
            justifyContent: 'center',
        },
        startQuizButtonText: {
            color: '#fff',
            fontSize: Theme.fontSize.base,
            fontWeight: Theme.fontWeight.bold,
        },

        // Video Description
        videoDescription: {
            backgroundColor: colors.surface,
            borderRadius: Theme.borderRadius.lg,
            padding: Theme.spacing.lg,
        },
        descriptionTitle: {
            fontSize: Theme.fontSize.base,
            fontWeight: Theme.fontWeight.semibold,
            color: colors.text,
            marginBottom: Theme.spacing.sm,
        },
        descriptionText: {
            fontSize: Theme.fontSize.base,
            color: colors.textSecondary,
            lineHeight: 24,
        },
        videoActions: {
            flexDirection: 'row',
            marginTop: Theme.spacing.lg,
            gap: Theme.spacing.md,
        },
        actionButton: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.background,
            paddingHorizontal: Theme.spacing.md,
            paddingVertical: Theme.spacing.sm,
            borderRadius: Theme.borderRadius.md,
            gap: Theme.spacing.xs,
        },
        actionButtonActive: {
            backgroundColor: colors.success + '15',
        },
        actionButtonText: {
            fontSize: Theme.fontSize.sm,
            color: colors.text,
        },
        actionButtonTextActive: {
            color: colors.success,
        },

        // Download Section for non-video lessons
        downloadSection: {
            marginTop: Theme.spacing.lg,
            paddingHorizontal: Theme.spacing.md,
        },
        downloadAllButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
            paddingHorizontal: Theme.spacing.lg,
            paddingVertical: Theme.spacing.md,
            borderRadius: Theme.borderRadius.md,
            gap: Theme.spacing.sm,
        },
        downloadAllButtonText: {
            fontSize: Theme.fontSize.base,
            fontWeight: Theme.fontWeight.semibold,
            color: '#fff',
        },

        // Blocks
        blocksContainer: {
            marginTop: Theme.spacing.lg,
        },
        blockItem: {
            marginBottom: Theme.spacing.md,
        },
        audioBlock: {
            marginVertical: Theme.spacing.md,
        },

        // Navigation Footer
        navigationFooter: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: Theme.spacing.lg,
            paddingVertical: Theme.spacing.md,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        navButton: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: Theme.spacing.sm,
            paddingHorizontal: Theme.spacing.md,
            borderRadius: Theme.borderRadius.md,
            gap: Theme.spacing.xs,
        },
        navButtonNext: {
            backgroundColor: colors.primary,
        },
        navButtonComplete: {
            backgroundColor: colors.success,
        },
        navButtonDisabled: {
            opacity: 0.5,
        },
        navButtonText: {
            fontSize: Theme.fontSize.base,
            color: colors.text,
            fontWeight: Theme.fontWeight.medium,
        },
        navButtonTextNext: {
            color: '#fff',
        },
        navButtonTextComplete: {
            color: '#fff',
        },
        navButtonTextDisabled: {
            color: colors.textTertiary,
        },
        progressIndicator: {
            paddingHorizontal: Theme.spacing.md,
        },
        progressText: {
            fontSize: Theme.fontSize.sm,
            color: colors.textSecondary,
            fontWeight: Theme.fontWeight.medium,
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
            backgroundColor: colors.surface,
            borderTopLeftRadius: 20,
            borderBottomLeftRadius: 20,
        },
        sidebarHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: Theme.spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        sidebarTitle: {
            fontSize: Theme.fontSize.lg,
            fontWeight: Theme.fontWeight.bold,
            color: colors.text,
        },
        closeSidebar: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.background,
            justifyContent: 'center',
            alignItems: 'center',
        },
        courseProgress: {
            padding: Theme.spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        courseProgressBar: {
            height: 6,
            backgroundColor: colors.border,
            borderRadius: 3,
            marginBottom: Theme.spacing.sm,
        },
        courseProgressFill: {
            height: '100%',
            backgroundColor: colors.primary,
            borderRadius: 3,
        },
        courseProgressText: {
            fontSize: Theme.fontSize.xs,
            color: colors.textSecondary,
        },
        moduleSection: {
            paddingVertical: Theme.spacing.md,
        },
        moduleSectionHeader: {
            paddingHorizontal: Theme.spacing.lg,
            paddingVertical: Theme.spacing.sm,
        },
        moduleSectionNumber: {
            fontSize: Theme.fontSize.xs,
            color: colors.primary,
            fontWeight: Theme.fontWeight.semibold,
            marginBottom: 2,
        },
        moduleSectionTitle: {
            fontSize: Theme.fontSize.base,
            fontWeight: Theme.fontWeight.semibold,
            color: colors.text,
        },
        sidebarLesson: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: Theme.spacing.md,
            paddingHorizontal: Theme.spacing.lg,
            marginHorizontal: Theme.spacing.sm,
            borderRadius: Theme.borderRadius.md,
        },
        sidebarLessonActive: {
            backgroundColor: colors.primary + '15',
        },
        lessonStatusIcon: {
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: colors.background,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: Theme.spacing.md,
        },
        lessonStatusCompleted: {
            backgroundColor: colors.success,
        },
        lessonStatusActive: {
            backgroundColor: colors.primary,
        },
        sidebarLessonInfo: {
            flex: 1,
        },
        sidebarLessonTitle: {
            fontSize: Theme.fontSize.sm,
            color: colors.text,
            lineHeight: 20,
        },
        sidebarLessonTitleActive: {
            fontWeight: Theme.fontWeight.semibold,
            color: colors.primary,
        },
        sidebarLessonMeta: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Theme.spacing.xs,
            marginTop: 2,
        },
        sidebarLessonType: {
            fontSize: Theme.fontSize.xs,
            color: colors.textTertiary,
        },
        downloadStatusContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: colors.backgroundSecondary,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: Theme.borderRadius.sm,
        },
        downloadProgressText: {
            fontSize: Theme.fontSize.xs,
            color: colors.textSecondary,
            fontWeight: Theme.fontWeight.medium,
        },
        sidebarDownloadBtn: {
            padding: Theme.spacing.xs,
            marginLeft: 'auto',
        },

        // Additional Block styles for video/image/file blocks
        blockTitle: {
            fontSize: Theme.fontSize.base,
            fontWeight: Theme.fontWeight.semibold,
            color: colors.text,
            marginBottom: Theme.spacing.sm,
        },
        additionalVideoBlock: {
            marginVertical: Theme.spacing.sm,
            width: '100%',
        },
        embeddedVideoContainer: {
            width: '100%',
            aspectRatio: 16 / 9,
            borderRadius: Theme.borderRadius.lg,
            overflow: 'hidden',
            backgroundColor: '#000',
        },
        embeddedVideo: {
            flex: 1,
        },
        blockVideo: {
            width: '100%',
            aspectRatio: 16 / 9,
            borderRadius: Theme.borderRadius.lg,
            backgroundColor: '#000',
        },
        imageBlock: {
            marginVertical: Theme.spacing.sm,
        },
        imageContainer: {
            borderRadius: Theme.borderRadius.lg,
            overflow: 'hidden',
            backgroundColor: colors.backgroundSecondary,
        },
        imagePlaceholder: {
            aspectRatio: 16 / 10,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.backgroundSecondary,
        },
        imageCaption: {
            fontSize: Theme.fontSize.sm,
            color: colors.textSecondary,
            marginTop: Theme.spacing.sm,
            textAlign: 'center',
        },
        fileBlock: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: Theme.spacing.md,
            backgroundColor: colors.backgroundSecondary,
            borderRadius: Theme.borderRadius.lg,
            gap: Theme.spacing.md,
        },
        fileInfo: {
            flex: 1,
        },
        fileName: {
            fontSize: Theme.fontSize.base,
            fontWeight: Theme.fontWeight.medium,
            color: colors.text,
        },
        fileAction: {
            fontSize: Theme.fontSize.xs,
            color: colors.primary,
            marginTop: 2,
        },

        // Video touch area


        // Skip indicator (shows when double-tapping)


        // Speed boost indicator (Instagram/FB style 2x)


        // Block image styles
        blockImage: {
            width: '100%',
            minHeight: 200,
            maxHeight: 400,
            borderRadius: Theme.borderRadius.lg,
        },

        // Inline quiz card (for quizzes not at first position)
        inlineQuizCard: {
            backgroundColor: colors.surface,
            borderRadius: Theme.borderRadius.lg,
            padding: Theme.spacing.lg,
            marginVertical: Theme.spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
        },
        inlineQuizHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: Theme.spacing.md,
            gap: Theme.spacing.sm,
        },
        inlineQuizTitle: {
            fontSize: Theme.fontSize.lg,
            fontWeight: Theme.fontWeight.semibold,
            color: colors.text,
            flex: 1,
        },
        inlineQuizDesc: {
            fontSize: Theme.fontSize.base,
            color: colors.textSecondary,
            marginBottom: Theme.spacing.lg,
            lineHeight: 22,
        },
        inlineQuizButton: {
            backgroundColor: colors.primary,
            paddingVertical: Theme.spacing.md,
            paddingHorizontal: Theme.spacing.xl,
            borderRadius: Theme.borderRadius.lg,
            alignItems: 'center',
        },
        inlineQuizButtonText: {
            color: '#fff',
            fontSize: Theme.fontSize.base,
            fontWeight: Theme.fontWeight.semibold,
        },

        // PDF Viewer styles
        pdfViewerContainer: {
            flex: 1,
            backgroundColor: colors.background,
        },
        pdfHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: Theme.spacing.md,
            paddingVertical: Theme.spacing.sm,
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        pdfCloseButton: {
            padding: Theme.spacing.sm,
        },
        pdfTitleContainer: {
            flex: 1,
            alignItems: 'center',
            marginHorizontal: Theme.spacing.sm,
        },
        pdfTitle: {
            fontSize: Theme.fontSize.base,
            fontWeight: Theme.fontWeight.semibold,
            color: colors.text,
            textAlign: 'center',
        },
        pdfPageInfo: {
            fontSize: Theme.fontSize.xs,
            color: colors.textSecondary,
            marginTop: 2,
        },
        pdfShareButton: {
            padding: Theme.spacing.sm,
        },
        pdfContent: {
            flex: 1,
            backgroundColor: colors.backgroundSecondary,
        },
        pdfView: {
            flex: 1,
            backgroundColor: colors.backgroundSecondary,
        },
        pdfWebView: {
            flex: 1,
            backgroundColor: colors.background,
        },
        pdfEmptyState: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: Theme.spacing.xl,
        },
        pdfEmptyText: {
            fontSize: Theme.fontSize.lg,
            fontWeight: Theme.fontWeight.semibold,
            color: colors.textSecondary,
            marginTop: Theme.spacing.md,
        },
        pdfEmptySubtext: {
            fontSize: Theme.fontSize.sm,
            color: colors.textSecondary,
            marginTop: Theme.spacing.xs,
            textAlign: 'center',
        },
        pdfLoadingOverlay: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.background,
            zIndex: 10,
        },
        pdfLoadingText: {
            marginTop: Theme.spacing.md,
            fontSize: Theme.fontSize.base,
            color: colors.textSecondary,
        },

        // Download Progress Overlay
        downloadProgressOverlay: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
        },
        downloadProgressCard: {
            backgroundColor: colors.surface,
            borderRadius: Theme.borderRadius.xl,
            padding: Theme.spacing.xl,
            alignItems: 'center',
            width: SCREEN_WIDTH * 0.8,
            maxWidth: 300,
        },
        downloadProgressTitle: {
            fontSize: Theme.fontSize.lg,
            fontWeight: Theme.fontWeight.semibold,
            color: colors.text,
            marginTop: Theme.spacing.md,
        },
        downloadProgressFilename: {
            fontSize: Theme.fontSize.sm,
            color: colors.textSecondary,
            marginTop: Theme.spacing.xs,
            maxWidth: '100%',
        },
        downloadProgressBarContainer: {
            width: '100%',
            height: 8,
            backgroundColor: colors.border,
            borderRadius: 4,
            marginTop: Theme.spacing.lg,
            overflow: 'hidden',
        },
        downloadProgressBar: {
            height: '100%',
            backgroundColor: colors.primary,
            borderRadius: 4,
        },
        downloadProgressPercent: {
            fontSize: Theme.fontSize.base,
            fontWeight: Theme.fontWeight.medium,
            color: colors.primary,
            marginTop: Theme.spacing.sm,
        },

        // Offline indicator styles
        offlineIndicator: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.warning + '20',
            paddingVertical: Theme.spacing.xs,
            paddingHorizontal: Theme.spacing.md,
            gap: Theme.spacing.xs,
            borderBottomWidth: 1,
            borderBottomColor: colors.warning + '30',
        },
        offlineIndicatorText: {
            fontSize: Theme.fontSize.xs,
            fontWeight: Theme.fontWeight.medium,
            color: colors.warning,
        },

        // Course download banner
        courseDownloadBanner: {
            backgroundColor: colors.primary,
            paddingHorizontal: Theme.spacing.md,
            paddingVertical: Theme.spacing.sm,
        },
        courseDownloadInfo: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Theme.spacing.sm,
        },
        courseDownloadTexts: {
            flex: 1,
        },
        courseDownloadTitle: {
            fontSize: Theme.fontSize.sm,
            fontWeight: Theme.fontWeight.semibold,
            color: '#fff',
        },
        courseDownloadStatus: {
            fontSize: Theme.fontSize.xs,
            color: 'rgba(255,255,255,0.8)',
        },
        courseDownloadPercent: {
            fontSize: Theme.fontSize.base,
            fontWeight: Theme.fontWeight.bold,
            color: '#fff',
        },
        courseDownloadProgressBg: {
            height: 3,
            backgroundColor: 'rgba(255,255,255,0.3)',
            borderRadius: 2,
            marginTop: Theme.spacing.xs,
            overflow: 'hidden',
        },
        courseDownloadProgressFill: {
            height: '100%',
            backgroundColor: '#fff',
            borderRadius: 2,
        },

        // Lesson header buttons container
        lessonHeaderButtons: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Theme.spacing.sm,
        },
        downloadCourseButton: {
            width: 44,
            height: 44,
            borderRadius: Theme.borderRadius.lg,
            backgroundColor: colors.background,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.border,
        },
        downloadCourseButtonActive: {
            backgroundColor: colors.success + '15',
            borderColor: colors.success + '30',
        },
        downloadCourseButtonDownloading: {
            backgroundColor: colors.primary + '10',
            borderColor: colors.primary + '30',
        },
    });
}
