// Using legacy API to avoid deprecation errors in SDK 52+
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Constants
// @ts-ignore - expo-file-system types may not match runtime
const LESSON_DIR = ((FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || '') + 'lessons/';
const DOWNLOADS_KEY = '@bdi_downloads';

// Types
export interface DownloadItem {
    id: string;
    lessonId: string;
    courseId?: string;
    title: string;
    courseTitle?: string;
    videoUrl: string;
    localUri: string;
    fileSize?: number;
    downloadedAt: string;
    status: 'pending' | 'downloading' | 'completed' | 'failed';
    progress: number;
    error?: string;
}

// Active downloads tracking
const activeDownloads = new Map<string, any>();

// Ensure download directory exists
export const ensureDirExists = async () => {
    const dirInfo = await FileSystem.getInfoAsync(LESSON_DIR);
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(LESSON_DIR, { intermediates: true });
    }
};

// Get local file URI for a lesson
export const getLocalLessonUri = (lessonId: string, extension: string = 'mp4') => {
    return LESSON_DIR + `${lessonId}.${extension}`;
};

// Check if a lesson is downloaded
export const isLessonDownloaded = async (lessonId: string): Promise<boolean> => {
    try {
        await ensureDirExists();
        const uri = getLocalLessonUri(lessonId);
        const fileInfo = await FileSystem.getInfoAsync(uri);
        return fileInfo.exists;
    } catch (error) {
        console.error('Error checking download status:', error);
        return false;
    }
};

// Get file size of a downloaded lesson
export const getDownloadedFileSize = async (lessonId: string): Promise<number> => {
    try {
        const uri = getLocalLessonUri(lessonId);
        // @ts-ignore - size option exists at runtime
        const fileInfo = await FileSystem.getInfoAsync(uri, { size: true } as any);
        return fileInfo.exists && 'size' in fileInfo ? (fileInfo as any).size || 0 : 0;
    } catch (error) {
        return 0;
    }
};

// Download a video lesson
export const downloadLessonVideo = async (
    lessonId: string,
    videoUrl: string,
    onProgress?: (progress: number) => void,
    metadata?: { title?: string; courseTitle?: string; courseId?: string }
): Promise<string> => {
    await ensureDirExists();
    const localUri = getLocalLessonUri(lessonId);

    // Check if already downloading
    if (activeDownloads.has(lessonId)) {
        throw new Error('Download already in progress');
    }

    // Create download resumable
    const downloadResumable = FileSystem.createDownloadResumable(
        videoUrl,
        localUri,
        {
            headers: {
                'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8',
            },
        },
        (downloadProgress) => {
            const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
            if (onProgress) onProgress(Math.min(progress, 1));
        }
    );

    // Track active download
    activeDownloads.set(lessonId, downloadResumable);

    try {
        const result = await downloadResumable.downloadAsync();
        
        if (!result || !result.uri) {
            throw new Error('Download failed - no result returned');
        }

        // Get file size
        // @ts-ignore - size option exists at runtime
        const fileInfo = await FileSystem.getInfoAsync(result.uri, { size: true } as any);
        const fileSize = fileInfo.exists && 'size' in fileInfo ? (fileInfo as any).size : 0;

        // Save to downloads list
        await saveDownloadRecord({
            id: lessonId,
            lessonId,
            courseId: metadata?.courseId,
            title: metadata?.title || 'Video Lesson',
            courseTitle: metadata?.courseTitle,
            videoUrl,
            localUri: result.uri,
            fileSize,
            downloadedAt: new Date().toISOString(),
            status: 'completed',
            progress: 1,
        });

        return result.uri;
    } catch (error: any) {
        console.error('Download error:', error);
        
        // Clean up partial download
        try {
            await FileSystem.deleteAsync(localUri, { idempotent: true });
        } catch {}
        
        throw new Error(error.message || 'Download failed');
    } finally {
        activeDownloads.delete(lessonId);
    }
};

// Pause a download
export const pauseDownload = async (lessonId: string): Promise<void> => {
    const download = activeDownloads.get(lessonId);
    if (download) {
        try {
            await download.pauseAsync();
        } catch (error) {
            console.error('Error pausing download:', error);
        }
    }
};

