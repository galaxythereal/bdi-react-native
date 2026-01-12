import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { documentDirectory, downloadAsync, cacheDirectory, getInfoAsync, deleteAsync, readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { shareAsync, isAvailableAsync } from 'expo-sharing';
import * as Linking from 'expo-linking';
import * as ScreenOrientation from 'expo-screen-orientation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    FlatList,
    GestureResponderEvent,
    Image,
    Modal,
    PanResponder,
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
import { AudioPlayer } from '../../src/components/AudioPlayer';
import { fetchCourseContentWithOfflineSupport, updateEnrollmentProgress } from '../../src/features/courses/courseService';
import {
    deleteLessonDownload,
    downloadLessonVideo,
    downloadLessonContent,
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
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);
    const [videoError, setVideoError] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isSpeedBoosted, setIsSpeedBoosted] = useState(false); // For hold-to-2x feature
    const [normalSpeed, setNormalSpeed] = useState(1.0); // Store normal speed when boosting
    
    const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

    // Download state
    const [downloadStates, setDownloadStates] = useState<Map<string, {
        isDownloaded: boolean;
        isDownloading: boolean;
        progress: number;
    }>>(new Map());

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

    // Double-tap and long-press state for video
    const [lastTapTime, setLastTapTime] = useState<{ left: number; right: number }>({ left: 0, right: 0 });
    const [skipIndicator, setSkipIndicator] = useState<{ visible: boolean; side: 'left' | 'right'; seconds: number }>({ 
        visible: false, side: 'left', seconds: 0 
    });

    // Refs
    const videoRef = useRef<Video>(null);
    const controlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const skipIndicatorTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Current lesson
    const currentLesson = allLessons[currentIndex] || null;

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

    const selectLesson = (index: number) => {
        setCurrentIndex(index);
        setShowSidebar(false);
        setShowQuiz(false);
        setIsPlaying(false);
        setVideoProgress(0);
        setVideoDuration(0);
        setVideoError(null); // Reset video error when changing lessons

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

    const handleVideoPlaybackStatus = (status: AVPlaybackStatus) => {
        if (!status.isLoaded) {
            // Only set buffering if we don't already have video loaded
            if (videoDuration === 0) {
                setIsBuffering(true);
            }
            return;
        }
        
        // Only show buffering when actually buffering AND not playing
        // This prevents the buffering overlay from showing during normal playback
        setIsBuffering(status.isBuffering && !status.isPlaying);
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

    const changePlaybackSpeed = async (speed: number) => {
        if (videoRef.current) {
            setPlaybackSpeed(speed);
            await videoRef.current.setRateAsync(speed, true);
            setShowSpeedMenu(false);
        }
    };

    const cyclePlaybackSpeed = async () => {
        if (!videoRef.current) return;
        const currentIndex = SPEED_OPTIONS.indexOf(playbackSpeed);
        const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length;
        const newSpeed = SPEED_OPTIONS[nextIndex];
        setPlaybackSpeed(newSpeed);
        await videoRef.current.setRateAsync(newSpeed, true);
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

    // Show skip indicator animation
    const showSkipIndicatorAnimation = (side: 'left' | 'right', seconds: number) => {
        // Clear any existing timeout
        if (skipIndicatorTimeout.current) {
            clearTimeout(skipIndicatorTimeout.current);
        }
        
        setSkipIndicator({ visible: true, side, seconds });
        
        skipIndicatorTimeout.current = setTimeout(() => {
            setSkipIndicator({ visible: false, side: 'left', seconds: 0 });
        }, 600);
    };

    // Handle video area tap - supports double-tap skip and single tap controls
    const handleVideoAreaTap = async (event: GestureResponderEvent) => {
        const touchX = event.nativeEvent.locationX;
        const screenWidth = SCREEN_WIDTH;
        const now = Date.now();
        const DOUBLE_TAP_DELAY = 300;
        
        // Determine if left or right side
        const isLeftSide = touchX < screenWidth * 0.35;
        const isRightSide = touchX > screenWidth * 0.65;
        
        if (isLeftSide) {
            // Check for double-tap on left
            if (now - lastTapTime.left < DOUBLE_TAP_DELAY) {
                // Double tap - skip back 10 seconds
                const newPosition = Math.max(0, videoProgress - 10000);
                seekVideo(newPosition);
                showSkipIndicatorAnimation('left', -10);
                setLastTapTime({ left: 0, right: lastTapTime.right });
            } else {
                // First tap - wait to see if it's a double tap
                setLastTapTime({ left: now, right: lastTapTime.right });
                setTimeout(() => {
                    setLastTapTime(prev => {
                        if (prev.left === now) {
                            // Was a single tap - toggle controls
                            setShowControls(c => !c);
                        }
                        return prev;
                    });
                }, DOUBLE_TAP_DELAY);
            }
        } else if (isRightSide) {
            // Check for double-tap on right
            if (now - lastTapTime.right < DOUBLE_TAP_DELAY) {
                // Double tap - skip forward 10 seconds
                const newPosition = Math.min(videoDuration, videoProgress + 10000);
                seekVideo(newPosition);
                showSkipIndicatorAnimation('right', 10);
                setLastTapTime({ left: lastTapTime.left, right: 0 });
            } else {
                // First tap - wait to see if it's a double tap
                setLastTapTime({ left: lastTapTime.left, right: now });
                setTimeout(() => {
                    setLastTapTime(prev => {
                        if (prev.right === now) {
                            // Was a single tap - toggle controls
                            setShowControls(c => !c);
                        }
                        return prev;
                    });
                }, DOUBLE_TAP_DELAY);
            }
        } else {
            // Center tap - toggle controls immediately
            setShowControls(!showControls);
        }
    };

    // Speed boost on long press (Instagram/FB style - hold right side for 2x)
    const handleVideoLongPressStart = async (event: GestureResponderEvent) => {
        const touchX = event.nativeEvent.locationX;
        const screenWidth = SCREEN_WIDTH;
        
        // If touch is on the right 40% of screen, start speed boost
        if (touchX > screenWidth * 0.6) {
            longPressTimer.current = setTimeout(async () => {
                if (videoRef.current && isPlaying) {
                    setNormalSpeed(playbackSpeed);
                    setIsSpeedBoosted(true);
                    try {
                        await videoRef.current.setRateAsync(2.0, true);
                    } catch (e) {
                        console.warn('Could not set playback rate:', e);
                    }
                }
            }, 300); // Start after 300ms hold
        }
    };
    
    const handleVideoLongPressEnd = async () => {
        // Clear the timer
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
        
        // If speed was boosted, restore normal speed
        if (isSpeedBoosted && videoRef.current) {
            setIsSpeedBoosted(false);
            try {
                await videoRef.current.setRateAsync(normalSpeed, true);
            } catch (e) {
                console.warn('Could not restore playback rate:', e);
            }
        }
    };

    // Toggle fullscreen using native player
    const toggleFullscreen = async () => {
        if (videoRef.current) {
            if (isFullscreen) {
                await videoRef.current.dismissFullscreenPlayer();
            } else {
                await videoRef.current.presentFullscreenPlayer();
            }
            setIsFullscreen(!isFullscreen);
        }
    };

    // Toggle landscape mode
    const toggleLandscape = async () => {
        try {
            const currentOrientation = await ScreenOrientation.getOrientationAsync();
            const isCurrentlyLandscape = 
                currentOrientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
                currentOrientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
            
            if (isCurrentlyLandscape) {
                // Go back to portrait
                await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
            } else {
                // Go to landscape
                await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
            }
        } catch (e) {
            console.warn('Could not change orientation:', e);
        }
    };

    // Cleanup orientation lock when leaving screen
    useEffect(() => {
        return () => {
            ScreenOrientation.unlockAsync().catch(() => {});
        };
    }, []);

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

    const handleQuizComplete = async (result: QuizResult) => {
        console.log('Quiz completed:', result);
        // Update progress when quiz is completed (regardless of pass/fail - user completed the lesson)
        if (id) {
            const completedLessons = currentIndex + 1;
            await updateEnrollmentProgress(id, completedLessons, allLessons.length);
        }
        // Don't auto-close - let user see results and click Continue
        // The quiz component shows results and has a Continue button that calls onCancel
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
            <View style={[styles.container, { paddingTop: insets.top, backgroundColor: COLORS.background }]}>
                <StatusBar barStyle="dark-content" />
                <QuizComponent
                    quiz={quizData}
                    onComplete={handleQuizComplete}
                    onCancel={handleQuizCancel}
                />
            </View>
        );
    }

    const downloadState = currentLesson ? downloadStates.get(currentLesson.id) : null;
    const progressPercent = videoDuration > 0 ? (videoProgress / videoDuration) * 100 : 0;
    
    // Get embed URL for YouTube/Vimeo/Wistia or direct URL
    const videoProvider = currentLesson?.video_provider || 'direct';
    const useEmbeddedPlayer = isEmbeddedVideo(videoProvider);
    
    // For direct videos, check if downloaded first, then use original URL
    const getDirectVideoSource = () => {
        if (!currentLesson?.video_url) return null;
        const state = downloadStates.get(currentLesson.id);
        if (state?.isDownloaded) {
            return { uri: getLocalLessonUri(currentLesson.id) };
        }
        return { uri: currentLesson.video_url };
    };
    
    // Get the appropriate video URL
    const embedUrl = useEmbeddedPlayer && currentLesson?.video_url 
        ? getEmbedUrl(currentLesson.video_url, videoProvider) 
        : null;
    const directVideoSource = !useEmbeddedPlayer ? getDirectVideoSource() : null;
    
    // Debug logging for video issues
    console.log('Video Debug:', {
        lessonTitle: currentLesson?.title,
        contentType: currentLesson?.content_type,
        videoUrl: currentLesson?.video_url,
        videoProvider,
        useEmbeddedPlayer,
        embedUrl,
        directVideoSource,
    });

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            {/* Video/Content Area - Only show for video content */}
            {currentLesson?.content_type === 'video' && currentLesson?.video_url ? (
                <View style={[styles.mediaContainer]}>
                    {/* Safe area spacer for video */}
                    <View style={{ height: insets.top, backgroundColor: '#000' }} />
                    {useEmbeddedPlayer && embedUrl ? (
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
                                    <View style={[styles.bufferingOverlay, { pointerEvents: 'none' }]}>
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
                    ) : directVideoSource ? (
                        /* Native video player (direct URLs) */
                        videoError ? (
                            /* Video error state */
                            <View style={styles.videoWrapper}>
                                <View style={styles.videoErrorContainer}>
                                    <Ionicons name="alert-circle" size={48} color={COLORS.error} />
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
                                {/* Back button */}
                                <View style={styles.embeddedTopBar}>
                                    <TouchableOpacity 
                                        style={styles.topBarButton}
                                        onPress={() => router.back()}
                                    >
                                        <Ionicons name="arrow-back" size={24} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                        <View style={styles.videoWrapper}>
                            {/* Video component */}
                            <Video
                                ref={videoRef}
                                source={directVideoSource}
                                style={styles.video}
                                resizeMode={ResizeMode.CONTAIN}
                                onPlaybackStatusUpdate={handleVideoPlaybackStatus}
                                shouldPlay={false}
                                useNativeControls={false}
                                onFullscreenUpdate={({ fullscreenUpdate }) => {
                                    if (fullscreenUpdate === 3) { // PLAYER_DID_DISMISS
                                        setIsFullscreen(false);
                                    } else if (fullscreenUpdate === 1) { // PLAYER_WILL_PRESENT
                                        setIsFullscreen(true);
                                    }
                                }}
                                onError={(error) => {
                                    console.error('Video playback error:', error);
                                    // Detect SSL certificate errors
                                    const errorStr = String(error);
                                    let errorMsg = 'Unable to play video.';
                                    if (errorStr.includes('SSL') || errorStr.includes('certificate') || errorStr.includes('SSLPeerUnverifiedException')) {
                                        errorMsg = 'SSL Certificate Error: The video server has an invalid certificate. Please contact support or try a different video source.';
                                    } else if (errorStr.includes('404') || errorStr.includes('not found')) {
                                        errorMsg = 'Video not found. The file may have been moved or deleted.';
                                    } else if (errorStr.includes('network') || errorStr.includes('connection')) {
                                        errorMsg = 'Network error. Please check your internet connection.';
                                    }
                                    setVideoError(errorMsg);
                                    setIsBuffering(false);
                                }}
                                onLoad={() => {
                                    setVideoError(null);
                                    setIsBuffering(false);
                                }}
                            />
                            
                            {/* Transparent touch overlay for gestures - positioned below top bar */}
                            <View style={styles.videoGestureContainer} pointerEvents="box-none">
                                {/* Left tap zone - double tap to rewind, single tap toggle controls */}
                                <Pressable
                                    style={styles.videoTapZoneLeft}
                                    onPress={handleVideoAreaTap}
                                />
                                
                                {/* Center tap zone - toggle controls */}
                                <Pressable
                                    style={styles.videoTapZoneCenter}
                                    onPress={() => setShowControls(prev => !prev)}
                                />
                                
                                {/* Right tap zone - double tap to forward, long press for 2x */}
                                <Pressable
                                    style={styles.videoTapZoneRight}
                                    onPress={handleVideoAreaTap}
                                    onLongPress={async () => {
                                        if (videoRef.current && isPlaying) {
                                            setNormalSpeed(playbackSpeed);
                                            setIsSpeedBoosted(true);
                                            try {
                                                await videoRef.current.setRateAsync(2.0, true);
                                            } catch (e) {
                                                console.warn('Could not set playback rate:', e);
                                            }
                                        }
                                    }}
                                    onPressOut={handleVideoLongPressEnd}
                                    delayLongPress={300}
                                />
                            </View>

                            {/* Skip indicator (shows -10s or +10s) */}
                            {skipIndicator.visible && (
                                <View 
                                    style={[
                                        styles.skipIndicator,
                                        skipIndicator.side === 'left' ? styles.skipIndicatorLeft : styles.skipIndicatorRight
                                    ]}
                                    pointerEvents="none"
                                >
                                    <Ionicons 
                                        name={skipIndicator.side === 'left' ? "play-back" : "play-forward"} 
                                        size={22} 
                                        color="#fff" 
                                    />
                                    <Text style={styles.skipIndicatorText}>
                                        {Math.abs(skipIndicator.seconds)}s
                                    </Text>
                                </View>
                            )}

                            {/* Speed boost indicator */}
                            {isSpeedBoosted && (
                                <View style={styles.speedBoostIndicator} pointerEvents="none">
                                    <Ionicons name="speedometer" size={14} color="#fff" />
                                    <Text style={styles.speedBoostText}>2×</Text>
                                </View>
                            )}

                            {/* Buffering indicator - pointerEvents none so it doesn't block touches */}
                            {isBuffering && (
                                <View style={styles.bufferingOverlay} pointerEvents="none">
                                    <ActivityIndicator size="large" color="#fff" />
                                </View>
                            )}

                            {/* Video Controls Overlay - pointerEvents box-none allows taps to pass through to gesture layer */}
                            {showControls && (
                                <View style={styles.controlsOverlay} pointerEvents="box-none">
                                    {/* Top bar */}
                                    <View style={styles.topBar}>
                                        <TouchableOpacity 
                                            style={styles.topBarButton}
                                            onPress={async () => {
                                                // If in fullscreen, exit fullscreen first
                                                if (isFullscreen && videoRef.current) {
                                                    await videoRef.current.dismissFullscreenPlayer();
                                                    setIsFullscreen(false);
                                                } else {
                                                    router.back();
                                                }
                                            }}
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

                                    {/* Bottom controls - positioned with safe area */}
                                    <View style={[styles.bottomControls, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                                        {/* Seekable progress bar */}
                                        <View style={styles.progressContainer}>
                                            <View 
                                                style={styles.progressBar}
                                                onStartShouldSetResponder={() => true}
                                                onMoveShouldSetResponder={() => true}
                                                onResponderGrant={(e) => {
                                                    const { locationX } = e.nativeEvent;
                                                    const barWidth = SCREEN_WIDTH - 32;
                                                    const percent = Math.max(0, Math.min(1, locationX / barWidth));
                                                    seekVideo(percent * videoDuration);
                                                }}
                                                onResponderMove={(e) => {
                                                    const { locationX } = e.nativeEvent;
                                                    const barWidth = SCREEN_WIDTH - 32;
                                                    const percent = Math.max(0, Math.min(1, locationX / barWidth));
                                                    seekVideo(percent * videoDuration);
                                                }}
                                            >
                                                <View style={styles.progressTrack}>
                                                    <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
                                                    {/* Draggable thumb */}
                                                    <View style={[styles.progressThumb, { left: `${progressPercent}%` }]} />
                                                </View>
                                            </View>
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
                                                <TouchableOpacity 
                                                    style={styles.speedButton}
                                                    onPress={() => setShowSpeedMenu(true)}
                                                >
                                                    <Text style={styles.speedButtonText}>{playbackSpeed}x</Text>
                                                </TouchableOpacity>
                                                {/* Landscape/Portrait rotation button */}
                                                <TouchableOpacity 
                                                    style={styles.rotateButton}
                                                    onPress={toggleLandscape}
                                                >
                                                    <Ionicons 
                                                        name="phone-landscape-outline" 
                                                        size={20} 
                                                        color="#fff" 
                                                    />
                                                </TouchableOpacity>
                                                <TouchableOpacity 
                                                    style={styles.fullscreenButton}
                                                    onPress={toggleFullscreen}
                                                >
                                                    <Ionicons 
                                                        name={isFullscreen ? "contract" : "expand"} 
                                                        size={20} 
                                                        color="#fff" 
                                                    />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            )}
                        </View>
                        )
                    ) : null}
                </View>
            ) : (
                /* Non-video header area (quiz, text, etc.) */
                <View style={[styles.nonVideoHeader, { paddingTop: insets.top }]}>
                    <TouchableOpacity 
                        style={styles.backButtonAlt}
                        onPress={() => router.back()}
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
                            <View style={styles.quizCard}>
                                <View style={styles.quizIcon}>
                                    <Ionicons name="school" size={48} color={COLORS.primary} />
                                </View>
                                <Text style={styles.quizTitle}>{currentLesson.quiz_data?.title || 'Knowledge Check'}</Text>
                                <Text style={styles.quizDescription}>
                                    {currentLesson.quiz_data?.description || 'Test your understanding of the material covered in this section.'}
                                </Text>
                                
                                <View style={styles.quizStats}>
                                    <View style={styles.quizStatItem}>
                                        <Ionicons name="help-circle-outline" size={20} color={COLORS.textSecondary} />
                                        <Text style={styles.quizStatText}>
                                            {currentLesson.quiz_data?.questions?.length || 0} Questions
                                        </Text>
                                    </View>
                                    {currentLesson.quiz_data?.time_limit && (
                                        <View style={styles.quizStatItem}>
                                            <Ionicons name="time-outline" size={20} color={COLORS.textSecondary} />
                                            <Text style={styles.quizStatText}>
                                                {currentLesson.quiz_data.time_limit} min
                                            </Text>
                                        </View>
                                    )}
                                    <View style={styles.quizStatItem}>
                                        <Ionicons name="ribbon-outline" size={20} color={COLORS.textSecondary} />
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
                                                color={COLORS.primary} 
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
                                                <Ionicons name="document-attach" size={24} color={COLORS.primary} />
                                                <View style={styles.fileInfo}>
                                                    <Text style={styles.fileName}>{block.content.filename || block.title || 'Download File'}</Text>
                                                    <Text style={styles.fileAction}>Tap to download</Text>
                                                </View>
                                                <Ionicons name="cloud-download-outline" size={20} color={COLORS.textSecondary} />
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
                                                    <Ionicons name="school" size={24} color={COLORS.primary} />
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
                                                            questions: (quizContent.questions || []).map((q: any, idx: number) => ({
                                                                id: q.id || `${block.id}_q${idx + 1}`,
                                                                question: q.question || 'Question',
                                                                type: q.question_type === 'multiple_select' ? 'multiple_choice' : 
                                                                      q.question_type === 'numeric' ? 'short_answer' :
                                                                      q.question_type === 'text' ? 'short_answer' :
                                                                      q.question_type || 'multiple_choice',
                                                                options: (q.options || []).map((opt: any) => opt.text || opt),
                                                                correct_answer: q.question_type === 'text' || q.question_type === 'numeric' 
                                                                    ? q.correct_text_answer || ''
                                                                    : (q.options || []).findIndex((opt: any) => opt.correct === true),
                                                                explanation: q.explanation,
                                                                points: q.points || 1,
                                                            })),
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
                                                        {dState?.isDownloading && (
                                                            <View style={styles.downloadStatusContainer}>
                                                                <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 4 }} />
                                                                <Text style={styles.downloadProgressText}>{Math.round(dState.progress * 100)}%</Text>
                                                            </View>
                                                        )}
                                                        {dState?.isDownloaded && !dState?.isDownloading && (
                                                            <View style={styles.downloadStatusContainer}>
                                                                <Ionicons name="cloud-done" size={14} color={COLORS.success} />
                                                                <Text style={[styles.downloadProgressText, { color: COLORS.success }]}>Saved</Text>
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
                                                        <Ionicons name="cloud-download-outline" size={18} color={COLORS.textSecondary} />
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

            {/* Playback Speed Selection Modal */}
            <Modal
                visible={showSpeedMenu}
                transparent
                animationType="fade"
                onRequestClose={() => setShowSpeedMenu(false)}
            >
                <TouchableOpacity
                    style={styles.speedMenuOverlay}
                    activeOpacity={1}
                    onPress={() => setShowSpeedMenu(false)}
                >
                    <View style={styles.speedMenuContainer}>
                        <Text style={styles.speedMenuTitle}>Playback Speed</Text>
                        {SPEED_OPTIONS.map((speed) => (
                            <TouchableOpacity
                                key={speed}
                                style={[
                                    styles.speedMenuItem,
                                    playbackSpeed === speed && styles.speedMenuItemActive,
                                ]}
                                onPress={() => changePlaybackSpeed(speed)}
                            >
                                <Text
                                    style={[
                                        styles.speedMenuItemText,
                                        playbackSpeed === speed && styles.speedMenuItemTextActive,
                                    ]}
                                >
                                    {speed}x {speed === 1 && '(Normal)'}
                                </Text>
                                {playbackSpeed === speed && (
                                    <Ionicons name="checkmark" size={20} color={COLORS.primary} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </TouchableOpacity>
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
                            <Ionicons name="close" size={24} color={COLORS.text} />
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
                            <Ionicons name="share-outline" size={24} color={COLORS.primary} />
                        </TouchableOpacity>
                    </View>
                    
                    {/* PDF Content - Native offline viewer using pdf.js */}
                    <View style={styles.pdfContent}>
                        {pdfLoading && (
                            <View style={styles.pdfLoadingOverlay}>
                                <ActivityIndicator size="large" color={COLORS.primary} />
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
                                <Ionicons name="document-text-outline" size={64} color={COLORS.textSecondary} />
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
                        <ActivityIndicator size="large" color={COLORS.primary} />
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
    controlsOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
    },
    topBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        zIndex: 20,
    },
    topBarButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
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
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginTop: -32,
        marginLeft: -32,
        zIndex: 15,
    },
    playButtonCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 0,
    },
    bottomControls: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 16,
        paddingTop: 40,
        paddingBottom: 12,
        backgroundColor: 'rgba(0,0,0,0.7)',
        zIndex: 20,
    },
    progressContainer: {
        marginBottom: 8,
    },
    progressBar: {
        height: 32,
        justifyContent: 'center',
        paddingVertical: 12,
    },
    progressTrack: {
        height: 3,
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: 1.5,
        position: 'relative',
        overflow: 'visible',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#E50914',
        borderRadius: 1.5,
    },
    progressThumb: {
        position: 'absolute',
        top: -5,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#E50914',
        marginLeft: -7,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
        elevation: 3,
    },
    timeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
    },
    timeText: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 12,
        fontWeight: '500',
    },
    bottomRightControls: {
        flexDirection: 'row',
        gap: 16,
        alignItems: 'center',
    },
    skipButton: {
        padding: 4,
    },
    speedButton: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 4,
    },
    speedButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    rotateButton: {
        padding: 4,
    },
    fullscreenButton: {
        padding: 4,
    },
    speedMenuOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    speedMenuContainer: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        width: 260,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    speedMenuTitle: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        textAlign: 'center',
        marginBottom: SPACING.md,
    },
    speedMenuItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
    },
    speedMenuItemActive: {
        backgroundColor: `${COLORS.primary}15`,
    },
    speedMenuItemText: {
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
    },
    speedMenuItemTextActive: {
        color: COLORS.primary,
        fontWeight: FONT_WEIGHT.semibold,
    },

    // Video Error
    videoErrorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
        padding: SPACING.xl,
    },
    videoErrorTitle: {
        color: '#fff',
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        marginTop: SPACING.md,
    },
    videoErrorText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: FONT_SIZE.sm,
        textAlign: 'center',
        marginTop: SPACING.xs,
        maxWidth: 280,
    },
    videoRetryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.md,
        marginTop: SPACING.lg,
        gap: SPACING.xs,
    },
    videoRetryText: {
        color: '#fff',
        fontWeight: FONT_WEIGHT.semibold,
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
        paddingBottom: SPACING.xl + 20,
        paddingHorizontal: SPACING.lg,
    },
    backButtonAlt: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    headerContent: {
        alignItems: 'center',
        paddingTop: SPACING.md,
    },
    headerIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    headerTitle: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
        color: '#fff',
        textAlign: 'center',
        marginBottom: SPACING.xs,
    },
    headerSubtitle: {
        fontSize: FONT_SIZE.sm,
        color: 'rgba(255,255,255,0.7)',
    },
    placeholderContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xl,
    },
    placeholderIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    placeholderTitle: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        color: '#fff',
        textAlign: 'center',
        marginTop: SPACING.sm,
    },
    placeholderSubtitle: {
        fontSize: FONT_SIZE.sm,
        color: 'rgba(255,255,255,0.6)',
        marginTop: SPACING.xs,
    },

    // Content Area
    contentArea: {
        flex: 1,
        backgroundColor: COLORS.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        marginTop: -20,
    },
    lessonHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: SPACING.lg,
        paddingTop: SPACING.xl + 4,
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
        flexGrow: 1,
    },
    textContent: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
    },

    // Quiz
    quizPrompt: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: SPACING.xl,
    },
    quizIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: COLORS.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    quizTitle: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        marginBottom: SPACING.xs,
        textAlign: 'center',
    },
    quizDescription: {
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginBottom: SPACING.lg,
        paddingHorizontal: SPACING.md,
    },
    quizCard: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.xl,
        padding: SPACING.xl,
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
        gap: SPACING.lg,
        marginBottom: SPACING.xl,
        paddingVertical: SPACING.md,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: COLORS.border,
        width: '100%',
    },
    quizStatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },
    quizStatText: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
    },
    startQuizButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        gap: SPACING.sm,
        minWidth: 180,
        justifyContent: 'center',
    },
    startQuizButtonText: {
        color: '#fff',
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
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
    
    // Download Section for non-video lessons
    downloadSection: {
        marginTop: SPACING.lg,
        paddingHorizontal: SPACING.md,
    },
    downloadAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.primary,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        gap: SPACING.sm,
    },
    downloadAllButtonText: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
        color: '#fff',
    },

    // Blocks
    blocksContainer: {
        marginTop: SPACING.lg,
    },
    blockItem: {
        marginBottom: SPACING.md,
    },
    audioBlock: {
        marginVertical: SPACING.md,
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
    navButtonComplete: {
        backgroundColor: COLORS.success,
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
    navButtonTextComplete: {
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
    downloadStatusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: COLORS.backgroundSecondary,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: BORDER_RADIUS.sm,
    },
    downloadProgressText: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.textSecondary,
        fontWeight: FONT_WEIGHT.medium,
    },
    sidebarDownloadBtn: {
        padding: SPACING.xs,
        marginLeft: 'auto',
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

    // Video touch area
    videoTouchArea: {
        width: '100%',
        height: '100%',
    },

    // Video gesture container for tap zones - starts below top bar area
    videoGestureContainer: {
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        bottom: 80,
        flexDirection: 'row',
        zIndex: 5,
    },
    videoTapZoneLeft: {
        flex: 0.35,
        height: '100%',
    },
    videoTapZoneCenter: {
        flex: 0.30,
        height: '100%',
    },
    videoTapZoneRight: {
        flex: 0.35,
        height: '100%',
    },

    // Skip indicator (shows when double-tapping)
    skipIndicator: {
        position: 'absolute',
        top: '50%',
        transform: [{ translateY: -35 }],
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    skipIndicatorLeft: {
        left: 50,
    },
    skipIndicatorRight: {
        right: 50,
    },
    skipIndicatorText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },

    // Speed boost indicator (Instagram/FB style 2x)
    speedBoostIndicator: {
        position: 'absolute',
        top: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.8)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 4,
        gap: 4,
    },
    speedBoostText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },

    // Block image styles
    blockImage: {
        width: '100%',
        minHeight: 200,
        maxHeight: 400,
        borderRadius: BORDER_RADIUS.lg,
    },

    // Inline quiz card (for quizzes not at first position)
    inlineQuizCard: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        marginVertical: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    inlineQuizHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.md,
        gap: SPACING.sm,
    },
    inlineQuizTitle: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.semibold,
        color: COLORS.text,
        flex: 1,
    },
    inlineQuizDesc: {
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
        marginBottom: SPACING.lg,
        lineHeight: 22,
    },
    inlineQuizButton: {
        backgroundColor: COLORS.primary,
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.xl,
        borderRadius: BORDER_RADIUS.lg,
        alignItems: 'center',
    },
    inlineQuizButtonText: {
        color: '#fff',
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
    },

    // PDF Viewer styles
    pdfViewerContainer: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    pdfHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    pdfCloseButton: {
        padding: SPACING.sm,
    },
    pdfTitleContainer: {
        flex: 1,
        alignItems: 'center',
        marginHorizontal: SPACING.sm,
    },
    pdfTitle: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
        color: COLORS.text,
        textAlign: 'center',
    },
    pdfPageInfo: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    pdfShareButton: {
        padding: SPACING.sm,
    },
    pdfContent: {
        flex: 1,
        backgroundColor: COLORS.backgroundSecondary,
    },
    pdfView: {
        flex: 1,
        backgroundColor: COLORS.backgroundSecondary,
    },
    pdfWebView: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    pdfEmptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xl,
    },
    pdfEmptyText: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.semibold,
        color: COLORS.textSecondary,
        marginTop: SPACING.md,
    },
    pdfEmptySubtext: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
        marginTop: SPACING.xs,
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
        backgroundColor: COLORS.background,
        zIndex: 10,
    },
    pdfLoadingText: {
        marginTop: SPACING.md,
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
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
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.xl,
        padding: SPACING.xl,
        alignItems: 'center',
        width: SCREEN_WIDTH * 0.8,
        maxWidth: 300,
    },
    downloadProgressTitle: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.semibold,
        color: COLORS.text,
        marginTop: SPACING.md,
    },
    downloadProgressFilename: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
        marginTop: SPACING.xs,
        maxWidth: '100%',
    },
    downloadProgressBarContainer: {
        width: '100%',
        height: 8,
        backgroundColor: COLORS.border,
        borderRadius: 4,
        marginTop: SPACING.lg,
        overflow: 'hidden',
    },
    downloadProgressBar: {
        height: '100%',
        backgroundColor: COLORS.primary,
        borderRadius: 4,
    },
    downloadProgressPercent: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.medium,
        color: COLORS.primary,
        marginTop: SPACING.sm,
    },
});
