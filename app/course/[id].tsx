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
import {
    downloadCourseForOffline,
    getOfflineCourse,
    saveCourseOffline,
    downloadLesson as downloadLessonOffline,
    deleteLessonDownload as deleteLessonOffline,
    checkIsOnline,
    syncOfflineData,
    getLocalPath,
    fileExists,
    CourseDownloadProgress,
    LessonDownloadProgress,
} from '../../src/features/offline/offlineManager';
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

// Extract video ID from various YouTube URL formats
const getYouTubeVideoId = (url: string): string | null => {
    if (!url) return null;
    
    // Try regex patterns first
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /youtube\.com\/shorts\/([^&\n?#]+)/,
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match?.[1]) return match[1];
    }
    
    // Try URL parsing for edge cases
    try {
        const urlObj = new URL(url);
        const vParam = urlObj.searchParams.get('v');
        if (vParam) return vParam;
    } catch (e) {
        // Invalid URL
    }
    
    return null;
};

// Generate custom HTML video player for YouTube with full control
const generateYouTubePlayerHTML = (videoId: string): string => {
    if (!videoId) return '<html><body style="background:#000;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><p>Invalid video</p></body></html>';
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { 
            width: 100%; 
            height: 100%; 
            background: #000; 
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        #player-container {
            position: relative;
            width: 100%;
            height: 100%;
        }
        #youtube-iframe {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border: none;
        }
        
        /* Custom Controls Overlay */
        #controls-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            opacity: 1;
            transition: opacity 0.3s ease;
            pointer-events: none;
            z-index: 10;
        }
        #controls-overlay.hidden { opacity: 0; }
        #controls-overlay > * { pointer-events: auto; }
        
        /* Gradient overlays */
        .gradient-top {
            background: linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%);
            height: 80px;
            padding: 12px 16px;
        }
        .gradient-bottom {
            background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%);
            padding: 16px;
            padding-bottom: 20px;
        }
        
        /* Center play button */
        #center-controls {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            display: flex;
            align-items: center;
            gap: 48px;
        }
        .center-btn {
            width: 64px;
            height: 64px;
            border-radius: 50%;
            background: rgba(0,0,0,0.6);
            border: none;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: transform 0.15s, background 0.15s;
        }
        .center-btn:active { transform: scale(0.95); background: rgba(0,0,0,0.8); }
        .center-btn.play-btn { width: 72px; height: 72px; background: rgba(229,9,20,0.9); }
        .center-btn svg { fill: white; }
        
        /* Skip buttons */
        .skip-btn { width: 48px; height: 48px; }
        .skip-btn svg { width: 28px; height: 28px; }
        
        /* Progress bar */
        #progress-container {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
        }
        #progress-bar {
            flex: 1;
            height: 4px;
            background: rgba(255,255,255,0.3);
            border-radius: 2px;
            cursor: pointer;
            position: relative;
        }
        #progress-bar:hover { height: 6px; }
        #progress-fill {
            height: 100%;
            background: #E50914;
            border-radius: 2px;
            width: 0%;
            position: relative;
        }
        #progress-thumb {
            position: absolute;
            right: -6px;
            top: 50%;
            transform: translateY(-50%);
            width: 14px;
            height: 14px;
            background: #E50914;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .time-text {
            color: white;
            font-size: 13px;
            font-weight: 600;
            min-width: 45px;
            font-variant-numeric: tabular-nums;
        }
        
        /* Bottom controls row */
        #bottom-controls-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .control-btn {
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            padding: 8px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.15s;
        }
        .control-btn:hover { background: rgba(255,255,255,0.1); }
        .control-btn:active { background: rgba(255,255,255,0.2); }
        .control-btn svg { width: 24px; height: 24px; fill: white; }
        
        /* Speed button */
        #speed-btn {
            background: rgba(255,255,255,0.15);
            padding: 6px 12px;
            border-radius: 16px;
            font-size: 13px;
            font-weight: 700;
        }
        
        /* Controls group */
        .controls-group {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        /* Skip indicator */
        .skip-indicator {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            background: rgba(255,255,255,0.15);
            padding: 16px 24px;
            border-radius: 50px;
            display: none;
            align-items: center;
            gap: 8px;
            color: white;
            font-weight: 700;
            font-size: 14px;
        }
        .skip-indicator.left { left: 60px; }
        .skip-indicator.right { right: 60px; }
        .skip-indicator.show { display: flex; }
        .skip-indicator svg { width: 24px; height: 24px; fill: white; }
        
        /* Speed indicator */
        #speed-indicator {
            position: absolute;
            top: 16px;
            right: 16px;
            background: rgba(0,0,0,0.8);
            padding: 6px 12px;
            border-radius: 4px;
            color: white;
            font-size: 13px;
            font-weight: 700;
            display: none;
            align-items: center;
            gap: 6px;
        }
        #speed-indicator.show { display: flex; }
        
        /* Buffering spinner */
        #buffering {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            display: none;
        }
        #buffering.show { display: block; }
        .spinner {
            width: 48px;
            height: 48px;
            border: 3px solid rgba(255,255,255,0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        
        /* Tap zones */
        #tap-zones {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            z-index: 5;
        }
        .tap-zone {
            flex: 1;
            height: 100%;
        }
        
        /* Speed menu */
        #speed-menu {
            position: absolute;
            bottom: 80px;
            right: 16px;
            background: rgba(28,28,28,0.95);
            border-radius: 12px;
            padding: 8px 0;
            display: none;
            min-width: 140px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        }
        #speed-menu.show { display: block; }
        .speed-option {
            padding: 12px 20px;
            color: white;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 14px;
        }
        .speed-option:hover { background: rgba(255,255,255,0.1); }
        .speed-option.active { color: #E50914; font-weight: 600; }
        .speed-option .check { display: none; }
        .speed-option.active .check { display: block; color: #E50914; }
    </style>
</head>
<body>
    <div id="player-container">
        <!-- YouTube player will be injected here by the API -->
        
        <!-- Tap zones for gestures -->
        <div id="tap-zones">
            <div class="tap-zone" id="tap-left"></div>
            <div class="tap-zone" id="tap-center"></div>
            <div class="tap-zone" id="tap-right"></div>
        </div>
        
        <!-- Skip indicators -->
        <div class="skip-indicator left" id="skip-left">
            <svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>
            <span id="skip-left-text">5s</span>
        </div>
        <div class="skip-indicator right" id="skip-right">
            <span id="skip-right-text">5s</span>
            <svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
        </div>
        
        <!-- Speed indicator for hold-to-2x -->
        <div id="speed-indicator">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>
            <span>2×</span>
        </div>
        
        <!-- Buffering -->
        <div id="buffering"><div class="spinner"></div></div>
        
        <!-- Controls overlay -->
        <div id="controls-overlay">
            <div class="gradient-top"></div>
            
            <div id="center-controls">
                <button class="center-btn skip-btn" id="skip-back-btn">
                    <svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8zm-1.1 11H10v-3.3L9 13v-.7l1.8-.6h.1V16zm4.3-1.8c0 .3 0 .6-.1.8l-.3.6s-.3.3-.5.3-.4.1-.6.1-.4 0-.6-.1-.3-.2-.5-.3-.2-.3-.3-.6-.1-.5-.1-.8v-.7c0-.3 0-.6.1-.8l.3-.6s.3-.3.5-.3.4-.1.6-.1.4 0 .6.1.3.2.5.3.2.3.3.6.1.5.1.8v.7zm-.9-.8v-.5s-.1-.2-.1-.3-.1-.1-.2-.2-.2-.1-.3-.1-.2 0-.3.1l-.2.2s-.1.2-.1.3v2s.1.2.1.3.1.1.2.2.2.1.3.1.2 0 .3-.1l.2-.2s.1-.2.1-.3v-1.5z"/></svg>
                </button>
                <button class="center-btn play-btn" id="play-btn">
                    <svg id="play-icon" viewBox="0 0 24 24" width="32" height="32"><path d="M8 5v14l11-7z"/></svg>
                    <svg id="pause-icon" viewBox="0 0 24 24" width="32" height="32" style="display:none"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                </button>
                <button class="center-btn skip-btn" id="skip-forward-btn">
                    <svg viewBox="0 0 24 24"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8zm-1.1 11H10v-3.3L9 13v-.7l1.8-.6h.1V16zm4.3-1.8c0 .3 0 .6-.1.8l-.3.6s-.3.3-.5.3-.4.1-.6.1-.4 0-.6-.1-.3-.2-.5-.3-.2-.3-.3-.6-.1-.5-.1-.8v-.7c0-.3 0-.6.1-.8l.3-.6s.3-.3.5-.3.4-.1.6-.1.4 0 .6.1.3.2.5.3.2.3.3.6.1.5.1.8v.7zm-.9-.8v-.5s-.1-.2-.1-.3-.1-.1-.2-.2-.2-.1-.3-.1-.2 0-.3.1l-.2.2s-.1.2-.1.3v2s.1.2.1.3.1.1.2.2.2.1.3.1.2 0 .3-.1l.2-.2s.1-.2.1-.3v-1.5z"/></svg>
                </button>
            </div>
            
            <div class="gradient-bottom">
                <div id="progress-container">
                    <span class="time-text" id="current-time">0:00</span>
                    <div id="progress-bar">
                        <div id="progress-fill">
                            <div id="progress-thumb"></div>
                        </div>
                    </div>
                    <span class="time-text" id="duration">0:00</span>
                </div>
                <div id="bottom-controls-row">
                    <div class="controls-group">
                        <button class="control-btn" id="play-btn-small">
                            <svg id="play-icon-small" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            <svg id="pause-icon-small" viewBox="0 0 24 24" style="display:none"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                        </button>
                    </div>
                    <div class="controls-group">
                        <button class="control-btn" id="speed-btn">1×</button>
                        <button class="control-btn" id="fullscreen-btn">
                            <svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Speed menu -->
        <div id="speed-menu">
            <div class="speed-option" data-speed="0.5">0.5× <span class="check">✓</span></div>
            <div class="speed-option" data-speed="0.75">0.75× <span class="check">✓</span></div>
            <div class="speed-option active" data-speed="1">Normal <span class="check">✓</span></div>
            <div class="speed-option" data-speed="1.25">1.25× <span class="check">✓</span></div>
            <div class="speed-option" data-speed="1.5">1.5× <span class="check">✓</span></div>
            <div class="speed-option" data-speed="1.75">1.75× <span class="check">✓</span></div>
            <div class="speed-option" data-speed="2">2× <span class="check">✓</span></div>
        </div>
    </div>

    <script>
        var player;
        var isPlaying = false;
        var controlsTimeout;
        var currentSpeed = 1;
        var normalSpeed = 1;
        var isHoldingForSpeed = false;
        var lastTapTime = { left: 0, right: 0 };
        var skipAmount = 0;
        var skipTimeout;
        var playerReady = false;
        var videoId = '${videoId}';

        // Load YouTube IFrame API
        function loadYouTubeAPI() {
            if (window.YT && window.YT.Player) {
                initPlayer();
                return;
            }
            var tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            tag.onerror = function() {
                // Fallback: use direct iframe embed
                useFallbackPlayer();
            };
            var firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        }

        // YouTube API callback
        window.onYouTubeIframeAPIReady = function() {
            initPlayer();
        };

        function initPlayer() {
            try {
                player = new YT.Player('player-container', {
                    width: '100%',
                    height: '100%',
                    videoId: videoId,
                    host: 'https://www.youtube.com',
                    playerVars: {
                        'playsinline': 1,
                        'controls': 0,
                        'rel': 0,
                        'showinfo': 0,
                        'modestbranding': 1,
                        'fs': 0,
                        'iv_load_policy': 3,
                        'disablekb': 1,
                        'enablejsapi': 1,
                        'origin': 'https://www.youtube.com'
                    },
                    events: {
                        'onReady': onPlayerReady,
                        'onStateChange': onPlayerStateChange,
                        'onError': onPlayerError
                    }
                });
            } catch (e) {
                console.error('YT Player init error:', e);
                useFallbackPlayer();
            }
        }

        function useFallbackPlayer() {
            // Use simple iframe as fallback
            var container = document.getElementById('player-container');
            container.innerHTML = '<iframe id="youtube-iframe" src="https://www.youtube.com/embed/' + videoId + '?playsinline=1&rel=0&modestbranding=1&fs=1&controls=1&enablejsapi=0" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="position:absolute;top:0;left:0;width:100%;height:100%;"></iframe>';
            document.getElementById('controls-overlay').style.display = 'none';
            document.getElementById('buffering').classList.remove('show');
        }

        function onPlayerReady(event) {
            playerReady = true;
            document.getElementById('buffering').classList.remove('show');
            updateDuration();
            setInterval(updateProgress, 250);
            window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'ready' }));
        }

        function onPlayerError(event) {
            console.error('YouTube Player Error:', event.data);
            // Error codes: 2=invalid param, 5=HTML5 error, 100=not found, 101/150=embed restricted
            if (event.data === 100 || event.data === 101 || event.data === 150) {
                // Video not available for embedding - show message
                document.getElementById('buffering').innerHTML = '<p style="color:#fff;text-align:center;padding:20px;">This video cannot be played in the app.<br>Error: ' + event.data + '</p>';
            } else {
                useFallbackPlayer();
            }
        }

        function onPlayerStateChange(event) {
            var buffering = document.getElementById('buffering');
            
            if (event.data === YT.PlayerState.PLAYING) {
                isPlaying = true;
                updatePlayIcons();
                buffering.classList.remove('show');
                hideControlsDelayed();
            } else if (event.data === YT.PlayerState.PAUSED) {
                isPlaying = false;
                updatePlayIcons();
                showControls();
            } else if (event.data === YT.PlayerState.BUFFERING) {
                buffering.classList.add('show');
            } else if (event.data === YT.PlayerState.ENDED) {
                isPlaying = false;
                updatePlayIcons();
                showControls();
                window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'ended' }));
            }
        }

        function updatePlayIcons() {
            document.getElementById('play-icon').style.display = isPlaying ? 'none' : 'block';
            document.getElementById('pause-icon').style.display = isPlaying ? 'block' : 'none';
            document.getElementById('play-icon-small').style.display = isPlaying ? 'none' : 'block';
            document.getElementById('pause-icon-small').style.display = isPlaying ? 'block' : 'none';
        }

        function togglePlay() {
            if (!player || !playerReady) return;
            try {
                if (isPlaying) {
                    player.pauseVideo();
                } else {
                    player.playVideo();
                }
            } catch (e) {
                console.error('togglePlay error:', e);
            }
        }

        function formatTime(seconds) {
            if (isNaN(seconds)) return '0:00';
            var mins = Math.floor(seconds / 60);
            var secs = Math.floor(seconds % 60);
            return mins + ':' + (secs < 10 ? '0' : '') + secs;
        }

        function updateProgress() {
            if (!player || !playerReady || !player.getCurrentTime) return;
            try {
                var current = player.getCurrentTime();
                var duration = player.getDuration();
                var percent = duration > 0 ? (current / duration) * 100 : 0;
                document.getElementById('progress-fill').style.width = percent + '%';
                document.getElementById('current-time').textContent = formatTime(current);
            } catch (e) {}
        }

        function updateDuration() {
            if (!player || !playerReady || !player.getDuration) return;
            try {
                document.getElementById('duration').textContent = formatTime(player.getDuration());
            } catch (e) {}
        }

        function seekTo(percent) {
            if (!player || !playerReady) return;
            try {
                var duration = player.getDuration();
                player.seekTo(percent * duration, true);
            } catch (e) {}
        }

        function skip(seconds) {
            if (!player || !playerReady) return;
            try {
                var current = player.getCurrentTime();
                var duration = player.getDuration();
                player.seekTo(Math.max(0, Math.min(duration, current + seconds)), true);
            } catch (e) {}
        }

        function setSpeed(speed) {
            if (!player || !playerReady) return;
            try {
                currentSpeed = speed;
                player.setPlaybackRate(speed);
                document.getElementById('speed-btn').textContent = speed === 1 ? '1×' : speed + '×';
                
                document.querySelectorAll('.speed-option').forEach(function(opt) {
                    opt.classList.toggle('active', parseFloat(opt.dataset.speed) === speed);
                });
            } catch (e) {}
        }

        function showControls() {
            document.getElementById('controls-overlay').classList.remove('hidden');
            clearTimeout(controlsTimeout);
        }

        function hideControls() {
            if (isPlaying) {
                document.getElementById('controls-overlay').classList.add('hidden');
            }
        }

        function hideControlsDelayed() {
            clearTimeout(controlsTimeout);
            controlsTimeout = setTimeout(hideControls, 3000);
        }

        function toggleControls() {
            var overlay = document.getElementById('controls-overlay');
            if (overlay.classList.contains('hidden')) {
                showControls();
                hideControlsDelayed();
            } else {
                hideControls();
            }
        }

        function handleDoubleTap(side) {
            var now = Date.now();
            var lastTap = lastTapTime[side];
            var skipSecs = 5;
            
            if (now - lastTap < 300) {
                skipAmount += skipSecs;
                clearTimeout(skipTimeout);
                
                var indicator = document.getElementById('skip-' + side);
                var textEl = document.getElementById('skip-' + side + '-text');
                
                skip(side === 'left' ? -skipSecs : skipSecs);
                textEl.textContent = skipAmount + 's';
                indicator.classList.add('show');
                
                skipTimeout = setTimeout(function() {
                    indicator.classList.remove('show');
                    skipAmount = 0;
                }, 600);
                
                lastTapTime[side] = 0;
            } else {
                lastTapTime[side] = now;
                setTimeout(function() {
                    if (lastTapTime[side] === now) {
                        toggleControls();
                    }
                }, 300);
            }
        }

        var longPressTimer;
        function startLongPress() {
            longPressTimer = setTimeout(function() {
                if (isPlaying && !isHoldingForSpeed && player && playerReady) {
                    isHoldingForSpeed = true;
                    normalSpeed = currentSpeed;
                    try { player.setPlaybackRate(2); } catch (e) {}
                    document.getElementById('speed-indicator').classList.add('show');
                }
            }, 300);
        }

        function endLongPress() {
            clearTimeout(longPressTimer);
            if (isHoldingForSpeed) {
                isHoldingForSpeed = false;
                try { player.setPlaybackRate(normalSpeed); } catch (e) {}
                document.getElementById('speed-indicator').classList.remove('show');
            }
        }

        // Event listeners
        document.getElementById('play-btn').addEventListener('click', togglePlay);
        document.getElementById('play-btn-small').addEventListener('click', togglePlay);
        document.getElementById('skip-back-btn').addEventListener('click', function() { skip(-10); });
        document.getElementById('skip-forward-btn').addEventListener('click', function() { skip(10); });
        
        document.getElementById('tap-left').addEventListener('click', function() { handleDoubleTap('left'); });
        document.getElementById('tap-center').addEventListener('click', toggleControls);
        document.getElementById('tap-right').addEventListener('click', function() { handleDoubleTap('right'); });
        
        document.getElementById('tap-right').addEventListener('touchstart', startLongPress);
        document.getElementById('tap-right').addEventListener('touchend', endLongPress);
        document.getElementById('tap-right').addEventListener('touchcancel', endLongPress);
        
        document.getElementById('progress-bar').addEventListener('click', function(e) {
            var rect = e.currentTarget.getBoundingClientRect();
            var percent = (e.clientX - rect.left) / rect.width;
            seekTo(Math.max(0, Math.min(1, percent)));
        });
        
        document.getElementById('speed-btn').addEventListener('click', function(e) {
            e.stopPropagation();
            document.getElementById('speed-menu').classList.toggle('show');
        });
        
        document.querySelectorAll('.speed-option').forEach(function(opt) {
            opt.addEventListener('click', function() {
                setSpeed(parseFloat(opt.dataset.speed));
                document.getElementById('speed-menu').classList.remove('show');
            });
        });
        
        document.addEventListener('click', function(e) {
            if (!e.target.closest('#speed-btn') && !e.target.closest('#speed-menu')) {
                document.getElementById('speed-menu').classList.remove('show');
            }
        });
        
        document.getElementById('fullscreen-btn').addEventListener('click', function() {
            window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'fullscreen' }));
        });
        
        // Initialize
        document.getElementById('buffering').classList.add('show');
        loadYouTubeAPI();
    </script>
