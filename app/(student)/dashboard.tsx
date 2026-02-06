import { Theme } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useNotifications } from "../../src/context/NotificationContext";
import { useTheme } from "../../src/context/ThemeContext";
import { useLocalization } from "../../src/context/LocalizationContext";
import { useAuth } from "../../src/features/auth/AuthContext";
import { fetchMyEnrollments } from "../../src/features/courses/courseService";
import {
  fetchDiplomaCatalog,
  fetchUpcomingLiveSessions,
} from "../../src/features/diplomas/diplomaService";
import { NotificationBell } from "../../src/features/notifications/NotificationComponents";
import { CatalogDiploma, Enrollment, LiveSession } from "../../src/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - Theme.spacing.lg * 2 - CARD_GAP) / 2;

// Compact Course Card for Grid
interface CourseCardProps {
  item: Enrollment;
  index: number;
  onPress: () => void;
}

const CourseCard: React.FC<CourseCardProps> = ({ item, index, onPress }) => {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const cardAnim = useRef(new Animated.Value(0)).current;
  const progress = Math.round(item.progress || 0);
  const diploma = item.diploma;

  useEffect(() => {
    Animated.spring(cardAnim, {
      toValue: 1,
      delay: index * 60,
      tension: 80,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, []);

  const scale = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1],
  });

  const translateY = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  // Progress color based on completion
  const getProgressColor = () => {
    if (progress >= 100) return colors.success;
    if (progress >= 50) return colors.primary;
    return Theme.colors.light.warning;
  };

  return (
    <Animated.View
      style={[
        styles.cardWrapper,
        {
          transform: [{ scale }, { translateY }],
          opacity: cardAnim,
        },
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.9}
        style={styles.card}
      >
        {/* Thumbnail */}
        <View style={styles.thumbnailContainer}>
          {diploma?.thumbnail_url ? (
            <Image
              source={{ uri: diploma.thumbnail_url }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Ionicons name="school" size={28} color={colors.primary} />
            </View>
          )}
          {/* Progress badge */}
          <View
            style={[
              styles.progressBadge,
              { backgroundColor: getProgressColor() },
            ]}
          >
            <Text style={styles.progressBadgeText}>{progress}%</Text>
          </View>
        </View>

        {/* Info */}
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {diploma?.title || "Untitled Diploma"}
          </Text>

          {/* Progress bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progress}%`,
                    backgroundColor: getProgressColor(),
                  },
                ]}
              />
            </View>
          </View>

          {/* Action text */}
          <Text style={[styles.actionText, { color: colors.primary }]}>
            {progress > 0 ? "Continue" : "Start"} →
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Stats Card Component
interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  value: string | number;
  label: string;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, value, label, color }) => {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  return (
    <View
      style={[
        styles.statCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.borderLight,
          borderWidth: 1,
        },
      ]}
    >
      <View
        style={[styles.statIconContainer, { backgroundColor: color + "10" }]}
      >
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.textPrimary }]}>
        {value}
      </Text>
      <Text
        style={[styles.statLabel, { color: colors.textSecondary }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
};

export default function DashboardScreen() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [allDiplomas, setAllDiplomas] = useState<CatalogDiploma[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { session } = useAuth();
  const { unreadCount } = useNotifications();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { colors, isDark } = useTheme();
  const { t, formatDate, formatTime } = useLocalization();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const loadData = async () => {
    try {
      const [enrollmentsData, sessionsData, catalogData] = await Promise.all([
        fetchMyEnrollments(),
        fetchUpcomingLiveSessions(),
        fetchDiplomaCatalog(),
      ]);
      setEnrollments(enrollmentsData || []);
      setLiveSessions(sessionsData || []);
      setAllDiplomas(catalogData || []);

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    } catch (error: any) {
      console.error("Error loading enrollments:", error);
      Alert.alert("Error", error.message || "Failed to load courses.");
      setEnrollments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Reload data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Calculate stats
  const totalCourses = enrollments.length;
  const avgProgress =
    totalCourses > 0
      ? Math.round(
          enrollments.reduce((acc, e) => acc + (e.progress || 0), 0) /
            totalCourses,
        )
      : 0;
  const completedCourses = enrollments.filter((e) => e.progress >= 100).length;
  const inProgressCourses = enrollments.filter(
    (e) => e.progress > 0 && e.progress < 100,
  ).length;

  const getUserName = () => {
    const email = session?.user.email || "";
    const name = email.split("@")[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading your dashboard...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Tab bar height for bottom padding
  const TAB_BAR_HEIGHT =
    56 + Math.max(insets.bottom, Platform.OS === "android" ? 12 : 24);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
        scrollEventThrottle={16}
        bounces={true}
        alwaysBounceVertical={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={{
          paddingBottom: TAB_BAR_HEIGHT + Theme.spacing.lg,
        }}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: colors.surface }]}>
            <View style={styles.headerTop}>
              <View style={styles.headerTextContainer}>
                <Text
                  style={[styles.greeting, { color: colors.textSecondary }]}
                >
                  Welcome back,
                </Text>
                <Text style={[styles.userName, { color: colors.textPrimary }]}>
                  {getUserName()} 👋
                </Text>
              </View>
              <View style={styles.headerActions}>
                <NotificationBell
                  onPress={() => router.push("/(student)/notifications")}
                  count={unreadCount}
                />
                <TouchableOpacity
                  style={[styles.avatar, { backgroundColor: colors.primary }]}
                  onPress={() => router.push("/(student)/profile")}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[styles.avatarText, { color: colors.textInverse }]}
                  >
                    {session?.user.email?.charAt(0).toUpperCase() || "S"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Quick Stats */}
            {totalCourses > 0 && (
              <View style={styles.statsRow}>
                <StatCard
                  icon="book"
                  value={totalCourses}
                  label="Diplomas"
                  color={Theme.colors.light.primary}
                />
                <StatCard
                  icon="trending-up"
                  value={`${avgProgress}%`}
                  label="Progress"
                  color={Theme.colors.light.info}
                />
                <StatCard
                  icon="checkmark-circle"
                  value={completedCourses}
                  label="Completed"
                  color={Theme.colors.light.success}
                />
              </View>
            )}
          </View>

          {/* Continue Learning Card */}
          {inProgressCourses > 0 &&
            enrollments.length > 0 &&
            (() => {
              // Find the most recently accessed in-progress course
              const recentCourse = enrollments
                .filter((e) => e.progress > 0 && e.progress < 100)
                .sort((a, b) => {
                  const dateA = a.last_accessed_at
                    ? new Date(a.last_accessed_at).getTime()
                    : 0;
                  const dateB = b.last_accessed_at
                    ? new Date(b.last_accessed_at).getTime()
                    : 0;
                  return dateB - dateA;
                })[0];

              if (
                !recentCourse ||
                !recentCourse.courses ||
                recentCourse.courses.length === 0
              )
                return null;

              // Find first incomplete course
              const courseInProgress =
                recentCourse.courses.find((c) => {
                  // Assuming courses have a progress field or we can calculate it
                  return true; // We'll navigate to the course and let it figure out where to continue
                }) || recentCourse.courses[0];

              const progress = recentCourse.progress || 0;

              return (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Continue Learning</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.continueCard}
                    onPress={() =>
                      router.push(`/course/${courseInProgress.id}`)
                    }
                    activeOpacity={0.95}
                  >
                    <LinearGradient
                      colors={[colors.primary, "#5e1616"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.continueGradient}
                    >
                      <View style={styles.continueContent}>
                        <View style={styles.continueIconContainer}>
                          <Ionicons name="play-circle" size={40} color="#fff" />
                        </View>
                        <View style={styles.continueInfo}>
                          <Text
                            style={styles.continueDiplomaName}
                            numberOfLines={1}
                          >
                            {recentCourse.diploma?.title || "Your Diploma"}
                          </Text>
                          <Text
                            style={styles.continueCourseName}
                            numberOfLines={2}
                          >
                            {courseInProgress.title}
                          </Text>
                          <View style={styles.continueProgressContainer}>
                            <View style={styles.continueProgressBar}>
                              <View
                                style={[
                                  styles.continueProgressFill,
                                  { width: `${progress}%` },
                                ]}
                              />
                            </View>
                            <Text style={styles.continueProgressText}>
                              {progress}%
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.continueButton}>
                        <Text style={styles.continueButtonText}>Continue</Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              );
            })()}

          {/* Featured Live Sessions */}
          {liveSessions.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <View style={styles.liveDot} />
                  <Text style={styles.sectionTitle}>Live Sessions</Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push("/(student)/live-sessions")}
                >
                  <Text style={styles.seeAllText}>View All</Text>
                </TouchableOpacity>
              </View>

              {liveSessions.slice(0, 1).map((session, index) => {
                const isLive = session.status === "live";
                const sessionDate = new Date(session.scheduled_at);
                const now = new Date();
                const diff = sessionDate.getTime() - now.getTime();
                const hours = Math.floor(diff / 3600000);
                const minutes = Math.floor((diff % 3600000) / 60000);
                const isToday =
                  now.toDateString() === sessionDate.toDateString();

                return (
                  <TouchableOpacity
                    key={session.id}
                    style={styles.liveSessionCard}
                    onPress={() => {
                      if (session.meeting_url) {
                        Alert.alert(
                          "Join Session",
                          `Join "${session.title}"?`,
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Join",
                              onPress: () =>
                                Linking.openURL(session.meeting_url!),
                            },
                          ],
                        );
                      } else {
                        router.push("/(student)/live-sessions");
                      }
                    }}
                    activeOpacity={0.9}
                  >
                    <LinearGradient
                      colors={
                        isLive
                          ? ["#EF4444", "#DC2626"]
                          : [colors.primary, "#7C3AED"]
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.liveSessionGradient}
                    >
                      {/* Live Badge */}
                      {isLive && (
                        <View style={styles.liveNowBadge}>
                          <View style={styles.liveNowDot} />
                          <Text style={styles.liveNowText}>{t.liveNow}</Text>
                        </View>
                      )}

                      {/* Content */}
                      <View style={styles.liveSessionContent}>
                        <View style={styles.liveSessionInfo}>
                          <Text
                            style={styles.liveSessionTitle}
                            numberOfLines={2}
                          >
                            {session.title}
                          </Text>
                          <View style={styles.liveSessionMeta}>
                            <Ionicons
                              name="time-outline"
                              size={14}
                              color="rgba(255,255,255,0.8)"
                            />
                            <Text style={styles.liveSessionMetaText}>
                              {isLive
                                ? t.happeningNow
                                : isToday
                                  ? `${t.today}, ${formatTime(sessionDate, { hour: "numeric", minute: "2-digit" })}`
                                  : formatDate(sessionDate, {
                                      weekday: "short",
                                      month: "short",
                                      day: "numeric",
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })}
                            </Text>
                          </View>
                          {session.duration_minutes && (
                            <View style={styles.liveSessionMeta}>
                              <Ionicons
                                name="videocam-outline"
                                size={14}
                                color="rgba(255,255,255,0.8)"
                              />
                              <Text style={styles.liveSessionMetaText}>
                                {session.duration_minutes} {t.minutes} {t.session}
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Countdown or Join */}
                        <View style={styles.liveSessionAction}>
                          {isLive ? (
                            <View style={styles.joinNowButton}>
                              <Ionicons
                                name="videocam"
                                size={18}
                                color={Theme.colors.light.error}
                              />
                              <Text style={styles.joinNowText}>Join</Text>
                            </View>
                          ) : diff > 0 && diff < 86400000 ? (
                            <View style={styles.countdownBox}>
                              <Text style={styles.countdownValue}>
                                {hours > 0
                                  ? `${hours}h ${minutes}m`
                                  : `${minutes}m`}
                              </Text>
                              <Text style={styles.countdownLabel}>
                                until live
                              </Text>
                            </View>
                          ) : (
                            <View style={styles.joinNowButton}>
                              <Ionicons
                                name="arrow-forward"
                                size={18}
                                color={Theme.colors.light.primary}
                              />
                            </View>
                          )}
                        </View>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Your Diploma(s) Section - Diploma-Centric Design */}
          {enrollments.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {enrollments.length === 1 ? "Your Diploma" : "Your Diplomas"}
                </Text>
              </View>

              {/* Enrolled Diplomas */}
              {enrollments.map((enrollment, enrollmentIndex) => {
                const diploma = enrollment.diploma;
                const courses = enrollment.courses || [];
                const overallProgress = enrollment.progress || 0;

                return (
                  <TouchableOpacity
                    key={enrollment.id}
                    style={[
                      styles.enrolledDiplomaCard,
                      enrollmentIndex > 0 && { marginTop: Theme.spacing.md },
                    ]}
                    onPress={() =>
                      router.push(`/diploma/${enrollment.diploma_id}`)
                    }
                    activeOpacity={0.95}
                  >
                    {/* Diploma Hero Image */}
                    <View style={styles.enrolledDiplomaHero}>
                      {diploma?.thumbnail_url ? (
                        <Image
                          source={{ uri: diploma.thumbnail_url }}
                          style={styles.enrolledDiplomaImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <LinearGradient
                          colors={[
                            Theme.colors.light.primary,
                            Theme.colors.light.primaryDark,
                          ]}
                          style={styles.enrolledDiplomaImage}
                        >
                          <Ionicons name="school" size={48} color="#fff" />
                        </LinearGradient>
                      )}
                      <LinearGradient
                        colors={["transparent", "rgba(0,0,0,0.85)"]}
                        style={styles.enrolledDiplomaOverlay}
                      >
                        <View style={styles.enrolledDiplomaBadge}>
                          <Ionicons
                            name="checkmark-circle"
                            size={14}
                            color={Theme.colors.light.success}
                          />
                          <Text style={styles.enrolledDiplomaBadgeText}>
                            Enrolled
                          </Text>
                        </View>
                        <Text
                          style={styles.enrolledDiplomaTitle}
                          numberOfLines={2}
                        >
                          {diploma?.title || "Your Diploma"}
                        </Text>
                        <Text style={styles.enrolledDiplomaCourseCount}>
                          {courses.length}{" "}
                          {courses.length === 1 ? "Course" : "Courses"}
                        </Text>
                      </LinearGradient>
                    </View>

                    {/* Progress Section */}
                    <View style={styles.enrolledDiplomaProgress}>
                      <View style={styles.progressHeader}>
                        <Text style={styles.progressLabel}>
                          Overall Progress
                        </Text>
                        <Text style={styles.progressPercentage}>
                          {overallProgress}%
                        </Text>
                      </View>
                      <View style={styles.progressBarLarge}>
                        <View
                          style={[
                            styles.progressBarFillLarge,
                            {
                              width: `${overallProgress}%`,
                              backgroundColor:
                                overallProgress >= 100
                                  ? colors.success
                                  : colors.primary,
                            },
                          ]}
                        />
                      </View>
                    </View>

                    {/* Course Preview Cards */}
                    {courses.length > 0 && (
                      <View style={styles.coursePreviewSection}>
                        <Text style={styles.coursePreviewTitle}>Courses</Text>
                        <View style={styles.coursePreviewGrid}>
                          {courses.slice(0, 3).map((course, index) => (
                            <TouchableOpacity
                              key={course.id}
                              style={styles.coursePreviewItem}
                              onPress={() =>
                                router.push(`/course/${course.id}`)
                              }
                              activeOpacity={0.8}
                            >
                              <View style={styles.coursePreviewNumber}>
                                <Text style={styles.coursePreviewNumberText}>
                                  {index + 1}
                                </Text>
                              </View>
                              <Text
                                style={styles.coursePreviewName}
                                numberOfLines={2}
                              >
                                {course.title}
                              </Text>
                              <Ionicons
                                name="chevron-forward"
                                size={16}
                                color={Theme.colors.light.primary}
                              />
                            </TouchableOpacity>
                          ))}
                          {courses.length > 3 && (
                            <View style={styles.coursePreviewMore}>
                              <Text style={styles.coursePreviewMoreText}>
                                +{courses.length - 3} more
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}

                    {/* View Details Button */}
                    <View style={styles.viewDetailsButton}>
                      <Text style={styles.viewDetailsText}>
                        View Diploma Details
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={Theme.colors.light.primary}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            /* Empty State for New Users */
            <View style={styles.section}>
              <View style={styles.emptyStateCard}>
                <LinearGradient
                  colors={[
                    Theme.colors.light.primary + "15",
                    Theme.colors.light.primaryLight + "10",
                  ]}
                  style={styles.emptyStateGradient}
                >
                  <View style={styles.emptyStateIcon}>
                    <Ionicons
                      name="school"
                      size={40}
                      color={Theme.colors.light.primary}
                    />
                  </View>
                  <Text style={styles.emptyStateTitle}>
                    Start Your Learning Journey
                  </Text>
                  <Text style={styles.emptyStateText}>
                    Browse our diploma programs below and contact your
                    instructor to get enrolled.
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyStateButton}
                    onPress={() => router.push("/(student)/catalog")}
                  >
                    <Text style={styles.emptyStateButtonText}>
                      Browse Programs
                    </Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            </View>
          )}

          {/* Browse All Diplomas Section */}
          {allDiplomas.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Browse All Programs</Text>
                <TouchableOpacity
                  onPress={() => router.push("/(student)/catalog")}
                >
                  <Text style={styles.seeAllText}>View All</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.diplomasScrollContent}
              >
                {allDiplomas.map((diploma) => {
                  const isEnrolled = enrollments.some(
                    (e) => e.diploma_id === diploma.id,
                  );
                  const enrollment = enrollments.find(
                    (e) => e.diploma_id === diploma.id,
                  );
                  const progress = enrollment?.progress || 0;

                  return (
                    <TouchableOpacity
                      key={diploma.id}
                      style={[
                        styles.diplomaCard,
                        !isEnrolled && styles.diplomaCardLocked,
                      ]}
                      onPress={() => router.push(`/diploma/${diploma.id}`)}
                      activeOpacity={0.9}
                    >
                      {/* Diploma Thumbnail */}
                      <View style={styles.diplomaThumbnailContainer}>
                        {diploma.thumbnail_url ? (
                          <Image
                            source={{ uri: diploma.thumbnail_url }}
                            style={styles.diplomaThumbnail}
                            resizeMode="cover"
                          />
                        ) : (
                          <LinearGradient
                            colors={
                              isEnrolled
                                ? [
                                    Theme.colors.light.primary,
                                    Theme.colors.light.primaryLight,
                                  ]
                                : ["#9CA3AF", "#6B7280"]
                            }
                            style={styles.diplomaThumbnail}
                          >
                            <Ionicons name="school" size={32} color="#fff" />
                          </LinearGradient>
                        )}

                        {/* Lock or Progress badge */}
                        {!isEnrolled ? (
                          <View style={styles.lockBadge}>
                            <Ionicons
                              name="lock-closed"
                              size={12}
                              color="#fff"
                            />
                          </View>
                        ) : (
                          progress > 0 && (
                            <View
                              style={[
                                styles.progressBadge,
                                {
                                  backgroundColor:
                                    progress >= 100
                                      ? colors.success
                                      : colors.primary,
                                },
                              ]}
                            >
                              <Text style={styles.progressBadgeText}>
                                {progress}%
                              </Text>
                            </View>
                          )
                        )}
                      </View>

                      {/* Diploma Info */}
                      <View style={styles.diplomaInfo}>
                        <Text
                          style={[
                            styles.diplomaTitle,
                            !isEnrolled && styles.diplomaTitleLocked,
                          ]}
                          numberOfLines={2}
                        >
                          {diploma.title}
                        </Text>
                        <Text style={styles.diplomaCourseCount}>
                          {diploma.courses?.length || 0} courses
                        </Text>
                        {isEnrolled ? (
                          <View style={styles.enrolledBadge}>
                            <Ionicons
                              name="checkmark-circle"
                              size={12}
                              color={Theme.colors.light.success}
                            />
                            <Text style={styles.enrolledText}>Enrolled</Text>
                          </View>
                        ) : (
                          <Text style={styles.diplomaPrice}>
                            {diploma.price && diploma.price > 0
                              ? `${diploma.currency || "USD"} ${diploma.price}`
                              : "Contact for pricing"}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Motivational card */}
          {totalCourses > 0 && avgProgress < 100 && (
            <View style={styles.section}>
              <View style={styles.motivationCard}>
                <View style={styles.motivationIcon}>
                  <Ionicons
                    name="rocket"
                    size={24}
                    color={Theme.colors.light.primary}
                  />
                </View>
                <View style={styles.motivationContent}>
                  <Text style={styles.motivationTitle}>
                    {avgProgress < 30
                      ? "Let's get started!"
                      : avgProgress < 70
                        ? "You're doing great!"
                        : "Almost there!"}
                  </Text>
                  <Text style={styles.motivationText}>
                    {avgProgress < 30
                      ? "Begin your learning journey today"
                      : avgProgress < 70
                        ? "Keep up the momentum"
                        : "Finish strong and earn your certificates"}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: typeof Theme.colors.light, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      gap: Theme.spacing.md,
    },
    loadingText: {
      fontSize: Theme.fontSize.base,
      marginTop: Theme.spacing.sm,
    },

    // Header
    header: {
      paddingHorizontal: Theme.spacing.lg,
      paddingTop: Theme.spacing.md,
      paddingBottom: Theme.spacing.xl,
      borderBottomLeftRadius: Theme.borderRadius["2xl"],
      borderBottomRightRadius: Theme.borderRadius["2xl"],
      ...Theme.shadows[isDark ? "dark" : "light"].sm,
    },
    headerTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: Theme.spacing.lg,
    },
    headerTextContainer: {
      flex: 1,
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.sm,
    },
    greeting: {
      fontSize: Theme.fontSize.base,
      fontWeight: "500",
      marginBottom: 2,
    },
    userName: {
      fontSize: Theme.fontSize["2xl"],
      fontWeight: "800",
      letterSpacing: -0.5,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      ...Theme.shadows[isDark ? "dark" : "light"].md,
    },
    avatarText: {
      fontSize: Theme.fontSize.lg,
      fontWeight: Theme.fontWeight.bold,
    },

    // Stats
    statsRow: {
      flexDirection: "row",
      gap: Theme.spacing.sm,
    },
    statCard: {
      flex: 1,
      flexDirection: "column",
      alignItems: "flex-start",
      padding: Theme.spacing.lg,
      paddingVertical: Theme.spacing.xl,
      borderRadius: Theme.borderRadius.xl,
      gap: Theme.spacing.sm,
      // Premium shadow
      ...Theme.shadows[isDark ? "dark" : "light"].md,
      borderWidth: 1,
    },
    statIconContainer: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    statValue: {
      fontSize: 22,
      fontWeight: "800",
      lineHeight: 26,
      letterSpacing: -0.5,
    },
    statLabel: {
      fontSize: 13,
      fontWeight: "600",
    },

    // Section
    section: {
      paddingHorizontal: Theme.spacing.lg,
      marginTop: Theme.spacing.xl,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: Theme.spacing.md,
    },
    sectionTitle: {
      fontSize: Theme.fontSize.lg,
      fontWeight: Theme.fontWeight.bold,
      color: colors.text,
    },
    seeAllText: {
      fontSize: Theme.fontSize.sm,
      color: colors.primary,
      fontWeight: Theme.fontWeight.semibold,
    },

    // Featured Card (Continue Learning)
    featuredCard: {
      borderRadius: Theme.borderRadius.xl,
      overflow: "hidden",
      backgroundColor: colors.surface,
      ...Theme.shadows[isDark ? "dark" : "light"].lg,
      marginTop: Theme.spacing.xs,
    },
    featuredImage: {
      width: "100%",
      height: 200,
    },
    featuredPlaceholder: {
      backgroundColor: colors.primary + "15",
      alignItems: "center",
      justifyContent: "center",
    },
    featuredOverlay: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: Theme.spacing.lg,
      paddingVertical: Theme.spacing.md,
      paddingBottom: Theme.spacing.lg,
      backgroundColor: "rgba(0,0,0,0.75)",
    },
    featuredContent: {
      gap: Theme.spacing.sm,
    },
    featuredTitle: {
      fontSize: Theme.fontSize.xl,
      fontWeight: Theme.fontWeight.bold,
      color: "#fff",
      lineHeight: 28,
    },
    featuredProgressRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.md,
    },
    featuredProgressBar: {
      flex: 1,
      height: 6,
      backgroundColor: "rgba(255,255,255,0.25)",
      borderRadius: 3,
      overflow: "hidden",
    },
    featuredProgressFill: {
      height: "100%",
      backgroundColor: colors.success,
      borderRadius: 3,
    },
    featuredProgressText: {
      fontSize: Theme.fontSize.base,
      color: "#fff",
      fontWeight: Theme.fontWeight.bold,
      minWidth: 45,
    },
    featuredButton: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: colors.primary,
      paddingHorizontal: Theme.spacing.lg,
      paddingVertical: Theme.spacing.sm + 2,
      borderRadius: Theme.borderRadius.round,
      gap: Theme.spacing.sm,
      marginTop: Theme.spacing.xs,
    },
    featuredButtonText: {
      color: "#fff",
      fontSize: Theme.fontSize.base,
      fontWeight: Theme.fontWeight.bold,
    },

    // Course Grid
    coursesGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: CARD_GAP,
    },
    cardWrapper: {
      width: CARD_WIDTH,
      marginBottom: Theme.spacing.lg,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: Theme.borderRadius.xl,
      overflow: "hidden",
      // Premium shadow
      ...Theme.shadows[isDark ? "dark" : "light"].md,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    thumbnailContainer: {
      position: "relative",
      height: 100,
      backgroundColor: colors.backgroundSecondary,
    },
    thumbnail: {
      width: "100%",
      height: "100%",
    },
    thumbnailPlaceholder: {
      width: "100%",
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary + "10",
    },
    progressBadge: {
      position: "absolute",
      top: Theme.spacing.xs,
      right: Theme.spacing.xs,
      paddingHorizontal: Theme.spacing.sm,
      paddingVertical: 3,
      borderRadius: Theme.borderRadius.sm,
    },
    progressBadgeText: {
      color: "#fff",
      fontSize: 10,
      fontWeight: Theme.fontWeight.bold,
    },
    cardInfo: {
      padding: Theme.spacing.sm,
    },
    cardTitle: {
      fontSize: Theme.fontSize.sm,
      fontWeight: Theme.fontWeight.semibold,
      marginBottom: Theme.spacing.xs,
      lineHeight: 18,
      minHeight: 36,
    },
    progressContainer: {
      marginBottom: Theme.spacing.xs,
    },
    progressBar: {
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: 2,
    },
    actionText: {
      fontSize: Theme.fontSize.xs,
      color: colors.primary,
      fontWeight: Theme.fontWeight.semibold,
    },

    // Empty State
    emptyState: {
      padding: Theme.spacing["2xl"],
      alignItems: "center",
    },
    emptyIconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.backgroundSecondary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Theme.spacing.lg,
    },
    emptyTitle: {
      fontSize: Theme.fontSize.lg,
      fontWeight: Theme.fontWeight.bold,
      color: colors.text,
      marginBottom: Theme.spacing.xs,
    },
    emptyText: {
      fontSize: Theme.fontSize.sm,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 20,
    },

    // Motivation Card
    motivationCard: {
      flexDirection: "row",
      backgroundColor: colors.primary + "10",
      borderRadius: Theme.borderRadius.lg,
      padding: Theme.spacing.md,
      alignItems: "center",
      gap: Theme.spacing.md,
    },
    motivationIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    motivationContent: {
      flex: 1,
    },
    motivationTitle: {
      fontSize: Theme.fontSize.base,
      fontWeight: Theme.fontWeight.bold,
      color: colors.text,
      marginBottom: 2,
    },
    motivationText: {
      fontSize: Theme.fontSize.sm,
      color: colors.textSecondary,
    },

    // Live Sessions on Home
    sectionTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.sm,
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.error,
    },
    liveSessionCard: {
      borderRadius: Theme.borderRadius.xl,
      overflow: "hidden",
      marginBottom: Theme.spacing.md,
      ...Theme.shadows[isDark ? "dark" : "light"].lg,
    },
    liveSessionGradient: {
      padding: Theme.spacing.lg,
    },
    liveNowBadge: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: "rgba(255,255,255,0.25)",
      paddingHorizontal: Theme.spacing.sm,
      paddingVertical: Theme.spacing.xs,
      borderRadius: Theme.borderRadius.full,
      gap: Theme.spacing.xs,
      marginBottom: Theme.spacing.sm,
    },
    liveNowDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#fff",
    },
    liveNowText: {
      fontSize: Theme.fontSize.xs,
      fontWeight: Theme.fontWeight.bold,
      color: "#fff",
      letterSpacing: 1,
    },
    liveSessionContent: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    liveSessionInfo: {
      flex: 1,
      marginRight: Theme.spacing.md,
    },
    liveSessionTitle: {
      fontSize: Theme.fontSize.lg,
      fontWeight: Theme.fontWeight.bold,
      color: "#fff",
      marginBottom: Theme.spacing.xs,
    },
    liveSessionMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.xs,
      marginTop: 4,
    },
    liveSessionMetaText: {
      fontSize: Theme.fontSize.sm,
      color: "rgba(255,255,255,0.85)",
    },
    liveSessionAction: {
      alignItems: "center",
    },
    joinNowButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#fff",
      paddingHorizontal: Theme.spacing.md,
      paddingVertical: Theme.spacing.sm,
      borderRadius: Theme.borderRadius.round,
      gap: Theme.spacing.xs,
      ...Theme.shadows[isDark ? "dark" : "light"].md,
    },
    joinNowText: {
      fontSize: Theme.fontSize.base,
      fontWeight: Theme.fontWeight.bold,
      color: colors.error,
    },
    countdownBox: {
      alignItems: "center",
      backgroundColor: "rgba(255,255,255,0.2)",
      paddingHorizontal: Theme.spacing.md,
      paddingVertical: Theme.spacing.sm,
      borderRadius: Theme.borderRadius.md,
    },
    countdownValue: {
      fontSize: Theme.fontSize.lg,
      fontWeight: Theme.fontWeight.bold,
      color: "#fff",
    },
    countdownLabel: {
      fontSize: Theme.fontSize.xs,
      color: "rgba(255,255,255,0.8)",
    },

    // Enrolled Diploma Card - Premium Design
    enrolledDiplomaCard: {
      backgroundColor: colors.surface,
      borderRadius: Theme.borderRadius["2xl"],
      overflow: "hidden",
      ...Theme.shadows[isDark ? "dark" : "light"].lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    enrolledDiplomaHero: {
      height: 160,
      position: "relative",
    },
    enrolledDiplomaImage: {
      width: "100%",
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
    },
    enrolledDiplomaOverlay: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      padding: Theme.spacing.lg,
      paddingTop: Theme.spacing["3xl"],
    },
    enrolledDiplomaBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(255,255,255,0.95)",
      paddingHorizontal: Theme.spacing.sm,
      paddingVertical: 4,
      borderRadius: Theme.borderRadius.round,
      alignSelf: "flex-start",
      marginBottom: Theme.spacing.sm,
      gap: 4,
    },
    enrolledDiplomaBadgeText: {
      fontSize: Theme.fontSize.xs,
      fontWeight: Theme.fontWeight.semibold,
      color: colors.success,
    },
    enrolledDiplomaTitle: {
      fontSize: Theme.fontSize.xl,
      fontWeight: Theme.fontWeight.bold,
      color: "#fff",
      marginBottom: 4,
      letterSpacing: -0.3,
    },
    enrolledDiplomaCourseCount: {
      fontSize: Theme.fontSize.sm,
      color: "rgba(255,255,255,0.85)",
    },
    enrolledDiplomaProgress: {
      padding: Theme.spacing.lg,
      paddingBottom: Theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    progressHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: Theme.spacing.sm,
    },
    progressLabel: {
      fontSize: Theme.fontSize.sm,
      color: colors.textSecondary,
      fontWeight: Theme.fontWeight.medium,
    },
    progressPercentage: {
      fontSize: Theme.fontSize.lg,
      color: colors.primary,
      fontWeight: Theme.fontWeight.bold,
    },
    progressBarLarge: {
      height: 10,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 5,
      overflow: "hidden",
    },
    progressBarFillLarge: {
      height: "100%",
      borderRadius: 5,
    },
    coursePreviewSection: {
      padding: Theme.spacing.lg,
      paddingTop: Theme.spacing.md,
    },
    coursePreviewTitle: {
      fontSize: Theme.fontSize.sm,
      fontWeight: Theme.fontWeight.semibold,
      color: colors.textSecondary,
      marginBottom: Theme.spacing.sm,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    coursePreviewGrid: {
      gap: Theme.spacing.sm,
    },
    coursePreviewItem: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.backgroundSecondary,
      borderRadius: Theme.borderRadius.lg,
      padding: Theme.spacing.md,
      gap: Theme.spacing.md,
    },
    coursePreviewNumber: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    coursePreviewNumberText: {
      fontSize: Theme.fontSize.sm,
      fontWeight: Theme.fontWeight.bold,
      color: "#fff",
    },
    coursePreviewName: {
      flex: 1,
      fontSize: Theme.fontSize.base,
      fontWeight: Theme.fontWeight.medium,
      color: colors.text,
    },
    coursePreviewMore: {
      alignItems: "center",
      paddingVertical: Theme.spacing.sm,
    },
    coursePreviewMoreText: {
      fontSize: Theme.fontSize.sm,
      color: colors.primary,
      fontWeight: Theme.fontWeight.semibold,
    },
    viewDetailsButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      padding: Theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      gap: Theme.spacing.xs,
    },
    viewDetailsText: {
      fontSize: Theme.fontSize.base,
      color: colors.primary,
      fontWeight: Theme.fontWeight.semibold,
    },

    // Empty State Card
    emptyStateCard: {
      borderRadius: Theme.borderRadius["2xl"],
      overflow: "hidden",
    },
    emptyStateGradient: {
      padding: Theme.spacing.xl,
      alignItems: "center",
    },
    emptyStateIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Theme.spacing.lg,
      ...Theme.shadows[isDark ? "dark" : "light"].sm,
    },
    emptyStateTitle: {
      fontSize: Theme.fontSize.xl,
      fontWeight: Theme.fontWeight.bold,
      color: colors.text,
      marginBottom: Theme.spacing.sm,
      textAlign: "center",
    },
    emptyStateText: {
      fontSize: Theme.fontSize.base,
      color: colors.textSecondary,
      textAlign: "center",
      marginBottom: Theme.spacing.lg,
      lineHeight: 22,
    },
    emptyStateButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.primary,
      paddingHorizontal: Theme.spacing.lg,
      paddingVertical: Theme.spacing.md,
      borderRadius: Theme.borderRadius.lg,
      gap: Theme.spacing.sm,
      ...Theme.shadows[isDark ? "dark" : "light"].md,
    },
    emptyStateButtonText: {
      fontSize: Theme.fontSize.base,
      fontWeight: Theme.fontWeight.bold,
      color: "#fff",
    },

    // Browse All Diplomas Section - Premium Design
    diplomasScrollContent: {
      paddingRight: Theme.spacing.lg,
      paddingLeft: Theme.spacing.xs,
      paddingVertical: Theme.spacing.sm,
      gap: Theme.spacing.md,
    },
    diplomaCard: {
      width: 200,
      backgroundColor: colors.surface,
      borderRadius: Theme.borderRadius.xl,
      overflow: "hidden",
      ...Theme.shadows[isDark ? "dark" : "light"].lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    diplomaCardLocked: {
      opacity: 0.75,
      borderColor: colors.border,
    },
    diplomaThumbnailContainer: {
      position: "relative",
      height: 120,
    },
    diplomaThumbnail: {
      width: "100%",
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
    },
    lockBadge: {
      position: "absolute",
      top: Theme.spacing.sm,
      right: Theme.spacing.sm,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: "rgba(0,0,0,0.7)",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: "rgba(255,255,255,0.2)",
    },
    diplomaInfo: {
      padding: Theme.spacing.md,
      paddingTop: Theme.spacing.sm,
    },
    diplomaTitle: {
      fontSize: Theme.fontSize.base,
      fontWeight: Theme.fontWeight.bold,
      color: colors.text,
      marginBottom: 6,
      minHeight: 42,
      lineHeight: 20,
    },
    diplomaTitleLocked: {
      color: colors.textSecondary,
    },
    diplomaCourseCount: {
      fontSize: Theme.fontSize.xs,
      color: colors.textTertiary,
      marginBottom: Theme.spacing.xs,
    },
    enrolledBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    enrolledText: {
      fontSize: Theme.fontSize.xs,
      color: colors.success,
      fontWeight: Theme.fontWeight.medium,
    },
    diplomaPrice: {
      fontSize: Theme.fontSize.sm,
      color: colors.primary,
      fontWeight: Theme.fontWeight.bold,
    },

    // Continue Learning Card
    continueCard: {
      borderRadius: Theme.borderRadius.xl,
      overflow: "hidden",
      ...Theme.shadows[isDark ? "dark" : "light"].lg,
    },
    continueGradient: {
      padding: Theme.spacing.lg,
      gap: Theme.spacing.md,
    },
    continueContent: {
      flexDirection: "row",
      gap: Theme.spacing.md,
      alignItems: "center",
    },
    continueIconContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: "rgba(255,255,255,0.2)",
      alignItems: "center",
      justifyContent: "center",
    },
    continueInfo: {
      flex: 1,
      gap: Theme.spacing.xs,
    },
    continueDiplomaName: {
      fontSize: Theme.fontSize.xs,
      color: "rgba(255,255,255,0.8)",
      fontWeight: Theme.fontWeight.medium,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    continueCourseName: {
      fontSize: Theme.fontSize.lg,
      color: "#fff",
      fontWeight: Theme.fontWeight.bold,
      lineHeight: 22,
    },
    continueProgressContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.sm,
      marginTop: Theme.spacing.xs,
    },
    continueProgressBar: {
      flex: 1,
      height: 6,
      backgroundColor: "rgba(255,255,255,0.3)",
      borderRadius: 3,
      overflow: "hidden",
    },
    continueProgressFill: {
      height: "100%",
      backgroundColor: "#fff",
      borderRadius: 3,
    },
    continueProgressText: {
      fontSize: Theme.fontSize.sm,
      color: "#fff",
      fontWeight: Theme.fontWeight.bold,
      minWidth: 42,
      textAlign: "right",
    },
    continueButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Theme.spacing.sm,
      backgroundColor: "rgba(255,255,255,0.2)",
      paddingVertical: Theme.spacing.md,
      borderRadius: Theme.borderRadius.lg,
    },
    continueButtonText: {
      fontSize: Theme.fontSize.base,
      color: "#fff",
      fontWeight: Theme.fontWeight.bold,
    },

    // Modal Styles - Premium Design
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "flex-end",
    },
    modalContainer: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      maxHeight: "92%",
      minHeight: "65%",
      ...Theme.shadows[isDark ? "dark" : "light"].lg,
    },
    modalHeader: {
      alignItems: "center",
      paddingTop: Theme.spacing.md,
      paddingHorizontal: Theme.spacing.lg,
      paddingBottom: Theme.spacing.xs,
    },
    modalDragHandle: {
      width: 48,
      height: 5,
      backgroundColor: colors.border,
      borderRadius: 3,
      marginBottom: Theme.spacing.xs,
    },
    modalCloseButton: {
      position: "absolute",
      top: Theme.spacing.md,
      right: Theme.spacing.md,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.backgroundSecondary,
      alignItems: "center",
      justifyContent: "center",
      ...Theme.shadows[isDark ? "dark" : "light"].sm,
    },
    modalScroll: {
      flex: 1,
    },
    modalScrollContent: {
      paddingBottom: Theme.spacing["3xl"] + 20,
    },
    modalHero: {
      position: "relative",
      height: 220,
      overflow: "hidden",
    },
    modalHeroImage: {
      width: "100%",
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
    },
    modalHeroOverlay: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: Theme.spacing.lg,
      paddingVertical: Theme.spacing.lg,
      paddingTop: Theme.spacing["3xl"],
    },
    modalDiplomaTitle: {
      fontSize: Theme.fontSize["2xl"],
      fontWeight: Theme.fontWeight.bold,
      color: "#fff",
      marginBottom: Theme.spacing.xs,
    },
    modalDiplomaMeta: {
      flexDirection: "row",
      gap: Theme.spacing.md,
    },
    modalMetaItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    modalMetaText: {
      fontSize: Theme.fontSize.sm,
      color: "#fff",
      fontWeight: Theme.fontWeight.medium,
    },
    modalSection: {
      padding: Theme.spacing.lg,
      paddingTop: Theme.spacing.lg,
    },
    modalSectionTitle: {
      fontSize: Theme.fontSize.lg,
      fontWeight: Theme.fontWeight.bold,
      color: colors.text,
      marginBottom: Theme.spacing.md,
      letterSpacing: -0.3,
    },
    modalDescription: {
      fontSize: Theme.fontSize.base,
      color: colors.textSecondary,
      lineHeight: 24,
    },
    courseListItem: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: Theme.borderRadius.lg,
      padding: Theme.spacing.md,
      marginBottom: Theme.spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      ...Theme.shadows[isDark ? "dark" : "light"].sm,
    },
    courseListItemLocked: {
      opacity: 0.65,
      backgroundColor: colors.backgroundSecondary,
    },
    courseListNumber: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginRight: Theme.spacing.md,
    },
    courseListNumberText: {
      fontSize: Theme.fontSize.sm,
      fontWeight: Theme.fontWeight.bold,
      color: "#fff",
    },
    courseListContent: {
      flex: 1,
    },
    courseListTitle: {
      fontSize: Theme.fontSize.base,
      fontWeight: Theme.fontWeight.medium,
      color: colors.text,
    },
    courseListTitleLocked: {
      color: colors.textSecondary,
    },
    modalActionSection: {
      padding: Theme.spacing.lg,
      paddingTop: 0,
    },
    enrollButton: {
      backgroundColor: colors.primary,
      borderRadius: Theme.borderRadius.lg,
      paddingVertical: Theme.spacing.md,
      alignItems: "center",
      ...Theme.shadows[isDark ? "dark" : "light"].md,
    },
    enrollButtonText: {
      fontSize: Theme.fontSize.base,
      fontWeight: Theme.fontWeight.bold,
      color: "#fff",
    },
  });
