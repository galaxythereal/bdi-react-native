import * as FileSystem from 'expo-file-system/legacy';

// @ts-ignore
const LESSON_DIR = (FileSystem.documentDirectory || FileSystem.cacheDirectory) + 'lessons/';

export const ensureDirExists = async () => {
    const dirInfo = await FileSystem.getInfoAsync(LESSON_DIR);
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(LESSON_DIR, { intermediates: true });
    }
};

export const getLocalLessonUri = (lessonId: string, extension: string = 'mp4') => {
    return LESSON_DIR + `${lessonId}.${extension}`;
};

export const isLessonDownloaded = async (lessonId: string): Promise<boolean> => {
    await ensureDirExists();
    const uri = getLocalLessonUri(lessonId);
    const fileInfo = await FileSystem.getInfoAsync(uri);
    return fileInfo.exists;
};

export const downloadLessonVideo = async (
    lessonId: string,
    videoUrl: string,
    onProgress?: (progress: number) => void
): Promise<string> => {
    await ensureDirExists();
    const localUri = getLocalLessonUri(lessonId);

    const downloadResumable = FileSystem.createDownloadResumable(
        videoUrl,
        localUri,
        {},
        (downloadProgress) => {
            const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
            if (onProgress) onProgress(progress);
        }
    );

    try {
        const result = await downloadResumable.downloadAsync();
        if (!result) throw new Error('Download failed');
        return result.uri;
    } catch (e) {
        console.error(e);
        throw e;
    }
};

export const deleteLessonDownload = async (lessonId: string) => {
    const uri = getLocalLessonUri(lessonId);
    await FileSystem.deleteAsync(uri, { idempotent: true });
};
