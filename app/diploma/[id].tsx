import { Theme } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalization } from "../../src/context/LocalizationContext";
import { useTheme } from "../../src/context/ThemeContext";
import { fetchMyEnrollments } from "../../src/features/courses/courseService";
import { fetchDiplomaById } from "../../src/features/diplomas/diplomaService";
import { CatalogDiploma, Enrollment } from "../../src/types";

export default function DiplomaDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { t, getLocalizedText, isRTL } = useLocalization();
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () => createStyles(colors, isDark, isRTL),
    [colors, isDark, isRTL],
  );

  const [diploma, setDiploma] = useState<CatalogDiploma | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      if (!id || typeof id !== "string") return;

      const [diplomaData, enrollmentsData] = await Promise.all([
        fetchDiplomaById(id),
        fetchMyEnrollments(),
      ]);

      setDiploma(diplomaData);
      setEnrollments(enrollmentsData || []);
    } catch (error) {
      console.error("Error loading diploma details:", error);
      Alert.alert(t.error, t.failedLoadDiplomaDetails);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!diploma) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            {t.diplomaNotFound}
          </Text>
        </View>
      </View>
    );
  }

  const isEnrolled = enrollments.some((e) => e.diploma_id === diploma.id);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Animated Header */}
      {/* Animated Header */}
      {/* 1. Base Transparent/Blur Layer - Always visible (optional, but good for initial state) */}

      {/* 2. Solid Background Layer - Fades in */}
      <Animated.View
        style={[
          styles.header,
          {
            height: 60 + insets.top,
            paddingTop: insets.top,
            backgroundColor: colors.background,
            opacity: scrollY.interpolate({
              inputRange: [0, 200],
              outputRange: [0, 1],
              extrapolate: "clamp",
            }),
            borderBottomWidth: 1,
            borderBottomColor: colors.borderLight, // Fixed color, fading opacity handles visibility
            zIndex: 49, // Below content but above scrollview
          },
        ]}
      />

      {/* 3. Header Content - Fades in/out or stays fixed */}
      <View
        style={[
          styles.header,
          {
            height: 60 + insets.top,
            paddingTop: insets.top,
            zIndex: 50,
            backgroundColor: "transparent",
          },
        ]}
      >
        {/* Drag Handle - Adaptive Color */}
        <Animated.View
          style={[
            styles.dragHandleContainer,
            {
              top: insets.top + 12, // Position visually at top
            },
          ]}
        >
          <Animated.View
            style={[
              styles.dragHandle,
              {
                backgroundColor: scrollY.interpolate({
                  inputRange: [0, 200],
                  outputRange: [
                    "rgba(255, 255, 255, 0.33)",
                    "rgba(207, 37, 37, 0.89)",
                  ], // Standard iOS colors
                  extrapolate: "clamp",
                }),
              },
            ]}
          />
        </Animated.View>

        <View style={styles.headerContent}>
          {/* Title that fades in */}
          <Animated.Text
            numberOfLines={1}
            style={[
              styles.headerTitle,
              {
                color: colors.text,
                opacity: scrollY.interpolate({
                  inputRange: [150, 250],
                  outputRange: [0, 1],
                  extrapolate: "clamp",
                }),
                transform: [
                  {
                    translateY: scrollY.interpolate({
                      inputRange: [150, 250],
                      outputRange: [10, 0],
                      extrapolate: "clamp",
                    }),
                  },
                ],
              },
            ]}
          >
            {getLocalizedText(diploma.title, diploma.title_ar)}
          </Animated.Text>
        </View>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        bounces={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
      >
        {/* Hero Section */}
        <View style={styles.hero}>
          {diploma.thumbnail_url ? (
            <Image
              source={{ uri: diploma.thumbnail_url }}
              style={styles.heroImage}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={[
                Theme.colors.light.primary,
                Theme.colors.light.primaryLight,
              ]}
              style={styles.heroImage}
            >
              <Ionicons name="school" size={64} color="#fff" />
            </LinearGradient>
          )}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.8)"]}
            style={styles.heroOverlay}
          >
            <Text style={styles.heroTitle}>
              {getLocalizedText(diploma.title, diploma.title_ar) || t.untitledDiploma}
            </Text>
            <View style={styles.heroMeta}>
              <View style={styles.metaItem}>
                <Ionicons name="book-outline" size={16} color="#fff" />
                <Text style={styles.metaText}>
                    {diploma.courses?.length || 0} {t.courses}
                </Text>
              </View>
              {diploma.duration_weeks && (
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={16} color="#fff" />
                  <Text style={styles.metaText}>
                    {diploma.duration_weeks} {t.weeks}
                  </Text>
                </View>
              )}
            </View>
          </LinearGradient>
        </View>

        <View style={styles.content}>
          {/* Description */}
          {getLocalizedText(diploma.description, diploma.description_ar) && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t.aboutProgram}
              </Text>
              <Text
                style={[styles.description, { color: colors.textSecondary }]}
              >
                {getLocalizedText(diploma.description, diploma.description_ar)}
              </Text>
            </View>
          )}

          {/* Courses List */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t.courseCurriculum} ({diploma.courses?.length || 0})
            </Text>

            {diploma.courses?.map((course, index) => (
              <TouchableOpacity
                key={course.id}
                style={[
                  styles.courseItem,
                  { backgroundColor: colors.surface },
                  !isEnrolled && styles.courseItemLocked,
                ]}
                onPress={() => {
                  if (isEnrolled) {
                    router.replace(`/course/${course.id}`);
                  } else {
                    Alert.alert(
                        t.enrollmentRequired,
                        t.enrollmentRequiredMessage,
                        [{ text: t.ok }],
                      );
                  }
                }}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.courseNumber,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  <Text style={styles.courseNumberText}>{index + 1}</Text>
                </View>
                <View style={styles.courseInfo}>
                  <Text
                    style={[
                      styles.courseTitle,
                      { color: colors.text },
                      !isEnrolled && { color: colors.textSecondary },
                    ]}
                    numberOfLines={2}
                  >
                    {getLocalizedText(course.title, course.title_ar)}
                  </Text>
                  <Text
                    style={[
                      styles.courseChapterCount,
                      { color: colors.textTertiary },
                    ]}
                  >
                    {course.chapters?.length || 0} {t.chapters}
                  </Text>
                </View>
                {isEnrolled ? (
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.primary}
                  />
                ) : (
                  <Ionicons
                    name="lock-closed"
                    size={18}
                    color={colors.textTertiary}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Animated.ScrollView>

      {/* Sticky Action Footer if not enrolled */}
      {!isEnrolled && (
        <View
          style={[
            styles.footer,
            {
              backgroundColor: colors.surface,
              paddingBottom: insets.bottom + Theme.spacing.md,
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.enrollButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              Alert.alert(t.contactInstructorTitle, t.contactInstructorMessage);
            }}
          >
            <Text style={styles.enrollButtonText}>{t.requestEnrollment}</Text>
            <Ionicons name={isRTL ? "arrow-back" : "arrow-forward"} size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const createStyles = (
  colors: typeof Theme.colors.light,
  isDark: boolean,
  isRTL: boolean,
) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    errorContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    errorText: {
      fontSize: Theme.fontSize.lg,
    },
    header: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 50,
    },
    closeButton: {
      alignSelf: isRTL ? "flex-end" : "flex-start",
      padding: Theme.spacing.md,
    },
    headerContent: {
      flex: 1,
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Theme.spacing.md,
    },
    headerButton: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    dragHandleContainer: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      alignItems: "center",
      zIndex: 60,
      pointerEvents: "none",
    },
    dragHandle: {
      width: 36,
      height: 5,
      borderRadius: 2.5,
      // Removed fixed background color for animated one
    },
    headerTitle: {
      flex: 1,
      fontSize: Theme.fontSize.base,
      fontWeight: "bold",
      textAlign: "center",
      marginHorizontal: Theme.spacing.sm,
    },
    hero: {
      height: 300,
      position: "relative",
      backgroundColor: colors.surface,
    },
    heroImage: {
      width: "100%",
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
    },
    heroOverlay: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      padding: Theme.spacing.xl,
      paddingTop: Theme.spacing["4xl"],
    },

    heroTitle: {
      fontSize: Theme.fontSize["2xl"],
      fontWeight: "bold",
      color: "#fff",
      marginBottom: Theme.spacing.sm,
      textShadowColor: "rgba(0,0,0,0.3)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
      textAlign: isRTL ? "right" : "left",
    },
    heroMeta: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      gap: Theme.spacing.lg,
    },
    metaItem: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      gap: Theme.spacing.xs,
    },
    metaText: {
      color: "#fff",
      fontSize: Theme.fontSize.sm,
      fontWeight: "500",
    },
    content: {
      padding: Theme.spacing.xl,
      gap: Theme.spacing.xl,
    },
    section: {
      gap: Theme.spacing.md,
    },
    sectionTitle: {
      fontSize: Theme.fontSize.lg,
      fontWeight: "bold",
      marginBottom: Theme.spacing.xs,
      textAlign: isRTL ? "right" : "left",
    },
    description: {
      fontSize: Theme.fontSize.base,
      lineHeight: 24,
      textAlign: isRTL ? "right" : "left",
    },
    courseItem: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      padding: Theme.spacing.md,
      borderRadius: Theme.borderRadius.xl,
      gap: Theme.spacing.md,
      // Premium shadow
      ...Theme.shadows[isDark ? "dark" : "light"].sm,
    },
    courseItemLocked: {
      opacity: 0.8,
    },
    courseNumber: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    courseNumberText: {
      color: "#fff",
      fontWeight: "bold",
      fontSize: Theme.fontSize.sm,
    },
    courseInfo: {
      flex: 1,
    },
    courseTitle: {
      fontSize: Theme.fontSize.base,
      fontWeight: "600",
      marginBottom: 2,
      textAlign: isRTL ? "right" : "left",
    },
    courseChapterCount: {
      fontSize: Theme.fontSize.xs,
    },
    footer: {
      padding: Theme.spacing.lg,
      paddingTop: Theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: "rgba(0,0,0,0.05)",
      ...Theme.shadows[isDark ? "dark" : "light"].lg,
    },
    enrollButton: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      justifyContent: "center",
      padding: Theme.spacing.md,
      borderRadius: Theme.borderRadius.full,
      gap: Theme.spacing.sm,
    },
    enrollButtonText: {
      color: "#fff",
      fontSize: Theme.fontSize.base,
      fontWeight: "bold",
    },
  });
