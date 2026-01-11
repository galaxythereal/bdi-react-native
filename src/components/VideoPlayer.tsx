import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video, VideoFullscreenUpdate, AVPlaybackStatus } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Platform,
    Pressable,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { BORDER_RADIUS, COLORS, FONT_SIZE, FONT_WEIGHT, SPACING } from '../lib/constants';

interface VideoPlayerProps {
    source: { uri: string };
    poster?: string;
    title?: string;
    onProgress?: (progress: number) => void;
    onComplete?: () => void;
    onError?: (error: string) => void;
    autoPlay?: boolean;
    startPosition?: number;
}

export interface VideoPlayerRef {
    play: () => void;
    pause: () => void;
    seek: (position: number) => void;
    getCurrentPosition: () => number;
}

const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
    ({ source, poster, title, onProgress, onComplete, onError, autoPlay = false, startPosition = 0 }, ref) => {
        const videoRef = useRef<Video>(null);
        const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
        const [isLoading, setIsLoading] = useState(true);
        const [isPlaying, setIsPlaying] = useState(false);
        const [isFullscreen, setIsFullscreen] = useState(false);
        const [showControls, setShowControls] = useState(true);
        const [currentTime, setCurrentTime] = useState(0);
        const [duration, setDuration] = useState(0);
        const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
        const [hasError, setHasError] = useState(false);
        const [errorMessage, setErrorMessage] = useState('');
        const [isBuffering, setIsBuffering] = useState(false);

        const controlsOpacity = useRef(new Animated.Value(1)).current;
        const controlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
        const progressBarWidth = useRef(new Animated.Value(0)).current;

        const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

        useImperativeHandle(ref, () => ({
            play: async () => {
                await videoRef.current?.playAsync();
            },
            pause: async () => {
                await videoRef.current?.pauseAsync();
            },
            seek: async (position: number) => {
                await videoRef.current?.setPositionAsync(position);
            },
            getCurrentPosition: () => currentTime,
        }));

        useEffect(() => {
            return () => {
                if (controlsTimeout.current) {
                    clearTimeout(controlsTimeout.current);
                }
            };
        }, []);

        const hideControlsWithDelay = useCallback(() => {
            if (controlsTimeout.current) {
                clearTimeout(controlsTimeout.current);
            }
            controlsTimeout.current = setTimeout(() => {
                if (isPlaying) {
                    Animated.timing(controlsOpacity, {
                        toValue: 0,
                        duration: 300,
                        useNativeDriver: true,
                    }).start(() => setShowControls(false));
                }
            }, 3000);
        }, [isPlaying, controlsOpacity]);

        const showControlsWithAnimation = useCallback(() => {
            setShowControls(true);
            Animated.timing(controlsOpacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }).start();
            hideControlsWithDelay();
        }, [controlsOpacity, hideControlsWithDelay]);

        const handleVideoPress = () => {
            if (showControls) {
                Animated.timing(controlsOpacity, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }).start(() => setShowControls(false));
            } else {
                showControlsWithAnimation();
            }
        };

        const handlePlaybackStatusUpdate = (playbackStatus: AVPlaybackStatus) => {
            setStatus(playbackStatus);
            
            if (!playbackStatus.isLoaded) {
                if (playbackStatus.error) {
                    setHasError(true);
                    setErrorMessage(playbackStatus.error);
                    onError?.(playbackStatus.error);
                }
                return;
            }

            setIsLoading(false);
            setIsBuffering(playbackStatus.isBuffering);
            setIsPlaying(playbackStatus.isPlaying);
            setCurrentTime(playbackStatus.positionMillis);
            setDuration(playbackStatus.durationMillis || 0);

            // Update progress bar animation
            if (playbackStatus.durationMillis) {
                const progress = playbackStatus.positionMillis / playbackStatus.durationMillis;
                progressBarWidth.setValue(progress);
                onProgress?.(progress);
            }

            // Check if video completed
            if (playbackStatus.didJustFinish) {
                onComplete?.();
                setIsPlaying(false);
            }
        };

        const togglePlayPause = async () => {
            if (!videoRef.current) return;

            if (isPlaying) {
                await videoRef.current.pauseAsync();
            } else {
                await videoRef.current.playAsync();
            }
            showControlsWithAnimation();
        };

        const handleSeek = async (position: number) => {
            if (!videoRef.current || !duration) return;
            const newPosition = Math.max(0, Math.min(position * duration, duration));
            await videoRef.current.setPositionAsync(newPosition);
        };

        const skipForward = async () => {
            if (!videoRef.current) return;
            const newPosition = Math.min(currentTime + 10000, duration);
            await videoRef.current.setPositionAsync(newPosition);
            showControlsWithAnimation();
        };

        const skipBackward = async () => {
            if (!videoRef.current) return;
            const newPosition = Math.max(currentTime - 10000, 0);
            await videoRef.current.setPositionAsync(newPosition);
            showControlsWithAnimation();
        };

        const toggleFullscreen = async () => {
            if (Platform.OS === 'ios') {
                if (isFullscreen) {
                    await videoRef.current?.dismissFullscreenPlayer();
                } else {
                    await videoRef.current?.presentFullscreenPlayer();
                }
            } else {
                // Android: Handle orientation
                if (isFullscreen) {
                    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
                    StatusBar.setHidden(false);
                } else {
                    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
                    StatusBar.setHidden(true);
                }
                setIsFullscreen(!isFullscreen);
            }
        };

        const handleFullscreenUpdate = async ({ fullscreenUpdate }: { fullscreenUpdate: VideoFullscreenUpdate }) => {
            switch (fullscreenUpdate) {
                case VideoFullscreenUpdate.PLAYER_WILL_PRESENT:
                    setIsFullscreen(true);
                    break;
                case VideoFullscreenUpdate.PLAYER_DID_DISMISS:
                    setIsFullscreen(false);
                    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
                    StatusBar.setHidden(false);
                    break;
            }
        };

        const cyclePlaybackSpeed = async () => {
            if (!videoRef.current) return;
            const currentIndex = speedOptions.indexOf(playbackSpeed);
            const nextIndex = (currentIndex + 1) % speedOptions.length;
            const newSpeed = speedOptions[nextIndex];
            setPlaybackSpeed(newSpeed);
            await videoRef.current.setRateAsync(newSpeed, true);
            showControlsWithAnimation();
        };

        const handleLoad = async () => {
            if (startPosition > 0 && videoRef.current) {
                await videoRef.current.setPositionAsync(startPosition);
            }
            if (autoPlay && videoRef.current) {
                await videoRef.current.playAsync();
            }
            setIsLoading(false);
        };

        if (hasError) {
            return (
                <View style={styles.container}>
                    <View style={styles.errorContainer}>
                        <Ionicons name="cloud-offline-outline" size={48} color={COLORS.error} />
                        <Text style={styles.errorTitle}>Video Unavailable</Text>
                        <Text style={styles.errorMessage}>
                            {errorMessage || 'Unable to load video. Please check your connection.'}
                        </Text>
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={() => {
                                setHasError(false);
                                setErrorMessage('');
                                setIsLoading(true);
                            }}
                        >
                            <Ionicons name="refresh" size={18} color={COLORS.surface} />
                            <Text style={styles.retryText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }

        return (
            <View style={[styles.container, isFullscreen && styles.fullscreenContainer]}>
                <Pressable onPress={handleVideoPress} style={styles.videoWrapper}>
                    <Video
                        ref={videoRef}
                        source={source}
                        style={styles.video}
                        resizeMode={ResizeMode.CONTAIN}
                        shouldPlay={autoPlay}
                        isLooping={false}
                        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
                        onFullscreenUpdate={handleFullscreenUpdate}
                        onLoad={handleLoad}
                        posterSource={poster ? { uri: poster } : undefined}
                        usePoster={!!poster}
                        posterStyle={styles.poster}
                    />

                    {/* Loading Overlay */}
                    {(isLoading || isBuffering) && (
                        <View style={styles.loadingOverlay}>
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={COLORS.surface} />
                                <Text style={styles.loadingText}>
                                    {isLoading ? 'Loading...' : 'Buffering...'}
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* Controls Overlay */}
                    {showControls && !isLoading && (
                        <Animated.View style={[styles.controlsOverlay, { opacity: controlsOpacity }]}>
                            {/* Top Controls */}
                            <View style={styles.topControls}>
                                {title && <Text style={styles.videoTitle} numberOfLines={1}>{title}</Text>}
                                <TouchableOpacity
                                    style={styles.controlButton}
                                    onPress={cyclePlaybackSpeed}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Text style={styles.speedText}>{playbackSpeed}x</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Center Controls */}
                            <View style={styles.centerControls}>
                                <TouchableOpacity
                                    style={styles.skipButton}
                                    onPress={skipBackward}
                                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                                >
                                    <Ionicons name="play-back" size={32} color={COLORS.surface} />
                                    <Text style={styles.skipText}>10</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.playPauseButton}
                                    onPress={togglePlayPause}
                                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                                >
                                    <Ionicons
                                        name={isPlaying ? 'pause' : 'play'}
                                        size={44}
                                        color={COLORS.surface}
                                    />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.skipButton}
                                    onPress={skipForward}
                                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                                >
                                    <Ionicons name="play-forward" size={32} color={COLORS.surface} />
                                    <Text style={styles.skipText}>10</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Bottom Controls */}
                            <View style={styles.bottomControls}>
                                <View style={styles.progressContainer}>
                                    <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                                    <Pressable
                                        style={styles.progressBarTouchable}
                                        onPress={(e) => {
                                            const { locationX } = e.nativeEvent;
                                            const width = Dimensions.get('window').width - 120;
                                            const position = locationX / width;
                                            handleSeek(position);
                                        }}
                                    >
                                        <View style={styles.progressBarBg}>
                                            <Animated.View
                                                style={[
                                                    styles.progressBarFill,
                                                    {
                                                        width: progressBarWidth.interpolate({
                                                            inputRange: [0, 1],
                                                            outputRange: ['0%', '100%'],
                                                        }),
                                                    },
                                                ]}
                                            />
                                            <Animated.View
                                                style={[
                                                    styles.progressKnob,
                                                    {
                                                        left: progressBarWidth.interpolate({
                                                            inputRange: [0, 1],
                                                            outputRange: ['0%', '100%'],
                                                        }),
                                                    },
                                                ]}
                                            />
                                        </View>
                                    </Pressable>
                                    <Text style={styles.timeText}>{formatTime(duration)}</Text>
                                </View>

                                <TouchableOpacity
                                    style={styles.fullscreenButton}
                                    onPress={toggleFullscreen}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Ionicons
                                        name={isFullscreen ? 'contract' : 'expand'}
                                        size={24}
                                        color={COLORS.surface}
                                    />
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    )}
                </Pressable>
            </View>
        );
    }
);

