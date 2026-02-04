import { Colors } from "@/constants/theme";
import { Redirect } from "expo-router";
import { View, StyleSheet, ActivityIndicator, Text } from "react-native";
import { useAuth } from "../src/features/auth/AuthContext";

export default function Index() {
  const { session, isLoading, userRole, isAdmin } = useAuth();

  // While loading auth state, show a loading indicator
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Redirect based on auth state
  if (session) {
    // Route based on user role
    if (
      isAdmin ||
      userRole === "admin" ||
      userRole === "instructor" ||
      userRole === "super_admin"
    ) {
      return <Redirect href="/(admin)/dashboard" />;
    }
    if (userRole === "support_manager") {
      return <Redirect href="/support-manager/dashboard" />;
    }
    if (userRole === "support") {
      return <Redirect href="/support/dashboard" />;
    }
    // Default to student dashboard
    return <Redirect href="/(student)/dashboard" />;
  }

  return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
});
