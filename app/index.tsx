import { Colors } from "@/constants/theme";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../src/features/auth/AuthContext";

export default function Index() {
  const { session, isLoading, userRole, isAdmin, forceSignOut } = useAuth();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showDebug, setShowDebug] = useState(false);

  // Log every render with all state values
  console.log('[INDEX] Render — isLoading:', isLoading, ', session:', !!session, ', userRole:', userRole || 'null', ', isAdmin:', isAdmin);

  // Track how long we've been loading
  useEffect(() => {
    if (!isLoading) {
      console.log('[INDEX] isLoading became false, resetting elapsed timer');
      setElapsedSeconds(0);
      return;
    }
    console.log('[INDEX] isLoading is true, starting elapsed timer');
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        if (next % 5 === 0) {
          console.log('[INDEX] Still loading after', next, 's — session:', !!session, ', userRole:', userRole || 'null');
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isLoading]);

  // While loading auth state, show a loading indicator
  if (isLoading) {
    console.log('[INDEX] Rendering LOADING state (elapsed:', elapsedSeconds, 's)');
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
        {elapsedSeconds >= 5 && (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              console.log(
                "[INDEX] User tapped retry after",
                elapsedSeconds,
                "s",
              );
              forceSignOut();
            }}
          >
            <Text style={styles.retryText}>Taking too long? Tap to retry</Text>
          </TouchableOpacity>
        )}
        {elapsedSeconds >= 3 && (
          <TouchableOpacity onPress={() => setShowDebug(!showDebug)}>
            <Text style={styles.debugToggle}>{elapsedSeconds}s elapsed</Text>
          </TouchableOpacity>
        )}
        {showDebug && (
          <View style={styles.debugBox}>
            <Text style={styles.debugText}>
              session: {session ? "yes" : "no"}
            </Text>
            <Text style={styles.debugText}>role: {userRole || "none"}</Text>
            <Text style={styles.debugText}>isAdmin: {String(isAdmin)}</Text>
          </View>
        )}
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
      console.log('[INDEX] Redirecting to ADMIN dashboard (role:', userRole, ')');
      return <Redirect href="/(admin)/dashboard" />;
    }
    if (userRole === "support_manager") {
      console.log('[INDEX] Redirecting to support-manager dashboard');
      return <Redirect href="/support-manager/dashboard" />;
    }
    if (userRole === "support") {
      console.log('[INDEX] Redirecting to support dashboard');
      return <Redirect href="/support/dashboard" />;
    }
    // Default to student dashboard
    console.log('[INDEX] Redirecting to STUDENT dashboard (role:', userRole, ')');
    return <Redirect href="/(student)/dashboard" />;
  }

  console.log('[INDEX] No session, redirecting to login');
  return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.light.textSecondary || "#666",
  },
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.light.primary,
    borderRadius: 8,
  },
  retryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  debugToggle: {
    marginTop: 16,
    fontSize: 12,
    color: "#999",
  },
  debugBox: {
    marginTop: 8,
    padding: 12,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
  },
  debugText: {
    fontSize: 11,
    color: "#666",
    fontFamily: "monospace",
  },
});
