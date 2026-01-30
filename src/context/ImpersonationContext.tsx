import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const IMPERSONATION_KEY = 'admin_impersonation';

interface ImpersonatedStudent {
    id: string;
    email: string;
    fullName: string;
    avatarUrl?: string;
}

interface ImpersonationContextType {
    isImpersonating: boolean;
    impersonatedStudent: ImpersonatedStudent | null;
    startImpersonation: (student: ImpersonatedStudent) => Promise<void>;
    endImpersonation: () => Promise<void>;
    // Use this ID for all data fetching when impersonating
    effectiveUserId: string | null;
}

const ImpersonationContext = createContext<ImpersonationContextType>({
    isImpersonating: false,
    impersonatedStudent: null,
    startImpersonation: async () => { },
    endImpersonation: async () => { },
    effectiveUserId: null,
});

export const useImpersonation = () => useContext(ImpersonationContext);

interface ImpersonationProviderProps {
    children: React.ReactNode;
    currentUserId: string | null;
}

export const ImpersonationProvider = ({ children, currentUserId }: ImpersonationProviderProps) => {
    const [impersonatedStudent, setImpersonatedStudent] = useState<ImpersonatedStudent | null>(null);
    const [isImpersonating, setIsImpersonating] = useState(false);

    // Load any stored impersonation session on mount
    useEffect(() => {
        loadStoredImpersonation();
    }, []);

    const loadStoredImpersonation = async () => {
        try {
            const stored = await AsyncStorage.getItem(IMPERSONATION_KEY);
            if (stored) {
                const data = JSON.parse(stored);
                setImpersonatedStudent(data);
                setIsImpersonating(true);
            }
        } catch (error) {
            console.error('Error loading impersonation:', error);
        }
    };

    const startImpersonation = async (student: ImpersonatedStudent) => {
        try {
            // Store impersonation session
            await AsyncStorage.setItem(IMPERSONATION_KEY, JSON.stringify(student));
            setImpersonatedStudent(student);
            setIsImpersonating(true);

            // Log the impersonation (optional, for audit)
            try {
                await supabase.from('admin_impersonation_sessions').insert({
                    admin_id: currentUserId,
                    impersonated_user_id: student.id,
                    started_at: new Date().toISOString(),
                    is_active: true,
                    platform: 'mobile',
                });
            } catch {
                // Ignore if table doesn't exist
            }
        } catch (error) {
            console.error('Error starting impersonation:', error);
            throw error;
        }
    };

    const endImpersonation = useCallback(async () => {
        try {
            // Clear stored session
            await AsyncStorage.removeItem(IMPERSONATION_KEY);

            // Log end of impersonation
            if (impersonatedStudent && currentUserId) {
                try {
                    await supabase
                        .from('admin_impersonation_sessions')
                        .update({ is_active: false, ended_at: new Date().toISOString() })
                        .eq('admin_id', currentUserId)
                        .eq('impersonated_user_id', impersonatedStudent.id)
                        .eq('is_active', true);
                } catch {
                    // Ignore if table doesn't exist
                }
            }

            setImpersonatedStudent(null);
            setIsImpersonating(false);
        } catch (error) {
            console.error('Error ending impersonation:', error);
            throw error;
        }
    }, [currentUserId, impersonatedStudent]);

    // When impersonating, use the student's ID for data fetching
    const effectiveUserId = isImpersonating && impersonatedStudent
        ? impersonatedStudent.id
        : currentUserId;

    return (
        <ImpersonationContext.Provider
            value={{
                isImpersonating,
                impersonatedStudent,
                startImpersonation,
                endImpersonation,
                effectiveUserId,
            }}
        >
            {children}
        </ImpersonationContext.Provider>
    );
};
