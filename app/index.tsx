import { Colors } from '@/constants/theme';
import { Redirect, SplashScreen } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useAuth } from '../src/features/auth/AuthContext';

// Keep splash screen visible initially
SplashScreen.preventAutoHideAsync();

export default function Index() {
    const { session, isLoading, userRole, isAdmin } = useAuth();
    const [showSplash, setShowSplash] = useState(true);
    const [minLoadComplete, setMinLoadComplete] = useState(false);

    // Minimum splash display time for smooth UX
    useEffect(() => {
        const timer = setTimeout(() => {
            setMinLoadComplete(true);
        }, 1000); // Show splash for at least 1 second
        return () => clearTimeout(timer);
    }, []);

    // Hide splash when both auth is loaded and minimum time has passed
    useEffect(() => {
        if (!isLoading && minLoadComplete) {
            const timer = setTimeout(() => {
                setShowSplash(false);
                SplashScreen.hideAsync();
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isLoading, minLoadComplete]);

    // Show branded splash screen
    if (showSplash || isLoading) {
        return (
            <View style={styles.splashContainer}>
                <Animated.View 
                    entering={FadeIn.duration(300)}
                    exiting={FadeOut.duration(200)}
                    style={styles.splashContent}
                >
                    <View style={styles.logoContainer}>
                        <Text style={styles.logoText}>BDI</Text>
                        <Text style={styles.logoSubText}>Learning Management System</Text>
                    </View>
                    <ActivityIndicator size="large" color="#fff" style={styles.loader} />
                    <Text style={styles.loadingText}>Loading...</Text>
                </Animated.View>
            </View>
        );
    }

    if (session) {
        // Route based on user role
        if (isAdmin || userRole === 'admin' || userRole === 'instructor' || userRole === 'super_admin') {
            return <Redirect href="/(admin)/dashboard" />;
        }
        if (userRole === 'support_manager') {
            return <Redirect href="/support-manager/dashboard" />;
        }
        if (userRole === 'support') {
            return <Redirect href="/support/dashboard" />;
        }
        // Default to student dashboard
        return <Redirect href="/(student)/dashboard" />;
    }

    return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
    splashContainer: {
        flex: 1,
        backgroundColor: Colors.light.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    splashContent: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logoText: {
        fontSize: 56,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: 4,
    },
    logoSubText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 8,
        letterSpacing: 1,
    },
    loader: {
        marginBottom: 12,
    },
    loadingText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
    },
});