// Resume a paused download
export const resumeDownload = async (
    lessonId: string,
    onProgress?: (progress: number) => void
): Promise<string | null> => {
    const download = activeDownloads.get(lessonId);
    if (download) {
        try {
            const result = await download.resumeAsync();
            return result?.uri || null;
        } catch (error) {
            console.error('Error resuming download:', error);
            return null;
        }
    }
    return null;
};

// Cancel a download
export const cancelDownload = async (lessonId: string): Promise<void> => {
    const download = activeDownloads.get(lessonId);
    if (download) {
        try {
            await download.pauseAsync();
            const localUri = getLocalLessonUri(lessonId);
            await FileSystem.deleteAsync(localUri, { idempotent: true });
            activeDownloads.delete(lessonId);
        } catch (error) {
            console.error('Error canceling download:', error);
        }
    }
};

// Delete a downloaded lesson
export const deleteLessonDownload = async (lessonId: string): Promise<void> => {
    try {
        const uri = getLocalLessonUri(lessonId);
        await FileSystem.deleteAsync(uri, { idempotent: true });
        await removeDownloadRecord(lessonId);
    } catch (error) {
        console.error('Error deleting download:', error);
        throw error;
    }
};

// Get all download records
export const getDownloadRecords = async (): Promise<DownloadItem[]> => {
    try {
        const data = await AsyncStorage.getItem(DOWNLOADS_KEY);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('Error getting download records:', error);
        return [];
    }
};

// Save a download record
export const saveDownloadRecord = async (record: DownloadItem): Promise<void> => {
    try {
        const records = await getDownloadRecords();
        const existingIndex = records.findIndex(r => r.lessonId === record.lessonId);
        
        if (existingIndex >= 0) {
            records[existingIndex] = record;
        } else {
            records.push(record);
        }
        
        await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(records));
    } catch (error) {
        console.error('Error saving download record:', error);
    }
};

// Remove a download record
export const removeDownloadRecord = async (lessonId: string): Promise<void> => {
    try {
        const records = await getDownloadRecords();
        const filteredRecords = records.filter(r => r.lessonId !== lessonId);
        await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(filteredRecords));
    } catch (error) {
        console.error('Error removing download record:', error);
    }
};

// Clear all downloads
export const clearAllDownloads = async (): Promise<void> => {
    try {
        const records = await getDownloadRecords();
        
        // Delete all files
        for (const record of records) {
            try {
                await FileSystem.deleteAsync(record.localUri, { idempotent: true });
            } catch {}
        }
        
        // Clear records
        await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify([]));
    } catch (error) {
        console.error('Error clearing downloads:', error);
        throw error;
    }
};

// Get total storage used by downloads
export const getDownloadsStorageUsed = async (): Promise<number> => {
    try {
        const records = await getDownloadRecords();
        let totalSize = 0;
        
        for (const record of records) {
            if (record.fileSize) {
                totalSize += record.fileSize;
            } else {
                const size = await getDownloadedFileSize(record.lessonId);
                totalSize += size;
            }
        }
        
        return totalSize;
    } catch (error) {
        console.error('Error calculating storage:', error);
        return 0;
    }
};

// Verify download integrity (check if files actually exist)
export const verifyDownloads = async (): Promise<DownloadItem[]> => {
    try {
        const records = await getDownloadRecords();
        const verifiedRecords: DownloadItem[] = [];
        
        for (const record of records) {
            const exists = await FileSystem.getInfoAsync(record.localUri);
            if (exists.exists) {
                verifiedRecords.push(record);
            }
        }
        
        // Update records if any were removed
        if (verifiedRecords.length !== records.length) {
            await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(verifiedRecords));
        }
        
        return verifiedRecords;
    } catch (error) {
        console.error('Error verifying downloads:', error);
        return [];
    }
};

// Check if download is in progress
export const isDownloading = (lessonId: string): boolean => {
    return activeDownloads.has(lessonId);
};

// Get active download count
export const getActiveDownloadCount = (): number => {
    return activeDownloads.size;
};
