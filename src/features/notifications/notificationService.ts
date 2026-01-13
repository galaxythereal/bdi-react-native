import { supabase } from '../../lib/supabase';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export type NotificationType = 
    | 'course_enrolled' 
    | 'course_completed' 
    | 'certificate_issued'
    | 'support_reply'
    | 'announcement'
    | 'reminder'
    | 'achievement'
    | 'system';

export interface Notification {
    id: string;
    user_id: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: Record<string, any>;
    action_url?: string;
    read: boolean;
    created_at: string;
}

// Type for real-time payload
export type NotificationPayload = RealtimePostgresChangesPayload<Notification>;

/**
 * Fetch all notifications for the current user
 */
export const fetchNotifications = async (): Promise<Notification[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) throw error;
    return data || [];
};

/**
 * Fetch unread notification count
 */
export const fetchUnreadCount = async (): Promise<number> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);

    if (error) throw error;
    return count || 0;
};

/**
 * Mark a notification as read
 */
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
    const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

    if (error) throw error;
};

/**
 * Mark all notifications as read for a user
 */
export const markAllNotificationsAsRead = async (userId: string): Promise<void> => {
    const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);

    if (error) throw error;
};

/**
 * Delete a notification
 */
export const deleteNotification = async (notificationId: string): Promise<void> => {
    const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

    if (error) throw error;
};

/**
 * Subscribe to real-time notification updates
 */
export const subscribeToNotifications = (
    userId: string,
    onUpdate: (payload: NotificationPayload) => void
) => {
    const channel = supabase
        .channel(`notifications:${userId}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${userId}`,
            },
            onUpdate
        )
        .subscribe();

    return channel;
};

/**
 * Get notification icon name based on type
 */
export const getNotificationIcon = (type: NotificationType): string => {
    switch (type) {
        case 'course_enrolled':
            return 'book-outline';
        case 'course_completed':
            return 'checkmark-circle-outline';
        case 'certificate_issued':
            return 'ribbon-outline';
        case 'support_reply':
            return 'chatbubbles-outline';
        case 'announcement':
            return 'megaphone-outline';
        case 'reminder':
            return 'alarm-outline';
        case 'achievement':
            return 'trophy-outline';
        case 'system':
        default:
            return 'information-circle-outline';
    }
};

/**
 * Get notification color based on type
 */
export const getNotificationColor = (type: NotificationType): string => {
    switch (type) {
        case 'course_enrolled':
            return '#219EBC'; // info blue
        case 'course_completed':
            return '#2A9D8F'; // success green
        case 'certificate_issued':
            return '#D4AF37'; // gold
        case 'support_reply':
            return '#8B1538'; // primary
        case 'announcement':
            return '#F77F00'; // warning orange
        case 'reminder':
            return '#E63946'; // alert red
        case 'achievement':
            return '#9B59B6'; // purple
        case 'system':
        default:
            return '#6B6B6B'; // gray
    }
};

/**
 * Format notification timestamp
 */
export const formatNotificationTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
        return 'Just now';
    } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `${hours}h ago`;
    } else if (diffInSeconds < 604800) {
        const days = Math.floor(diffInSeconds / 86400);
        return `${days}d ago`;
    } else {
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
    }
};
