import { Ionicons } from "@expo/vector-icons";
import {
  Audio,
  AVPlaybackStatus,
  ResizeMode,
  Video,
  VideoFullscreenUpdate,
} from "expo-av";
import * as ScreenOrientation from "expo-screen-orientation";
import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Dimensions,
  GestureResponderEvent,
  PanResponder,
  PanResponderInstance,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Theme from "../../constants/theme";
import { useTheme } from "../context/ThemeContext";

// ============================================================================
// Types
// ============================================================================

interface VideoPlayerProps {
  source: { uri: string };
  poster?: string;
  title?: string;
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
  autoPlay?: boolean;
  startPosition?: number;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  allowBackgroundAudio?: boolean;
}

export interface VideoPlayerRef {
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (position: number) => Promise<void>;
  getCurrentPosition: () => number;
  getDuration: () => number;
  toggleFullscreen: () => void;
  isPlaying: () => boolean;
}

interface SeekIndicatorState {
  visible: boolean;
  seconds: number;
  side: "left" | "right";
}

interface ScreenDimensions {
  width: number;
  height: number;
}

// ============================================================================
// Constants
// ============================================================================

const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0] as const;
const CONTROLS_HIDE_DELAY = 3000;
const SEEK_AMOUNT_MS = 10000;
const DOUBLE_TAP_THRESHOLD = 300;

// ============================================================================
// Utility Functions
// ============================================================================

const formatTime = (milliseconds: number): string => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

// ============================================================================
// Sub-Components (Memoized)
// ============================================================================

interface SpeedMenuProps {
  visible: boolean;
  currentSpeed: number;
  onSelectSpeed: (speed: number) => void;
  isFullscreen: boolean;
  primaryColor: string;
}

