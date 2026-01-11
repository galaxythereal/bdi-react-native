import { Ionicons } from '@expo/vector-icons';
import { Audio, AVPlaybackStatus } from 'expo-av';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { BORDER_RADIUS, COLORS, FONT_SIZE, FONT_WEIGHT, SHADOWS, SPACING } from '../lib/constants';

interface AudioPlayerProps {
    uri: string;
    title?: string;
    onComplete?: () => void;
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
    uri,
    title,
    onComplete,
}) => {
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [duration, setDuration] = useState(0);
    const [position, setPosition] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
    const [showSpeedOptions, setShowSpeedOptions] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const progressAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        loadAudio();
        return () => {
            if (sound) {
                sound.unloadAsync();
            }
        };
    }, [uri]);

    useEffect(() => {
        Animated.timing(progressAnim, {
            toValue: duration > 0 ? position / duration : 0,
            duration: 100,
            useNativeDriver: false,
        }).start();
    }, [position, duration]);

    const loadAudio = async () => {
        try {
            setIsLoading(true);
            setError(null);
            
            // Configure audio mode
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                staysActiveInBackground: true,
                playsInSilentModeIOS: true,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            });

            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri },
                { shouldPlay: false },
                onPlaybackStatusUpdate
            );
            
            setSound(newSound);
            setIsLoading(false);
        } catch (err: any) {
            console.error('Error loading audio:', err);
            setError(err.message || 'Failed to load audio');
            setIsLoading(false);
        }
    };

    const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
        if (!status.isLoaded) {
            if (status.error) {
                setError(status.error);
            }
            return;
        }

        setIsPlaying(status.isPlaying);
        setPosition(status.positionMillis || 0);
        setDuration(status.durationMillis || 0);

        if (status.didJustFinish && !status.isLooping) {
            setIsPlaying(false);
            onComplete?.();
        }
    };

    const togglePlayPause = async () => {
        if (!sound) return;

        try {
            if (isPlaying) {
                await sound.pauseAsync();
            } else {
                await sound.playAsync();
            }
        } catch (err) {
            console.error('Error toggling playback:', err);
        }
    };

    const seekTo = async (value: number) => {
        if (!sound) return;
        try {
            await sound.setPositionAsync(value);
        } catch (err) {
            console.error('Error seeking:', err);
        }
    };

    const skipBackward = async () => {
        if (!sound) return;
        const newPosition = Math.max(0, position - 15000);
        await seekTo(newPosition);
    };

    const skipForward = async () => {
        if (!sound) return;
        const newPosition = Math.min(duration, position + 15000);
        await seekTo(newPosition);
    };

    const changeSpeed = async (speed: number) => {
        if (!sound) return;
        try {
            await sound.setRateAsync(speed, true);
            setPlaybackSpeed(speed);
            setShowSpeedOptions(false);
        } catch (err) {
            console.error('Error changing speed:', err);
        }
    };

    const formatTime = (ms: number): string => {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    if (error) {
        return (
            <View style={styles.container}>
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={32} color={COLORS.error} />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={loadAudio}>
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Waveform/Visual representation */}
            <View style={styles.visualContainer}>
                <View style={styles.waveformContainer}>
                    {[...Array(20)].map((_, i) => (
                        <Animated.View
                            key={i}
                            style={[
                                styles.waveformBar,
                                {
                                    height: 10 + Math.random() * 40,
                                    opacity: progressAnim.interpolate({
                                        inputRange: [0, (i + 1) / 20, 1],
                                        outputRange: [0.3, 1, 1],
                                        extrapolate: 'clamp',
                                    }),
                                    backgroundColor: progressAnim.interpolate({
                                        inputRange: [0, i / 20, (i + 1) / 20, 1],
                                        outputRange: [COLORS.border, COLORS.border, COLORS.primary, COLORS.primary],
                                        extrapolate: 'clamp',
                                    }),
                                },
                            ]}
                        />
                    ))}
                </View>
                {title && <Text style={styles.title} numberOfLines={2}>{title}</Text>}
            </View>

            {/* Progress Slider */}
            <View style={styles.progressContainer}>
                <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={duration}
                    value={position}
                    onSlidingComplete={seekTo}
                    minimumTrackTintColor={COLORS.primary}
                    maximumTrackTintColor={COLORS.border}
                    thumbTintColor={COLORS.primary}
                    disabled={isLoading}
                />
                <View style={styles.timeContainer}>
                    <Text style={styles.timeText}>{formatTime(position)}</Text>
                    <Text style={styles.timeText}>{formatTime(duration)}</Text>
                </View>
            </View>

            {/* Controls */}
            <View style={styles.controlsContainer}>
                {/* Skip backward */}
                <TouchableOpacity 
                    style={styles.skipButton}
                    onPress={skipBackward}
                    disabled={isLoading}
                >
                    <Ionicons name="play-back" size={24} color={COLORS.text} />
                    <Text style={styles.skipText}>15s</Text>
                </TouchableOpacity>

                {/* Play/Pause */}
                <TouchableOpacity 
                    style={styles.playButton}
                    onPress={togglePlayPause}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator size="large" color={COLORS.surface} />
                    ) : (
                        <Ionicons 
                            name={isPlaying ? "pause" : "play"} 
                            size={32} 
                            color={COLORS.surface} 
                        />
                    )}
                </TouchableOpacity>

                {/* Skip forward */}
                <TouchableOpacity 
                    style={styles.skipButton}
                    onPress={skipForward}
                    disabled={isLoading}
                >
                    <Ionicons name="play-forward" size={24} color={COLORS.text} />
                    <Text style={styles.skipText}>15s</Text>
                </TouchableOpacity>
            </View>

            {/* Speed Control */}
            <View style={styles.speedContainer}>
                <TouchableOpacity 
                    style={styles.speedButton}
                    onPress={() => setShowSpeedOptions(!showSpeedOptions)}
                >
                    <Ionicons name="speedometer-outline" size={18} color={COLORS.textSecondary} />
                    <Text style={styles.speedButtonText}>{playbackSpeed}x</Text>
                </TouchableOpacity>

                {showSpeedOptions && (
                    <View style={styles.speedOptionsContainer}>
                        {PLAYBACK_SPEEDS.map((speed) => (
                            <TouchableOpacity
                                key={speed}
                                style={[
                                    styles.speedOption,
                                    playbackSpeed === speed && styles.speedOptionActive,
                                ]}
                                onPress={() => changeSpeed(speed)}
                            >
                                <Text style={[
                                    styles.speedOptionText,
                                    playbackSpeed === speed && styles.speedOptionTextActive,
                                ]}>
                                    {speed}x
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.xl,
        padding: SPACING.lg,
        ...SHADOWS.md,
    },
    visualContainer: {
        alignItems: 'center',
        marginBottom: SPACING.lg,
    },
    waveformContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 60,
        gap: 3,
        marginBottom: SPACING.md,
    },
    waveformBar: {
        width: 4,
        borderRadius: 2,
    },
    title: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
        color: COLORS.text,
        textAlign: 'center',
    },
    progressContainer: {
        marginBottom: SPACING.md,
    },
    slider: {
        width: '100%',
        height: 40,
    },
    timeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.xs,
    },
    timeText: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
        fontWeight: FONT_WEIGHT.medium,
    },
    controlsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.xl,
        marginBottom: SPACING.lg,
    },
    skipButton: {
        alignItems: 'center',
        padding: SPACING.sm,
    },
    skipText: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    playButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.lg,
    },
    speedContainer: {
        alignItems: 'center',
    },
    speedButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        backgroundColor: COLORS.backgroundSecondary,
        borderRadius: BORDER_RADIUS.md,
    },
    speedButtonText: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
        fontWeight: FONT_WEIGHT.medium,
    },
    speedOptionsContainer: {
        position: 'absolute',
        bottom: '100%',
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.sm,
        marginBottom: SPACING.sm,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.xs,
        ...SHADOWS.lg,
        zIndex: 100,
    },
    speedOption: {
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        backgroundColor: COLORS.backgroundSecondary,
    },
    speedOptionActive: {
        backgroundColor: COLORS.primary,
    },
    speedOptionText: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.text,
        fontWeight: FONT_WEIGHT.medium,
    },
    speedOptionTextActive: {
        color: COLORS.surface,
    },
    errorContainer: {
        alignItems: 'center',
        padding: SPACING.xl,
        gap: SPACING.md,
    },
    errorText: {
        fontSize: FONT_SIZE.md,
        color: COLORS.error,
        textAlign: 'center',
    },
    retryButton: {
        backgroundColor: COLORS.primary,
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.lg,
        borderRadius: BORDER_RADIUS.md,
    },
    retryButtonText: {
        color: COLORS.surface,
        fontWeight: FONT_WEIGHT.bold,
    },
});

export default AudioPlayer;
