import { Theme } from "@/constants/theme";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import {
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../../src/components/Button";
import { Input } from "../../src/components/Input";
import { useLocalization } from "../../src/context/LocalizationContext";
import { useTheme } from "../../src/context/ThemeContext";
import { useAuth } from "../../src/features/auth/AuthContext";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signInWithPassword, signUp, session, isLoading } = useAuth();
  const { colors, isDark } = useTheme();
  const { t, isRTL } = useLocalization();

  // Auth navigation is handled by AuthContext — no Redirect here to avoid conflicts

  const handleSubmit = async () => {
    console.log('[LOGIN] handleSubmit called, isSignUp:', isSignUp);
    if (!email || !password) {
      Alert.alert(t.error, t.enterEmailPassword);
      return;
    }

    if (isSignUp && !fullName.trim()) {
      Alert.alert(t.error, t.enterFullName);
      return;
    }

    console.log('[LOGIN] Setting loading=true');
    setLoading(true);
    const startTime = Date.now();
    try {
      if (isSignUp) {
        console.log('[LOGIN] Calling signUp...');
        await signUp(email, password, fullName.trim());
        console.log('[LOGIN] signUp completed in', Date.now() - startTime, 'ms');
        Alert.alert(
          t.accountCreatedTitle,
          t.accountCreatedMessage,
        );
        setIsSignUp(false);
        setEmail("");
        setPassword("");
        setFullName("");
      } else {
        console.log('[LOGIN] Calling signInWithPassword...');
        await signInWithPassword(email, password);
        console.log('[LOGIN] signInWithPassword returned in', Date.now() - startTime, 'ms');
        console.log('[LOGIN] Waiting for auth state change to trigger navigation...');
        // Navigation will happen via useEffect when session is set
      }
    } catch (error: any) {
      console.error('[LOGIN] Auth error after', Date.now() - startTime, 'ms:', error);
      let errorMessage = error.message || t.error;

      if (
        errorMessage.includes("NetworkError") ||
        errorMessage.includes("Failed to fetch")
      ) {
        errorMessage = t.networkErrorMessage;
      } else if (errorMessage.includes("Invalid login credentials")) {
        errorMessage = t.invalidLoginMessage;
      } else if (errorMessage.includes("User already registered")) {
        errorMessage = t.userAlreadyRegisteredMessage;
      }

      Alert.alert(isSignUp ? t.signUpFailedTitle : t.loginFailedTitle, errorMessage);
    } finally {
      console.log('[LOGIN] Setting loading=false, total time:', Date.now() - startTime, 'ms');
      setLoading(false);
    }
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar style={isDark ? "light" : "dark"} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <TouchableWithoutFeedback onPress={dismissKeyboard}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <View
                style={[
                  styles.logoContainer,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Text
                  style={[styles.logoText, { color: colors.textOnPrimary }]}
                >
                  ISE
                </Text>
              </View>
              <Text style={[styles.title, { color: colors.text }]}>
                {isSignUp ? t.createAccount : t.welcomeBack}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {isSignUp
                  ? t.signUpToGetStarted
                  : t.signInToAccessCourses}
              </Text>
            </View>

            <View style={styles.form}>
              {isSignUp && (
                <Input
                  label={t.fullName}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder={t.fullNamePlaceholder}
                  autoCapitalize="words"
                />
              )}

              <Input
                label={t.emailAddressLabel}
                value={email}
                onChangeText={setEmail}
                placeholder={t.emailPlaceholder}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Input
                label={t.password}
                value={password}
                onChangeText={setPassword}
                placeholder={
                  isSignUp
                    ? t.createPasswordPlaceholder
                    : t.passwordPlaceholder
                }
                secureTextEntry
              />

              <Button
                title={
                  loading
                    ? isSignUp
                      ? t.creatingAccount
                      : t.signingIn
                    : isSignUp
                      ? t.createAccount
                      : t.signIn
                }
                onPress={handleSubmit}
                disabled={loading}
                style={styles.submitButton}
              />

              <View
                style={[
                  styles.switchContainer,
                  isRTL && { flexDirection: "row-reverse" },
                ]}
              >
                <Text
                  style={[styles.switchText, { color: colors.textSecondary }]}
                >
                  {isSignUp
                    ? t.alreadyHaveAccount
                    : t.dontHaveAccount}
                </Text>
                <Button
                  title={isSignUp ? t.signIn : t.signUp}
                  onPress={() => {
                    setIsSignUp(!isSignUp);
                    setEmail("");
                    setPassword("");
                    setFullName("");
                  }}
                  variant="ghost"
                  style={styles.switchButton}
                />
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.light.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: Theme.spacing.lg,
  },
  header: {
    alignItems: "center",
    marginBottom: Theme.spacing.xl * 2,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: Theme.borderRadius.xl,
    backgroundColor: Theme.colors.light.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Theme.spacing.xl,
    ...Theme.shadows.light.lg,
  },
  logoText: {
    fontSize: Theme.fontSize["3xl"],
    fontWeight: Theme.fontWeight.extrabold,
    color: Theme.colors.light.surface,
    letterSpacing: 2,
  },
  title: {
    fontSize: Theme.fontSize["3xl"],
    fontWeight: Theme.fontWeight.bold,
    color: Theme.colors.light.text,
    marginBottom: Theme.spacing.sm,
    textAlign: "center",
  },
  subtitle: {
    fontSize: Theme.fontSize.lg,
    color: Theme.colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 24,
  },
  form: {
    width: "100%",
  },
  submitButton: {
    marginTop: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
  },
  switchContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: Theme.spacing.md,
  },
  switchText: {
    fontSize: Theme.fontSize.base,
    color: Theme.colors.light.textSecondary,
  },
  switchButton: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    minHeight: "auto",
  },
});