const SpeedMenu = memo<SpeedMenuProps>(
  ({ visible, currentSpeed, onSelectSpeed, isFullscreen, primaryColor }) => {
    if (!visible) return null;

    return (
      <View
        style={[
          speedMenuStyles.container,
          isFullscreen && speedMenuStyles.containerFullscreen,
        ]}
      >
        {SPEED_OPTIONS.map((speed) => (
          <TouchableOpacity
            key={speed}
            style={[
              speedMenuStyles.item,
              currentSpeed === speed && speedMenuStyles.itemActive,
            ]}
            onPress={() => onSelectSpeed(speed)}
          >
            <Text
              style={[
                speedMenuStyles.itemText,
                currentSpeed === speed && { color: primaryColor },
              ]}
            >
              {speed}x
            </Text>
            {currentSpeed === speed && (
              <Ionicons name="checkmark" size={18} color={primaryColor} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  },
);

const speedMenuStyles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 60,
    right: 16,
    backgroundColor: "rgba(28, 28, 30, 0.95)",
    borderRadius: 12,
    padding: 4,
    zIndex: 100,
    minWidth: 100,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  containerFullscreen: {
    top: 70,
    right: 24,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  itemActive: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  itemText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "500",
  },
});

interface SeekIndicatorProps {
  state: SeekIndicatorState;
  opacity: Animated.Value;
}

const SeekIndicator = memo<SeekIndicatorProps>(({ state, opacity }) => {
  if (!state.visible) return null;

  return (
    <Animated.View
      style={[
        seekIndicatorStyles.container,
        state.side === "left"
          ? seekIndicatorStyles.left
          : seekIndicatorStyles.right,
        { opacity },
      ]}
    >
      <Ionicons
        name={state.side === "left" ? "play-back" : "play-forward"}
        size={32}
        color="#FFFFFF"
      />
      <Text style={seekIndicatorStyles.text}>
        {state.seconds > 0 ? "+" : ""}
        {state.seconds}s
      </Text>
    </Animated.View>
  );
});

const seekIndicatorStyles = StyleSheet.create({
  container: {
    position: "absolute",
    top: "50%",
    marginTop: -40,
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
  },
  left: {
    left: "15%",
  },
  right: {
    right: "15%",
  },
  text: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
  },
});

interface ErrorViewProps {
  message: string;
  onRetry: () => void;
  primaryColor: string;
  errorColor: string;
}

const ErrorView = memo<ErrorViewProps>(
  ({ message, onRetry, primaryColor, errorColor }) => (
    <View style={errorViewStyles.container}>
      <View
        style={[
          errorViewStyles.iconContainer,
          { backgroundColor: `${errorColor}15` },
        ]}
      >
        <Ionicons name="cloud-offline-outline" size={56} color={errorColor} />
      </View>
      <Text style={errorViewStyles.title}>Video Unavailable</Text>
      <Text style={errorViewStyles.message}>
        {message ||
          "Unable to load video. Please check your connection and try again."}
      </Text>
      <TouchableOpacity
        style={[errorViewStyles.retryButton, { backgroundColor: primaryColor }]}
        onPress={onRetry}
        activeOpacity={0.8}
      >
        <Ionicons name="refresh" size={20} color="#FFFFFF" />
        <Text style={errorViewStyles.retryText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  ),
);

const errorViewStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: "#1a1a1a",
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  message: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 20,
    maxWidth: 280,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 999,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  retryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

// ============================================================================
// Main Component
// ============================================================================

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  (
    {
      source,
      poster,
      title,
      onProgress,
      onComplete,
      onError,
      autoPlay = false,
      startPosition = 0,
      onFullscreenChange,
      allowBackgroundAudio = false,
    },
    ref,
  ) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();

    // ========================================================================
    // Refs
    // ========================================================================
    const videoRef = useRef<Video>(null);
    const controlsOpacity = useRef(new Animated.Value(1)).current;
    const controlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const progressBarWidth = useRef(new Animated.Value(0)).current;
    const lastTapTime = useRef<number>(0);
    const lastTapX = useRef<number>(0);
    const seekIndicatorOpacity = useRef(new Animated.Value(0)).current;

    // ========================================================================
    // State
    // ========================================================================
    const [isLoading, setIsLoading] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
    const [hasError, setHasError] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [isBuffering, setIsBuffering] = useState(false);
    const [barWidth, setBarWidth] = useState(0);
    const [isSeeking, setIsSeeking] = useState(false);
    const [seekPosition, setSeekPosition] = useState(0);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);
    const [seekIndicator, setSeekIndicator] = useState<SeekIndicatorState>({
      visible: false,
      seconds: 0,
      side: "left",
    });
    const [dimensions, setDimensions] = useState<ScreenDimensions>(() => {
      const { width, height } = Dimensions.get("window");
      return { width, height };
    });

    // ========================================================================
    // Memoized Styles
    // ========================================================================
    const styles = useMemo(() => createStyles(colors), [colors]);

    // Get the correct dimensions for fullscreen
    // Use window dimensions which update correctly on rotation
    const fullscreenDimensions = useMemo(() => {
      // Get both window and screen dimensions
      const windowDims = Dimensions.get("window");
      const screenDims = Dimensions.get("screen");

      // Use the larger values to ensure we cover the full screen in landscape
      const width = Math.max(
        windowDims.width,
        windowDims.height,
        screenDims.width,
        screenDims.height,
      );
      const height = Math.min(
        windowDims.width,
        windowDims.height,
        screenDims.width,
        screenDims.height,
      );

      return { width, height };
    }, [dimensions]);

    const containerStyle = useMemo<ViewStyle>(() => {
      if (!isFullscreen) {
        return styles.container;
      }

      // In fullscreen, use flex to fill the entire screen
      // This avoids issues with explicit dimensions not matching the actual screen
      return {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        flex: 1,
        zIndex: 9999,
        elevation: 9999,
        backgroundColor: "#000000",
      };
    }, [isFullscreen, styles.container, fullscreenDimensions]);

    const progressKnobStyle = useMemo(
      () => [
        styles.progressKnob,
        isSeeking && styles.progressKnobActive,
        {
          left: progressBarWidth.interpolate({
            inputRange: [0, 1],
            outputRange: [0, Math.max(0, barWidth - 16)],
            extrapolate: "clamp",
          }),
        },
      ],
      [styles, isSeeking, progressBarWidth, barWidth],
    );

    const progressFillStyle = useMemo(
      () => [
        styles.progressBarFill,
        {
          width: progressBarWidth.interpolate({
            inputRange: [0, 1],
            outputRange: ["0%", "100%"],
          }),
        },
      ],
      [styles, progressBarWidth],
    );

    // ========================================================================
    // Audio Configuration
    // ========================================================================
    useEffect(() => {
      const enableAudio = async () => {
        try {
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: allowBackgroundAudio,
            shouldDuckAndroid: true,
          });
        } catch (e) {
          console.warn("Audio mode error:", e);
        }
      };
      enableAudio();
    }, [allowBackgroundAudio]);

    // ========================================================================
    // Android Back Button
    // ========================================================================
    useEffect(() => {
      const backHandler = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          if (isFullscreen) {
            exitFullscreen();
            return true;
          }
          return false;
        },
      );

      return () => backHandler.remove();
    }, [isFullscreen]);

    // ========================================================================
    // Cleanup
    // ========================================================================
    useEffect(() => {
      return () => {
        if (controlsTimeout.current) {
          clearTimeout(controlsTimeout.current);
        }
      };
    }, []);

    // ========================================================================
    // Dimension Changes (for orientation)
    // ========================================================================
    useEffect(() => {
      const subscription = Dimensions.addEventListener(
        "change",
        ({ window, screen }) => {
          setDimensions({ width: screen.width, height: screen.height });
        },
      );

      return () => subscription.remove();
    }, []);

    // ========================================================================
    // Imperative Handle
    // ========================================================================
    useImperativeHandle(
      ref,
      () => ({
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
        getDuration: () => duration,
        toggleFullscreen: () => {
          if (isFullscreen) {
            exitFullscreen();
          } else {
            enterFullscreen();
          }
        },
        isPlaying: () => isPlaying,
      }),
      [currentTime, duration, isFullscreen, isPlaying],
    );

    // ========================================================================
    // Controls Visibility
    // ========================================================================
    const hideControlsWithDelay = useCallback(() => {
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
      controlsTimeout.current = setTimeout(() => {
        if (isPlaying && !showSpeedMenu) {
          Animated.timing(controlsOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start(() => setShowControls(false));
        }
      }, CONTROLS_HIDE_DELAY);
    }, [isPlaying, showSpeedMenu, controlsOpacity]);

    const showControlsWithAnimation = useCallback(() => {
      setShowControls(true);
      Animated.timing(controlsOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      hideControlsWithDelay();
    }, [controlsOpacity, hideControlsWithDelay]);

    // ========================================================================
    // Double Tap Handling
    // ========================================================================
    const handleDoubleTap = useCallback(
      async (side: "left" | "right") => {
        if (!videoRef.current) return;

        const newPosition =
          side === "left"
            ? Math.max(currentTime - SEEK_AMOUNT_MS, 0)
            : Math.min(currentTime + SEEK_AMOUNT_MS, duration);

        setSeekIndicator({
          visible: true,
          seconds: side === "left" ? -10 : 10,
          side,
        });

        Animated.sequence([
          Animated.timing(seekIndicatorOpacity, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.delay(600),
          Animated.timing(seekIndicatorOpacity, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setSeekIndicator((prev) => ({ ...prev, visible: false }));
        });

        await videoRef.current.setPositionAsync(newPosition);
      },
      [currentTime, duration, seekIndicatorOpacity],
    );

    const handleVideoPress = useCallback(
      (event: GestureResponderEvent) => {
        const now = Date.now();
        const { locationX, pageX } = event.nativeEvent;
        // Get the actual layout width of the pressable area
        const { width: layoutWidth } = event.nativeEvent.target
          ? Dimensions.get("window")
          : { width: dimensions.width };
        const actualWidth = isFullscreen
          ? Dimensions.get("window").width
          : layoutWidth;

        if (
          now - lastTapTime.current < DOUBLE_TAP_THRESHOLD &&
          Math.abs(locationX - lastTapX.current) < 50
        ) {
          // Double tap - determine side based on tap location
          const side = locationX < actualWidth / 2 ? "left" : "right";
          handleDoubleTap(side);
          lastTapTime.current = 0;
        } else {
          // Single tap
          lastTapTime.current = now;
          lastTapX.current = locationX;

          setTimeout(() => {
            if (Date.now() - lastTapTime.current >= DOUBLE_TAP_THRESHOLD - 50) {
              if (showControls) {
                setShowSpeedMenu(false);
                Animated.timing(controlsOpacity, {
                  toValue: 0,
                  duration: 200,
                  useNativeDriver: true,
                }).start(() => setShowControls(false));
              } else {
                showControlsWithAnimation();
              }
            }
          }, DOUBLE_TAP_THRESHOLD);
        }
      },
      [
        showControls,
        isFullscreen,
        dimensions,
        controlsOpacity,
        showControlsWithAnimation,
        handleDoubleTap,
      ],
    );

    // ========================================================================
    // Playback Status Update
    // ========================================================================
    const handlePlaybackStatusUpdate = useCallback(
      (playbackStatus: AVPlaybackStatus) => {
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

        if (!isSeeking) {
          setCurrentTime(playbackStatus.positionMillis);
        }

        const newDuration = playbackStatus.durationMillis || 0;
        if (newDuration !== duration) {
          setDuration(newDuration);
        }

        if (playbackStatus.durationMillis && !isSeeking) {
          const progress =
            playbackStatus.positionMillis / playbackStatus.durationMillis;
          progressBarWidth.setValue(progress);
          onProgress?.(progress);
        }

        if (playbackStatus.didJustFinish) {
          onComplete?.();
          setIsPlaying(false);
          setShowControls(true);
          Animated.timing(controlsOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }).start();
        }
      },
      [
        isSeeking,
        duration,
        onProgress,
        onComplete,
        onError,
        controlsOpacity,
        progressBarWidth,
      ],
    );

    // ========================================================================
    // Playback Controls
    // ========================================================================
    const togglePlayPause = useCallback(async () => {
      if (!videoRef.current) return;

      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
      showControlsWithAnimation();
    }, [isPlaying, showControlsWithAnimation]);

    const skipForward = useCallback(async () => {
      if (!videoRef.current) return;
      const newPosition = Math.min(currentTime + SEEK_AMOUNT_MS, duration);
      await videoRef.current.setPositionAsync(newPosition);
      showControlsWithAnimation();
    }, [currentTime, duration, showControlsWithAnimation]);

    const skipBackward = useCallback(async () => {
      if (!videoRef.current) return;
      const newPosition = Math.max(currentTime - SEEK_AMOUNT_MS, 0);
      await videoRef.current.setPositionAsync(newPosition);
      showControlsWithAnimation();
    }, [currentTime, showControlsWithAnimation]);

    // ========================================================================
    // Fullscreen Handling
    // ========================================================================
    const enterFullscreen = useCallback(async () => {
      try {
        setIsFullscreen(true);
        StatusBar.setHidden(true, "fade");
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.LANDSCAPE,
        );
        onFullscreenChange?.(true);
        showControlsWithAnimation();
      } catch (e) {
        console.warn("Fullscreen error:", e);
      }
    }, [onFullscreenChange, showControlsWithAnimation]);

    const exitFullscreen = useCallback(async () => {
      try {
        setIsFullscreen(false);
        setShowSpeedMenu(false);
        StatusBar.setHidden(false, "fade");
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP,
        );
        onFullscreenChange?.(false);
        showControlsWithAnimation();
      } catch (e) {
        console.warn("Exit fullscreen error:", e);
      }
    }, [onFullscreenChange, showControlsWithAnimation]);

    const toggleFullscreen = useCallback(() => {
      if (isFullscreen) {
        exitFullscreen();
      } else {
        enterFullscreen();
      }
    }, [isFullscreen, enterFullscreen, exitFullscreen]);

    // ========================================================================
    // Speed Control
    // ========================================================================
    const handleSpeedSelect = useCallback(
      async (speed: number) => {
        if (!videoRef.current) return;
        setPlaybackSpeed(speed);
        await videoRef.current.setRateAsync(speed, true);
        setShowSpeedMenu(false);
        showControlsWithAnimation();
      },
      [showControlsWithAnimation],
    );

    const toggleSpeedMenu = useCallback(() => {
      setShowSpeedMenu((prev) => !prev);
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
    }, []);

    // ========================================================================
    // Progress Bar Seeking
    // ========================================================================
    const handleSeekStart = useCallback(() => {
      setIsSeeking(true);
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
    }, []);

    const handleSeekMove = useCallback(
      (position: number) => {
        if (!duration) return;
        const clampedPosition = Math.max(0, Math.min(1, position));
        setSeekPosition(clampedPosition * duration);
        progressBarWidth.setValue(clampedPosition);
      },
      [duration, progressBarWidth],
    );

    const handleSeekEnd = useCallback(
      async (position: number) => {
        if (!videoRef.current || !duration) return;
        const clampedPosition = Math.max(0, Math.min(1, position));
        const newPosition = clampedPosition * duration;
        await videoRef.current.setPositionAsync(newPosition);
        setIsSeeking(false);
        hideControlsWithDelay();
      },
      [duration, hideControlsWithDelay],
    );

    const progressPanResponder = useRef<PanResponderInstance>(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          handleSeekStart();
          if (barWidth > 0) {
            const position = evt.nativeEvent.locationX / barWidth;
            handleSeekMove(position);
          }
        },
        onPanResponderMove: (evt) => {
          if (barWidth > 0) {
            const position = evt.nativeEvent.locationX / barWidth;
            handleSeekMove(position);
          }
        },
        onPanResponderRelease: (evt) => {
          if (barWidth > 0) {
            const position = evt.nativeEvent.locationX / barWidth;
            handleSeekEnd(position);
          }
        },
        onPanResponderTerminate: () => {
          setIsSeeking(false);
        },
      }),
    ).current;

    // ========================================================================
    // Video Load Handler
    // ========================================================================
    const handleLoad = useCallback(async () => {
      if (startPosition > 0 && videoRef.current) {
        await videoRef.current.setPositionAsync(startPosition);
      }
      if (autoPlay && videoRef.current) {
        await videoRef.current.playAsync();
      }
      setIsLoading(false);
    }, [startPosition, autoPlay]);

    // ========================================================================
    // Error Handling
    // ========================================================================
    const handleRetry = useCallback(() => {
      setHasError(false);
      setErrorMessage("");
      setIsLoading(true);
    }, []);

    const handleFullscreenUpdate = useCallback(
      async ({
        fullscreenUpdate,
      }: {
        fullscreenUpdate: VideoFullscreenUpdate;
      }) => {
        if (fullscreenUpdate === VideoFullscreenUpdate.PLAYER_DID_DISMISS) {
          await exitFullscreen();
        }
      },
      [exitFullscreen],
    );

    const handleProgressBarLayout = useCallback(
      (event: { nativeEvent: { layout: { width: number } } }) => {
        setBarWidth(event.nativeEvent.layout.width);
      },
      [],
    );

    // ========================================================================
    // Render Error State
    // ========================================================================
    if (hasError) {
      return (
        <View style={styles.container}>
          <ErrorView
            message={errorMessage}
            onRetry={handleRetry}
            primaryColor={colors.primary}
            errorColor={colors.error}
          />
        </View>
      );
    }

    // ========================================================================
    // Main Render
    // ========================================================================
    return (
      <View style={containerStyle}>
        <Pressable
          style={[
            styles.videoWrapper,
            isFullscreen && {
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              // Add safe area padding in landscape for notch/cutout
              paddingLeft: isFullscreen ? insets.left : 0,
              paddingRight: isFullscreen ? insets.right : 0,
            },
          ]}
          onPress={handleVideoPress}
        >
          <Video
            ref={videoRef}
            source={source}
            style={
              isFullscreen
                ? {
                    width: "100%",
                    height: "100%",
                  }
                : StyleSheet.absoluteFill
            }
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={autoPlay}
            isLooping={false}
            onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
            onFullscreenUpdate={handleFullscreenUpdate}
            onLoad={handleLoad}
            posterSource={poster ? { uri: poster } : undefined}
            usePoster={!!poster}
            posterStyle={styles.poster}
            videoStyle={
              isFullscreen ? { width: "100%", height: "100%" } : undefined
            }
          />

          {/* Loading Overlay */}
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.loadingText}>Loading video...</Text>
              </View>
            </View>
          )}

          {/* Seek Indicator */}
          <SeekIndicator state={seekIndicator} opacity={seekIndicatorOpacity} />

          {/* Controls Overlay */}
          {!isLoading && (
            <Animated.View
              style={[styles.controlsOverlay, { opacity: controlsOpacity }]}
              pointerEvents={showControls ? "auto" : "none"}
            >
              {/* Gradient Overlays */}
              <View style={styles.gradientTop} />
              <View style={styles.gradientBottom} />

              <SafeAreaView
                style={styles.controlsContent}
                edges={isFullscreen ? ["left", "right", "top", "bottom"] : []}
              >
                {/* Top Controls */}
                <View
                  style={[
                    styles.topControls,
                    isFullscreen && styles.topControlsFullscreen,
                  ]}
                >
                  {isFullscreen && (
                    <TouchableOpacity
                      style={styles.backButton}
                      onPress={exitFullscreen}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
                    </TouchableOpacity>
                  )}
                  <View style={styles.titleContainer}>
                    {title && (
                      <Text
                        style={[
                          styles.videoTitle,
                          isFullscreen && styles.videoTitleFullscreen,
                        ]}
                        numberOfLines={1}
                      >
                        {title}
                      </Text>
                    )}
                  </View>
                  <View style={styles.topRightControls}>
                    <TouchableOpacity
                      style={styles.speedButton}
                      onPress={toggleSpeedMenu}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={styles.speedText}>{playbackSpeed}x</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Speed Menu */}
                <SpeedMenu
                  visible={showSpeedMenu}
                  currentSpeed={playbackSpeed}
                  onSelectSpeed={handleSpeedSelect}
                  isFullscreen={isFullscreen}
                  primaryColor={colors.primary}
                />

                {/* Center Controls */}
                <View style={styles.centerControls}>
                  <TouchableOpacity
                    style={styles.skipButton}
                    onPress={skipBackward}
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.skipButtonInner}>
                      <Ionicons name="play-back" size={28} color="#FFFFFF" />
                    </View>
                    <Text style={styles.skipText}>10</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.playPauseButton}
                    onPress={togglePlayPause}
                    activeOpacity={0.8}
                  >
                    {isBuffering ? (
                      <ActivityIndicator size="large" color="#FFFFFF" />
                    ) : (
                      <Ionicons
                        name={isPlaying ? "pause" : "play"}
                        size={isFullscreen ? 48 : 40}
                        color="#FFFFFF"
                        style={!isPlaying && styles.playIcon}
                      />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.skipButton}
                    onPress={skipForward}
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.skipButtonInner}>
                      <Ionicons name="play-forward" size={28} color="#FFFFFF" />
                    </View>
                    <Text style={styles.skipText}>10</Text>
                  </TouchableOpacity>
                </View>

                {/* Bottom Controls */}
                <View
                  style={[
                    styles.bottomControls,
                    isFullscreen && styles.bottomControlsFullscreen,
                  ]}
                >
                  {/* Time Display */}
                  <View style={styles.timeContainer}>
                    <Text style={styles.timeText}>
                      {formatTime(isSeeking ? seekPosition : currentTime)}
                    </Text>
                    <Text style={styles.timeSeparator}>/</Text>
                    <Text style={styles.timeText}>{formatTime(duration)}</Text>
                  </View>

                  {/* Progress Bar */}
                  <View
                    style={styles.progressBarContainer}
                    onLayout={handleProgressBarLayout}
                    {...progressPanResponder.panHandlers}
                  >
                    <View style={styles.progressBarTrack}>
                      <Animated.View style={progressFillStyle} />
                    </View>
                    <Animated.View style={progressKnobStyle} />
                  </View>

                  {/* Fullscreen Button */}
                  <TouchableOpacity
                    style={styles.fullscreenButton}
                    onPress={toggleFullscreen}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={
                        isFullscreen ? "contract-outline" : "expand-outline"
                      }
                      size={24}
                      color="#FFFFFF"
                    />
                  </TouchableOpacity>
                </View>
              </SafeAreaView>
            </Animated.View>
          )}
        </Pressable>
      </View>
    );
  },
);

