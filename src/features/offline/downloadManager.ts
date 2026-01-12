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

// Download a file to a specific location using react-native-blob-util
export const downloadFile = async (
    url: string,
    localPath: string,
    onProgress?: (progress: number) => void
): Promise<string> => {
    await ensureDirExists();
    
    // Clean URL
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'https://' + cleanUrl;
    }
    
    console.log('downloadFile: Downloading from', cleanUrl, 'to', localPath);
    
    // Use expo-file-system (works in Expo Go)
    try {
        const downloadResumable = FileSystem.createDownloadResumable(
            cleanUrl,
            localPath,
            {
                headers: {
                    'Accept': '*/*',
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
                },
            },
            (downloadProgress) => {
                const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
                if (onProgress) onProgress(Math.min(progress, 1));
            }
        );

        const result = await downloadResumable.downloadAsync();
        if (result && result.uri) {
            console.log('Download complete:', result.uri);
            return result.uri;
        }
        throw new Error('No result from download');
    } catch (fsError: any) {
        console.error('Download failed:', fsError.message);
        // Clean up any partial file
        try {
            await FileSystem.deleteAsync(localPath, { idempotent: true });
        } catch {}
        throw new Error(`Download failed: ${fsError.message}`);
    }
};

// Download entire lesson content including all blocks
export interface LessonDownloadResult {
    lessonId: string;
    files: {
        type: string;
        url: string;
        localUri: string;
        success: boolean;
        error?: string;
    }[];
    totalSize: number;
}

export const downloadLessonContent = async (
    lessonId: string,
    lesson: {
        video_url?: string;
        blocks?: {
            type: string;
            content?: {
                url?: string;
                filename?: string;
            };
        }[];
    },
    onProgress?: (progress: number, currentFile: string) => void
): Promise<LessonDownloadResult> => {
    await ensureDirExists();
    
    const result: LessonDownloadResult = {
        lessonId,
        files: [],
        totalSize: 0,
    };

    // Collect all downloadable URLs
    const downloadables: { type: string; url: string; filename: string }[] = [];
    
    // Add main video if exists
    if (lesson.video_url) {
        downloadables.push({
            type: 'video',
            url: lesson.video_url,
            filename: `${lessonId}_video.mp4`,
        });
    }
    
    // Add block content
    if (lesson.blocks) {
        lesson.blocks.forEach((block, index) => {
            if (block.content?.url) {
                let ext = 'file';
                if (block.type === 'video') ext = 'mp4';
                else if (block.type === 'audio') ext = 'mp3';
                else if (block.type === 'image') ext = 'jpg';
                else if (block.type === 'file') {
                    const urlExt = block.content.url.split('.').pop()?.split('?')[0];
                    ext = urlExt || 'file';
                }
                
                downloadables.push({
                    type: block.type,
                    url: block.content.url,
                    filename: block.content.filename || `${lessonId}_block_${index}.${ext}`,
                });
            }
        });
    }

    if (downloadables.length === 0) {
        return result;
    }

    // Download each file
    let completedCount = 0;
    
    for (const item of downloadables) {
        const localPath = LESSON_DIR + item.filename;
        
        try {
            onProgress?.(completedCount / downloadables.length, item.filename);
            
            await downloadFile(item.url, localPath, (fileProgress) => {
                const totalProgress = (completedCount + fileProgress) / downloadables.length;
                onProgress?.(totalProgress, item.filename);
            });
            
            // Get file size
            // @ts-ignore
            const fileInfo = await FileSystem.getInfoAsync(localPath, { size: true } as any);
            const fileSize = fileInfo.exists && 'size' in fileInfo ? (fileInfo as any).size : 0;
            
            result.files.push({
                type: item.type,
                url: item.url,
                localUri: localPath,
                success: true,
            });
            result.totalSize += fileSize;
            
            completedCount++;
        } catch (error: any) {
            result.files.push({
                type: item.type,
                url: item.url,
                localUri: localPath,
                success: false,
                error: error.message,
            });
            completedCount++;
        }
    }

    onProgress?.(1, 'Complete');
    return result;
};

// Get local path for a file
export const getLocalFilePath = (filename: string): string => {
    return LESSON_DIR + filename;
};

// Check if a specific file exists locally
export const isFileDownloaded = async (filename: string): Promise<boolean> => {
    try {
        const uri = LESSON_DIR + filename;
        const fileInfo = await FileSystem.getInfoAsync(uri);
        return fileInfo.exists;
    } catch (error) {
        return false;
    }
};