const styles = StyleSheet.create({
    container: {
        width: '100%',
        aspectRatio: 16 / 9,
        backgroundColor: '#000',
        borderRadius: BORDER_RADIUS.lg,
        overflow: 'hidden',
    },
    fullscreenContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: Dimensions.get('screen').width,
        height: Dimensions.get('screen').height,
        borderRadius: 0,
        zIndex: 999,
    },
    videoWrapper: {
        flex: 1,
    },
    video: {
        flex: 1,
    },
    poster: {
        flex: 1,
        resizeMode: 'cover',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContainer: {
        alignItems: 'center',
    },
    loadingText: {
        color: COLORS.surface,
        fontSize: FONT_SIZE.sm,
        marginTop: SPACING.sm,
        fontWeight: FONT_WEIGHT.medium,
    },
    controlsOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'space-between',
    },
    topControls: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.md,
        paddingTop: SPACING.md,
    },
    videoTitle: {
        color: COLORS.surface,
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
        flex: 1,
        marginRight: SPACING.md,
    },
    controlButton: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.sm,
    },
    speedText: {
        color: COLORS.surface,
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.bold,
    },
    centerControls: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: SPACING.xxl,
    },
    playPauseButton: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(139, 21, 56, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    skipButton: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 56,
        height: 56,
    },
    skipText: {
        color: COLORS.surface,
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.bold,
        marginTop: -4,
    },
    bottomControls: {
        paddingHorizontal: SPACING.md,
        paddingBottom: SPACING.md,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    timeText: {
        color: COLORS.surface,
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.medium,
        minWidth: 48,
        textAlign: 'center',
    },
    progressBarTouchable: {
        flex: 1,
        paddingVertical: SPACING.sm,
        marginHorizontal: SPACING.sm,
    },
    progressBarBg: {
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 2,
        position: 'relative',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: COLORS.primary,
        borderRadius: 2,
    },
    progressKnob: {
        position: 'absolute',
        top: -6,
        marginLeft: -8,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: COLORS.primary,
        borderWidth: 2,
        borderColor: COLORS.surface,
    },
    fullscreenButton: {
        alignSelf: 'flex-end',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xl,
        backgroundColor: '#1a1a1a',
    },
    errorTitle: {
        color: COLORS.surface,
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        marginTop: SPACING.md,
        marginBottom: SPACING.sm,
    },
    errorMessage: {
        color: COLORS.textTertiary,
        fontSize: FONT_SIZE.sm,
        textAlign: 'center',
        marginBottom: SPACING.lg,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        backgroundColor: COLORS.primary,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
        borderRadius: BORDER_RADIUS.md,
    },
    retryText: {
        color: COLORS.surface,
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
    },
});
