import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { BORDER_RADIUS, COLORS, FONT_SIZE, FONT_WEIGHT, SHADOWS, SPACING } from '../lib/constants';

interface Download {
    id: string;
    lessonId: string;
    title: string;
    courseTitle?: string;
    progress: number;
    status: 'pending' | 'downloading' | 'completed' | 'failed' | 'paused';
    fileSize?: number;
    downloadedSize?: number;
    uri?: string;
    error?: string;
}

interface DownloadManagerProps {
    downloads: Download[];
    onRemove: (lessonId: string) => void;
    onRetry: (lessonId: string) => void;
    onPause?: (lessonId: string) => void;
    onResume?: (lessonId: string) => void;
    onPlay?: (lessonId: string) => void;
    onClearAll?: () => void;
}

const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const DownloadManager: React.FC<DownloadManagerProps> = ({
    downloads,
    onRemove,
    onRetry,
    onPause,
    onResume,
    onPlay,
    onClearAll,
}) => {
    const completedDownloads = downloads.filter(d => d.status === 'completed');
    const activeDownloads = downloads.filter(d => d.status === 'downloading' || d.status === 'pending');
    const failedDownloads = downloads.filter(d => d.status === 'failed');

    const renderDownloadItem = ({ item, index }: { item: Download; index: number }) => {
        const progressAnim = React.useRef(new Animated.Value(0)).current;

        React.useEffect(() => {
            Animated.timing(progressAnim, {
                toValue: item.progress,
                duration: 300,
                useNativeDriver: false,
            }).start();
        }, [item.progress]);

        const getStatusIcon = () => {
            switch (item.status) {
                case 'completed':
                    return { name: 'checkmark-circle', color: COLORS.success };
                case 'downloading':
                    return { name: 'cloud-download', color: COLORS.primary };
                case 'pending':
                    return { name: 'hourglass', color: COLORS.warning };
                case 'failed':
                    return { name: 'alert-circle', color: COLORS.error };
                case 'paused':
                    return { name: 'pause-circle', color: COLORS.textSecondary };
                default:
                    return { name: 'help-circle', color: COLORS.textTertiary };
            }
        };

        const statusIcon = getStatusIcon();

        const handlePress = () => {
            if (item.status === 'completed' && onPlay) {
                onPlay(item.lessonId);
            }
        };

        const handleRemove = () => {
            Alert.alert(
                'Remove Download',
                `Are you sure you want to remove "${item.title}"?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => onRemove(item.lessonId) },
                ]
            );
        };

        return (
            <TouchableOpacity
                style={styles.downloadItem}
                onPress={handlePress}
                disabled={item.status !== 'completed'}
                activeOpacity={0.8}
            >
                <View style={styles.downloadContent}>
                    <View style={[styles.statusIndicator, { backgroundColor: statusIcon.color + '20' }]}>
                        {item.status === 'downloading' ? (
                            <ActivityIndicator size="small" color={statusIcon.color} />
                        ) : (
                            <Ionicons name={statusIcon.name as any} size={24} color={statusIcon.color} />
                        )}
                    </View>

                    <View style={styles.downloadInfo}>
                        <Text style={styles.downloadTitle} numberOfLines={1}>
                            {item.title}
                        </Text>
                        {item.courseTitle && (
                            <Text style={styles.downloadCourse} numberOfLines={1}>
                                {item.courseTitle}
                            </Text>
                        )}

                        {item.status === 'downloading' && (
                            <View style={styles.progressContainer}>
                                <View style={styles.progressBar}>
                                    <Animated.View
                                        style={[
                                            styles.progressFill,
                                            {
                                                width: progressAnim.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: ['0%', '100%'],
                                                }),
                                            },
                                        ]}
                                    />
                                </View>
                                <Text style={styles.progressText}>
                                    {Math.round(item.progress * 100)}%
                                    {item.downloadedSize && item.fileSize && (
                                        <Text> • {formatBytes(item.downloadedSize)} / {formatBytes(item.fileSize)}</Text>
                                    )}
                                </Text>
                            </View>
                        )}

                        {item.status === 'completed' && item.fileSize && (
                            <Text style={styles.fileSizeText}>{formatBytes(item.fileSize)}</Text>
                        )}

                        {item.status === 'failed' && item.error && (
                            <Text style={styles.errorText} numberOfLines={1}>
                                {item.error}
                            </Text>
                        )}
                    </View>

                    <View style={styles.downloadActions}>
                        {item.status === 'downloading' && onPause && (
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => onPause(item.lessonId)}
                            >
                                <Ionicons name="pause" size={20} color={COLORS.textSecondary} />
                            </TouchableOpacity>
                        )}

                        {item.status === 'paused' && onResume && (
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => onResume(item.lessonId)}
                            >
                                <Ionicons name="play" size={20} color={COLORS.primary} />
                            </TouchableOpacity>
                        )}

                        {item.status === 'failed' && (
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => onRetry(item.lessonId)}
                            >
                                <Ionicons name="refresh" size={20} color={COLORS.primary} />
                            </TouchableOpacity>
                        )}

                        {item.status === 'completed' && onPlay && (
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => onPlay(item.lessonId)}
                            >
                                <Ionicons name="play-circle" size={24} color={COLORS.primary} />
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={handleRemove}
                        >
                            <Ionicons name="trash-outline" size={20} color={COLORS.error} />
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderSectionHeader = (title: string, count: number) => (
        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <View style={styles.badge}>
                <Text style={styles.badgeText}>{count}</Text>
            </View>
        </View>
    );

    if (downloads.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <View style={styles.emptyIconContainer}>
                    <Ionicons name="cloud-download-outline" size={64} color={COLORS.textTertiary} />
                </View>
                <Text style={styles.emptyTitle}>No Downloads</Text>
                <Text style={styles.emptyText}>
                    Download videos to watch offline.{'\n'}
                    Look for the download icon on video lessons.
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Storage Info */}
            <StorageInfo />

            {/* Active Downloads */}
            {activeDownloads.length > 0 && (
                <View style={styles.section}>
                    {renderSectionHeader('Downloading', activeDownloads.length)}
                    <FlatList
                        data={activeDownloads}
                        renderItem={renderDownloadItem}
                        keyExtractor={(item) => item.id}
                        scrollEnabled={false}
                    />
                </View>
            )}

            {/* Failed Downloads */}
            {failedDownloads.length > 0 && (
                <View style={styles.section}>
                    {renderSectionHeader('Failed', failedDownloads.length)}
                    <FlatList
                        data={failedDownloads}
                        renderItem={renderDownloadItem}
                        keyExtractor={(item) => item.id}
                        scrollEnabled={false}
                    />
                </View>
            )}

            {/* Completed Downloads */}
            {completedDownloads.length > 0 && (
                <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        {renderSectionHeader('Downloaded', completedDownloads.length)}
                        {onClearAll && completedDownloads.length > 1 && (
                            <TouchableOpacity style={styles.clearButton} onPress={onClearAll}>
                                <Text style={styles.clearButtonText}>Clear All</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <FlatList
                        data={completedDownloads}
                        renderItem={renderDownloadItem}
                        keyExtractor={(item) => item.id}
                        scrollEnabled={false}
                    />
                </View>
            )}
        </View>
    );
};

// Storage Info Component
const StorageInfo: React.FC = () => {
    const [storageInfo, setStorageInfo] = useState<{ used: number; free: number } | null>(null);

    useEffect(() => {
        const getStorageInfo = async () => {
            try {
                const freeSpace = await FileSystem.getFreeDiskStorageAsync();
                // Estimate used space by downloaded files - this would need actual implementation
                setStorageInfo({ used: 0, free: freeSpace });
            } catch (error) {
                console.warn('Could not get storage info:', error);
            }
        };
        getStorageInfo();
    }, []);

    if (!storageInfo) return null;

    return (
        <View style={styles.storageContainer}>
            <View style={styles.storageHeader}>
                <Ionicons name="folder-open-outline" size={20} color={COLORS.textSecondary} />
                <Text style={styles.storageTitle}>Storage</Text>
            </View>
            <View style={styles.storageBar}>
                <View style={[styles.storageUsed, { width: '15%' }]} />
            </View>
            <Text style={styles.storageText}>
                {formatBytes(storageInfo.free)} available
            </Text>
        </View>
    );
};

// Download Button Component for easy reuse
interface DownloadButtonProps {
    lessonId: string;
    videoUrl: string;
    isDownloaded: boolean;
    isDownloading: boolean;
    progress: number;
    onDownload: () => void;
    onDelete: () => void;
    size?: 'small' | 'medium' | 'large';
    showLabel?: boolean;
}

export const DownloadButton: React.FC<DownloadButtonProps> = ({
    isDownloaded,
    isDownloading,
    progress,
    onDownload,
    onDelete,
    size = 'medium',
    showLabel = false,
}) => {
    const iconSize = size === 'small' ? 18 : size === 'medium' ? 24 : 32;
    const progressAnim = React.useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(progressAnim, {
            toValue: progress,
            duration: 200,
            useNativeDriver: false,
        }).start();
    }, [progress]);

    const handlePress = () => {
        if (isDownloaded) {
            Alert.alert(
                'Remove Download',
                'Remove this video from your device?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: onDelete },
                ]
            );
        } else if (!isDownloading) {
            onDownload();
        }
    };

    if (isDownloading) {
        return (
            <View style={[styles.downloadButton, styles[`button_${size}`]]}>
                <View style={styles.progressCircle}>
                    <Animated.View
                        style={[
                            styles.progressCircleFill,
                            {
                                transform: [
                                    {
                                        rotate: progressAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: ['0deg', '360deg'],
                                        }),
                                    },
                                ],
                            },
                        ]}
                    />
                    <Text style={styles.progressCircleText}>
                        {Math.round(progress * 100)}%
                    </Text>
                </View>
                {showLabel && <Text style={styles.downloadLabel}>Downloading...</Text>}
            </View>
        );
    }

    return (
        <TouchableOpacity
            style={[styles.downloadButton, styles[`button_${size}`]]}
            onPress={handlePress}
            activeOpacity={0.7}
        >
            <View style={[
                styles.downloadIconContainer,
                isDownloaded && styles.downloadIconContainerCompleted,
            ]}>
                <Ionicons
                    name={isDownloaded ? 'checkmark-circle' : 'download-outline'}
                    size={iconSize}
                    color={isDownloaded ? COLORS.success : COLORS.primary}
                />
            </View>
            {showLabel && (
                <Text style={[styles.downloadLabel, isDownloaded && styles.downloadLabelCompleted]}>
                    {isDownloaded ? 'Downloaded' : 'Download'}
                </Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xxxl,
    },
    emptyIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: COLORS.backgroundSecondary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.xl,
    },
    emptyTitle: {
        fontSize: FONT_SIZE.xl,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        marginBottom: SPACING.sm,
    },
    emptyText: {
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },
    storageContainer: {
        backgroundColor: COLORS.surface,
        padding: SPACING.lg,
        marginBottom: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        ...SHADOWS.sm,
    },
    storageHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        marginBottom: SPACING.sm,
    },
    storageTitle: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
        color: COLORS.text,
    },
    storageBar: {
        height: 8,
        backgroundColor: COLORS.border,
        borderRadius: 4,
        marginBottom: SPACING.xs,
        overflow: 'hidden',
    },
    storageUsed: {
        height: '100%',
        backgroundColor: COLORS.primary,
        borderRadius: 4,
    },
    storageText: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
    },
    section: {
        marginBottom: SPACING.lg,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        marginBottom: SPACING.md,
        paddingHorizontal: SPACING.sm,
    },
    sectionTitle: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
    },
    badge: {
        backgroundColor: COLORS.primary + '20',
        paddingHorizontal: SPACING.sm,
        paddingVertical: 2,
        borderRadius: BORDER_RADIUS.round,
    },
    badgeText: {
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.primary,
    },
    clearButton: {
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
    },
    clearButtonText: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.error,
        fontWeight: FONT_WEIGHT.medium,
    },
    downloadItem: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        marginBottom: SPACING.sm,
        ...SHADOWS.sm,
    },
    downloadContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
    },
    statusIndicator: {
        width: 48,
        height: 48,
        borderRadius: BORDER_RADIUS.lg,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.md,
    },
    downloadInfo: {
        flex: 1,
    },
    downloadTitle: {
        fontSize: FONT_SIZE.md,
        fontWeight: FONT_WEIGHT.semibold,
        color: COLORS.text,
        marginBottom: 2,
    },
    downloadCourse: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textSecondary,
    },
    progressContainer: {
        marginTop: SPACING.sm,
    },
    progressBar: {
        height: 4,
        backgroundColor: COLORS.border,
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 4,
    },
    progressFill: {
        height: '100%',
        backgroundColor: COLORS.primary,
        borderRadius: 2,
    },
    progressText: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.textSecondary,
    },
    fileSizeText: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.textTertiary,
        marginTop: 2,
    },
    errorText: {
        fontSize: FONT_SIZE.sm,
        color: COLORS.error,
        marginTop: SPACING.xs,
    },
    downloadActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
    },
    actionButton: {
        padding: SPACING.sm,
    },
    downloadButton: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    button_small: {
        minWidth: 32,
    },
    button_medium: {
        minWidth: 48,
    },
    button_large: {
        minWidth: 64,
    },
    downloadIconContainer: {
        padding: SPACING.xs,
    },
    downloadIconContainerCompleted: {
        backgroundColor: COLORS.success + '15',
        borderRadius: BORDER_RADIUS.round,
    },
    downloadLabel: {
        fontSize: FONT_SIZE.xs,
        color: COLORS.primary,
        fontWeight: FONT_WEIGHT.medium,
        marginTop: 2,
    },
    downloadLabelCompleted: {
        color: COLORS.success,
    },
    progressCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 3,
        borderColor: COLORS.border,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    progressCircleFill: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        borderRadius: 20,
        borderWidth: 3,
        borderColor: COLORS.primary,
        borderTopColor: 'transparent',
        borderRightColor: 'transparent',
    },
    progressCircleText: {
        fontSize: FONT_SIZE.xs,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.primary,
    },
});
