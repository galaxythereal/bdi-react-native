// Comprehensive Offline Manager for LMS
// Handles caching and downloading of all content types: videos, quizzes, text, PDFs, audio, images

import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// CONSTANTS
// ============================================================================

// @ts-ignore - expo-file-system types may not match runtime
const BASE_DIR = ((FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || '') + 'offline/';
const VIDEOS_DIR = BASE_DIR + 'videos/';
const AUDIO_DIR = BASE_DIR + 'audio/';
const PDFS_DIR = BASE_DIR + 'pdfs/';
const IMAGES_DIR = BASE_DIR + 'images/';
const FILES_DIR = BASE_DIR + 'files/';

// Storage keys
const OFFLINE_COURSES_KEY = '@offline_courses';
const OFFLINE_LESSONS_KEY = '@offline_lessons';
const OFFLINE_ENROLLMENTS_KEY = '@offline_enrollments';
const DOWNLOAD_QUEUE_KEY = '@download_queue';
const NETWORK_STATUS_KEY = '@network_status';

// ============================================================================
// TYPES
// ============================================================================

export interface OfflineCourse {
    id: string;
    title: string;
    description: string;
    thumbnail_url: string | null;
    thumbnail_local?: string | null;
    slug: string;
    created_at: string;
    downloadedAt: string;
    totalSize: number;
    modules: OfflineModule[];
    enrollmentProgress?: number;
}

export interface OfflineModule {
    id: string;
    title: string;
    order_index: number;
    lessons: OfflineLesson[];
}

export interface OfflineLesson {
    id: string;
    title: string;
    slug: string;
    content_type: 'video' | 'text' | 'quiz' | 'image' | 'file' | 'audio';
    order_index: number;
    is_preview: boolean;
    
    // Content based on type
    video_url: string | null;
    video_local?: string | null;
    video_provider?: 'youtube' | 'vimeo' | 'wistia' | 'direct';
    
    content_html: string | null;
    
    quiz_data?: any;
    
    description?: string | null;
    duration?: number | null;
    
    // Blocks for complex lessons
    blocks?: OfflineBlock[];
    
    // Download metadata
    downloadStatus: 'pending' | 'downloading' | 'completed' | 'failed' | 'not_downloaded';
    downloadProgress: number;
    fileSize: number;
    error?: string;
}

export interface OfflineBlock {
    id: string;
    type: 'video' | 'text' | 'quiz' | 'image' | 'file' | 'audio';
    title?: string;
    order_index: number;
    content: any;
    localUri?: string;
}

export interface DownloadQueueItem {
    id: string;
    courseId: string;
    lessonId: string;
    type: 'video' | 'audio' | 'pdf' | 'image' | 'file';
    url: string;
    filename: string;
    priority: number;
    status: 'pending' | 'downloading' | 'completed' | 'failed';
    progress: number;
    retries: number;
    error?: string;
    createdAt: string;
}

export interface OfflineStats {
    totalCourses: number;
    totalLessons: number;
    totalSize: number;
    lastSyncedAt: string | null;
    isOnline: boolean;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

let isInitialized = false;
const activeDownloads = new Map<string, any>();

/**
 * Initialize offline storage directories
 */
export const initializeOfflineStorage = async (): Promise<void> => {
    if (isInitialized) return;
    
    try {
        const dirs = [BASE_DIR, VIDEOS_DIR, AUDIO_DIR, PDFS_DIR, IMAGES_DIR, FILES_DIR];
        
        for (const dir of dirs) {
            const dirInfo = await FileSystem.getInfoAsync(dir);
            if (!dirInfo.exists) {
                await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
            }
        }
        
        isInitialized = true;
        console.log('Offline storage initialized');
    } catch (error) {
        console.error('Failed to initialize offline storage:', error);
        throw error;
    }
};

// ============================================================================
// NETWORK STATUS
// ============================================================================

let isOnline = true;

/**
 * Start monitoring network status (simplified - use fetch to check)
 */
export const startNetworkMonitoring = (): void => {
    // Check periodically
    const checkNetwork = async () => {
        isOnline = await checkIsOnline();
    };
    checkNetwork();
    // Check every 30 seconds in background (could be improved with actual NetInfo package)
    setInterval(checkNetwork, 30000);
};

/**
 * Stop monitoring network status
 */
export const stopNetworkMonitoring = (): void => {
    // No-op in simplified version
};

/**
 * Check if device is currently online using a simple fetch test
 */
export const checkIsOnline = async (): Promise<boolean> => {
    try {
        // Try to fetch a small resource to verify connectivity
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch('https://www.google.com/generate_204', {
            method: 'HEAD',
            signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        isOnline = response.ok || response.status === 204;
        return isOnline;
    } catch {
        isOnline = false;
        return false;
    }
};

/**
 * Get current online status (cached)
 */
export const getIsOnline = (): boolean => isOnline;

// ============================================================================
// COURSE OFFLINE STORAGE
// ============================================================================

/**
 * Save course data for offline access (metadata only, no files)
 */
export const saveCourseOffline = async (
    course: any,
    enrollmentProgress: number = 0
): Promise<void> => {
    await initializeOfflineStorage();
    
    try {
        const offlineCourse: OfflineCourse = {
            id: course.id,
            title: course.title,
            description: course.description,
            thumbnail_url: course.thumbnail_url,
            slug: course.slug,
            created_at: course.created_at,
            downloadedAt: new Date().toISOString(),
            totalSize: 0,
            enrollmentProgress,
            modules: (course.modules || []).map((mod: any) => ({
                id: mod.id,
                title: mod.title,
                order_index: mod.order_index,
                lessons: (mod.lessons || []).map((lesson: any) => ({
                    id: lesson.id,
                    title: lesson.title,
                    slug: lesson.slug,
                    content_type: lesson.content_type,
                    order_index: lesson.order_index,
                    is_preview: lesson.is_preview,
                    video_url: lesson.video_url,
                    video_provider: lesson.video_provider,
                    content_html: lesson.content_html,
                    quiz_data: lesson.quiz_data,
                    description: lesson.description,
                    duration: lesson.duration,
                    blocks: lesson.blocks,
                    downloadStatus: 'not_downloaded',
                    downloadProgress: 0,
                    fileSize: 0,
                })),
            })),
        };
        
        // Get existing courses
        const existingCourses = await getOfflineCourses();
        const courseIndex = existingCourses.findIndex(c => c.id === course.id);
        
        if (courseIndex >= 0) {
            // Update existing - preserve download status
            const existing = existingCourses[courseIndex];
            offlineCourse.totalSize = existing.totalSize;
            offlineCourse.modules = offlineCourse.modules.map((mod, mi) => ({
                ...mod,
                lessons: mod.lessons.map((lesson, li) => {
                    const existingLesson = existing.modules[mi]?.lessons[li];
                    if (existingLesson && existingLesson.id === lesson.id) {
                        return {
                            ...lesson,
                            video_local: existingLesson.video_local,
                            downloadStatus: existingLesson.downloadStatus,
                            downloadProgress: existingLesson.downloadProgress,
                            fileSize: existingLesson.fileSize,
                            blocks: lesson.blocks?.map((block, bi) => {
                                const existingBlock = existingLesson.blocks?.[bi];
                                return {
                                    ...block,
                                    localUri: existingBlock?.localUri,
                                };
                            }),
                        };
                    }
                    return lesson;
                }),
            }));
            existingCourses[courseIndex] = offlineCourse;
        } else {
            existingCourses.push(offlineCourse);
        }
        
        await AsyncStorage.setItem(OFFLINE_COURSES_KEY, JSON.stringify(existingCourses));
    } catch (error) {
        console.error('Failed to save course offline:', error);
        throw error;
    }
};

/**
 * Get all offline courses
 */
export const getOfflineCourses = async (): Promise<OfflineCourse[]> => {
    try {
        const data = await AsyncStorage.getItem(OFFLINE_COURSES_KEY);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('Failed to get offline courses:', error);
        return [];
    }
};

/**
 * Get a specific offline course
 */
export const getOfflineCourse = async (courseId: string): Promise<OfflineCourse | null> => {
    const courses = await getOfflineCourses();
    return courses.find(c => c.id === courseId) || null;
};

/**
 * Check if a course is available offline
 */
export const isCourseOffline = async (courseId: string): Promise<boolean> => {
    const course = await getOfflineCourse(courseId);
    return course !== null;
};

/**
 * Remove course from offline storage
 */
export const removeCourseOffline = async (courseId: string): Promise<void> => {
    try {
        const courses = await getOfflineCourses();
        const course = courses.find(c => c.id === courseId);
        
        if (course) {
            // Delete all downloaded files for this course
            for (const module of course.modules) {
                for (const lesson of module.lessons) {
                    if (lesson.video_local) {
                        try {
                            await FileSystem.deleteAsync(lesson.video_local, { idempotent: true });
                        } catch {}
                    }
                    // Delete block files
                    for (const block of lesson.blocks || []) {
                        if (block.localUri) {
                            try {
                                await FileSystem.deleteAsync(block.localUri, { idempotent: true });
                            } catch {}
                        }
                    }
                }
            }
        }
        
        const filteredCourses = courses.filter(c => c.id !== courseId);
        await AsyncStorage.setItem(OFFLINE_COURSES_KEY, JSON.stringify(filteredCourses));
    } catch (error) {
        console.error('Failed to remove course offline:', error);
        throw error;
    }
};

/**
 * Delete offline course (alias for removeCourseOffline)
 */
export const deleteOfflineCourse = removeCourseOffline;

// ============================================================================
// FILE DOWNLOADS
// ============================================================================

/**
 * Get the local path for a file
 */
export const getLocalPath = (
    type: 'video' | 'audio' | 'pdf' | 'image' | 'file',
    filename: string
): string => {
    const dirs: Record<string, string> = {
        video: VIDEOS_DIR,
        audio: AUDIO_DIR,
        pdf: PDFS_DIR,
        image: IMAGES_DIR,
        file: FILES_DIR,
    };
    return (dirs[type] || FILES_DIR) + filename;
};

/**
 * Get file extension from URL
 */
const getExtensionFromUrl = (url: string, defaultExt: string = 'file'): string => {
    try {
        const pathname = new URL(url).pathname;
        const ext = pathname.split('.').pop()?.split('?')[0]?.toLowerCase();
        return ext && ext.length <= 5 ? ext : defaultExt;
    } catch {
        return defaultExt;
    }
};

/**
 * Download a single file with progress tracking
 */
export const downloadFile = async (
    url: string,
    localPath: string,
    onProgress?: (progress: number) => void
): Promise<{ uri: string; size: number }> => {
    await initializeOfflineStorage();
    
    // Clean URL
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'https://' + cleanUrl;
    }
    
    const downloadResumable = FileSystem.createDownloadResumable(
        cleanUrl,
        localPath,
        {
            headers: {
                'Accept': '*/*',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
            },
        },
        (downloadProgress) => {
            const progress = downloadProgress.totalBytesExpectedToWrite > 0
                ? downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite
                : 0;
            onProgress?.(Math.min(progress, 1));
        }
    );
    
    const result = await downloadResumable.downloadAsync();
    
    if (!result || !result.uri) {
        throw new Error('Download failed - no result');
    }
    
    // @ts-ignore
    const fileInfo = await FileSystem.getInfoAsync(result.uri, { size: true });
    const size = fileInfo.exists && 'size' in fileInfo ? (fileInfo as any).size : 0;
    
    return { uri: result.uri, size };
};

/**
 * Check if a file exists locally
 */
export const fileExists = async (localPath: string): Promise<boolean> => {
    try {
        const info = await FileSystem.getInfoAsync(localPath);
        return info.exists;
    } catch {
        return false;
    }
};

/**
 * Delete a local file
 */
export const deleteFile = async (localPath: string): Promise<void> => {
    try {
        await FileSystem.deleteAsync(localPath, { idempotent: true });
    } catch (error) {
        console.error('Failed to delete file:', error);
    }
};

// ============================================================================
// LESSON DOWNLOAD
// ============================================================================

export interface LessonDownloadProgress {
    lessonId: string;
    status: 'pending' | 'downloading' | 'completed' | 'failed';
    progress: number;
    currentFile: string;
    totalFiles: number;
    completedFiles: number;
    error?: string;
}

/**
 * Download all content for a lesson (video, audio, PDFs, images in blocks)
 */
export const downloadLesson = async (
    courseId: string,
    lessonId: string,
    lesson: OfflineLesson,
    onProgress?: (progress: LessonDownloadProgress) => void
): Promise<{ success: boolean; totalSize: number; error?: string }> => {
    await initializeOfflineStorage();
    
    const progress: LessonDownloadProgress = {
        lessonId,
        status: 'downloading',
        progress: 0,
        currentFile: '',
        totalFiles: 0,
        completedFiles: 0,
    };
    
    try {
        // Collect all downloadable items
        interface DownloadItem {
            type: 'video' | 'audio' | 'pdf' | 'image' | 'file';
            url: string;
            filename: string;
            blockIndex?: number;
        }
        
        const downloadItems: DownloadItem[] = [];
        
        // Main video (direct URLs only)
        if (lesson.video_url && lesson.video_provider === 'direct') {
            const ext = getExtensionFromUrl(lesson.video_url, 'mp4');
            downloadItems.push({
                type: 'video',
                url: lesson.video_url,
                filename: `${lessonId}_main.${ext}`,
            });
        }
        
        // Blocks content
        if (lesson.blocks) {
            lesson.blocks.forEach((block, index) => {
                if (!block.content?.url) return;
                
                let type: 'video' | 'audio' | 'pdf' | 'image' | 'file' = 'file';
                let defaultExt = 'file';
                
                switch (block.type) {
                    case 'video':
                        // Only download direct videos
                        if (block.content.provider && block.content.provider !== 'direct') return;
                        type = 'video';
                        defaultExt = 'mp4';
                        break;
                    case 'audio':
                        type = 'audio';
                        defaultExt = 'mp3';
                        break;
                    case 'image':
                        type = 'image';
                        defaultExt = 'jpg';
                        break;
                    case 'file':
                        type = 'file';
                        // Detect PDF
                        if (block.content.url.toLowerCase().includes('.pdf')) {
                            type = 'pdf';
                            defaultExt = 'pdf';
                        }
                        break;
                    default:
                        return;
                }
                
                const ext = getExtensionFromUrl(block.content.url, defaultExt);
                downloadItems.push({
                    type,
                    url: block.content.url,
                    filename: `${lessonId}_block_${index}.${ext}`,
                    blockIndex: index,
                });
            });
        }
        
        progress.totalFiles = downloadItems.length;
        
        if (downloadItems.length === 0) {
            // No files to download (text/quiz only) - mark as complete
            progress.status = 'completed';
            progress.progress = 1;
            onProgress?.(progress);
            
            await updateLessonDownloadStatus(courseId, lessonId, 'completed', 1, 0);
            return { success: true, totalSize: 0 };
        }
        
        let totalSize = 0;
        const localUris: Record<string, string> = {};
        
        // Download each file
        for (let i = 0; i < downloadItems.length; i++) {
            const item = downloadItems[i];
            progress.currentFile = item.filename;
            onProgress?.(progress);
            
            const localPath = getLocalPath(item.type, item.filename);
            
            try {
                const result = await downloadFile(item.url, localPath, (fileProgress) => {
                    progress.progress = (i + fileProgress) / downloadItems.length;
                    onProgress?.(progress);
                });
                
                totalSize += result.size;
                localUris[item.filename] = result.uri;
                
                // Store the main video local path (not block videos)
                if (item.type === 'video' && item.blockIndex === undefined) {
                    await updateLessonLocalVideo(courseId, lessonId, result.uri);
                }
                
                // Store block local URIs
                if (item.blockIndex !== undefined) {
                    await updateBlockLocalUri(courseId, lessonId, item.blockIndex, result.uri);
                }
                
                progress.completedFiles++;
            } catch (error: any) {
                console.error(`Failed to download ${item.filename}:`, error);
                // Continue with other files
            }
        }
        
        progress.status = 'completed';
        progress.progress = 1;
        onProgress?.(progress);
        
        await updateLessonDownloadStatus(courseId, lessonId, 'completed', 1, totalSize);
        return { success: true, totalSize };
        
    } catch (error: any) {
        progress.status = 'failed';
        progress.error = error.message;
        onProgress?.(progress);
        
        await updateLessonDownloadStatus(courseId, lessonId, 'failed', 0, 0, error.message);
        return { success: false, totalSize: 0, error: error.message };
    }
};

/**
 * Update lesson download status in stored course data
 */
const updateLessonDownloadStatus = async (
    courseId: string,
    lessonId: string,
    status: OfflineLesson['downloadStatus'],
    progress: number,
    fileSize: number,
    error?: string
): Promise<void> => {
    const courses = await getOfflineCourses();
    const courseIndex = courses.findIndex(c => c.id === courseId);
    
    if (courseIndex < 0) return;
    
    const course = courses[courseIndex];
    
    for (const module of course.modules) {
        const lesson = module.lessons.find(l => l.id === lessonId);
        if (lesson) {
            lesson.downloadStatus = status;
            lesson.downloadProgress = progress;
            lesson.fileSize = fileSize;
            lesson.error = error;
            
            // Recalculate total course size
            course.totalSize = course.modules.reduce((total, mod) => 
                total + mod.lessons.reduce((lessonTotal, l) => lessonTotal + (l.fileSize || 0), 0)
            , 0);
            
            break;
        }
    }
    
    courses[courseIndex] = course;
    await AsyncStorage.setItem(OFFLINE_COURSES_KEY, JSON.stringify(courses));
};

/**
 * Update lesson local video path
 */
const updateLessonLocalVideo = async (
    courseId: string,
    lessonId: string,
    localUri: string
): Promise<void> => {
    const courses = await getOfflineCourses();
    const courseIndex = courses.findIndex(c => c.id === courseId);
    
    if (courseIndex < 0) return;
    
    for (const module of courses[courseIndex].modules) {
        const lesson = module.lessons.find(l => l.id === lessonId);
        if (lesson) {
            lesson.video_local = localUri;
            break;
        }
    }
    
    await AsyncStorage.setItem(OFFLINE_COURSES_KEY, JSON.stringify(courses));
};

/**
 * Update block local URI
 */
const updateBlockLocalUri = async (
    courseId: string,
    lessonId: string,
    blockIndex: number,
    localUri: string
): Promise<void> => {
    const courses = await getOfflineCourses();
    const courseIndex = courses.findIndex(c => c.id === courseId);
    
    if (courseIndex < 0) return;
    
    for (const module of courses[courseIndex].modules) {
        const lesson = module.lessons.find(l => l.id === lessonId);
        if (lesson && lesson.blocks && lesson.blocks[blockIndex]) {
            lesson.blocks[blockIndex].localUri = localUri;
            break;
        }
    }
    
    await AsyncStorage.setItem(OFFLINE_COURSES_KEY, JSON.stringify(courses));
};

// ============================================================================
// COURSE DOWNLOAD (FULL)
// ============================================================================

export interface CourseDownloadProgress {
    courseId: string;
    status: 'pending' | 'downloading' | 'completed' | 'failed' | 'cancelled';
    progress: number;
    currentLesson: string;
    totalLessons: number;
    completedLessons: number;
    totalSize: number;
    error?: string;
}

/**
 * Download entire course for offline use
 */
export const downloadCourseForOffline = async (
    course: any,
    onProgress?: (progress: CourseDownloadProgress) => void
): Promise<{ success: boolean; totalSize: number; error?: string }> => {
    // First save course metadata
    await saveCourseOffline(course);
    
    const progress: CourseDownloadProgress = {
        courseId: course.id,
        status: 'downloading',
        progress: 0,
        currentLesson: '',
        totalLessons: 0,
        completedLessons: 0,
        totalSize: 0,
    };
    
    try {
        // Flatten all lessons
        const allLessons: { moduleIndex: number; lesson: any }[] = [];
        (course.modules || []).forEach((module: any, moduleIndex: number) => {
            (module.lessons || []).forEach((lesson: any) => {
                allLessons.push({ moduleIndex, lesson });
            });
        });
        
        progress.totalLessons = allLessons.length;
        onProgress?.(progress);
        
        let totalSize = 0;
        
        for (let i = 0; i < allLessons.length; i++) {
            const { lesson } = allLessons[i];
            progress.currentLesson = lesson.title;
            progress.progress = i / allLessons.length;
            onProgress?.(progress);
            
            // Download lesson content
            const result = await downloadLesson(
                course.id,
                lesson.id,
                lesson as OfflineLesson,
                (lessonProgress) => {
                    const overallProgress = (i + lessonProgress.progress) / allLessons.length;
                    progress.progress = overallProgress;
                    onProgress?.(progress);
                }
            );
            
            totalSize += result.totalSize;
            progress.completedLessons++;
            progress.totalSize = totalSize;
        }
        
        progress.status = 'completed';
        progress.progress = 1;
        onProgress?.(progress);
        
        return { success: true, totalSize };
        
    } catch (error: any) {
        progress.status = 'failed';
        progress.error = error.message;
        onProgress?.(progress);
        
        return { success: false, totalSize: 0, error: error.message };
    }
};

// ============================================================================
// DELETE LESSON DOWNLOAD
// ============================================================================

/**
 * Delete downloaded content for a specific lesson
 */
export const deleteLessonDownload = async (
    courseId: string,
    lessonId: string
): Promise<void> => {
    const courses = await getOfflineCourses();
    const courseIndex = courses.findIndex(c => c.id === courseId);
    
    if (courseIndex < 0) return;
    
    const course = courses[courseIndex];
    
    for (const module of course.modules) {
        const lesson = module.lessons.find(l => l.id === lessonId);
        if (lesson) {
            // Delete main video
            if (lesson.video_local) {
                await deleteFile(lesson.video_local);
                lesson.video_local = undefined;
            }
            
            // Delete block files
            if (lesson.blocks) {
                for (const block of lesson.blocks) {
                    if (block.localUri) {
                        await deleteFile(block.localUri);
                        block.localUri = undefined;
                    }
                }
            }
            
            lesson.downloadStatus = 'not_downloaded';
            lesson.downloadProgress = 0;
            lesson.fileSize = 0;
            lesson.error = undefined;
            
            break;
        }
    }
    
    // Recalculate total size
    course.totalSize = course.modules.reduce((total, mod) => 
        total + mod.lessons.reduce((lessonTotal, l) => lessonTotal + (l.fileSize || 0), 0)
    , 0);
    
    courses[courseIndex] = course;
    await AsyncStorage.setItem(OFFLINE_COURSES_KEY, JSON.stringify(courses));
};

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get offline storage statistics
 */
export const getOfflineStats = async (): Promise<OfflineStats> => {
    const courses = await getOfflineCourses();
    
    let totalLessons = 0;
    let totalSize = 0;
    
    for (const course of courses) {
        totalSize += course.totalSize || 0;
        for (const module of course.modules) {
            totalLessons += module.lessons.filter(l => l.downloadStatus === 'completed').length;
        }
    }
    
    return {
        totalCourses: courses.length,
        totalLessons,
        totalSize,
        lastSyncedAt: courses.length > 0 
            ? courses.reduce((latest, c) => c.downloadedAt > latest ? c.downloadedAt : latest, '')
            : null,
        isOnline,
    };
};

/**
 * Get total storage used by offline content
 */
export const getOfflineStorageUsed = async (): Promise<number> => {
    const stats = await getOfflineStats();
    return stats.totalSize;
};

/**
 * Verify and update download status for all courses by checking actual files
 * This reconciles the stored status with what's actually on disk
 */
export const verifyDownloadStatuses = async (): Promise<void> => {
    try {
        const courses = await getOfflineCourses();
        let modified = false;
        
        for (const course of courses) {
            for (const module of course.modules) {
                for (const lesson of module.lessons) {
                    // Check if video_local exists
                    if (lesson.video_local) {
                        const exists = await fileExists(lesson.video_local);
                        if (exists && lesson.downloadStatus !== 'completed') {
                            lesson.downloadStatus = 'completed';
                            modified = true;
                        } else if (!exists && lesson.downloadStatus === 'completed') {
                            lesson.downloadStatus = 'not_downloaded';
                            lesson.video_local = undefined;
                            modified = true;
                        }
                    } else if (lesson.downloadStatus === 'completed' && lesson.content_type === 'video') {
                        // If marked complete but no local path, reset status
                        lesson.downloadStatus = 'not_downloaded';
                        modified = true;
                    }
                    
                    // For non-video content types (quiz, text), they're "downloaded" when saved
                    if (lesson.content_type === 'quiz' || lesson.content_type === 'text') {
                        if (lesson.quiz_data || lesson.content_html) {
                            lesson.downloadStatus = 'completed';
                            modified = true;
                        }
                    }
                }
            }
        }
        
        if (modified) {
            await AsyncStorage.setItem(OFFLINE_COURSES_KEY, JSON.stringify(courses));
        }
    } catch (error) {
        console.error('Failed to verify download statuses:', error);
    }
};

// ============================================================================
// CLEAR ALL OFFLINE DATA
// ============================================================================

/**
 * Clear all offline data and files
 */
export const clearAllOfflineData = async (): Promise<void> => {
    try {
        // Delete all directories
        const dirs = [VIDEOS_DIR, AUDIO_DIR, PDFS_DIR, IMAGES_DIR, FILES_DIR];
        
        for (const dir of dirs) {
            try {
                await FileSystem.deleteAsync(dir, { idempotent: true });
            } catch {}
        }
        
        // Recreate directories
        for (const dir of dirs) {
            await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        }
        
        // Clear storage
        await AsyncStorage.multiRemove([
            OFFLINE_COURSES_KEY,
            OFFLINE_LESSONS_KEY,
            OFFLINE_ENROLLMENTS_KEY,
            DOWNLOAD_QUEUE_KEY,
        ]);
        
        console.log('All offline data cleared');
    } catch (error) {
        console.error('Failed to clear offline data:', error);
        throw error;
    }
};

// ============================================================================
// ENROLLMENT SYNC
// ============================================================================

/**
 * Save enrollments for offline access
 */
export const saveEnrollmentsOffline = async (enrollments: any[]): Promise<void> => {
    try {
        await AsyncStorage.setItem(OFFLINE_ENROLLMENTS_KEY, JSON.stringify({
            data: enrollments,
            savedAt: new Date().toISOString(),
        }));
    } catch (error) {
        console.error('Failed to save enrollments offline:', error);
    }
};

/**
 * Get offline enrollments
 */
export const getOfflineEnrollments = async (): Promise<any[]> => {
    try {
        const data = await AsyncStorage.getItem(OFFLINE_ENROLLMENTS_KEY);
        if (data) {
            const parsed = JSON.parse(data);
            return parsed.data || [];
        }
        return [];
    } catch (error) {
        console.error('Failed to get offline enrollments:', error);
        return [];
    }
};

// ============================================================================
// QUIZ PROGRESS SYNC (for offline quiz attempts)
// ============================================================================

const QUIZ_PROGRESS_KEY = '@offline_quiz_progress';

export interface OfflineQuizAttempt {
    lessonId: string;
    courseId: string;
    quizId: string;
    answers: Record<string, any>;
    score: number;
    passed: boolean;
    completedAt: string;
    synced: boolean;
}

/**
 * Save quiz attempt for later sync
 */
export const saveQuizAttemptOffline = async (attempt: OfflineQuizAttempt): Promise<void> => {
    try {
        const data = await AsyncStorage.getItem(QUIZ_PROGRESS_KEY);
        const attempts: OfflineQuizAttempt[] = data ? JSON.parse(data) : [];
        attempts.push(attempt);
        await AsyncStorage.setItem(QUIZ_PROGRESS_KEY, JSON.stringify(attempts));
    } catch (error) {
        console.error('Failed to save quiz attempt:', error);
    }
};

/**
 * Get unsynced quiz attempts
 */
export const getUnsyncedQuizAttempts = async (): Promise<OfflineQuizAttempt[]> => {
    try {
        const data = await AsyncStorage.getItem(QUIZ_PROGRESS_KEY);
        const attempts: OfflineQuizAttempt[] = data ? JSON.parse(data) : [];
        return attempts.filter(a => !a.synced);
    } catch (error) {
        console.error('Failed to get quiz attempts:', error);
        return [];
    }
};

/**
 * Mark quiz attempts as synced
 */
export const markQuizAttemptsSynced = async (lessonIds: string[]): Promise<void> => {
    try {
        const data = await AsyncStorage.getItem(QUIZ_PROGRESS_KEY);
        const attempts: OfflineQuizAttempt[] = data ? JSON.parse(data) : [];
        
        const updated = attempts.map(a => ({
            ...a,
            synced: lessonIds.includes(a.lessonId) ? true : a.synced,
        }));
        
        await AsyncStorage.setItem(QUIZ_PROGRESS_KEY, JSON.stringify(updated));
    } catch (error) {
        console.error('Failed to mark quiz attempts synced:', error);
    }
};

// ============================================================================
// OFFLINE DATA SYNC
// ============================================================================

/**
 * Sync offline data when coming back online
 * - Syncs quiz attempts to server
 * - Updates enrollment progress
 * - Refreshes course data
 */
export const syncOfflineData = async (): Promise<{ synced: number; errors: string[] }> => {
    const result = { synced: 0, errors: [] as string[] };
    
    try {
        const online = await checkIsOnline();
        if (!online) {
            return { synced: 0, errors: ['No network connection'] };
        }
        
        // 1. Sync quiz attempts
        const unsyncedAttempts = await getUnsyncedQuizAttempts();
        if (unsyncedAttempts.length > 0) {
            console.log(`Syncing ${unsyncedAttempts.length} quiz attempts...`);
            
            // Import supabase dynamically to avoid circular dependencies
            const { supabase } = await import('../../lib/supabase');
            const { data: { user } } = await supabase.auth.getUser();
            
            if (user) {
                const syncedIds: string[] = [];
                
                for (const attempt of unsyncedAttempts) {
                    try {
                        // Try to update or insert quiz attempt
                        const { error } = await supabase
                            .from('quiz_attempts')
                            .upsert({
                                user_id: user.id,
                                lesson_id: attempt.lessonId,
                                course_id: attempt.courseId,
                                quiz_id: attempt.quizId,
                                answers: attempt.answers,
                                score: attempt.score,
                                passed: attempt.passed,
                                completed_at: attempt.completedAt,
                            }, { onConflict: 'user_id,lesson_id' });
                        
                        if (!error) {
                            syncedIds.push(attempt.lessonId);
                            result.synced++;
                        } else {
                            console.warn('Failed to sync quiz attempt:', error);
                            result.errors.push(`Quiz sync failed: ${error.message}`);
                        }
                    } catch (e: any) {
                        result.errors.push(`Quiz sync error: ${e.message}`);
                    }
                }
                
                // Mark synced attempts
                if (syncedIds.length > 0) {
                    await markQuizAttemptsSynced(syncedIds);
                }
            }
        }
        
        // 2. Sync enrollment progress from offline enrollments
        const offlineEnrollments = await getOfflineEnrollments();
        if (offlineEnrollments.length > 0) {
            const { supabase } = await import('../../lib/supabase');
            const { data: { user } } = await supabase.auth.getUser();
            
            if (user) {
                for (const enrollment of offlineEnrollments) {
                    if (enrollment.progress > 0) {
                        try {
                            await supabase
                                .from('enrollments')
                                .update({
                                    progress: enrollment.progress,
                                    last_accessed_at: new Date().toISOString(),
                                })
                                .eq('course_id', enrollment.course_id)
                                .eq('user_id', user.id);
                        } catch (e: any) {
                            console.warn('Failed to sync enrollment progress:', e);
                        }
                    }
                }
            }
        }
        
        console.log(`Sync complete: ${result.synced} items synced`);
        return result;
    } catch (error: any) {
        console.error('Sync failed:', error);
        result.errors.push(error.message);
        return result;
    }
};

// ============================================================================
// EXPORTS SUMMARY
// ============================================================================

export default {
    // Initialization
    initializeOfflineStorage,
    
    // Network
    startNetworkMonitoring,
    stopNetworkMonitoring,
    checkIsOnline,
    getIsOnline,
    
    // Courses
    saveCourseOffline,
    getOfflineCourses,
    getOfflineCourse,
    isCourseOffline,
    removeCourseOffline,
    
    // Downloads
    downloadLesson,
    downloadCourseForOffline,
    deleteLessonDownload,
    downloadFile,
    fileExists,
    deleteFile,
    getLocalPath,
    
    // Stats
    getOfflineStats,
    getOfflineStorageUsed,
    
    // Clear
    clearAllOfflineData,
    
    // Enrollments
    saveEnrollmentsOffline,
    getOfflineEnrollments,
    
    // Quiz
    saveQuizAttemptOffline,
    getUnsyncedQuizAttempts,
    markQuizAttemptsSynced,
};