</body>
</html>
`;
};

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

    // Double-tap and long-press state for video
    const [lastTapTime, setLastTapTime] = useState<{ left: number; right: number }>({ left: 0, right: 0 });
    const [skipIndicator, setSkipIndicator] = useState<{ visible: boolean; side: 'left' | 'right'; seconds: number }>({ 
        visible: false, side: 'left', seconds: 0 
    });

    // Refs
    const videoRef = useRef<Video>(null);
    const webViewRef = useRef<WebView>(null);
    const audioPlayerRef = useRef<any>(null);
    const controlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const skipIndicatorTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isTransitioning = useRef<boolean>(false);
    const lessonChangeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        
        // Cleanup function - unload media when leaving the screen
        return () => {
            // Clear any pending lesson change timeout
            if (lessonChangeTimeout.current) {
                clearTimeout(lessonChangeTimeout.current);
            }
            // Use a separate cleanup function that unloads
            const cleanup = async () => {
                if (videoRef.current) {
                    try {
                        await videoRef.current.stopAsync();
                        await videoRef.current.unloadAsync();
                    } catch (e) {
                        // Ignore errors during cleanup
                    }
                }
            };
            cleanup();
        };
    }, [id]);

    // Stop all media playback (used when changing lessons)
    const stopAllMedia = async (fullUnload: boolean = false) => {
        // Skip if already transitioning (debounce)
        if (isTransitioning.current && !fullUnload) {
            return;
        }
        
        // Stop video - just pause, don't unload unless fullUnload is true
        // (The key prop change on Video will handle destroying the old instance)
        if (videoRef.current) {
            try {
                const status = await videoRef.current.getStatusAsync();
                if (status.isLoaded) {
                    await videoRef.current.pauseAsync();
                    // Only unload when leaving the screen entirely
                    if (fullUnload) {
                        await videoRef.current.unloadAsync();
                    }
                }
            } catch (e) {
                // Ignore errors - video might not be loaded yet or already unloading
            }
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
    const isYouTube = videoProvider === 'youtube';
    
    // For direct videos, check multiple sources for offline video
    // 1. Check if video URL is already a local file:// path (from offline course data)
    // 2. Check downloadStates for legacy downloadManager
    // 3. Check offline course for video_local path
    const getDirectVideoSource = () => {
        if (!currentLesson?.video_url) return null;
        
        // If video_url already starts with file://, it's already local (from offline course)
        if (currentLesson.video_url.startsWith('file://')) {
            console.log('Using local video path from offline course:', currentLesson.video_url);
            return { uri: currentLesson.video_url };
        }
        
        // Check legacy download manager state
        const state = downloadStates.get(currentLesson.id);
        if (state?.isDownloaded) {
            const localUri = getLocalLessonUri(currentLesson.id);
            console.log('Using legacy downloaded video:', localUri);
            return { uri: localUri };
        }
        
        // Return original URL for online playback
        return { uri: currentLesson.video_url };
    };
    
    // Get the appropriate video URL
    const embedUrl = useEmbeddedPlayer && currentLesson?.video_url 
        ? getEmbedUrl(currentLesson.video_url, videoProvider) 
        : null;
    const directVideoSource = !useEmbeddedPlayer ? getDirectVideoSource() : null;
    
    // For YouTube, generate custom HTML player for proper playback
    const youtubeVideoId = isYouTube && currentLesson?.video_url 
        ? getYouTubeVideoId(currentLesson.video_url) 
        : null;
    const youtubePlayerHTML = youtubeVideoId ? generateYouTubePlayerHTML(youtubeVideoId) : null;
    
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
                    {isYouTube && youtubePlayerHTML ? (
                        /* YouTube player using HTML + baseUrl approach for proper origin */
                        <View style={styles.embeddedVideoWrapper}>
                            <WebView
                                source={{ 
                                    html: youtubePlayerHTML, 
                                    baseUrl: 'https://www.youtube.com' 
                                }}
                                ref={webViewRef}
                                style={styles.embeddedWebView}
                                originWhitelist={['*']}
                                allowsFullscreenVideo={true}
                                allowsInlineMediaPlayback={true}
                                mediaPlaybackRequiresUserAction={false}
                                javaScriptEnabled={true}
                                domStorageEnabled={true}
                                startInLoadingState={false}
                                mixedContentMode="always"
                                allowsProtectedMedia={true}
                                sharedCookiesEnabled={true}
                                thirdPartyCookiesEnabled={true}
                                cacheEnabled={true}
                                setSupportMultipleWindows={false}
                                overScrollMode="never"
                                bounces={false}
                                scalesPageToFit={false}
                                scrollEnabled={false}
                                onMessage={(event) => {
                                    try {
                                        const data = JSON.parse(event.nativeEvent.data);
                                        if (data.type === 'ended') {
                                            // Video ended - could auto-advance
                                            console.log('YouTube video ended');
                                        } else if (data.type === 'fullscreen') {
                                            // Handle fullscreen request
                                            console.log('Fullscreen requested');
                                        } else if (data.type === 'ready') {
                                            console.log('YouTube player ready');
                                        }
                                    } catch (e) {
                                        // Not JSON message
                                    }
                                }}
                                onError={(syntheticEvent) => {
                                    const { nativeEvent } = syntheticEvent;
                                    console.warn('WebView error:', nativeEvent);
                                }}
                            />
                            {/* Floating back button */}
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
                    ) : useEmbeddedPlayer && embedUrl ? (
                        /* Embedded video player (Vimeo, Wistia) */
                        <View style={styles.embeddedVideoWrapper}>
                            <WebView
                                source={{ uri: embedUrl }}
                                style={styles.embeddedWebView}
                                allowsFullscreenVideo={true}
                                allowsInlineMediaPlayback={true}
                                mediaPlaybackRequiresUserAction={false}
                                javaScriptEnabled={true}
                                domStorageEnabled={true}
                                startInLoadingState={true}
                                mixedContentMode="compatibility"
                                allowsProtectedMedia={true}
                                sharedCookiesEnabled={true}
                                thirdPartyCookiesEnabled={true}
                                cacheEnabled={true}
                                setSupportMultipleWindows={false}
                                overScrollMode="never"
                                bounces={false}
                                scalesPageToFit={true}
                                userAgent="Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
                                onError={(syntheticEvent) => {
                                    const { nativeEvent } = syntheticEvent;
                                    console.warn('WebView error:', nativeEvent);
                                }}
                                onHttpError={(syntheticEvent) => {
                                    const { nativeEvent } = syntheticEvent;
                                    console.warn('WebView HTTP error:', nativeEvent.statusCode);
                                }}
                                renderLoading={() => (
                                    <View style={styles.embeddedLoadingOverlay}>
                                        <ActivityIndicator size="large" color="#fff" />
                                        <Text style={styles.embeddedLoadingText}>Loading video...</Text>
                                    </View>
                                )}
                            />
                            {/* Floating back button - doesn't block video controls */}
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
                                        onPress={async () => {
                                            await stopAllMedia(true);
                                            router.back();
                                        }}
                                    >
                                        <Ionicons name="arrow-back" size={24} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                        <View style={styles.videoWrapper}>
                            {/* Video component - key forces re-creation when source changes to avoid decoder conflicts */}
                            <Video
                                key={`video-${currentLesson?.id}-${directVideoSource?.uri}`}
                                ref={videoRef}
                                source={directVideoSource}
                                style={styles.video}
                                resizeMode={ResizeMode.CONTAIN}
                                onPlaybackStatusUpdate={handleVideoPlaybackStatus}
                                shouldPlay={false}
                                useNativeControls={false}
                                progressUpdateIntervalMillis={500}
                                onFullscreenUpdate={({ fullscreenUpdate }) => {
                                    if (fullscreenUpdate === 3) { // PLAYER_DID_DISMISS
                                        setIsFullscreen(false);
                                    } else if (fullscreenUpdate === 1) { // PLAYER_WILL_PRESENT
                                        setIsFullscreen(true);
                                    }
                                }}
                                onError={(error) => {
                                    console.error('Video playback error:', error);
                                    // Detect various error types
                                    const errorStr = String(error);
                                    let errorMsg = 'Unable to play video.';
                                    if (errorStr.includes('SSL') || errorStr.includes('certificate') || errorStr.includes('SSLPeerUnverifiedException')) {
                                        errorMsg = 'SSL Certificate Error: The video server has an invalid certificate.';
                                    } else if (errorStr.includes('404') || errorStr.includes('not found')) {
                                        errorMsg = 'Video not found. The file may have been moved or deleted.';
                                    } else if (errorStr.includes('network') || errorStr.includes('connection')) {
                                        errorMsg = 'Network error. Please check your internet connection.';
                                    } else if (errorStr.includes('Decoder') || errorStr.includes('codec') || errorStr.includes('c2.qti')) {
                                        // Hardware decoder error - suggest retry
                                        errorMsg = 'Video decoder error. The video format may not be supported. Try again or contact support.';
                                    }
                                    setVideoError(errorMsg);
                                    setIsBuffering(false);
                                }}
                                onLoad={() => {
                                    setVideoError(null);
                                    setIsBuffering(false);
                                }}
                                onReadyForDisplay={() => {
                                    // Video is ready to display
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
                                                    await stopAllMedia(true);
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

                                    {/* Bottom controls - Netflix/YouTube style */}
                                    <View style={[styles.bottomControlsContainer]}>
                                        {/* Gradient background for better visibility */}
                                        <View style={styles.bottomGradient} />
                                        
                                        {/* Seekable progress bar - larger touch area */}
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

                                        {/* Time and controls row */}
                                        <View style={[styles.timeRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                                            <Text style={styles.timeText}>
                                                {formatTime(videoProgress)} / {formatTime(videoDuration)}
                                            </Text>
                                            <View style={styles.bottomRightControls}>
                                                <TouchableOpacity 
                                                    style={styles.controlIconButton}
                                                    onPress={() => seekVideo(Math.max(0, videoProgress - 10000))}
                                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                >
                                                    <Ionicons name="play-back" size={22} color="#fff" />
                                                </TouchableOpacity>
                                                <TouchableOpacity 
                                                    style={styles.controlIconButton}
                                                    onPress={() => seekVideo(Math.min(videoDuration, videoProgress + 10000))}
                                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                >
                                                    <Ionicons name="play-forward" size={22} color="#fff" />
                                                </TouchableOpacity>
                                                <TouchableOpacity 
                                                    style={styles.speedPill}
                                                    onPress={() => setShowSpeedMenu(true)}
                                                    hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
                                                >
                                                    <Text style={styles.speedPillText}>{playbackSpeed}x</Text>
                                                </TouchableOpacity>
                                                {/* Landscape/Portrait rotation button */}
                                                <TouchableOpacity 
                                                    style={styles.controlIconButton}
                                                    onPress={toggleLandscape}
                                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                >
                                                    <Ionicons 
                                                        name="phone-landscape-outline" 
                                                        size={22} 
                                                        color="#fff" 
                                                    />
                                                </TouchableOpacity>
                                                <TouchableOpacity 
                                                    style={styles.controlIconButton}
                                                    onPress={toggleFullscreen}
                                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                >
                                                    <Ionicons 
                                                        name={isFullscreen ? "contract" : "expand"} 
                                                        size={22} 
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
                        <Ionicons name="cloud-offline" size={16} color={COLORS.warning} />
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
                                <ActivityIndicator size="small" color={COLORS.primary} />
                            ) : (
                                <Ionicons 
                                    name={isCourseDownloaded ? "checkmark-circle" : "cloud-download-outline"} 
                                    size={22} 
                                    color={isCourseDownloaded ? COLORS.success : COLORS.primary} 
                                />
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={styles.outlineButton}
                            onPress={toggleSidebar}
                        >
                            <Ionicons name="list" size={24} color={COLORS.primary} />
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
                                        {block.type === 'text' && (block.content?.html || block.content?.text || block.content) && (
                                            <View style={styles.textBlockContainer}>
                                                {block.title && <Text style={styles.textBlockTitle}>{block.title}</Text>}
                                                <RenderHtml
                                                    contentWidth={SCREEN_WIDTH - SPACING.lg * 2 - 32}
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
                                                {block.content?.provider === 'youtube' ? (
                                                    // YouTube block with HTML + baseUrl approach
                                                    <View style={styles.embeddedVideoContainer}>
                                                        <WebView
                                                            source={{ 
                                                                html: generateYouTubePlayerHTML(getYouTubeVideoId(block.content.url) || ''),
                                                                baseUrl: 'https://www.youtube.com'
                                                            }}
                                                            style={styles.embeddedVideo}
                                                            originWhitelist={['*']}
                                                            allowsFullscreenVideo={true}
                                                            allowsInlineMediaPlayback={true}
                                                            mediaPlaybackRequiresUserAction={false}
                                                            javaScriptEnabled={true}
                                                            domStorageEnabled={true}
                                                            scrollEnabled={false}
                                                        />
                                                    </View>
                                                ) : isEmbeddedVideo(block.content?.provider) ? (
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
                                                        onError={(error) => {
                                                            console.warn('Block video error:', error);
                                                        }}
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
        lineHeight: 28,
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    p: {
        marginBottom: SPACING.md,
        marginTop: 0,
        lineHeight: 28,
    },
    h1: {
        fontSize: 28,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: SPACING.lg,
        marginTop: SPACING.xl,
        lineHeight: 36,
    },
    h2: {
        fontSize: 24,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: SPACING.md,
        marginTop: SPACING.lg,
        lineHeight: 32,
    },
    h3: {
        fontSize: 20,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: SPACING.sm,
        marginTop: SPACING.md,
        lineHeight: 28,
    },
    h4: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: SPACING.sm,
        marginTop: SPACING.md,
        lineHeight: 26,
    },
    h5: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: SPACING.xs,
        marginTop: SPACING.sm,
    },
    h6: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginBottom: SPACING.xs,
        marginTop: SPACING.sm,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    ul: {
        marginBottom: SPACING.md,
        marginTop: SPACING.sm,
        paddingLeft: SPACING.md,
    },
    ol: {
        marginBottom: SPACING.md,
        marginTop: SPACING.sm,
        paddingLeft: SPACING.md,
    },
    li: {
        marginBottom: SPACING.xs,
        lineHeight: 26,
    },
    a: {
        color: COLORS.primary,
        textDecorationLine: 'underline',
    },
    strong: {
        fontWeight: '700',
        color: COLORS.text,
    },
    b: {
        fontWeight: '700',
        color: COLORS.text,
    },
    em: {
        fontStyle: 'italic',
    },
    i: {
        fontStyle: 'italic',
    },
    blockquote: {
        borderLeftWidth: 4,
        borderLeftColor: COLORS.primary,
        paddingLeft: SPACING.md,
        paddingVertical: SPACING.sm,
        marginVertical: SPACING.md,
        backgroundColor: `${COLORS.primary}10`,
        borderRadius: BORDER_RADIUS.sm,
        marginLeft: 0,
        marginRight: 0,
    },
    code: {
        backgroundColor: COLORS.backgroundSecondary,
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 4,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: FONT_SIZE.sm,
        color: COLORS.primary,
    },
    pre: {
        backgroundColor: COLORS.backgroundSecondary,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        overflow: 'scroll',
        marginVertical: SPACING.md,
    },
    img: {
        marginVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
    },
    table: {
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: BORDER_RADIUS.md,
        marginVertical: SPACING.md,
    },
    th: {
        backgroundColor: COLORS.backgroundSecondary,
        padding: SPACING.sm,
        fontWeight: '600',
    },
    td: {
        padding: SPACING.sm,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    hr: {
        backgroundColor: COLORS.border,
        height: 1,
        marginVertical: SPACING.lg,
    },
    mark: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 2,
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
        marginTop: -36,
        marginLeft: -36,
        zIndex: 15,
    },
    playButtonCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    
    // Netflix/YouTube style bottom controls
    bottomControlsContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 20,
    },
    bottomGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 120,
        backgroundColor: 'transparent',
        // Simulated gradient using multiple layers
        borderTopWidth: 0,
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
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 4,
    },
    progressBar: {
        height: 44,
        justifyContent: 'center',
        paddingVertical: 16,
    },
    progressTrack: {
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 2,
        position: 'relative',
        overflow: 'visible',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#E50914',
        borderRadius: 2,
    },
    progressThumb: {
        position: 'absolute',
        top: -6,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#E50914',
        marginLeft: -8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 3,
        elevation: 4,
        borderWidth: 2,
        borderColor: '#fff',
    },
    timeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    timeText: {
        color: 'rgba(255,255,255,0.95)',
        fontSize: 13,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
    },
    bottomRightControls: {
        flexDirection: 'row',
        gap: 20,
        alignItems: 'center',
    },
    controlIconButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    skipButton: {
        padding: 6,
    },
    speedPill: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
        minWidth: 44,
        alignItems: 'center',
    },
    speedPillText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700',
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
        backgroundColor: 'rgba(0,0,0,0.6)',
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
    
    // Text block container for rich HTML content
    textBlockContainer: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        marginVertical: SPACING.sm,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    textBlockTitle: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        marginBottom: SPACING.md,
        paddingBottom: SPACING.sm,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
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
        width: '100%',
    },
    embeddedVideoContainer: {
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: BORDER_RADIUS.lg,
        overflow: 'hidden',
        backgroundColor: '#000',
    },
    embeddedVideo: {
        flex: 1,
    },
    blockVideo: {
        width: '100%',
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

    // Offline indicator styles
    offlineIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.warning + '20',
        paddingVertical: SPACING.xs,
        paddingHorizontal: SPACING.md,
        gap: SPACING.xs,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.warning + '30',
    },
    offlineIndicatorText: {
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.medium,
        color: COLORS.warning,
    },

    // Course download banner
    courseDownloadBanner: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
    },
    courseDownloadInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    courseDownloadTexts: {
        flex: 1,
    },
    courseDownloadTitle: {
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.semibold,
        color: '#fff',
    },
    courseDownloadStatus: {
        fontSize: FONT_SIZE.xs,
        color: 'rgba(255,255,255,0.8)',
    },
    courseDownloadPercent: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.bold,
        color: '#fff',
    },
    courseDownloadProgressBg: {
        height: 3,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 2,
        marginTop: SPACING.xs,
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
        gap: SPACING.sm,
    },
    downloadCourseButton: {
        width: 44,
        height: 44,
        borderRadius: BORDER_RADIUS.lg,
        backgroundColor: COLORS.background,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    downloadCourseButtonActive: {
        backgroundColor: COLORS.success + '15',
        borderColor: COLORS.success + '30',
    },
    downloadCourseButtonDownloading: {
        backgroundColor: COLORS.primary + '10',
        borderColor: COLORS.primary + '30',
    },
});
