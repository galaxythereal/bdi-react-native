/**
 * Responsive Design Utility
 * Provides helpers for responsive layouts across all devices
 * Supports phones, tablets, iPads, and different orientations
 */

import { Dimensions, Platform, PixelRatio } from 'react-native';

// Get window dimensions
export const getWindowDimensions = () => {
  const { width, height } = Dimensions.get('window');
  return { width, height };
};

// Device type detection
export const isTablet = () => {
  const { width, height } = getWindowDimensions();
  const aspectRatio = height / width;
  
  // iPad/Tablet detection
  if (Platform.OS === 'ios') {
    return Platform.isPad || (width >= 768 && aspectRatio < 1.6);
  }
  
  // Android tablet detection
  return width >= 600;
};

export const isLandscape = () => {
  const { width, height } = getWindowDimensions();
  return width > height;
};

export const isSmallDevice = () => {
  const { width, height } = getWindowDimensions();
  return width < 375 || height < 667;
};

// Breakpoints following standard conventions
export const breakpoints = {
  xs: 0,      // Small phones
  sm: 375,    // Regular phones (iPhone SE, 6, 7, 8)
  md: 414,    // Large phones (iPhone Plus, XR, 11)
  lg: 768,    // Tablets (iPad, iPad Mini)
  xl: 1024,   // Large tablets (iPad Pro)
  xxl: 1280,  // Desktop
};

// Get current breakpoint
export const getCurrentBreakpoint = () => {
  const { width } = getWindowDimensions();
  
  if (width < breakpoints.sm) return 'xs';
  if (width < breakpoints.md) return 'sm';
  if (width < breakpoints.lg) return 'md';
  if (width < breakpoints.xl) return 'lg';
  if (width < breakpoints.xxl) return 'xl';
  return 'xxl';
};

// Responsive value selector
export const responsiveValue = <T,>(values: {
  xs?: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
  xxl?: T;
  default: T;
}): T => {
  const breakpoint = getCurrentBreakpoint();
  return values[breakpoint] ?? values.default;
};

// Responsive sizing - scales based on device width
const baseWidth = 375; // iPhone SE/6/7/8 as base

export const scaleSize = (size: number): number => {
  const { width } = getWindowDimensions();
  const scale = width / baseWidth;
  const newSize = size * scale;
  
  // Limit scaling on tablets
  if (isTablet()) {
    return Math.min(newSize, size * 1.5);
  }
  
  return PixelRatio.roundToNearestPixel(newSize);
};

// Responsive font sizes
export const scaleFontSize = (size: number): number => {
  const fontScale = PixelRatio.getFontScale();
  const scaledSize = scaleSize(size);
  
  // Limit font scaling on tablets
  if (isTablet()) {
    return Math.min(scaledSize, size * 1.3);
  }
  
  return scaledSize / fontScale;
};

// Responsive spacing
export const responsiveSpacing = {
  xs: scaleSize(4),
  sm: scaleSize(8),
  md: scaleSize(16),
  lg: scaleSize(24),
  xl: scaleSize(32),
  xxl: scaleSize(48),
  xxxl: scaleSize(64),
};

// Safe area helpers
export const getSafeAreaPadding = (insets: { top: number; bottom: number; left: number; right: number }) => {
  return {
    paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 8 : 0),
    paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 0),
    paddingLeft: Math.max(insets.left, 0),
    paddingRight: Math.max(insets.right, 0),
  };
};

// Notch detection for iOS
export const hasNotch = () => {
  const { height, width } = getWindowDimensions();
  const d = Platform.OS === 'ios' && !Platform.isPad;
  
  return (
    d &&
    (height >= 812 || width >= 812) // iPhone X and newer
  );
};

// Grid system for tablets
export const getGridColumns = (): number => {
  const { width } = getWindowDimensions();
  
  if (width < breakpoints.md) return 1; // Phone portrait
  if (width < breakpoints.lg) return 2; // Phone landscape
  if (width < breakpoints.xl) return 2; // Tablet portrait
  if (width < breakpoints.xxl) return 3; // Tablet landscape
  return 4; // Desktop
};

// Responsive container width
export const getContainerWidth = (): number => {
  const { width } = getWindowDimensions();
  
  if (isTablet()) {
    // On tablets, use max width with margins
    return Math.min(width - 64, 1200);
  }
  
  // On phones, use full width with padding
  return width;
};

// Orientation-aware dimensions
export const getOrientationDimensions = () => {
  const { width, height } = getWindowDimensions();
  const isLandscapeMode = width > height;
  
  return {
    width,
    height,
    isLandscape: isLandscapeMode,
    shortDimension: Math.min(width, height),
    longDimension: Math.max(width, height),
  };
};

// Device info
export const getDeviceInfo = () => {
  const { width, height } = getWindowDimensions();
  
  return {
    isTablet: isTablet(),
    isLandscape: isLandscape(),
    isSmallDevice: isSmallDevice(),
    hasNotch: hasNotch(),
    breakpoint: getCurrentBreakpoint(),
    pixelRatio: PixelRatio.get(),
    fontScale: PixelRatio.getFontScale(),
    width,
    height,
    platform: Platform.OS,
  };
};

export default {
  getWindowDimensions,
  isTablet,
  isLandscape,
  isSmallDevice,
  breakpoints,
  getCurrentBreakpoint,
  responsiveValue,
  scaleSize,
  scaleFontSize,
  responsiveSpacing,
  getSafeAreaPadding,
  hasNotch,
  getGridColumns,
  getContainerWidth,
  getOrientationDimensions,
  getDeviceInfo,
};
