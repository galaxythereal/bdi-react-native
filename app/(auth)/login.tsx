import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { useAuth } from '../../src/features/auth/AuthContext';
import { BORDER_RADIUS, COLORS, FONT_SIZE, FONT_WEIGHT, SHADOWS, SPACING } from '../../src/lib/constants';
import { Mail, Lock, UserPlus } from 'lucide-react-native';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const { signInWithPassword, signUp, session, isLoading } = useAuth();
    const router = useRouter();

    // Navigate to dashboard when session is available
    useEffect(() => {
        if (!isLoading && session) {
            router.replace('/(student)/dashboard');
        }
    }, [session, isLoading, router]);

    const handleSubmit = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter both email and password');
            return;
        }

        if (isSignUp && !fullName.trim()) {
            Alert.alert('Error', 'Please enter your full name');
            return;
        }

        setLoading(true);
        try {
            if (isSignUp) {
                await signUp(email, password, fullName.trim());
                Alert.alert(
                    'Account Created', 
                    'Your account has been created! Please wait for admin approval before you can access courses.'
                );
                setIsSignUp(false);
                setEmail('');
                setPassword('');
                setFullName('');
            } else {
                await signInWithPassword(email, password);
                // Navigation will happen via useEffect when session is set
            }
        } catch (error: any) {
            console.error('Auth error:', error);
            let errorMessage = error.message || 'An error occurred';
            
            if (errorMessage.includes('NetworkError') || errorMessage.includes('Failed to fetch')) {
                errorMessage = 'Network error: Please check your connection.';
            } else if (errorMessage.includes('Invalid login credentials')) {
                errorMessage = 'Invalid email or password. Please try again.';
            } else if (errorMessage.includes('User already registered')) {
                errorMessage = 'This email is already registered. Please sign in instead.';
            }
            
            Alert.alert(isSignUp ? 'Sign Up Failed' : 'Login Failed', errorMessage);
        } finally {
            setLoading(false);
        }
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
                            <Text style={styles.title}>
                                {isSignUp ? 'Create Account' : 'Welcome Back'}
                            </Text>
                            <Text style={styles.subtitle}>
                                {isSignUp ? 'Sign up to get started' : 'Sign in to access your courses'}
                            </Text>
                        </View>

                        <View style={styles.form}>
                            {isSignUp && (
                                <Input
                                    label="Full Name"
                                    value={fullName}
                                    onChangeText={setFullName}
                                    placeholder="John Doe"
                                    autoCapitalize="words"
                                />
                            )}

                            <Input
                                label="Email Address"
                                value={email}
                                onChangeText={setEmail}
                                placeholder="you@example.com"
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />

                            <Input
                                label="Password"
                                value={password}
                                onChangeText={setPassword}
                                placeholder={isSignUp ? 'Create a password (min. 6 characters)' : 'Enter your password'}
                                secureTextEntry
                            />

                            <Button
                                title={loading 
                                    ? (isSignUp ? 'Creating Account...' : 'Signing In...')
                                    : (isSignUp ? 'Create Account' : 'Sign In')
                                }
                                onPress={handleSubmit}
                                disabled={loading}
                                style={styles.submitButton}
                            />

                            <View style={styles.switchContainer}>
                                <Text style={styles.switchText}>
                                    {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                                </Text>
                                <Button
                                    title={isSignUp ? 'Sign In' : 'Sign Up'}
                                    onPress={() => {
                                        setIsSignUp(!isSignUp);
                                        setEmail('');
                                        setPassword('');
                                        setFullName('');
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
        backgroundColor: COLORS.background,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: SPACING.lg,
    },
    header: {
        alignItems: 'center',
        marginBottom: SPACING.xl * 2,
    },
    logoContainer: {
        width: 120,
        height: 120,
        borderRadius: BORDER_RADIUS.xl,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.xl,
        ...SHADOWS.lg,
    },
    logoText: {
        fontSize: FONT_SIZE.xxxl,
        fontWeight: FONT_WEIGHT.extrabold,
        color: COLORS.surface,
        letterSpacing: 2,
    },
    title: {
        fontSize: FONT_SIZE.xxxl,
        fontWeight: FONT_WEIGHT.bold,
        color: COLORS.text,
        marginBottom: SPACING.sm,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: FONT_SIZE.lg,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
    },
    form: {
        width: '100%',
    },
    submitButton: {
        marginTop: SPACING.lg,
        marginBottom: SPACING.md,
    },
    switchContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: SPACING.md,
    },
    switchText: {
        fontSize: FONT_SIZE.md,
        color: COLORS.textSecondary,
    },
    switchButton: {
        paddingHorizontal: 0,
        paddingVertical: 0,
        minHeight: 'auto',
    },
});
