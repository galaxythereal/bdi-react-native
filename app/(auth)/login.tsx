import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { useAuth } from '../../src/features/auth/AuthContext';
import { BORDER_RADIUS, COLORS, FONT_SIZE, FONT_WEIGHT, SHADOWS, SPACING } from '../../src/lib/constants';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [usePassword, setUsePassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const { signInWithEmail, signInWithPassword, session, isLoading } = useAuth();
    const router = useRouter();

    // Navigate to dashboard when session is available
    useEffect(() => {
        if (!isLoading && session) {
            router.replace('/(student)/dashboard');
        }
    }, [session, isLoading, router]);

    const handleLogin = async () => {
        if (!email) {
            Alert.alert('Error', 'Please enter your email address');
            return;
        }

        if (usePassword && !password) {
            Alert.alert('Error', 'Please enter your password');
            return;
        }

        setLoading(true);
        try {
            if (usePassword) {
                await signInWithPassword(email, password);
                // Navigation will happen via useEffect when session is set
            } else {
                await signInWithEmail(email);
                Alert.alert('Check your email', 'We sent you a magic link to login!');
            }
        } catch (error: any) {
            console.error('Login error:', error);
            let errorMessage = error.message || 'An error occurred';
            
            if (errorMessage.includes('NetworkError') || errorMessage.includes('Failed to fetch')) {
                errorMessage = 'Network error: Please check your Supabase URL and internet connection. Make sure your .env file has EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY set.';
            } else if (errorMessage.includes('Invalid login credentials')) {
                errorMessage = 'Invalid email or password. Please check your credentials.';
            }
            
            Alert.alert('Login Failed', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const quickLogin = (testEmail: string, testPassword: string) => {
        setEmail(testEmail);
        setPassword(testPassword);
        setUsePassword(true);
    };

    const dismissKeyboard = () => {
        Keyboard.dismiss();
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.keyboardView}
            >
                <TouchableWithoutFeedback onPress={dismissKeyboard}>
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={styles.header}>
                            <View style={styles.logoContainer}>
                                <Text style={styles.logoText}>BDI</Text>
                            </View>
                            <Text style={styles.title}>Welcome Back</Text>
                            <Text style={styles.subtitle}>Sign in to access your courses</Text>
                        </View>

                        <View style={styles.form}>
                            <Input
                                label="Email Address"
                                value={email}
                                onChangeText={setEmail}
                                placeholder="student@test.com"
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />

                            {usePassword && (
                                <Input
                                    label="Password"
                                    value={password}
                                    onChangeText={setPassword}
                                    placeholder="Enter password"
                                    secureTextEntry
                                    containerStyle={styles.passwordInput}
                                />
                            )}

                            <Button
                                title={usePassword ? "Sign In" : "Sign In with Magic Link"}
                                onPress={handleLogin}
                                isLoading={loading}
                                style={styles.button}
                            />

                            <View style={styles.switchContainer}>
                                <Text style={styles.switchText} onPress={() => setUsePassword(!usePassword)}>
                                    {usePassword ? 'Use Magic Link instead' : 'Use Password instead'}
                                </Text>
                            </View>

                            {/* Quick Login for Testing */}
                            <View style={styles.quickLoginContainer}>
                                <Text style={styles.quickLoginLabel}>Quick Login (Test):</Text>
                                <View style={styles.quickLoginButtons}>
                                    <Button
                                        title="Student"
                                        onPress={() => quickLogin('student@test.com', 'student123')}
                                        variant="outline"
                                        size="sm"
                                        style={styles.quickButton}
                                    />
                                    <Button
                                        title="Admin"
                                        onPress={() => quickLogin('admin@test.com', 'admin123')}
                                        variant="outline"
                                        size="sm"
                                        style={styles.quickButton}
                                    />
                                </View>
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
        backgroundColor: COLORS.surface,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.xxl,
        justifyContent: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: SPACING.xxl + SPACING.lg,
    },
    logoContainer: {
        width: 140,
        height: 140,
        backgroundColor: COLORS.primary,
        borderRadius: BORDER_RADIUS.xxl,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.xxl,
        ...SHADOWS.xl,
    },
    logoText: {
        color: COLORS.surface,
        fontSize: 44,
        fontWeight: FONT_WEIGHT.extrabold,
        letterSpacing: 4,
    },
    title: {
        fontSize: FONT_SIZE.xxxl,
        fontWeight: FONT_WEIGHT.extrabold,
        color: COLORS.text,
        marginBottom: SPACING.sm,
        letterSpacing: -1.2,
        lineHeight: 44,
    },
    subtitle: {
        fontSize: FONT_SIZE.lg,
        color: COLORS.textSecondary,
        lineHeight: 26,
        fontWeight: FONT_WEIGHT.medium,
    },
    form: {
        width: '100%',
        marginTop: SPACING.xl,
    },
    button: {
        marginTop: SPACING.lg,
        height: 56,
    },
    passwordInput: {
        marginTop: SPACING.md,
    },
    switchContainer: {
        marginTop: SPACING.md,
        alignItems: 'center',
    },
    switchText: {
        color: COLORS.primary,
        fontSize: FONT_SIZE.sm,
        fontWeight: FONT_WEIGHT.semibold,
    },
    quickLoginContainer: {
        marginTop: SPACING.xl,
        paddingTop: SPACING.xl,
        borderTopWidth: 1,
        borderTopColor: COLORS.borderLight,
    },
    quickLoginLabel: {
        fontSize: FONT_SIZE.sm,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginBottom: SPACING.sm,
        textAlign: 'center',
    },
    quickLoginButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: SPACING.md,
    },
    quickButton: {
        flex: 1,
    },
});