VideoPlayer.displayName = "VideoPlayer";

// ============================================================================
// Styles
// ============================================================================

const createStyles = (colors: typeof Theme.colors.light) =>
  StyleSheet.create({
    container: {
      width: "100%",
      aspectRatio: 16 / 9,
      backgroundColor: "#000000",
      borderRadius: Theme.borderRadius.lg,
      overflow: "hidden",
    },
    videoWrapper: {
      flex: 1,
      backgroundColor: "#000000",
    },
    video: {
      flex: 1,
    },
    poster: {
      ...StyleSheet.absoluteFillObject,
      resizeMode: "cover",
    },

    // Loading
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      justifyContent: "center",
      alignItems: "center",
    },
    loadingContainer: {
      alignItems: "center",
      padding: 32,
    },
    loadingText: {
      color: "#FFFFFF",
      fontSize: 14,
      marginTop: 16,
      fontWeight: "500",
    },

    // Controls Overlay
    controlsOverlay: {
      ...StyleSheet.absoluteFillObject,
    },
    controlsContent: {
      flex: 1,
      justifyContent: "space-between",
    },
    gradientTop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 100,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    gradientBottom: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: 120,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
    },

    // Top Controls
    topControls: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 16,
      zIndex: 10,
    },
    topControlsFullscreen: {
      paddingHorizontal: 32,
      paddingTop: 24,
    },
    backButton: {
      width: 44,
      height: 44,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 8,
    },
    titleContainer: {
      flex: 1,
    },
    videoTitle: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "600",
    },
    videoTitleFullscreen: {
      fontSize: 18,
    },
    topRightControls: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    speedButton: {
      backgroundColor: "rgba(255, 255, 255, 0.2)",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      minWidth: 48,
      alignItems: "center",
    },
    speedText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "700",
    },

    // Center Controls
    centerControls: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 48,
      zIndex: 10,
    },
    playPauseButton: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: "rgba(139, 21, 56, 0.9)",
      justifyContent: "center",
      alignItems: "center",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
        },
        android: {
          elevation: 8,
        },
      }),
    },
    playIcon: {
      marginLeft: 4,
    },
    skipButton: {
      alignItems: "center",
      justifyContent: "center",
    },
    skipButtonInner: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: "rgba(255, 255, 255, 0.15)",
      justifyContent: "center",
      alignItems: "center",
    },
    skipText: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "700",
      marginTop: 2,
    },

    // Bottom Controls
    bottomControls: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      zIndex: 10,
    },
    bottomControlsFullscreen: {
      paddingHorizontal: 32,
      paddingBottom: 24,
    },
    timeContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    timeText: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "600",
      fontVariant: ["tabular-nums"],
    },
    timeSeparator: {
      color: "rgba(255, 255, 255, 0.6)",
      fontSize: 12,
      marginHorizontal: 4,
    },
    progressBarContainer: {
      height: 32,
      justifyContent: "center",
      marginBottom: 8,
    },
    progressBarTrack: {
      height: 4,
      backgroundColor: "rgba(255, 255, 255, 0.3)",
      borderRadius: 2,
      overflow: "hidden",
    },
    progressBarFill: {
      height: "100%",
      backgroundColor: colors.primary,
      borderRadius: 2,
    },
    progressKnob: {
      position: "absolute",
      top: 8,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.primary,
      borderWidth: 2,
      borderColor: "#FFFFFF",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    progressKnobActive: {
      transform: [{ scale: 1.3 }],
    },
    fullscreenButton: {
      alignSelf: "flex-end",
      width: 44,
      height: 44,
      justifyContent: "center",
      alignItems: "center",
    },
  });

export default VideoPlayer;
