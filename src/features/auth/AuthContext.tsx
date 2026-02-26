import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { AppState, AppStateStatus, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';

interface UserProfile {
    id: string;
    role: 'admin' | 'instructor' | 'support' | 'support_manager' | 'student';
    email: string;
    full_name: string | null;
    status: string;
}

interface AuthContextType {
    session: Session | null;
    isLoading: boolean;
    signInWithPassword: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, fullName: string) => Promise<void>;
    signOut: () => Promise<void>;
    isAuthenticated: boolean;
    forceSignOut: () => Promise<void>;
    userProfile: UserProfile | null;
    userRole: 'admin' | 'instructor' | 'support' | 'support_manager' | 'student' | null;
    isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    isLoading: true,
    signInWithPassword: async () => { },
    signUp: async () => { },
    signOut: async () => { },
    isAuthenticated: false,
    forceSignOut: async () => { },
    userProfile: null,
    userRole: null,
    isAdmin: false,
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
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [profileFetchDone, setProfileFetchDone] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const segments = useSegments();
    const navigationState = useRootNavigationState();
    const hasNavigated = useRef(false);
    const appState = useRef(AppState.currentState);

    // Helper to fetch user profile
    const fetchUserProfile = async (userId: string) => {
        console.log('[AUTH] fetchUserProfile called for userId:', userId);
        const t0 = Date.now();
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, role, email, full_name, status')
                .eq('id', userId)
                .single();

            console.log('[AUTH] fetchUserProfile query took', Date.now() - t0, 'ms');
            if (error) {
                console.error('[AUTH] Error fetching profile:', error);
                return null;
            }
            console.log('[AUTH] Profile fetched - role:', data?.role, ', status:', data?.status);
            return data as UserProfile;
        } catch (error) {
            console.error('[AUTH] fetchUserProfile exception after', Date.now() - t0, 'ms:', error);
            return null;
        }
    };

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
        setUserProfile(null);
        setProfileFetchDone(false);
        setIsLoading(false);
        // Navigate immediately
        router.replace('/(auth)/login');
    }, [router]);

    useEffect(() => {
        let isMounted = true;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        
        const initAuth = async () => {
            console.log('[AUTH] Starting auth initialization...');
            console.log('[AUTH] Supabase URL:', process.env.EXPO_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING');
            
            // Set a timeout to prevent hanging forever
            timeoutId = setTimeout(() => {
                if (isMounted && isLoading) {
                    console.warn('[AUTH] ⚠️ Auth initialization timed out after 8s, proceeding as signed out');
                    setSession(null);
                    setProfileFetchDone(false);
                    setIsLoading(false);
                }
            }, 8000); // 8 second timeout
            
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                
                // Clear timeout as soon as we get a response
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }

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
                    if (isMounted) setSession(null);
                } else {
                    console.log('Session retrieved:', session ? 'exists' : 'null');
                    if (isMounted) {
                        setSession(session);
                        // Fetch user profile if session exists
                        if (session?.user?.id) {
                            const profile = await fetchUserProfile(session.user.id);
                            if (isMounted) {
                                setUserProfile(profile);
                                setProfileFetchDone(true);
                            }
                        }
                    }
                }
            } catch (error: any) {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                console.error('Auth init error:', error);
                if (isRefreshTokenError(error)) {
                    await clearAuthStorage();
                }
                if (isMounted) setSession(null);
            } finally {
                console.log('Auth initialization complete');
                if (isMounted) setIsLoading(false);
            }
        };

        initAuth();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, session) => {
            const t0 = Date.now();
            console.log('[AUTH] ===== onAuthStateChange =====');
            console.log('[AUTH] Event:', event);
            console.log('[AUTH] Session:', session ? 'exists' : 'null');
            console.log('[AUTH] User:', session?.user?.email || 'no user', ', ID:', session?.user?.id || 'none');

            // Clear timeout on any auth state change - we have a response
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }

            // Handle token refresh errors
            if (event === 'TOKEN_REFRESHED' && !session) {
                console.log('Token refresh failed, forcing sign out');
                await clearAuthStorage();
                if (isMounted) setSession(null);
                setUserProfile(null);
                setIsLoading(false);
                router.replace('/(auth)/login');
                return;
            }

            // Handle successful token refresh - update session but don't navigate
            if (event === 'TOKEN_REFRESHED' && session) {
                console.log('Token refreshed successfully');
                if (isMounted) {
                    setSession(session);
                    if (session.user?.id) {
                        const profile = await fetchUserProfile(session.user.id);
                        setUserProfile(profile);
                    }
                    setIsLoading(false);
                }
                return;
            }

            // Handle explicit sign out
            if (event === 'SIGNED_OUT') {
                console.log('User signed out, redirecting to login');
                setSession(null);
                setUserProfile(null);
                setProfileFetchDone(false);
                setIsLoading(false);
                hasNavigated.current = false;
                router.replace('/(auth)/login');
                return;
            }

            // Fetch profile when user signs in
            // Set session IMMEDIATELY so navigation can react, then fetch profile
            console.log('[AUTH] Setting session and isLoading=false (event:', event, ')');
            if (isMounted) {
                setSession(session);
                setIsLoading(false);
            }

            if (session?.user?.id) {
                console.log('[AUTH] Fetching user profile for navigation...');
                const profile = await fetchUserProfile(session.user.id);
                console.log('[AUTH] Profile fetch done in onAuthStateChange, role:', profile?.role, ', took', Date.now() - t0, 'ms total');
                if (isMounted) {
                    setUserProfile(profile);
                    setProfileFetchDone(true);
                }
            } else {
                console.log('[AUTH] No user ID in session, skipping profile fetch');
            }
            console.log('[AUTH] ===== onAuthStateChange complete in', Date.now() - t0, 'ms =====');
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
            isMounted = false;
            subscription.unsubscribe();
            appStateSubscription.remove();
        };
    }, [router, forceSignOut]);

    // Handle navigation based on auth state - wait for navigation to be ready
    useEffect(() => {
        console.log('[NAV] Navigation effect fired - isLoading:', isLoading, ', session:', !!session, ', navKey:', !!navigationState?.key, ', segments:', segments, ', hasNavigated:', hasNavigated.current, ', userProfile:', userProfile?.role || 'null');

        // Don't navigate while loading
        if (isLoading) {
            console.log('[NAV] Still loading, skipping navigation');
            return;
        }

        // Wait for navigation state to be ready
        if (!navigationState?.key) {
            console.log('[NAV] Navigation state not ready, skipping');
            return;
        }

        const inAuthGroup = segments[0] === '(auth)';
        console.log('[NAV] inAuthGroup:', inAuthGroup);

        if (!session && !inAuthGroup) {
            // Not authenticated and not on auth screen - redirect to login
            console.log('[NAV] Not authenticated, redirecting to login');
            router.replace('/(auth)/login');
        } else if (session && inAuthGroup && !hasNavigated.current) {
            // Authenticated and on auth screen - redirect based on role
            if (!profileFetchDone) {
                console.log('[NAV] Session exists but profile fetch not done yet, waiting...');
                return;
            }

            // Profile fetch done but no profile found - no account in profiles table
            if (!userProfile) {
                console.log('[NAV] Profile not found in database, signing out with error');
                hasNavigated.current = true;
                Alert.alert(
                    'Account Not Found',
                    'No account found with these credentials. Please sign up first.',
                    [{ text: 'OK' }]
                );
                // Sign out the auth session since there's no profile
                supabase.auth.signOut().catch(() => {});
                setSession(null);
                setProfileFetchDone(false);
                hasNavigated.current = false;
                return;
            }

            hasNavigated.current = true;
            const role = userProfile.role;
            console.log('[NAV] Profile loaded, role:', role, ', navigating...');
            if (role === 'admin' || role === 'instructor') {
                console.log('[NAV] >>> Redirecting to ADMIN dashboard');
                router.replace('/(admin)/dashboard');
            } else {
                console.log('[NAV] >>> Redirecting to STUDENT dashboard');
                router.replace('/(student)/dashboard');
            }
        } else {
            console.log('[NAV] No navigation action needed (session:', !!session, ', inAuth:', inAuthGroup, ', hasNav:', hasNavigated.current, ')');
        }
    }, [session, isLoading, segments, navigationState?.key, router, userProfile, profileFetchDone]);

    const signInWithPassword = async (email: string, password: string) => {
        console.log('[AUTH] signInWithPassword called for:', email);
        const t0 = Date.now();
        hasNavigated.current = false;
        setProfileFetchDone(false);
        setUserProfile(null);
        console.log('[AUTH] Calling supabase.auth.signInWithPassword...');
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        console.log('[AUTH] supabase.auth.signInWithPassword returned in', Date.now() - t0, 'ms');
        console.log('[AUTH] Result - session:', data?.session ? 'exists' : 'null', ', user:', data?.user?.id || 'null', ', error:', error?.message || 'none');

        if (error) throw error;
        console.log('[AUTH] signInWithPassword success, waiting for onAuthStateChange...');
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
        setUserProfile(null);
        setProfileFetchDone(false);
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
                userProfile,
                userRole: userProfile?.role || null,
                isAdmin: userProfile?.role === 'admin',
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
