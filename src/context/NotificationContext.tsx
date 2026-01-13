import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { AppState, AppStateStatus, Vibration, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../features/auth/AuthContext';
import { 
    Notification, 
    fetchNotifications, 
    markNotificationAsRead, 
    markAllNotificationsAsRead,
    deleteNotification,
    subscribeToNotifications,
    NotificationPayload,
} from '../features/notifications';

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    removeNotification: (id: string) => Promise<void>;
    clearError: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    error: null,
    refresh: async () => {},
    markAsRead: async () => {},
    markAllAsRead: async () => {},
    removeNotification: async () => {},
    clearError: () => {},
});

export const useNotifications = () => useContext(NotificationContext);

interface NotificationProviderProps {
    children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
    const { session, isAuthenticated } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const appState = useRef(AppState.currentState);
    const subscriptionRef = useRef<any>(null);
    const previousUnreadCount = useRef(0);

    // Calculate unread count
    const unreadCount = notifications.filter(n => !n.read).length;

    // Trigger haptic feedback for new notifications
    const triggerNotificationHaptic = useCallback(async () => {
        try {
            if (Platform.OS === 'ios') {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
                Vibration.vibrate(200);
            }
        } catch (e) {
            // Haptics may not be available
        }
    }, []);

    // Load notifications
    const loadNotifications = useCallback(async (silent = false) => {
        if (!isAuthenticated || !session?.user?.id) {
            setNotifications([]);
            return;
        }

        if (!silent) {
            setIsLoading(true);
        }
        setError(null);

        try {
            const data = await fetchNotifications();
            setNotifications(data);

            // Check if we have new unread notifications
            const newUnreadCount = data.filter((n: Notification) => !n.read).length;
            if (newUnreadCount > previousUnreadCount.current && previousUnreadCount.current > 0) {
                triggerNotificationHaptic();
            }
            previousUnreadCount.current = newUnreadCount;
        } catch (err: any) {
            console.error('Error loading notifications:', err);
            if (!silent) {
                setError(err.message || 'Failed to load notifications');
            }
        } finally {
            setIsLoading(false);
        }
    }, [isAuthenticated, session?.user?.id, triggerNotificationHaptic]);

    // Set up real-time subscription
    useEffect(() => {
        if (!isAuthenticated || !session?.user?.id) {
            // Clean up subscription if not authenticated
            if (subscriptionRef.current) {
                subscriptionRef.current.unsubscribe();
                subscriptionRef.current = null;
            }
            setNotifications([]);
            return;
        }

        // Initial load
        loadNotifications();

        // Subscribe to real-time updates
        const subscription = subscribeToNotifications(session.user.id, (payload: NotificationPayload) => {
            console.log('Notification update:', payload.eventType);
            
            if (payload.eventType === 'INSERT') {
                // New notification received
                setNotifications(prev => [payload.new as Notification, ...prev]);
                triggerNotificationHaptic();
            } else if (payload.eventType === 'UPDATE') {
                // Notification updated (e.g., marked as read)
                setNotifications(prev => 
                    prev.map(n => n.id === payload.new.id ? payload.new as Notification : n)
                );
            } else if (payload.eventType === 'DELETE') {
                // Notification deleted
                setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
            }
        });

        subscriptionRef.current = subscription;

        return () => {
            if (subscriptionRef.current) {
                subscriptionRef.current.unsubscribe();
                subscriptionRef.current = null;
            }
        };
    }, [isAuthenticated, session?.user?.id, loadNotifications, triggerNotificationHaptic]);

    // Refresh on app foreground
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (
                appState.current.match(/inactive|background/) && 
                nextAppState === 'active' &&
                isAuthenticated
            ) {
                loadNotifications(true);
            }
            appState.current = nextAppState;
        });

        return () => subscription.remove();
    }, [isAuthenticated, loadNotifications]);

    // Mark single notification as read
    const markAsRead = useCallback(async (id: string) => {
        try {
            await markNotificationAsRead(id);
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, read: true } : n)
            );
        } catch (err: any) {
            console.error('Error marking notification as read:', err);
            setError(err.message || 'Failed to update notification');
        }
    }, []);

    // Mark all as read
    const markAllAsRead = useCallback(async () => {
        if (!session?.user?.id) return;
        
        try {
            await markAllNotificationsAsRead(session.user.id);
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        } catch (err: any) {
            console.error('Error marking all notifications as read:', err);
            setError(err.message || 'Failed to update notifications');
        }
    }, [session?.user?.id]);

    // Remove notification
    const removeNotification = useCallback(async (id: string) => {
        try {
            await deleteNotification(id);
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (err: any) {
            console.error('Error deleting notification:', err);
            setError(err.message || 'Failed to delete notification');
        }
    }, []);

    // Clear error
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    // Refresh function
    const refresh = useCallback(async () => {
        await loadNotifications();
    }, [loadNotifications]);

    return (
        <NotificationContext.Provider
            value={{
                notifications,
                unreadCount,
                isLoading,
                error,
                refresh,
                markAsRead,
                markAllAsRead,
                removeNotification,
                clearError,
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
};
