/**
 * Image Upload Component for React Native
 * 
 * A reusable component for uploading images in lessons/blocks.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS } from '../../lib/constants';
import {
  pickImage,
  uploadFile,
  getMediaUrl,
} from '../../services/mediaService';

interface ImageUploadProps {
  value?: string | null;
  onChange?: (url: string | null) => void;
  entityId?: string;
  label?: string;
  aspectRatio?: number; // width / height
  disabled?: boolean;
  maxSizeMB?: number;
}

export function ImageUpload({
  value,
  onChange,
  entityId,
  label = 'Upload Image',
  aspectRatio = 16 / 9,
  disabled = false,
  maxSizeMB = 10,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const displayUrl = localPreview || (value ? getMediaUrl(value) : null);

  const handlePick = useCallback(async () => {
    if (disabled || uploading) return;

    try {
      const asset = await pickImage({
        allowsEditing: true,
        aspect: aspectRatio >= 1 ? [16, 9] : [9, 16],
        quality: 0.85,
      });

      if (!asset) return;

      // Check file size
      if (asset.fileSize && asset.fileSize > maxSizeMB * 1024 * 1024) {
        Alert.alert('File Too Large', `Maximum size is ${maxSizeMB}MB`);
        return;
      }

      setLocalPreview(asset.uri);
      setUploading(true);
      setProgress(0);

      const result = await uploadFile(asset.uri, 'image', {
        entityId,
        onProgress: (p) => setProgress(p.percentage),
      });

      if (result.success && result.url) {
        onChange?.(result.url);
        setLocalPreview(null);
      } else {
        Alert.alert('Upload Failed', result.error || 'Failed to upload image');
        setLocalPreview(null);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to pick image');
      setLocalPreview(null);
    } finally {
      setUploading(false);
    }
  }, [disabled, uploading, entityId, onChange, aspectRatio, maxSizeMB]);

  const handleRemove = useCallback(() => {
    Alert.alert(
      'Remove Image',
      'Are you sure you want to remove this image?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setLocalPreview(null);
            onChange?.(null);
          },
        },
      ]
    );
  }, [onChange]);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <TouchableOpacity
        style={[
          styles.uploadArea,
          { aspectRatio },
          displayUrl && styles.hasImage,
          disabled && styles.disabled,
        ]}
        onPress={displayUrl ? undefined : handlePick}
        disabled={disabled || uploading}
        activeOpacity={0.8}
      >
        {displayUrl ? (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: displayUrl }}
              style={styles.image}
              resizeMode="cover"
            />
            
            {/* Action buttons */}
            {!uploading && !disabled && (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handlePick}
                >
                  <Ionicons name="swap-horizontal" size={20} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.removeButton]}
                  onPress={handleRemove}
                >
                  <Ionicons name="trash" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="image-outline" size={40} color={COLORS.textSecondary} />
            <Text style={styles.placeholderText}>Tap to select image</Text>
            <Text style={styles.placeholderHint}>Max {maxSizeMB}MB • JPG, PNG, WebP</Text>
          </View>
        )}

        {/* Upload overlay */}
        {uploading && (
          <View style={styles.uploadingOverlay}>
            <ActivityIndicator color="#fff" size="large" />
            <Text style={styles.uploadingText}>Uploading... {Math.round(progress)}%</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  uploadArea: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  hasImage: {
    borderStyle: 'solid',
    borderWidth: 0,
  },
  disabled: {
    opacity: 0.5,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  placeholderHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  imageContainer: {
    flex: 1,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  actions: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButton: {
    backgroundColor: COLORS.error,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  uploadingText: {
    color: '#fff',
    fontSize: 14,
    marginTop: SPACING.sm,
  },
  progressBar: {
    width: '80%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    marginTop: SPACING.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
});
