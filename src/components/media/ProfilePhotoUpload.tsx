/**
 * Profile Photo Upload Component for React Native
 * 
 * A reusable component for uploading and displaying profile photos.
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
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, BORDER_RADIUS } from '../../lib/constants';
import {
  pickImage,
  takePhoto,
  uploadProfilePhoto,
  getAvatarUrl,
} from '../../services/mediaService';

interface ProfilePhotoUploadProps {
  value?: string | null;
  onChange?: (url: string | null) => void;
  userId?: string;
  size?: number;
  disabled?: boolean;
  name?: string | null;
  showEditButton?: boolean;
}

export function ProfilePhotoUpload({
  value,
  onChange,
  userId,
  size = 120,
  disabled = false,
  name,
  showEditButton = true,
}: ProfilePhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const displayUrl = localPreview || (value ? getAvatarUrl(value, name, size * 2) : null);
  const initials = name
    ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const handleUpload = useCallback(async (asset: ImagePicker.ImagePickerAsset) => {
    setLocalPreview(asset.uri);
    setUploading(true);
    setProgress(0);

    try {
      const result = await uploadProfilePhoto(asset.uri, userId);
      
      if (result.success && result.url) {
        onChange?.(result.url);
        setLocalPreview(null); // Clear local preview, use actual URL
      } else {
        Alert.alert('Upload Failed', result.error || 'Failed to upload photo');
        setLocalPreview(null);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to upload photo');
      setLocalPreview(null);
    } finally {
      setUploading(false);
    }
  }, [userId, onChange]);

  const showPicker = useCallback(() => {
    if (disabled || uploading) return;

    Alert.alert(
      'Change Photo',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const asset = await takePhoto({ aspect: [1, 1] });
            if (asset) handleUpload(asset);
          },
        },
        {
          text: 'Choose from Library',
          onPress: async () => {
            const asset = await pickImage({ aspect: [1, 1] });
            if (asset) handleUpload(asset);
          },
        },
        ...(value ? [{
          text: 'Remove Photo',
          style: 'destructive' as const,
          onPress: () => {
            setLocalPreview(null);
            onChange?.(null);
          },
        }] : []),
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  }, [disabled, uploading, value, handleUpload, onChange]);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.avatarContainer,
          { width: size, height: size, borderRadius: size / 2 },
          disabled && styles.disabled,
        ]}
        onPress={showPicker}
        disabled={disabled || uploading}
        activeOpacity={0.8}
      >
        {displayUrl ? (
          <Image
            source={{ uri: displayUrl }}
            style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
          />
        ) : (
          <View
            style={[
              styles.placeholder,
              { width: size, height: size, borderRadius: size / 2 },
            ]}
          >
            <Text style={[styles.initials, { fontSize: size * 0.35 }]}>
              {initials}
            </Text>
          </View>
        )}

        {/* Upload overlay */}
        {uploading && (
          <View style={[styles.uploadingOverlay, { borderRadius: size / 2 }]}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.uploadingText}>{Math.round(progress)}%</Text>
          </View>
        )}

        {/* Edit button */}
        {showEditButton && !uploading && !disabled && (
          <View style={styles.editButton}>
            <Ionicons name="camera" size={16} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  avatar: {
    backgroundColor: COLORS.surface,
  },
  placeholder: {
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
  },
  editButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  disabled: {
    opacity: 0.5,
  },
});
