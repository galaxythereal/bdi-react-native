import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import { useRootNavigationState, useRouter, useSegments } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, AppState, AppStateStatus } from 'react-native';
import { supabase } from '../../lib/supabase';

const LOG_PREFIX = '[AUTH]';
const NAV_PREFIX = '[NAV]';
const PROFILE_FETCH_TIMEOUT_MS = 5000;  // 5s timeout for profile queries
const INIT_SAFETY_TIMEOUT_MS = 10000;   // 10s global safety timeout

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
            console.log(LOG_PREFIX, 'Cleared auth storage:', authKeys.length, 'keys');
        }
    } catch (e) {
        console.error(LOG_PREFIX, 'Error clearing auth storage:', e);
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

    // Refs to stabilize useEffect dependencies and avoid re-runs
    const routerRef = useRef(router);
    routerRef.current = router;
    const isMountedRef = useRef(true);
    const profileFetchInFlightRef = useRef(false);
    const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const initCompleteRef = useRef(false);

    // Helper to fetch user profile WITH timeout
    const fetchUserProfile = useCallback(async (userId: string, caller: string): Promise<UserProfile | null> => {
        console.log(LOG_PREFIX, `fetchUserProfile called for userId: ${userId} (caller: ${caller})`);
        const t0 = Date.now();

        // Guard against concurrent fetches
        if (profileFetchInFlightRef.current) {
            console.log(LOG_PREFIX, `fetchUserProfile SKIPPED — already in flight (caller: ${caller})`);
            return null;
        }
        profileFetchInFlightRef.current = true;

        try {
            const queryPromise = supabase
                .from('profiles')
                .select('id, role, email, full_name, status')
                .eq('id', userId)
                .single();

            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`Profile fetch timeout after ${PROFILE_FETCH_TIMEOUT_MS}ms`)), PROFILE_FETCH_TIMEOUT_MS)
            );

            const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

            const elapsed = Date.now() - t0;
            console.log(LOG_PREFIX, `fetchUserProfile query completed in ${elapsed}ms (caller: ${caller})`);

            if (error) {
                console.error(LOG_PREFIX, `fetchUserProfile error (caller: ${caller}):`, error.message || error);
                return null;
            }

            console.log(LOG_PREFIX, `Profile fetched — role: ${data?.role}, status: ${data?.status}, email: ${data?.email} (caller: ${caller})`);
            return data as UserProfile;
        } catch (error: any) {
            const elapsed = Date.now() - t0;
            console.error(LOG_PREFIX, `fetchUserProfile EXCEPTION after ${elapsed}ms (caller: ${caller}):`, error?.message || error);
            return null;
        } finally {
            profileFetchInFlightRef.current = false;
        }
    }, []);

    // Clear the safety timeout
    const clearSafetyTimeout = useCallback((reason: string) => {
        if (safetyTimeoutRef.current) {
            clearTimeout(safetyTimeoutRef.current);
            safetyTimeoutRef.current = null;
            console.log(LOG_PREFIX, `Safety timeout CLEARED — reason: ${reason}`);
        }
    }, []);

    // Force sign out - clears everything and redirects
    const forceSignOut = useCallback(async () => {
        console.log(LOG_PREFIX, 'Force sign out triggered');
        try {
            await clearAuthStorage();
            await supabase.auth.signOut();
        } catch (e) {
            console.error(LOG_PREFIX, 'Force sign out error:', e);
        }
        clearSafetyTimeout('forceSignOut');
        setSession(null);
        setUserProfile(null);
        setProfileFetchDone(false);
        setIsLoading(false);
        // Navigate immediately
        routerRef.current.replace('/(auth)/login');
    }, [clearSafetyTimeout]);

    // ─────────────────────────────────────────────────
    // MAIN AUTH EFFECT — runs ONCE on mount
    // ─────────────────────────────────────────────────
    useEffect(() => {
        isMountedRef.current = true;
        initCompleteRef.current = false;

        console.log(LOG_PREFIX, '========================================');
        console.log(LOG_PREFIX, 'Auth effect MOUNTED');
        console.log(LOG_PREFIX, 'Supabase URL:', process.env.EXPO_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING');
        console.log(LOG_PREFIX, '========================================');

        // ── GLOBAL SAFETY TIMEOUT ──
        // This is NEVER cleared by event handlers — only cleared on explicit success
        safetyTimeoutRef.current = setTimeout(() => {
            console.warn(LOG_PREFIX, `⚠️ SAFETY TIMEOUT fired after ${INIT_SAFETY_TIMEOUT_MS}ms`);
            console.warn(LOG_PREFIX, '⚠️ initComplete:', initCompleteRef.current, ', profileInFlight:', profileFetchInFlightRef.current);
            if (isMountedRef.current) {
                console.warn(LOG_PREFIX, '⚠️ Forcing isLoading=false, session=null — user will be sent to login');
                setSession(null);
                setUserProfile(null);
                setProfileFetchDone(false);
                setIsLoading(false);
            }
        }, INIT_SAFETY_TIMEOUT_MS);
        console.log(LOG_PREFIX, `Safety timeout set for ${INIT_SAFETY_TIMEOUT_MS}ms`);

        // ── INIT AUTH ──
        const initAuth = async () => {
            console.log(LOG_PREFIX, 'initAuth() starting...');
            const t0 = Date.now();
            try {
                console.log(LOG_PREFIX, 'Calling supabase.auth.getSession()...');
                const { data: { session }, error } = await supabase.auth.getSession();
                const elapsed = Date.now() - t0;
                console.log(LOG_PREFIX, `getSession() returned in ${elapsed}ms — session: ${session ? 'exists' : 'null'}, error: ${error?.message || 'none'}`);

                if (error) {
                    console.error(LOG_PREFIX, 'getSession error:', error.message);
                    if (isRefreshTokenError(error)) {
                        console.log(LOG_PREFIX, 'Refresh token error in getSession, clearing storage');
                        await clearAuthStorage();
                        try { await supabase.auth.signOut(); } catch (e) { /* ignore */ }
                    }
                    if (isMountedRef.current) {
                        setSession(null);
                        setProfileFetchDone(true);
                    }
                } else if (isMountedRef.current) {
                    setSession(session);
                    if (session?.user?.id) {
                        console.log(LOG_PREFIX, 'initAuth: fetching profile for user', session.user.id);
                        const profile = await fetchUserProfile(session.user.id, 'initAuth');
                        if (isMountedRef.current) {
                            console.log(LOG_PREFIX, 'initAuth: setting profile:', profile?.role || 'null');
                            setUserProfile(profile);
                            setProfileFetchDone(true);
                        }
                    } else {
                        console.log(LOG_PREFIX, 'initAuth: no session/user, setting profileFetchDone=true');
                        setProfileFetchDone(true);
                    }
                }
            } catch (error: any) {
                console.error(LOG_PREFIX, `initAuth EXCEPTION after ${Date.now() - t0}ms:`, error?.message || error);
                if (isRefreshTokenError(error)) {
                    await clearAuthStorage();
                }
                if (isMountedRef.current) {
                    setSession(null);
                    setProfileFetchDone(true);
                }
            } finally {
                initCompleteRef.current = true;
                console.log(LOG_PREFIX, `initAuth() COMPLETE in ${Date.now() - t0}ms — setting isLoading=false`);
                if (isMountedRef.current) {
                    setIsLoading(false);
                    clearSafetyTimeout('initAuth completed');
                }
            }
        };

        initAuth();

        // ── AUTH STATE CHANGE LISTENER ──
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, session) => {
            const t0 = Date.now();
            console.log(LOG_PREFIX, '===== onAuthStateChange =====');
            console.log(LOG_PREFIX, 'Event:', event);
            console.log(LOG_PREFIX, 'Session:', session ? 'exists' : 'null');
            console.log(LOG_PREFIX, 'User:', session?.user?.email || 'no user', ', ID:', session?.user?.id || 'none');
            console.log(LOG_PREFIX, 'initComplete:', initCompleteRef.current);

            // Handle token refresh errors
            if (event === 'TOKEN_REFRESHED' && !session) {
                console.log(LOG_PREFIX, 'TOKEN_REFRESHED but no session — forcing sign out');
                await clearAuthStorage();
                if (isMountedRef.current) {
                    setSession(null);
                    setUserProfile(null);
                    setProfileFetchDone(true);
                    setIsLoading(false);
                    clearSafetyTimeout('TOKEN_REFRESHED no session');
                }
                routerRef.current.replace('/(auth)/login');
                return;
            }

            // Handle successful token refresh
            if (event === 'TOKEN_REFRESHED' && session) {
                console.log(LOG_PREFIX, 'TOKEN_REFRESHED with valid session');
                if (isMountedRef.current) {
                    setSession(session);

                    // If initAuth is still running, defer profile/loading to it.
                    // During token refresh, Supabase queries hang until the refresh completes.
                    // initAuth's getSession() will resolve after the refresh, then fetch the profile successfully.
                    if (!initCompleteRef.current) {
                        console.log(LOG_PREFIX, 'TOKEN_REFRESHED: initAuth still running — deferring profile/loading to initAuth');
                        console.log(LOG_PREFIX, `===== TOKEN_REFRESHED deferred in ${Date.now() - t0}ms =====`);
                        return;
                    }

                    // initAuth is done — this is a mid-session token refresh (user is already using the app)
                    if (session.user?.id) {
                        console.log(LOG_PREFIX, 'TOKEN_REFRESHED (post-init): fetching profile...');
                        const profile = await fetchUserProfile(session.user.id, 'TOKEN_REFRESHED');
                        if (isMountedRef.current) {
                            console.log(LOG_PREFIX, 'TOKEN_REFRESHED (post-init): profile result:', profile?.role || 'null');
                            if (profile) {
                                setUserProfile(profile);
                            }
                            setProfileFetchDone(true);
                        }
                    }
                    // No need to change isLoading — user is already past the loading screen
                    console.log(LOG_PREFIX, 'TOKEN_REFRESHED (post-init): done, no loading state change needed');
                }
                console.log(LOG_PREFIX, `===== TOKEN_REFRESHED complete in ${Date.now() - t0}ms =====`);
                return;
            }

            // Handle explicit sign out
            if (event === 'SIGNED_OUT') {
                console.log(LOG_PREFIX, 'SIGNED_OUT event — clearing state');
                setSession(null);
                setUserProfile(null);
                setProfileFetchDone(false);
                setIsLoading(false);
                hasNavigated.current = false;
                clearSafetyTimeout('SIGNED_OUT');
                routerRef.current.replace('/(auth)/login');
                return;
            }

            // Handle INITIAL_SESSION — if initAuth is still running, defer to it
            if (event === 'INITIAL_SESSION' && !initCompleteRef.current) {
                console.log(LOG_PREFIX, 'INITIAL_SESSION fired while initAuth is still running — deferring profile/loading to initAuth');
                if (isMountedRef.current) {
                    setSession(session);
                    // Do NOT set isLoading=false or clear safety timeout — initAuth will handle it
                }
                console.log(LOG_PREFIX, `===== INITIAL_SESSION deferred in ${Date.now() - t0}ms =====`);
                return;
            }

            // Handle SIGNED_IN and late INITIAL_SESSION events (after initAuth is done)
            console.log(LOG_PREFIX, `Event ${event}: setting session, isLoading=false`);
            if (isMountedRef.current) {
                setSession(session);
            }

            if (session?.user?.id) {
                console.log(LOG_PREFIX, `Event ${event}: fetching profile...`);
                const profile = await fetchUserProfile(session.user.id, `onAuthStateChange:${event}`);
                console.log(LOG_PREFIX, `Event ${event}: profile result:`, profile?.role || 'null', `(${Date.now() - t0}ms total)`);
                if (isMountedRef.current) {
                    setUserProfile(profile);
                    setProfileFetchDone(true);
                }
            } else {
                console.log(LOG_PREFIX, `Event ${event}: no user ID, skipping profile fetch`);
                if (isMountedRef.current) {
                    setProfileFetchDone(true);
                }
            }

            if (isMountedRef.current) {
                setIsLoading(false);
            }
            clearSafetyTimeout(`onAuthStateChange:${event} complete`);
            console.log(LOG_PREFIX, `===== onAuthStateChange ${event} complete in ${Date.now() - t0}ms =====`);
        });

        // ── APP STATE LISTENER (foreground resume) ──
        const appStateSubscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
            if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                console.log(LOG_PREFIX, 'App resumed to foreground, verifying session...');
                try {
                    const { data: { session }, error } = await supabase.auth.getSession();
                    if (error && isRefreshTokenError(error)) {
                        console.log(LOG_PREFIX, 'Session invalid on app resume — forcing sign out');
                        // Use the ref to avoid stale closure
                        await clearAuthStorage();
                        try { await supabase.auth.signOut(); } catch (e) { /* ignore */ }
                        setSession(null);
                        setUserProfile(null);
                        setProfileFetchDone(false);
                        setIsLoading(false);
                        routerRef.current.replace('/(auth)/login');
                    } else {
                        console.log(LOG_PREFIX, 'Session OK on app resume');
                    }
                } catch (e) {
                    console.error(LOG_PREFIX, 'Error checking session on resume:', e);
                }
            }
            appState.current = nextAppState;
        });

        return () => {
            console.log(LOG_PREFIX, 'Auth effect UNMOUNTING');
            isMountedRef.current = false;
            subscription.unsubscribe();
            appStateSubscription.remove();
            clearSafetyTimeout('unmount');
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Stable deps — refs used for router/forceSignOut

    // ─────────────────────────────────────────────────
    // NAVIGATION EFFECT
    // ─────────────────────────────────────────────────
    useEffect(() => {
        console.log(NAV_PREFIX, 'Navigation effect fired —',
            'isLoading:', isLoading,
            ', session:', !!session,
            ', navKey:', !!navigationState?.key,
            ', segments:', JSON.stringify(segments),
            ', hasNavigated:', hasNavigated.current,
            ', userProfile:', userProfile?.role || 'null',
            ', profileFetchDone:', profileFetchDone,
        );

        // Don't navigate while loading
        if (isLoading) {
            console.log(NAV_PREFIX, 'Still loading, skipping navigation');
            return;
        }

        // Wait for navigation state to be ready
        if (!navigationState?.key) {
            console.log(NAV_PREFIX, 'Navigation state not ready, skipping');
            return;
        }

        const inAuthGroup = segments[0] === '(auth)';
        console.log(NAV_PREFIX, 'inAuthGroup:', inAuthGroup);

        if (!session && !inAuthGroup) {
            // Not authenticated and not on auth screen - redirect to login
            console.log(NAV_PREFIX, 'Not authenticated, redirecting to login');
            router.replace('/(auth)/login');
        } else if (session && inAuthGroup && !hasNavigated.current) {
            // Authenticated and on auth screen - redirect based on role
            if (!profileFetchDone) {
                console.log(NAV_PREFIX, 'Session exists but profile fetch not done yet, waiting...');
                return;
            }

            // Profile fetch done but no profile found - no account in profiles table
            if (!userProfile) {
                console.log(NAV_PREFIX, 'Profile not found in database, signing out with error');
                hasNavigated.current = true;
                Alert.alert(
                    'Account Not Found',
                    'No account found with these credentials. Please sign up first.',
                    [{ text: 'OK' }]
                );
                // Sign out the auth session since there's no profile
                supabase.auth.signOut().catch(() => { });
                setSession(null);
                setProfileFetchDone(false);
                hasNavigated.current = false;
                return;
            }

            hasNavigated.current = true;
            const role = userProfile.role;
            console.log(NAV_PREFIX, 'Profile loaded, role:', role, ', navigating...');
            if (role === 'admin' || role === 'instructor') {
                console.log(NAV_PREFIX, '>>> Redirecting to ADMIN dashboard');
                router.replace('/(admin)/dashboard');
            } else {
                console.log(NAV_PREFIX, '>>> Redirecting to STUDENT dashboard');
                router.replace('/(student)/dashboard');
            }
        } else {
            console.log(NAV_PREFIX, 'No navigation action needed (session:', !!session, ', inAuth:', inAuthGroup, ', hasNav:', hasNavigated.current, ')');
        }
    }, [session, isLoading, segments, navigationState?.key, router, userProfile, profileFetchDone]);

    const signInWithPassword = async (email: string, password: string) => {
        console.log(LOG_PREFIX, 'signInWithPassword called for:', email);
        const t0 = Date.now();
        hasNavigated.current = false;
        setProfileFetchDone(false);
        setUserProfile(null);
        console.log(LOG_PREFIX, 'Calling supabase.auth.signInWithPassword...');
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        console.log(LOG_PREFIX, `signInWithPassword returned in ${Date.now() - t0}ms`);
        console.log(LOG_PREFIX, 'Result — session:', data?.session ? 'exists' : 'null', ', user:', data?.user?.id || 'null', ', error:', error?.message || 'none');

        if (error) throw error;
        console.log(LOG_PREFIX, 'signInWithPassword success, waiting for onAuthStateChange...');
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
        console.log(LOG_PREFIX, 'signOut called');
        try {
            await clearAuthStorage();
            const { error } = await supabase.auth.signOut();
            if (error) {
                console.error(LOG_PREFIX, 'Sign out error:', error);
            }
        } catch (e) {
            console.error(LOG_PREFIX, 'Sign out exception:', e);
        }
        // Always clear session and navigate
        setSession(null);
        setUserProfile(null);
        setProfileFetchDone(false);
        hasNavigated.current = false;
        routerRef.current.replace('/(auth)/login');
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
