import { Theme } from "@/constants/theme";
import Constants from "expo-constants";
import {
    ChevronRight,
    Info,
    LogOut,
    Moon,
    Shield,
    Sun,
} from "lucide-react-native";
import React from "react";
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../src/context/ThemeContext";
import { useAuth } from "../../src/features/auth/AuthContext";

export default function AdminSettings() {
  const { colors, isDark, toggleTheme } = useTheme();
  const { signOut, userProfile } = useAuth();

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: signOut,
      },
    ]);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      padding: 24,
      paddingTop: 16,
    },
    title: {
      fontSize: 28,
      fontWeight: "700",
      color: colors.text,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      marginTop: 8,
    },
    content: {
      paddingHorizontal: 20,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: 12,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    lastRow: {
      borderBottomWidth: 0,
    },
    rowIcon: {
      width: 40,
      height: 40,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 14,
    },
    rowContent: {
      flex: 1,
    },
    rowTitle: {
      fontSize: 16,
      fontWeight: "500",
      color: colors.text,
    },
    rowSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 2,
    },
    signOutButton: {
      backgroundColor: "#ef444420",
      borderRadius: 12,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    signOutText: {
      color: "#ef4444",
      fontSize: 16,
      fontWeight: "600",
      marginLeft: 8,
    },
    versionText: {
      textAlign: "center",
      color: colors.textSecondary,
      fontSize: 13,
      marginTop: 24,
      marginBottom: 20,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Admin preferences</Text>
        </View>

        <View style={styles.content}>
          {/* Account */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.card}>
              <View style={[styles.row, styles.lastRow]}>
                <View
                  style={[
                    styles.rowIcon,
                    { backgroundColor: colors.primary + "20" },
                  ]}
                >
                  <Shield color={colors.primary} size={20} />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowTitle}>
                    {userProfile?.full_name || "Admin"}
                  </Text>
                  <Text style={styles.rowSubtitle}>{userProfile?.email}</Text>
                  <Text style={[styles.rowSubtitle, { color: colors.primary }]}>
                    Administrator
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Preferences */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preferences</Text>
            <View style={styles.card}>
              <TouchableOpacity
                style={[styles.row, styles.lastRow]}
                onPress={toggleTheme}
              >
                <View
                  style={[
                    styles.rowIcon,
                    {
                      backgroundColor: isDark
                        ? "rgba(251, 191, 36, 0.1)"
                        : "rgba(59, 130, 246, 0.1)",
                    },
                  ]}
                >
                  {isDark ? (
                    <Sun color="#fbbf24" size={20} />
                  ) : (
                    <Moon color="#3b82f6" size={20} />
                  )}
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowTitle}>Appearance</Text>
                  <Text style={styles.rowSubtitle}>
                    {isDark ? "Dark mode" : "Light mode"}
                  </Text>
                </View>
                <ChevronRight color={colors.textSecondary} size={20} />
              </TouchableOpacity>
            </View>
          </View>

          {/* About */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <View style={styles.card}>
              <View style={[styles.row, styles.lastRow]}>
                <View
                  style={[
                    styles.rowIcon,
                    { backgroundColor: "rgba(139, 92, 246, 0.1)" },
                  ]}
                >
                  <Info color="#8b5cf6" size={20} />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowTitle}>ISE LMS Admin</Text>
                  <Text style={styles.rowSubtitle}>
                    Version {Constants.expoConfig?.version || "1.0.0"}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Sign Out */}
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <LogOut color={Theme.colors.light.error} size={20} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>

          <Text style={styles.versionText}>
            Admin Mobile View • ISE Learning Management System
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
