/**
 * Media Service for React Native
 * 
 * Handles media uploads, downloads, and URL management for the mobile app.
 * Works with the Cloudflare R2 backend configured in the Next.js API.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

// Constants from FileSystem - using type assertion for compatibility
// @ts-ignore - expo-file-system types may not match runtime
const cacheDirectory = ((FileSystem as any).cacheDirectory || '') as string;
// @ts-ignore - expo-file-system types may not match runtime
const documentDirectory = ((FileSystem as any).documentDirectory || '') as string;

// API Base URL - should match your Next.js deployment
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const R2_PUBLIC_URL = process.env.EXPO_PUBLIC_R2_URL || '';

// Media type configurations (mirror the web app)
export const MEDIA_CONFIG = {
  profile: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    dimensions: { width: 400, height: 400 },
  },
  thumbnail: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    dimensions: { width: 1280, height: 720 },
  },
  video: {
    maxSize: 5 * 1024 * 1024 * 1024, // 5GB
    allowedTypes: ['video/mp4', 'video/quicktime'],
  },
  image: {
    maxSize: 20 * 1024 * 1024, // 20MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  },
  audio: {
    maxSize: 100 * 1024 * 1024, // 100MB
    allowedTypes: ['audio/mpeg', 'audio/mp4', 'audio/wav'],
  },
  file: {
    maxSize: 100 * 1024 * 1024, // 100MB
    allowedTypes: ['application/pdf', 'application/msword'],
  },
} as const;

export type MediaType = keyof typeof MEDIA_CONFIG;

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}

/**
 * Get the full URL for a media file
 */
export function getMediaUrl(path: string | null | undefined): string {
  if (!path) return '';
  
  // Already a full URL
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('file://')) {
    return path;
  }
  
  // Construct R2 URL
  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL}/${path}`;
  }
  
  return path;
}

/**
 * Get URL for profile avatar with fallback
 */
export function getAvatarUrl(
  avatarUrl: string | null | undefined,
  name?: string | null,
  size: number = 200
): string {
  if (avatarUrl) {
    return getMediaUrl(avatarUrl);
  }
  
  // Generate initials-based avatar
  const initials = name
    ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';
  
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&size=${size}&background=8B1538&color=fff&bold=true`;
}

/**
 * Get URL for course thumbnail with fallback
 */
export function getThumbnailUrl(
  thumbnailUrl: string | null | undefined,
  courseTitle?: string
): string {
  if (thumbnailUrl) {
    return getMediaUrl(thumbnailUrl);
  }
  
  const title = courseTitle || 'Course';
  return `https://via.placeholder.com/1280x720/8B1538/ffffff?text=${encodeURIComponent(title.slice(0, 20))}`;
}

/**
 * Get authentication token for API requests
 */
async function getAuthToken(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch {
    return null;
  }
}

/**
 * Request permission to access media library
 */
export async function requestMediaPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

/**
 * Request permission to access camera
 */
export async function requestCameraPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  return status === 'granted';
}

/**
 * Pick an image from the gallery
 */
