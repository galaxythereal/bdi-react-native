import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

/**
 * Register for push notifications and save token to profile
 */
export async function registerForPushNotifications(): Promise<string | null> {
    // Must be a physical device
    if (!Device.isDevice) {
        console.log('Push notifications only work on physical devices');
        return null;
    }

    // Request permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        console.log('Permission not granted for push notifications');
        return null;
    }

    // Get Expo push token
    try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ??
            (Constants as any).easConfig?.projectId;

        if (!projectId) {
            console.log('No project ID found. Make sure you have configured EAS.');
            // Try to get token anyway (works in some Expo configurations)
        }

        const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: projectId || undefined
        });
        const token = tokenData.data;

        console.log('Expo push token:', token);

        // Save token to user profile
        await saveTokenToProfile(token);

        return token;
    } catch (error) {
        console.error('Error getting push token:', error);
        return null;
    }
}

/**
 * Save push token to user's Supabase profile
 */
async function saveTokenToProfile(token: string) {
    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
            const { error } = await supabase
                .from('profiles')
                .update({ expo_push_token: token })
                .eq('id', user.id);

            if (error) {
                console.error('Error saving push token:', error);
            } else {
                console.log('Push token saved to profile');
            }
        }
    } catch (error) {
        console.error('Error saving token to profile:', error);
    }
}

/**
 * Setup notification listeners for foreground and tap handling
 */
export function setupNotificationListeners(
    onNotificationReceived?: (notification: Notifications.Notification) => void,
    onNotificationResponse?: (response: Notifications.NotificationResponse) => void
) {
    // When notification is received while app is foregrounded
    const notificationListener = Notifications.addNotificationReceivedListener((notification: Notifications.Notification) => {
        console.log('Notification received:', notification.request.content);
        onNotificationReceived?.(notification);
    });

    // When user taps on notification
    const responseListener = Notifications.addNotificationResponseReceivedListener((response: Notifications.NotificationResponse) => {
        console.log('Notification tapped:', response.notification.request.content);
        onNotificationResponse?.(response);

        // Get custom data from notification
        const data = response.notification.request.content.data;

        // You can implement navigation here based on data
        if (data?.screen) {
            console.log('Should navigate to:', data.screen);
        }
        if (data?.diploma_id) {
            console.log('Should open diploma:', data.diploma_id);
        }
    });

    // Return cleanup function
    return () => {
        notificationListener.remove();
        responseListener.remove();
    };
}

/**
 * Setup Android notification channel
 */
export async function setupAndroidChannel() {
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#C8A052', // Your brand gold color
        });

        // Optional: Create additional channels for different notification types
        await Notifications.setNotificationChannelAsync('live-sessions', {
            name: 'Live Sessions',
            description: 'Alerts for upcoming live sessions',
            importance: Notifications.AndroidImportance.HIGH,
            sound: 'default',
        });

        await Notifications.setNotificationChannelAsync('course-updates', {
            name: 'Course Updates',
            description: 'New content and course updates',
            importance: Notifications.AndroidImportance.DEFAULT,
        });
    }
}

/**
 * Send a local notification (for testing or local alerts)
 */
export async function sendLocalNotification(
    title: string,
    body: string,
    data?: Record<string, any>
) {
    await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            data: data || {},
            sound: 'default',
        },
        trigger: null, // null = immediate
    });
}

/**
 * Schedule a notification for later
 */
export async function scheduleNotification(
    title: string,
    body: string,
    scheduledDate: Date,
    data?: Record<string, any>
) {
    const trigger = scheduledDate.getTime() - Date.now();

    if (trigger <= 0) {
        console.log('Scheduled date is in the past, sending immediately');
        return sendLocalNotification(title, body, data);
    }

    const seconds = Math.floor(trigger / 1000);

    return await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            data: data || {},
            sound: 'default',
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: seconds,
        },
    });
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllScheduledNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get the badge count
 */
export async function getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
}

/**
 * Set the badge count
 */
export async function setBadgeCount(count: number) {
    await Notifications.setBadgeCountAsync(count);
}

/**
 * Clear the badge
 */
export async function clearBadge() {
    await Notifications.setBadgeCountAsync(0);
}
