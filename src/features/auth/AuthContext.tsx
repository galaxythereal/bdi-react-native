import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '../../lib/supabase';

interface AuthContextType {
    session: Session | null;
    isLoading: boolean;
    signInWithPassword: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, fullName: string) => Promise<void>;
    signOut: () => Promise<void>;
    isAuthenticated: boolean;
    forceSignOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    isLoading: true,
    signInWithPassword: async () => { },
    signUp: async () => { },
    signOut: async () => { },
    isAuthenticated: false,
    forceSignOut: async () => { },
});

export const useAuth = () => useContext(AuthContext);

// Helper to check if error is a refresh token error
const isRefreshTokenError = (error: any): boolean => {
    return error?.message?.includes('Refresh Token') ||
           error?.message?.includes('refresh_token') ||
           error?.message?.includes('Invalid Refresh Token') ||
           error?.code === 'refresh_token_not_found' ||
           error?.code === 'invalid_grant';
};

// Clear all auth-related storage
const clearAuthStorage = async () => {
    try {
        const keys = await AsyncStorage.getAllKeys();
        const authKeys = keys.filter(key => 
            key.includes('supabase') || 
            key.includes('auth') ||
            key.includes('token') ||
            key.includes('session')
        );
        if (authKeys.length > 0) {
            await AsyncStorage.multiRemove(authKeys);
            console.log('Cleared auth storage:', authKeys.length, 'keys');
        }
    } catch (e) {
        console.error('Error clearing auth storage:', e);
    }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const segments = useSegments();
    const navigationState = useRootNavigationState();
    const hasNavigated = useRef(false);
    const appState = useRef(AppState.currentState);

    // Force sign out - clears everything and redirects
    const forceSignOut = useCallback(async () => {
        console.log('Force sign out triggered');
        try {
            await clearAuthStorage();
            await supabase.auth.signOut();
        } catch (e) {
            console.error('Force sign out error:', e);
        }
        setSession(null);
        setIsLoading(false);
        // Navigate immediately
        router.replace('/(auth)/login');
    }, [router]);

    useEffect(() => {
        const initAuth = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                
                if (error) {
                    console.error('Error getting session:', error);
                    // If refresh token is invalid, clear storage and continue as signed out
                    if (isRefreshTokenError(error)) {
                        console.log('Refresh token error detected, clearing storage');
                        await clearAuthStorage();
                        try {
                            await supabase.auth.signOut();
                        } catch (e) {
                            // Ignore signout errors
                        }
                    }
                    setSession(null);
                } else {
                    setSession(session);
                }
            } catch (error: any) {
                console.error('Auth init error:', error);
                if (isRefreshTokenError(error)) {
                    await clearAuthStorage();
                }
                setSession(null);
            } finally {
                setIsLoading(false);
            }
        };

        initAuth();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth state changed:', event, session?.user?.email || 'no user');
            
            // Handle token refresh errors
            if (event === 'TOKEN_REFRESHED' && !session) {
                console.log('Token refresh failed, forcing sign out');
                await clearAuthStorage();
                setSession(null);
                setIsLoading(false);
                router.replace('/(auth)/login');
                return;
            }
            
            // Handle explicit sign out
            if (event === 'SIGNED_OUT') {
                console.log('User signed out, redirecting to login');
                setSession(null);
                setIsLoading(false);
                hasNavigated.current = false;
                router.replace('/(auth)/login');
                return;
            }
            
            setSession(session);
            setIsLoading(false);
        });

        // Handle app state changes for token refresh
        const appStateSubscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
            if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                // App has come to foreground, verify session
                try {
                    const { data: { session }, error } = await supabase.auth.getSession();
                    if (error && isRefreshTokenError(error)) {
                        console.log('Session invalid on app resume');
                        await forceSignOut();
                    }
                } catch (e) {
                    console.error('Error checking session on resume:', e);
                }
            }
            appState.current = nextAppState;
        });

        return () => {
            subscription.unsubscribe();
            appStateSubscription.remove();
        };
    }, [router, forceSignOut]);

    // Handle navigation based on auth state - wait for navigation to be ready
    useEffect(() => {
        // Don't navigate while loading
        if (isLoading) return;
        
        // Wait for navigation state to be ready
        if (!navigationState?.key) return;
        
        const inAuthGroup = segments[0] === '(auth)';
        
        if (!session && !inAuthGroup) {
            // Not authenticated and not on auth screen - redirect to login
            console.log('Not authenticated, redirecting to login');
            router.replace('/(auth)/login');
        } else if (session && inAuthGroup && !hasNavigated.current) {
            // Authenticated and on auth screen - redirect to dashboard
            console.log('Authenticated, redirecting to dashboard');
            hasNavigated.current = true;
            router.replace('/(student)/dashboard');
        }
    }, [session, isLoading, segments, navigationState?.key, router]);

    const signInWithPassword = async (email: string, password: string) => {
        hasNavigated.current = false;
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;
    };

    const signUp = async (email: string, password: string, fullName: string) => {
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                },
            },
        });

        if (error) throw error;
    };

    const signOut = async () => {
        try {
            await clearAuthStorage();
            const { error } = await supabase.auth.signOut();
            if (error) {
                console.error('Sign out error:', error);
            }
        } catch (e) {
            console.error('Sign out exception:', e);
        }
        // Always clear session and navigate
        setSession(null);
        hasNavigated.current = false;
        router.replace('/(auth)/login');
    };

    return (
        <AuthContext.Provider
            value={{
                session,
                isLoading,
                signInWithPassword,
                signUp,
                signOut,
                isAuthenticated: !!session,
                forceSignOut,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
