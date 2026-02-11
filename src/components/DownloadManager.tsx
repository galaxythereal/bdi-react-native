import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import React, { useEffect, useState } from 'react';
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
import Theme from '../../constants/theme';
import { useLocalization } from '../context/LocalizationContext';
import { useTheme } from '../context/ThemeContext';

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
    const { colors, isDark } = useTheme();
    const { t, isRTL } = useLocalization();
    const styles = React.useMemo(() => createStyles(colors, isDark, isRTL), [colors, isDark, isRTL]);

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
                    return { name: 'checkmark-circle', color: colors.success };
                case 'downloading':
                    return { name: 'cloud-download', color: colors.primary };
                case 'pending':
                    return { name: 'hourglass', color: colors.warning };
                case 'failed':
                    return { name: 'alert-circle', color: colors.error };
                case 'paused':
                    return { name: 'pause-circle', color: colors.textSecondary };
                default:
                    return { name: 'help-circle', color: colors.textTertiary };
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
                                <Ionicons name="pause" size={20} color={colors.textSecondary} />
                            </TouchableOpacity>
                        )}

                        {item.status === 'paused' && onResume && (
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => onResume(item.lessonId)}
                            >
                                <Ionicons name="play" size={20} color={colors.primary} />
                            </TouchableOpacity>
                        )}

                        {item.status === 'failed' && (
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => onRetry(item.lessonId)}
                            >
                                <Ionicons name="refresh" size={20} color={colors.primary} />
                            </TouchableOpacity>
                        )}

                        {item.status === 'completed' && onPlay && (
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => onPlay(item.lessonId)}
                            >
                                <Ionicons name="play-circle" size={24} color={colors.primary} />
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={handleRemove}
                        >
                            <Ionicons name="trash-outline" size={20} color={colors.error} />
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
                    <Ionicons name="cloud-download-outline" size={64} color={colors.textTertiary} />
                </View>
                <Text style={styles.emptyTitle}>{t.noDownloadsYet}</Text>
                <Text style={styles.emptyText}>
                    {t.downloadOfflineHint}{"\n"}
                    {t.goToCourseDownload}
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
                    {renderSectionHeader(t.downloading, activeDownloads.length)}
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
                    {renderSectionHeader(t.failed, failedDownloads.length)}
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
                        {renderSectionHeader(t.downloadedContent, completedDownloads.length)}
                        {onClearAll && completedDownloads.length > 1 && (
                            <TouchableOpacity style={styles.clearButton} onPress={onClearAll}>
                                <Text style={styles.clearButtonText}>{t.clearAllAction}</Text>
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
    const { colors, isDark } = useTheme();
    const { t, isRTL } = useLocalization();
    const styles = React.useMemo(() => createStyles(colors, isDark, isRTL), [colors, isDark, isRTL]);

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
                <Ionicons name="folder-open-outline" size={20} color={colors.textSecondary} />
                <Text style={styles.storageTitle}>{t.storageLabel}</Text>
            </View>
            <View style={styles.storageBar}>
                <View style={[styles.storageUsed, { width: '15%' }]} />
            </View>
            <Text style={styles.storageText}>
                {t.storageAvailable.replace('{size}', formatBytes(storageInfo.free))}
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
    const { colors, isDark } = useTheme();
    const { t, isRTL } = useLocalization();
    const styles = React.useMemo(() => createStyles(colors, isDark, isRTL), [colors, isDark, isRTL]);

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
                t.removeDownloadTitle,
                t.removeLessonMessage,
                [
                    { text: t.cancel, style: 'cancel' },
                    { text: t.delete, style: 'destructive', onPress: onDelete },
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
                {showLabel && <Text style={styles.downloadLabel}>{t.downloadingLabel}</Text>}
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
                    color={isDownloaded ? colors.success : colors.primary}
                />
            </View>
            {showLabel && (
                <Text style={[styles.downloadLabel, isDownloaded && styles.downloadLabelCompleted]}>
                    {isDownloaded ? t.downloadedLabel : t.downloadLabel}
                </Text>
            )}
        </TouchableOpacity>
    );
};

const createStyles = (colors: typeof Theme.colors.light, isDark: boolean, isRTL: boolean) => StyleSheet.create({
    container: {
        flex: 1,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Theme.spacing['3xl'],
    },
    emptyIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: colors.backgroundSecondary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Theme.spacing.xl,
    },
    emptyTitle: {
        fontSize: Theme.fontSize.xl,
        fontWeight: Theme.fontWeight.bold,
        color: colors.text,
        marginBottom: Theme.spacing.sm,
        textAlign: isRTL ? 'right' : 'left',
    },
    emptyText: {
        fontSize: Theme.fontSize.base,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },
    storageContainer: {
        backgroundColor: colors.surface,
        padding: Theme.spacing.lg,
        marginBottom: Theme.spacing.md,
        borderRadius: Theme.borderRadius.lg,
        ...Theme.shadows[isDark ? 'dark' : 'light'].sm,
    },
    storageHeader: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: Theme.spacing.sm,
        marginBottom: Theme.spacing.sm,
    },
    storageTitle: {
        fontSize: Theme.fontSize.base,
        fontWeight: Theme.fontWeight.semibold,
        color: colors.text,
        textAlign: isRTL ? 'right' : 'left',
    },
    storageBar: {
        height: 8,
        backgroundColor: colors.border,
        borderRadius: 4,
        marginBottom: Theme.spacing.xs,
        overflow: 'hidden',
    },
    storageUsed: {
        height: '100%',
        backgroundColor: colors.primary,
        borderRadius: 4,
    },
    storageText: {
        fontSize: Theme.fontSize.sm,
        color: colors.textSecondary,
        textAlign: isRTL ? 'right' : 'left',
    },
    section: {
        marginBottom: Theme.spacing.lg,
    },
    sectionHeaderRow: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sectionHeader: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: Theme.spacing.sm,
        marginBottom: Theme.spacing.md,
        paddingHorizontal: Theme.spacing.sm,
    },
    sectionTitle: {
        fontSize: Theme.fontSize.lg,
        fontWeight: Theme.fontWeight.bold,
        color: colors.text,
        textAlign: isRTL ? 'right' : 'left',
    },
    badge: {
        backgroundColor: colors.primary + '20',
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: 2,
        borderRadius: Theme.borderRadius.round,
    },
    badgeText: {
        fontSize: Theme.fontSize.xs,
        fontWeight: Theme.fontWeight.bold,
        color: colors.primary,
    },
    clearButton: {
        paddingHorizontal: Theme.spacing.md,
        paddingVertical: Theme.spacing.xs,
    },
    clearButtonText: {
        fontSize: Theme.fontSize.sm,
        color: colors.error,
        fontWeight: Theme.fontWeight.medium,
    },
    downloadItem: {
        backgroundColor: colors.surface,
        borderRadius: Theme.borderRadius.lg,
        marginBottom: Theme.spacing.sm,
        ...Theme.shadows[isDark ? 'dark' : 'light'].sm,
    },
    downloadContent: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        padding: Theme.spacing.md,
    },
    statusIndicator: {
        width: 48,
        height: 48,
        borderRadius: Theme.borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: isRTL ? 0 : Theme.spacing.md,
        marginLeft: isRTL ? Theme.spacing.md : 0,
    },
    downloadInfo: {
        flex: 1,
    },
    downloadTitle: {
        fontSize: Theme.fontSize.base,
        fontWeight: Theme.fontWeight.semibold,
        color: colors.text,
        marginBottom: 2,
        textAlign: isRTL ? 'right' : 'left',
    },
    downloadCourse: {
        fontSize: Theme.fontSize.sm,
        color: colors.textSecondary,
        textAlign: isRTL ? 'right' : 'left',
    },
    progressContainer: {
        marginTop: Theme.spacing.sm,
    },
    progressBar: {
        height: 4,
        backgroundColor: colors.border,
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 4,
    },
    progressFill: {
        height: '100%',
        backgroundColor: colors.primary,
        borderRadius: 2,
    },
    progressText: {
        fontSize: Theme.fontSize.xs,
        color: colors.textSecondary,
    },
    fileSizeText: {
        fontSize: Theme.fontSize.sm,
        color: colors.textTertiary,
        marginTop: 2,
    },
    errorText: {
        fontSize: Theme.fontSize.sm,
        color: colors.error,
        marginTop: Theme.spacing.xs,
    },
    downloadActions: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: Theme.spacing.xs,
    },
    actionButton: {
        padding: Theme.spacing.sm,
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
        padding: Theme.spacing.xs,
    },
    downloadIconContainerCompleted: {
        backgroundColor: colors.success + '15',
        borderRadius: Theme.borderRadius.round,
    },
    downloadLabel: {
        fontSize: Theme.fontSize.xs,
        color: colors.primary,
        fontWeight: Theme.fontWeight.medium,
        marginTop: 2,
    },
    downloadLabelCompleted: {
        color: colors.success,
    },
    progressCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 3,
        borderColor: colors.border,
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
        borderColor: colors.primary,
        borderTopColor: 'transparent',
        borderRightColor: 'transparent',
    },
    progressCircleText: {
        fontSize: Theme.fontSize.xs,
        fontWeight: Theme.fontWeight.bold,
        color: colors.primary,
    },
});
