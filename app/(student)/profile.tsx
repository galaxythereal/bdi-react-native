import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    Alert,
    Animated,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import {
    SafeAreaView,
    useSafeAreaInsets,
} from "react-native-safe-area-context";
import Theme from "../../constants/theme";
import { Card } from "../../src/components/Card";
import { ComingSoonModal } from "../../src/components/ComingSoonModal";
import { LanguageSelector } from "../../src/components/LanguageSelector";
import { ProfilePhotoUpload } from "../../src/components/media/ProfilePhotoUpload";
import { useLocalization } from "../../src/context/LocalizationContext";
import { useTheme } from "../../src/context/ThemeContext";
import { useAuth } from "../../src/features/auth/AuthContext";
import { fetchMyEnrollments } from "../../src/features/courses/courseService";
import { supabase } from "../../src/lib/supabase";
interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  onPress: () => void;
  badge?: string;
  danger?: boolean;
}

interface StatsData {
  courses: number;
  progress: number;
  certificates: number;
}

export default function ProfileScreen() {
  const { signOut, session } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark, theme, setTheme } = useTheme();
  const { t, isRTL } = useLocalization();
  const styles = React.useMemo(
    () => createStyles(colors, isDark, isRTL),
    [colors, isDark, isRTL],
  );
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<StatsData>({
    courses: 0,
    progress: 0,
    certificates: 0,
  });

  // Modal states
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [legalContent, setLegalContent] = useState<
    "privacy" | "terms" | "data"
  >("privacy");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [comingSoonVisible, setComingSoonVisible] = useState(false);
  const [comingSoonConfig, setComingSoonConfig] = useState({
    title: "",
    description: "",
    icon: "rocket-outline" as any,
  });

  // Form states
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Animations
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(30)).current;

  // Tab bar height
  const TAB_BAR_HEIGHT =
    56 + Math.max(insets.bottom, Platform.OS === "android" ? 12 : 24);

  // Show coming soon modal helper
  const showComingSoon = (
    title: string,
    description: string,
    icon: keyof typeof Ionicons.glyphMap = "rocket-outline",
  ) => {
    setComingSoonConfig({ title, description, icon });
    setComingSoonVisible(true);
  };

  // Refresh stats when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, []),
  );

  useEffect(() => {
    loadProfile();
    animateIn();
  }, []);

  const animateIn = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const loadStats = async () => {
    try {
      const enrollments = await fetchMyEnrollments();
      const totalProgress =
        enrollments.length > 0
          ? Math.round(
              enrollments.reduce((acc, e) => acc + (e.progress || 0), 0) /
                enrollments.length,
            )
          : 0;

      setStats({
        courses: enrollments.length,
        progress: totalProgress,
        certificates: enrollments.filter((e) => e.progress === 100).length,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const loadProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("id", user.id)
          .single();
        if (profile?.full_name) {
          setFullName(profile.full_name);
        }
        if (profile?.avatar_url) {
          setAvatarUrl(profile.avatar_url);
        }
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  };

  const handleUpdateProfile = async () => {
    if (!fullName.trim()) {
      Alert.alert(t.error, t.required);
      return;
    }
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from("profiles")
          .update({ full_name: fullName.trim() })
          .eq("id", user.id);

        if (error) throw error;
        Alert.alert(t.success, t.profileUpdated);
        setEditProfileVisible(false);
      }
    } catch (error: any) {
      Alert.alert(t.error, error.message || "Failed to update profile");
    }
  };

  const handleAvatarChange = async (url: string | null) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from("profiles")
          .update({ avatar_url: url })
          .eq("id", user.id);

        if (error) throw error;
        setAvatarUrl(url);
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to update avatar");
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert(t.error, t.passwordMinLength);
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t.error, t.passwordsNotMatch);
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      Alert.alert(t.success, t.passwordUpdated);
      setChangePasswordVisible(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      Alert.alert(t.error, error.message || "Failed to update password");
    }
  };

  const handleDeleteAccountRequest = () => {
    Alert.alert(t.deleteAccountTitle, t.deleteAccountWarning, [
      { text: t.cancel, style: "cancel" },
      {
        text: t.requestDeletion,
        style: "destructive",
        onPress: async () => {
          try {
            const {
              data: { user },
            } = await supabase.auth.getUser();
            if (!user) {
              Alert.alert(t.error, t.signIn);
              return;
            }

            // Insert deletion request into database
            const { error } = await supabase
              .from("account_deletion_requests")
              .insert({
                user_id: user.id,
                email: user.email,
                reason: "User requested via mobile app",
                status: "pending",
              });

            if (error) {
              // If table doesn't exist yet, show alternative message
              if (error.code === "42P01") {
                Alert.alert(t.deletionRequested, t.deletionConfirmation, [
                  { text: t.ok },
                ]);
              } else {
                throw error;
              }
            } else {
              Alert.alert(t.deletionRequested, t.deletionConfirmation, [
                { text: t.ok, onPress: signOut },
              ]);
            }
          } catch (error: any) {
            Alert.alert(
              t.error,
              error.message || "Failed to submit deletion request",
            );
          }
        },
      },
    ]);
  };

  const handleOpenLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error("Error opening link:", error);
      Alert.alert("Error", "Could not open link");
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  const handleSignOut = () => {
    Alert.alert(t.signOut, t.signOutConfirm, [
      { text: t.cancel, style: "cancel" },
      { text: t.signOut, style: "destructive", onPress: signOut },
    ]);
  };

  const menuSections: { title: string; items: MenuItem[] }[] = [
    {
      title: t.accountSettings,
      items: [
        {
          icon: "person-outline",
          label: t.editProfile,
          subtitle: t.personalInfo,
          onPress: () => setEditProfileVisible(true),
        },
        {
          icon: "lock-closed-outline",
          label: t.changePassword,
          subtitle: t.accountSettings,
          onPress: () => setChangePasswordVisible(true),
        },
      ],
    },
    {
      title: t.learn,
      items: [
        {
          icon: "cloud-download-outline",
          label: t.downloads,
          subtitle: t.offlineAvailable,
          onPress: () => router.push("/(student)/downloads"),
        },
        {
          icon: "bookmark-outline",
          label: t.bookmarks,
          subtitle: t.savedLessons,
          onPress: () =>
            showComingSoon(
              t.bookmarks,
              t.featureComingSoon,
              "bookmark-outline",
            ),
        },
        {
          icon: "trophy-outline",
          label: t.certificates,
          subtitle: t.myCertificates,
          badge:
            stats.certificates > 0 ? String(stats.certificates) : undefined,
          onPress: () => router.push("/(student)/certificates"),
        },
      ],
    },
    {
      title: t.settings,
      items: [
        {
          icon: "notifications-outline",
          label: t.notifications,
          subtitle: notificationsEnabled ? t.active : t.offline,
          onPress: () => {
            setNotificationsEnabled(!notificationsEnabled);
            Alert.alert(
              t.notifications,
              `${t.notifications} ${!notificationsEnabled ? t.active : t.offline}`,
            );
          },
        },
        {
          icon: isDark ? "moon" : "sunny-outline",
          label: t.appearance,
          subtitle:
            theme === "system"
              ? t.systemMode
              : isDark
                ? t.darkMode
                : t.lightMode,
          onPress: () => setThemeModalVisible(true),
        },
        {
          icon: "language-outline",
          label: t.language,
          subtitle: "English / العربية",
          onPress: () => setLanguageModalVisible(true),
        },
      ],
    },
    {
      title: t.support,
      items: [
        {
          icon: "chatbubble-outline",
          label: t.contactSupport,
          subtitle: t.faq,
          onPress: () => router.push("/(student)/support"),
        },
        {
          icon: "shield-checkmark-outline",
          label: t.privacyPolicy,
          subtitle: t.dataProtection,
          onPress: () => {
            setLegalContent("privacy");
            setLegalModalVisible(true);
          },
        },
        {
          icon: "document-text-outline",
          label: t.termsOfService,
          subtitle: t.legalInfo,
          onPress: () => {
            setLegalContent("terms");
            setLegalModalVisible(true);
          },
        },
        {
          icon: "finger-print-outline",
          label: t.yourDataRights,
          subtitle: t.dataProtection,
          onPress: () => {
            setLegalContent("data");
            setLegalModalVisible(true);
          },
        },
      ],
    },
    {
      title: t.deleteAccountTitle,
      items: [
        {
          icon: "trash-outline",
          label: t.deleteAccount,
          subtitle: t.deleteAccountWarning,
          danger: true,
          onPress: handleDeleteAccountRequest,
        },
      ],
    },
  ];

  const getUserInitials = () => {
    const email = session?.user.email || "";
    if (email.includes("@")) {
      return email.charAt(0).toUpperCase();
    }
    return "U";
  };

  const getUserName = () => {
    const email = session?.user.email || "User";
    return email
      .split("@")[0]
      .replace(/[._]/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: TAB_BAR_HEIGHT + Theme.spacing.lg },
        ]}
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
      >
        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View
            style={[
              styles.headerBackground,
              { backgroundColor: colors.primary },
            ]}
          />

          <View style={styles.headerContent}>
            <ProfilePhotoUpload
              value={avatarUrl}
              onChange={handleAvatarChange}
              userId={session?.user?.id}
              size={100}
              name={fullName || session?.user?.email?.split("@")[0]}
              showEditButton={true}
            />

            <Text style={[styles.userName, { color: colors.text }]}>
              {getUserName()}
            </Text>
            <Text style={[styles.email, { color: colors.textSecondary }]}>
              {session?.user.email}
            </Text>

            <View
              style={[styles.roleBadge, { backgroundColor: colors.surface }]}
            >
              <Ionicons
                name="school-outline"
                size={14}
                color={colors.primary}
              />
              <Text style={[styles.roleText, { color: colors.primary }]}>
                Student
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Stats Card */}
        <Animated.View
          style={[
            styles.statsCardWrapper,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Card style={[styles.statsCard, { backgroundColor: colors.surface }]}>
            <View style={styles.statItem}>
              <View
                style={[
                  styles.statIconContainer,
                  { backgroundColor: colors.primary + "15" },
                ]}
              >
                <Ionicons name="library" size={22} color={colors.primary} />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats.courses}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Courses
              </Text>
            </View>

            <View
              style={[styles.statDivider, { backgroundColor: colors.border }]}
            />

            <View style={styles.statItem}>
              <View
                style={[
                  styles.statIconContainer,
                  { backgroundColor: colors.success + "15" },
                ]}
              >
                <Ionicons name="trending-up" size={22} color={colors.success} />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats.progress}%
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Progress
              </Text>
            </View>

            <View
              style={[styles.statDivider, { backgroundColor: colors.border }]}
            />

            <View style={styles.statItem}>
              <View
                style={[
                  styles.statIconContainer,
                  { backgroundColor: colors.warning + "15" },
                ]}
              >
                <Ionicons name="trophy" size={22} color={colors.warning} />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats.certificates}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Certificates
              </Text>
            </View>
          </Card>
        </Animated.View>

        {/* Menu Sections */}
        {menuSections.map((section, sectionIndex) => (
          <Animated.View
            key={section.title}
            style={[
              styles.menuSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text
              style={[styles.sectionTitle, { color: colors.textSecondary }]}
            >
              {section.title}
            </Text>
            <View
              style={[styles.menuCard, { backgroundColor: colors.surface }]}
            >
              {section.items.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.menuItem,
                    index < section.items.length - 1 && [
                      styles.menuItemBorder,
                      { borderBottomColor: colors.borderLight },
                    ],
                    item.danger && styles.menuItemDanger,
                  ]}
                  onPress={item.onPress}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.menuIconContainer,
                      {
                        backgroundColor: item.danger
                          ? colors.error + "10"
                          : colors.primary + "10",
                      },
                    ]}
                  >
                    <Ionicons
                      name={item.icon}
                      size={20}
                      color={item.danger ? colors.error : colors.primary}
                    />
                  </View>

                  <View style={styles.menuItemContent}>
                    <Text
                      style={[
                        styles.menuItemText,
                        { color: item.danger ? colors.error : colors.text },
                      ]}
                    >
                      {item.label}
                    </Text>
                    {item.subtitle && (
                      <Text
                        style={[
                          styles.menuItemSubtitle,
                          { color: colors.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        {item.subtitle}
                      </Text>
                    )}
                  </View>

                  <View style={styles.menuItemRight}>
                    {item.badge && (
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: colors.primary },
                        ]}
                      >
                        <Text
                          style={[styles.badgeText, { color: colors.surface }]}
                        >
                          {item.badge}
                        </Text>
                      </View>
                    )}
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.textTertiary}
                    />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        ))}

        {/* Sign Out */}
        <Animated.View
          style={[
            styles.signOutSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.signOutButton,
              {
                backgroundColor: colors.error + "10",
                borderColor: colors.error + "30",
              },
            ]}
            onPress={handleSignOut}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={22} color={colors.error} />
            <Text style={[styles.signOutText, { color: colors.error }]}>
              Sign Out
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.version, { color: colors.textSecondary }]}>
            ISE Learning • Version 1.0.0
          </Text>
          <Text style={[styles.copyright, { color: colors.textTertiary }]}>
            © 2026 ISE. All rights reserved.
          </Text>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={editProfileVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditProfileVisible(false)}
      >
        <View
          style={[
            styles.modalOverlay,
            { backgroundColor: isDark ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.5)" },
          ]}
        >
          <View
            style={[styles.modalContent, { backgroundColor: colors.surface }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Edit Profile
              </Text>
              <TouchableOpacity onPress={() => setEditProfileVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Text
                style={[styles.inputLabel, { color: colors.textSecondary }]}
              >
                Full Name
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    color: colors.textPrimary,
                    borderColor: colors.border,
                  },
                ]}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your full name"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text
                style={[styles.inputLabel, { color: colors.textSecondary }]}
              >
                Email
              </Text>
              <TextInput
                style={[
                  styles.input,
                  styles.inputDisabled,
                  {
                    backgroundColor: colors.background,
                    color: colors.textPrimary,
                    borderColor: colors.border,
                  },
                ]}
                value={session?.user.email || ""}
                editable={false}
              />
            </View>

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.primary }]}
              onPress={handleUpdateProfile}
            >
              <Text style={[styles.modalButtonText, { color: colors.surface }]}>
                Save Changes
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        visible={changePasswordVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setChangePasswordVisible(false)}
      >
        <View
          style={[
            styles.modalOverlay,
            { backgroundColor: isDark ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.5)" },
          ]}
        >
          <View
            style={[styles.modalContent, { backgroundColor: colors.surface }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Change Password
              </Text>
              <TouchableOpacity onPress={() => setChangePasswordVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Text
                style={[styles.inputLabel, { color: colors.textSecondary }]}
              >
                New Password
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    color: colors.textPrimary,
                    borderColor: colors.border,
                  },
                ]}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
              />
            </View>

            <View style={styles.inputContainer}>
              <Text
                style={[styles.inputLabel, { color: colors.textSecondary }]}
              >
                Confirm Password
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    color: colors.textPrimary,
                    borderColor: colors.border,
                  },
                ]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.primary }]}
              onPress={handleChangePassword}
            >
              <Text style={[styles.modalButtonText, { color: colors.surface }]}>
                Update Password
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Theme Selection Modal */}
      <Modal
        visible={themeModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setThemeModalVisible(false)}
      >
        <View
          style={[
            styles.modalOverlay,
            { backgroundColor: isDark ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.5)" },
          ]}
        >
          <View
            style={[styles.modalContent, { backgroundColor: colors.surface }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Appearance
              </Text>
              <TouchableOpacity onPress={() => setThemeModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.themeOptions}>
              {[
                { value: "light", label: "Light", icon: "sunny-outline" },
                { value: "dark", label: "Dark", icon: "moon-outline" },
                {
                  value: "system",
                  label: "System",
                  icon: "phone-portrait-outline",
                },
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.themeOption,
                    {
                      backgroundColor:
                        theme === option.value
                          ? colors.primary + "15"
                          : colors.background,
                      borderColor:
                        theme === option.value ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => {
                    setTheme(option.value as any);
                    setThemeModalVisible(false);
                  }}
                >
                  <Ionicons
                    name={option.icon as any}
                    size={24}
                    color={
                      theme === option.value
                        ? colors.primary
                        : colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.themeOptionText,
                      {
                        color:
                          theme === option.value ? colors.primary : colors.text,
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                  {theme === option.value && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={colors.primary}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Coming Soon Modal */}
      <ComingSoonModal
        visible={comingSoonVisible}
        onClose={() => setComingSoonVisible(false)}
        title={comingSoonConfig.title}
        description={comingSoonConfig.description}
        icon={comingSoonConfig.icon}
      />

      {/* Language Selector Modal */}
      <LanguageSelector
        visible={languageModalVisible}
        onClose={() => setLanguageModalVisible(false)}
      />

      {/* Legal Information Modal */}
      <Modal
        visible={legalModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setLegalModalVisible(false)}
      >
        <View
          style={[
            styles.modalOverlay,
            { backgroundColor: isDark ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.5)" },
          ]}
        >
          <View
            style={[
              styles.legalModalContent,
              { backgroundColor: colors.surface },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {legalContent === "privacy"
                  ? t.privacyPolicy
                  : legalContent === "terms"
                    ? t.termsOfService
                    : t.yourDataRights}
              </Text>
              <TouchableOpacity onPress={() => setLegalModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.legalScrollContent}
              showsVerticalScrollIndicator={false}
              scrollEnabled={true}
              scrollEventThrottle={16}
              bounces={true}
              alwaysBounceVertical={true}
            >
              {legalContent === "privacy" && (
                <View>
                  <View
                    style={[
                      styles.legalInfoCard,
                      { backgroundColor: colors.primary + "10" },
                    ]}
                  >
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={24}
                      color={colors.primary}
                    />
                    <Text
                      style={[
                        styles.legalInfoText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {isRTL
                        ? "نحن ملتزمون بحماية خصوصيتك وبياناتك الشخصية."
                        : "We are committed to protecting your privacy and personal data."}
                    </Text>
                  </View>
                  <Text
                    style={[styles.legalText, { color: colors.textSecondary }]}
                  >
                    {isRTL
                      ? `سياسة الخصوصية\n\nنحن نجمع فقط المعلومات الضرورية لتقديم خدماتنا التعليمية. يشمل ذلك:\n\n• معلومات الحساب (الاسم، البريد الإلكتروني)\n• بيانات التعلم (التقدم، الدرجات، الشهادات)\n• معلومات الجهاز للدعم الفني\n\nلن نشارك بياناتك مع أطراف ثالثة دون موافقتك الصريحة. يمكنك طلب حذف بياناتك في أي وقت من خلال إعدادات الحساب.`
                      : `Privacy Policy\n\nWe only collect information necessary to provide our educational services. This includes:\n\n• Account information (name, email)\n• Learning data (progress, grades, certificates)\n• Device information for technical support\n\nWe will not share your data with third parties without your explicit consent. You can request deletion of your data at any time through account settings.`}
                  </Text>
                </View>
              )}

              {legalContent === "terms" && (
                <View>
                  <View
                    style={[
                      styles.legalInfoCard,
                      { backgroundColor: colors.primary + "10" },
                    ]}
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={24}
                      color={colors.primary}
                    />
                    <Text
                      style={[
                        styles.legalInfoText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {isRTL
                        ? "باستخدام خدماتنا، فإنك توافق على هذه الشروط."
                        : "By using our services, you agree to these terms."}
                    </Text>
                  </View>
                  <Text
                    style={[styles.legalText, { color: colors.textSecondary }]}
                  >
                    {isRTL
                      ? `شروط الخدمة\n\n1. الاستخدام المقبول\nيجب استخدام المنصة للأغراض التعليمية فقط. يُحظر مشاركة بيانات الدخول.\n\n2. المحتوى\nجميع المواد التعليمية محمية بحقوق الطبع والنشر. لا يجوز نسخها أو توزيعها.\n\n3. الحسابات\nأنت مسؤول عن الحفاظ على سرية حسابك وكلمة المرور.\n\n4. الإنهاء\nيحق لنا إنهاء الحسابات التي تنتهك هذه الشروط.`
                      : `Terms of Service\n\n1. Acceptable Use\nThe platform must be used for educational purposes only. Sharing login credentials is prohibited.\n\n2. Content\nAll educational materials are protected by copyright. They may not be copied or distributed.\n\n3. Accounts\nYou are responsible for maintaining the confidentiality of your account and password.\n\n4. Termination\nWe reserve the right to terminate accounts that violate these terms.`}
                  </Text>
                </View>
              )}

              {legalContent === "data" && (
                <View>
                  <View
                    style={[
                      styles.legalInfoCard,
                      { backgroundColor: colors.primary + "10" },
                    ]}
                  >
                    <Ionicons
                      name="finger-print-outline"
                      size={24}
                      color={colors.primary}
                    />
                    <Text
                      style={[
                        styles.legalInfoText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {isRTL
                        ? "لديك حقوق كاملة في التحكم ببياناتك الشخصية."
                        : "You have full rights to control your personal data."}
                    </Text>
                  </View>

                  <Text
                    style={[styles.legalSectionTitle, { color: colors.text }]}
                  >
                    {t.yourDataRights}
                  </Text>

                  <View style={styles.dataRightsGrid}>
                    <View
                      style={[
                        styles.dataRightItem,
                        { backgroundColor: colors.background },
                      ]}
                    >
                      <Ionicons
                        name="eye-outline"
                        size={24}
                        color={colors.primary}
                      />
                      <Text
                        style={[styles.dataRightTitle, { color: colors.text }]}
                      >
                        {t.accessData}
                      </Text>
                      <Text
                        style={[
                          styles.dataRightDesc,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {isRTL ? "عرض جميع بياناتك" : "View all your data"}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.dataRightItem,
                        { backgroundColor: colors.background },
                      ]}
                    >
                      <Ionicons
                        name="create-outline"
                        size={24}
                        color={colors.primary}
                      />
                      <Text
                        style={[styles.dataRightTitle, { color: colors.text }]}
                      >
                        {t.correctData}
                      </Text>
                      <Text
                        style={[
                          styles.dataRightDesc,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {isRTL ? "تعديل معلوماتك" : "Update your info"}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.dataRightItem,
                        { backgroundColor: colors.background },
                      ]}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={24}
                        color={colors.primary}
                      />
                      <Text
                        style={[styles.dataRightTitle, { color: colors.text }]}
                      >
                        {t.deleteData}
                      </Text>
                      <Text
                        style={[
                          styles.dataRightDesc,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {isRTL ? "حذف حسابك" : "Delete your account"}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.dataRightItem,
                        { backgroundColor: colors.background },
                      ]}
                    >
                      <Ionicons
                        name="download-outline"
                        size={24}
                        color={colors.primary}
                      />
                      <Text
                        style={[styles.dataRightTitle, { color: colors.text }]}
                      >
                        {t.exportData}
                      </Text>
                      <Text
                        style={[
                          styles.dataRightDesc,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {isRTL ? "تصدير بياناتك" : "Export your data"}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Contact Info */}
              <View
                style={[
                  styles.legalContactCard,
                  { borderColor: colors.border },
                ]}
              >
                <Text
                  style={[styles.legalContactTitle, { color: colors.text }]}
                >
                  {t.questionsContact}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.legalEmailButton,
                    { backgroundColor: colors.primary },
                  ]}
                  onPress={() => Linking.openURL("mailto:legal@ise.com")}
                >
                  <Ionicons name="mail-outline" size={18} color="#fff" />
                  <Text style={styles.legalEmailButtonText}>legal@ise.com</Text>
                </TouchableOpacity>
              </View>

              <Text
                style={[
                  styles.legalLastUpdated,
                  { color: colors.textTertiary },
                ]}
              >
                {t.lastUpdated}: February 1, 2026
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (
  colors: typeof Theme.colors.light,
  isDark: boolean,
  isRTL: boolean = false,
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      // paddingBottom handled dynamically via TAB_BAR_HEIGHT
    },
    header: {
      alignItems: "center",
      paddingBottom: Theme.spacing["2xl"],
      paddingHorizontal: Theme.spacing.lg,
      zIndex: 1,
    },
    headerBackground: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 200,
      backgroundColor: colors.primary,
      borderBottomLeftRadius: 30,
      borderBottomRightRadius: 30,
    },
    headerContent: {
      alignItems: "center",
      zIndex: 10,
      elevation: 10,
    },
    avatarContainer: {
      position: "relative",
      marginTop: Theme.spacing.xl,
      marginBottom: Theme.spacing.md,
    },
    avatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 4,
      borderColor: colors.surface,
      ...Theme.shadows[isDark ? "dark" : "light"].lg,
    },
    avatarText: {
      fontSize: 40,
      fontWeight: Theme.fontWeight.extrabold,
      color: colors.primary,
    },
    editAvatarButton: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 3,
      borderColor: colors.surface,
    },
    userName: {
      fontSize: Theme.fontSize.xl,
      fontWeight: Theme.fontWeight.bold,
      color: colors.text,
      marginBottom: Theme.spacing.xs,
    },
    email: {
      fontSize: Theme.fontSize.sm,
      color: colors.textSecondary,
      marginBottom: Theme.spacing.sm,
    },
    roleBadge: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Theme.spacing.xs,
      backgroundColor: colors.surface,
      paddingHorizontal: Theme.spacing.lg,
      paddingVertical: Theme.spacing.sm,
      borderRadius: Theme.borderRadius.round,
      marginTop: Theme.spacing.sm,
      borderWidth: 1,
      borderColor: colors.primary + "30",
      zIndex: 10,
      elevation: 5,
    },
    roleText: {
      fontSize: Theme.fontSize.sm,
      color: colors.primary,
      fontWeight: Theme.fontWeight.bold,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    statsCardWrapper: {
      paddingHorizontal: Theme.spacing.lg,
      marginTop: Theme.spacing.lg,
    },
    statsCard: {
      flexDirection: "row",
      justifyContent: "space-around",
      alignItems: "center",
      paddingVertical: Theme.spacing.lg,
      ...Theme.shadows[isDark ? "dark" : "light"].md,
    },
    statItem: {
      alignItems: "center",
      flex: 1,
    },
    statIconContainer: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Theme.spacing.sm,
    },
    statValue: {
      fontSize: Theme.fontSize.xl,
      fontWeight: Theme.fontWeight.extrabold,
      color: colors.text,
      marginBottom: 2,
    },
    statLabel: {
      fontSize: Theme.fontSize.xs,
      color: colors.textSecondary,
      fontWeight: Theme.fontWeight.medium,
    },
    statDivider: {
      width: 1,
      height: 50,
      backgroundColor: colors.border,
    },
    menuSection: {
      paddingHorizontal: Theme.spacing.lg,
      marginTop: Theme.spacing.xl,
    },
    sectionTitle: {
      fontSize: Theme.fontSize.xs,
      fontWeight: Theme.fontWeight.bold,
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: Theme.spacing.sm,
      marginLeft: Theme.spacing.xs,
    },
    menuCard: {
      backgroundColor: colors.surface,
      borderRadius: Theme.borderRadius.xl,
      overflow: "hidden",
      ...Theme.shadows[isDark ? "dark" : "light"].sm,
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: Theme.spacing.md,
    },
    menuItemBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    menuItemDanger: {},
    menuIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.primary + "10",
      alignItems: "center",
      justifyContent: "center",
      marginRight: Theme.spacing.md,
    },
    menuIconContainerDanger: {
      backgroundColor: colors.error + "10",
    },
    menuItemContent: {
      flex: 1,
    },
    menuItemText: {
      fontSize: Theme.fontSize.base,
      color: colors.text,
      fontWeight: Theme.fontWeight.medium,
    },
    menuItemTextDanger: {
      color: colors.error,
    },
    menuItemSubtitle: {
      fontSize: Theme.fontSize.xs,
      color: colors.textSecondary,
      marginTop: 2,
    },
    menuItemRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.sm,
    },
    badge: {
      backgroundColor: colors.primary,
      paddingHorizontal: Theme.spacing.sm,
      paddingVertical: 2,
      borderRadius: Theme.borderRadius.round,
      minWidth: 22,
      alignItems: "center",
    },
    badgeText: {
      fontSize: Theme.fontSize.xs,
      color: colors.surface,
      fontWeight: Theme.fontWeight.bold,
    },
    signOutSection: {
      paddingHorizontal: Theme.spacing.lg,
      marginTop: Theme.spacing["2xl"],
    },
    signOutButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Theme.spacing.sm,
      backgroundColor: colors.error + "10",
      paddingVertical: Theme.spacing.md,
      borderRadius: Theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.error + "30",
    },
    signOutText: {
      fontSize: Theme.fontSize.base,
      color: colors.error,
      fontWeight: Theme.fontWeight.semibold,
    },
    footer: {
      alignItems: "center",
      marginTop: Theme.spacing["2xl"],
      paddingHorizontal: Theme.spacing.lg,
    },
    version: {
      fontSize: Theme.fontSize.sm,
      color: colors.textSecondary,
      fontWeight: Theme.fontWeight.medium,
      marginBottom: Theme.spacing.xs,
    },
    copyright: {
      fontSize: Theme.fontSize.xs,
      color: colors.textTertiary,
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: Theme.spacing.lg,
      paddingBottom: Theme.spacing["3xl"],
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: Theme.spacing.lg,
    },
    modalTitle: {
      fontSize: Theme.fontSize.xl,
      fontWeight: Theme.fontWeight.bold,
      color: colors.textPrimary,
    },
    inputContainer: {
      marginBottom: Theme.spacing.md,
    },
    inputLabel: {
      fontSize: Theme.fontSize.sm,
      fontWeight: Theme.fontWeight.medium,
      color: colors.textSecondary,
      marginBottom: Theme.spacing.xs,
    },
    input: {
      backgroundColor: colors.background,
      borderRadius: Theme.borderRadius.md,
      paddingHorizontal: Theme.spacing.md,
      paddingVertical: Theme.spacing.sm,
      fontSize: Theme.fontSize.base,
      color: colors.textPrimary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inputDisabled: {
      opacity: 0.6,
    },
    modalButton: {
      backgroundColor: colors.primary,
      borderRadius: Theme.borderRadius.md,
      paddingVertical: Theme.spacing.md,
      alignItems: "center",
      marginTop: Theme.spacing.md,
    },
    modalButtonText: {
      color: colors.surface,
      fontSize: Theme.fontSize.base,
      fontWeight: Theme.fontWeight.semibold,
    },
    storageInfo: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.sm,
      backgroundColor: colors.primary + "10",
      padding: Theme.spacing.md,
      borderRadius: Theme.borderRadius.md,
      marginBottom: Theme.spacing.md,
    },
    storageText: {
      fontSize: Theme.fontSize.sm,
      color: colors.textPrimary,
      fontWeight: Theme.fontWeight.medium,
    },
    downloadsList: {
      maxHeight: 400,
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: Theme.spacing["2xl"],
    },
    emptyStateText: {
      fontSize: Theme.fontSize.base,
      fontWeight: Theme.fontWeight.medium,
      color: colors.textSecondary,
      marginTop: Theme.spacing.md,
    },
    emptyStateSubtext: {
      fontSize: Theme.fontSize.sm,
      color: colors.textTertiary,
      marginTop: Theme.spacing.xs,
    },
    downloadItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: Theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    downloadItemIcon: {
      width: 44,
      height: 44,
      borderRadius: Theme.borderRadius.md,
      backgroundColor: colors.primary + "10",
      alignItems: "center",
      justifyContent: "center",
      marginRight: Theme.spacing.md,
    },
    downloadItemInfo: {
      flex: 1,
    },
    downloadItemTitle: {
      fontSize: Theme.fontSize.base,
      fontWeight: Theme.fontWeight.medium,
      color: colors.textPrimary,
    },
    downloadItemSubtitle: {
      fontSize: Theme.fontSize.xs,
      color: colors.textSecondary,
      marginTop: 2,
    },
    downloadItemDelete: {
      padding: Theme.spacing.sm,
    },
    themeOptions: {
      gap: Theme.spacing.sm,
    },
    themeOption: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      padding: Theme.spacing.md,
      borderRadius: Theme.borderRadius.md,
      borderWidth: 1.5,
      gap: Theme.spacing.md,
    },
    themeOptionText: {
      flex: 1,
      fontSize: Theme.fontSize.base,
      fontFamily: "Inter-Medium",
      textAlign: isRTL ? "right" : "left",
    },
    // Legal Modal styles
    legalModalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: Theme.spacing.lg,
      paddingBottom: Theme.spacing["3xl"],
      maxHeight: "85%",
      height: "auto",
    },
    legalScrollContent: {
      flexGrow: 1,
      paddingBottom: Theme.spacing["2xl"],
    },
    legalInfoCard: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      padding: Theme.spacing.md,
      borderRadius: Theme.borderRadius.md,
      marginBottom: Theme.spacing.lg,
      gap: Theme.spacing.sm,
    },
    legalInfoText: {
      flex: 1,
      fontSize: Theme.fontSize.sm,
      lineHeight: 20,
      textAlign: isRTL ? "right" : "left",
    },
    legalText: {
      fontSize: Theme.fontSize.sm,
      lineHeight: 22,
      textAlign: isRTL ? "right" : "left",
    },
    legalSectionTitle: {
      fontSize: Theme.fontSize.lg,
      fontWeight: Theme.fontWeight.bold,
      marginBottom: Theme.spacing.md,
      textAlign: isRTL ? "right" : "left",
    },
    dataRightsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Theme.spacing.md,
      marginTop: Theme.spacing.md,
    },
    dataRightItem: {
      width: "47%",
      padding: Theme.spacing.md,
      borderRadius: Theme.borderRadius.md,
      alignItems: "center",
      gap: Theme.spacing.xs,
    },
    dataRightTitle: {
      fontSize: Theme.fontSize.sm,
      fontWeight: Theme.fontWeight.semibold,
    },
    dataRightDesc: {
      fontSize: Theme.fontSize.xs,
      textAlign: "center",
    },
    legalContactCard: {
      padding: Theme.spacing.lg,
      borderRadius: Theme.borderRadius.lg,
      borderWidth: 1,
      alignItems: "center",
      marginTop: Theme.spacing.xl,
    },
    legalContactTitle: {
      fontSize: Theme.fontSize.sm,
      textAlign: "center",
      marginBottom: Theme.spacing.md,
    },
    legalEmailButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: Theme.spacing.xs,
      paddingHorizontal: Theme.spacing.lg,
      paddingVertical: Theme.spacing.sm,
      borderRadius: Theme.borderRadius.full,
    },
    legalEmailButtonText: {
      color: "#fff",
      fontSize: Theme.fontSize.sm,
      fontWeight: Theme.fontWeight.semibold,
    },
    legalLastUpdated: {
      fontSize: Theme.fontSize.xs,
      textAlign: "center",
      marginTop: Theme.spacing.lg,
      marginBottom: Theme.spacing.xl,
    },
  });