export async function pickImage(options?: {
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
}): Promise<ImagePicker.ImagePickerAsset | null> {
  const hasPermission = await requestMediaPermission();
  if (!hasPermission) {
    throw new Error('Media library permission not granted');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: options?.allowsEditing ?? true,
    aspect: options?.aspect ?? [1, 1],
    quality: options?.quality ?? 0.8,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  return result.assets[0];
}

/**
 * Take a photo with the camera
 */
export async function takePhoto(options?: {
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
}): Promise<ImagePicker.ImagePickerAsset | null> {
  const hasPermission = await requestCameraPermission();
  if (!hasPermission) {
    throw new Error('Camera permission not granted');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: options?.allowsEditing ?? true,
    aspect: options?.aspect ?? [1, 1],
    quality: options?.quality ?? 0.8,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  return result.assets[0];
}

/**
 * Pick a video from the gallery
 */
export async function pickVideo(): Promise<ImagePicker.ImagePickerAsset | null> {
  const hasPermission = await requestMediaPermission();
  if (!hasPermission) {
    throw new Error('Media library permission not granted');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    allowsEditing: false,
    quality: 1,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  return result.assets[0];
}

/**
 * Resize and compress an image
 */
export async function processImage(
  uri: string,
  options?: {
    width?: number;
    height?: number;
    compress?: number;
    format?: 'jpeg' | 'png';
  }
): Promise<string> {
  const actions: ImageManipulator.Action[] = [];
  
  if (options?.width || options?.height) {
    actions.push({
      resize: {
        width: options.width,
        height: options.height,
      },
    });
  }

  const result = await ImageManipulator.manipulateAsync(
    uri,
    actions,
    {
      compress: options?.compress ?? 0.8,
      format: options?.format === 'png' 
        ? ImageManipulator.SaveFormat.PNG 
        : ImageManipulator.SaveFormat.JPEG,
    }
  );

  return result.uri;
}

/**
 * Upload a file to the API
 */
export async function uploadFile(
  uri: string,
  mediaType: MediaType,
  options?: {
    entityId?: string;
    filename?: string;
    mimeType?: string;
    onProgress?: (progress: UploadProgress) => void;
  }
): Promise<UploadResult> {
  try {
    const token = await getAuthToken();
    if (!token) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      return { success: false, error: 'File not found' };
    }

    const config = MEDIA_CONFIG[mediaType];
    
    // Check file size
    if (fileInfo.size && fileInfo.size > config.maxSize) {
      const maxSizeMB = Math.round(config.maxSize / (1024 * 1024));
      return { success: false, error: `File too large. Maximum size: ${maxSizeMB}MB` };
    }

    // Determine filename and mime type
    const filename = options?.filename || uri.split('/').pop() || `file-${Date.now()}`;
    const extension = filename.split('.').pop()?.toLowerCase() || 'jpg';
    
    const mimeTypeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      mp3: 'audio/mpeg',
      m4a: 'audio/mp4',
      wav: 'audio/wav',
      pdf: 'application/pdf',
    };
    
    const mimeType = options?.mimeType || mimeTypeMap[extension] || 'application/octet-stream';

    // Create form data
    const formData = new FormData();
    formData.append('file', {
      uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
      name: filename,
      type: mimeType,
    } as any);
    formData.append('mediaType', mediaType);
    if (options?.entityId) {
      formData.append('entityId', options.entityId);
    }

    // Upload
    const response = await fetch(`${API_BASE_URL}/api/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return { success: false, error: data.error || 'Upload failed' };
    }

    return {
      success: true,
      url: data.url,
      key: data.key,
    };

  } catch (error: any) {
    console.error('Upload error:', error);
    return { success: false, error: error.message || 'Upload failed' };
  }
}

/**
 * Upload profile photo
 */
export async function uploadProfilePhoto(
  uri: string,
  userId?: string
): Promise<UploadResult> {
  // Process image to standard size
  const processedUri = await processImage(uri, {
    width: 400,
    height: 400,
    compress: 0.85,
    format: 'jpeg',
  });

  return uploadFile(processedUri, 'profile', {
    entityId: userId,
    filename: `profile-${Date.now()}.jpg`,
    mimeType: 'image/jpeg',
  });
}

/**
 * Upload course thumbnail
 */
export async function uploadThumbnail(
  uri: string,
  courseId: string
): Promise<UploadResult> {
  // Process image to standard size
  const processedUri = await processImage(uri, {
    width: 1280,
    height: 720,
    compress: 0.85,
    format: 'jpeg',
  });

  return uploadFile(processedUri, 'thumbnail', {
    entityId: courseId,
    filename: `thumbnail-${Date.now()}.jpg`,
    mimeType: 'image/jpeg',
  });
}

/**
 * Download a file for offline use
 */
export async function downloadMedia(
  url: string,
  localPath: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<{ success: boolean; localPath?: string; error?: string }> {
  try {
    const callback = onProgress
      ? (downloadProgress: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => {
          const percentage = downloadProgress.totalBytesExpectedToWrite > 0
            ? Math.round((downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100)
            : 0;
          onProgress({
            loaded: downloadProgress.totalBytesWritten,
            total: downloadProgress.totalBytesExpectedToWrite,
            percentage,
          });
        }
      : undefined;

    const downloadResult = await FileSystem.createDownloadResumable(
      url,
      localPath,
      {},
      callback
    ).downloadAsync();

    if (!downloadResult?.uri) {
      return { success: false, error: 'Download failed' };
    }

    return { success: true, localPath: downloadResult.uri };

  } catch (error: any) {
    console.error('Download error:', error);
    return { success: false, error: error.message || 'Download failed' };
  }
}

/**
 * Delete a local file
 */
export async function deleteLocalFile(localPath: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(localPath);
    if (info.exists) {
      await FileSystem.deleteAsync(localPath, { idempotent: true });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Get cached media URL or download it
 */
export async function getCachedMediaUrl(
  remoteUrl: string,
  cacheKey: string
): Promise<string> {
  const mediaCacheDir = `${cacheDirectory}media/`;
  const localPath = `${mediaCacheDir}${cacheKey}`;

  try {
    // Check if already cached
    const info = await FileSystem.getInfoAsync(localPath);
    if (info.exists) {
      return localPath;
    }

    // Ensure cache directory exists
    const dirInfo = await FileSystem.getInfoAsync(mediaCacheDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(mediaCacheDir, { intermediates: true });
    }

    // Download
    const result = await downloadMedia(remoteUrl, localPath);
    if (result.success && result.localPath) {
      return result.localPath;
    }

    // Fallback to remote URL
    return remoteUrl;

  } catch {
    return remoteUrl;
  }
}

/**
 * Clear media cache
 */
export async function clearMediaCache(): Promise<void> {
  const mediaCacheDir = `${cacheDirectory}media/`;
  try {
    await FileSystem.deleteAsync(mediaCacheDir, { idempotent: true });
  } catch {
    // Ignore errors
  }
}

/**
 * Get cache size
 */
export async function getMediaCacheSize(): Promise<number> {
  const mediaCacheDir = `${cacheDirectory}media/`;
  try {
    const info = await FileSystem.getInfoAsync(mediaCacheDir);
    if (info.exists && 'size' in info) {
      return info.size || 0;
    }
    return 0;
  } catch {
    return 0;
  }
}
