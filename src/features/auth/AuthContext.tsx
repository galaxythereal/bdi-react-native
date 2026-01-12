import { Session } from '@supabase/supabase-js';
import { useRouter, useSegments } from 'expo-router';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface AuthContextType {
    session: Session | null;
    isLoading: boolean;
    signInWithPassword: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, fullName: string) => Promise<void>;
    signOut: () => Promise<void>;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    isLoading: true,
    signInWithPassword: async () => { },
    signUp: async () => { },
    signOut: async () => { },
    isAuthenticated: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const segments = useSegments();

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session }, error }) => {
            if (error) {
                console.error('Error getting session:', error);
            }
            setSession(session);
            setIsLoading(false);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth state changed:', event, session?.user?.email);
            setSession(session);
            setIsLoading(false);
            
            // Redirect to login on sign out
            if (event === 'SIGNED_OUT') {
                router.replace('/(auth)/login');
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Handle navigation based on auth state
    useEffect(() => {
        if (isLoading) return;
        
        const inAuthGroup = segments[0] === '(auth)';
        
        if (!session && !inAuthGroup) {
            // Redirect to login if not authenticated and not already on auth screen
            router.replace('/(auth)/login');
        } else if (session && inAuthGroup) {
            // Redirect to dashboard if authenticated and on auth screen
            router.replace('/(student)/dashboard');
        }
    }, [session, isLoading, segments]);

    const signInWithPassword = async (email: string, password: string) => {
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
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Sign out error:', error);
        }
        // Navigation will be handled by onAuthStateChange
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
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
