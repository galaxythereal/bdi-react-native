import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, PermissionsAndroid, NativeModules } from 'react-native';
import { supabase } from '../lib/supabase';

// Detect if Firebase native modules are installed (native build vs Expo Go)
const isNativeBuild = !!NativeModules.RNFBAppModule;

// ─── Firebase lazy loader ───────────────────────────────────────────
// We do NOT import @react-native-firebase/* at the top level because
// that immediately loads the native module which crashes in Expo Go.
// Instead we lazily require() it and fall back to expo-notifications.

let _messaging: any = null;
let _firebaseAvailable: boolean | null = null;

function getFirebaseMessaging(): any {
    if (_firebaseAvailable === false) return null;
    if (_messaging) return _messaging;

    try {
        // Require the app module first to trigger native auto-init
        require('@react-native-firebase/app');
        const mod = require('@react-native-firebase/messaging');
        const fn = mod.default || mod;
        _messaging = fn();
        _firebaseAvailable = true;
        return _messaging;
    } catch (e: any) {
        const msg = e?.message || '';
        if (!isNativeBuild) {
            // Native module not present (Expo Go) → permanent failure
            console.warn('Firebase native modules not installed (Expo Go), using expo-notifications');
            _firebaseAvailable = false;
        } else {
            // Native build but Firebase not yet initialized → allow retry
            console.warn('Firebase messaging not ready yet, will retry:', msg);
        }
        return null;
    }
}

function getFirebaseAuthorizationStatus() {
    try {
        const mod = require('@react-native-firebase/messaging');
        const fn = mod.default || mod;
        return {
            AUTHORIZED: fn.AuthorizationStatus?.AUTHORIZED ?? 1,
            PROVISIONAL: fn.AuthorizationStatus?.PROVISIONAL ?? 2,
        };
    } catch {
        return { AUTHORIZED: 1, PROVISIONAL: 2 };
    }
}

// ─── Notification display handler ──────────────────────────────────
// expo-notifications still handles the display part in both modes
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
 * Register for push notifications.
 * - Native build: Firebase Cloud Messaging (FCM token)
 * - Expo Go:      Expo Push Notifications (Expo push token)
 */
export async function registerForPushNotifications(): Promise<string | null> {
    if (!Device.isDevice) {
        console.log('Push notifications only work on physical devices');
        return null;
    }

    try {
        // In native builds, retry a few times if Firebase isn't initialized yet
        if (isNativeBuild) {
            let fbMessaging = getFirebaseMessaging();
            if (!fbMessaging) {
                // Firebase may not be initialized yet in release builds — retry
                for (let i = 0; i < 5; i++) {
                    console.log(`Firebase not ready, retry ${i + 1}/5...`);
                    await new Promise(r => setTimeout(r, 1000));
                    fbMessaging = getFirebaseMessaging();
                    if (fbMessaging) break;
                }
            }
            if (fbMessaging) {
                return await registerWithFirebase(fbMessaging);
            } else {
                console.error('Firebase failed to initialize after retries in native build');
                return null;
            }
        } else {
            // Expo Go — use Expo Push tokens
            return await registerWithExpo();
        }
    } catch (error) {
        console.error('Error registering for push notifications:', error);
        return null;
    }
}

// ─── FCM registration (native builds) ──────────────────────────────
async function registerWithFirebase(fbMessaging: any): Promise<string | null> {
    if (Platform.OS === 'android') {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('Android notification permission not granted');
            return null;
        }

        // Android 13+ explicit runtime permission
        if (Platform.Version >= 33) {
            try {
                const postNotif = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
                );
                if (postNotif !== PermissionsAndroid.RESULTS.GRANTED) {
                    console.log('POST_NOTIFICATIONS permission not granted');
                    return null;
                }
            } catch (e) {
                console.warn('PermissionsAndroid.request failed:', e);
            }
        }
    } else {
        // iOS: Request via Firebase messaging
        const authStatuses = getFirebaseAuthorizationStatus();
        const authStatus = await fbMessaging.requestPermission();
        const enabled =
            authStatus === authStatuses.AUTHORIZED ||
            authStatus === authStatuses.PROVISIONAL;

        if (!enabled) {
            console.log('iOS notification permission not granted');
            return null;
        }
    }

    const token = await fbMessaging.getToken();
    console.log('FCM token:', token);

    await saveTokenToProfile(token);

    fbMessaging.onTokenRefresh(async (newToken: string) => {
        console.log('FCM token refreshed:', newToken);
        await saveTokenToProfile(newToken);
    });

    return token;
}

// ─── Expo Push registration (Expo Go) ──────────────────────────────
async function registerWithExpo(): Promise<string | null> {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        console.log('Notification permission not granted');
        return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: '56489819-36c2-4d3c-b474-38cd0182a5f8',
    });
    const token = tokenData.data;
    console.log('Expo push token:', token);

    await saveTokenToProfile(token);
    return token;
}

/**
 * Save token to user's Supabase profile
 */
async function saveTokenToProfile(token: string) {
    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
            // Try saving to fcm_token column
            const { error: fcmError } = await supabase
                .from('profiles')
                .update({ fcm_token: token })
                .eq('id', user.id);

            if (fcmError) {
                console.warn('Could not save to fcm_token column (run migration 004?):', fcmError.message);
            }

            // Also save to expo_push_token as fallback
            const { error: legacyError } = await supabase
                .from('profiles')
                .update({ expo_push_token: token })
                .eq('id', user.id);

            if (legacyError) {
                console.error('Error saving token to legacy column:', legacyError);
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
    const notificationListener = Notifications.addNotificationReceivedListener((notification: Notifications.Notification) => {
        console.log('Notification received:', notification.request.content);
        onNotificationReceived?.(notification);
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener((response: Notifications.NotificationResponse) => {
        console.log('Notification tapped:', response.notification.request.content);
        onNotificationResponse?.(response);

        const data = response.notification.request.content.data;
        if (data?.screen) {
            console.log('Should navigate to:', data.screen);
        }
        if (data?.diploma_id) {
            console.log('Should open diploma:', data.diploma_id);
        }
    });

    // Firebase foreground message handler (native builds only)
    let unsubscribeOnMessage: (() => void) | null = null;
    const fbMessaging = getFirebaseMessaging();

    if (fbMessaging) {
        unsubscribeOnMessage = fbMessaging.onMessage(async (remoteMessage: any) => {
            console.log('FCM foreground message:', remoteMessage);

            if (remoteMessage.notification) {
                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: remoteMessage.notification.title || '',
                        body: remoteMessage.notification.body || '',
                        data: remoteMessage.data || {},
                        sound: 'default',
                    },
                    trigger: null,
                });
            }
        });
    }

    return () => {
        notificationListener.remove();
        responseListener.remove();
        unsubscribeOnMessage?.();
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
            lightColor: '#C8A052',
        });

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
 * Setup Firebase background message handler
 * Safe to call even in Expo Go — silently skips if Firebase is unavailable.
 * Must be called at app entry level (outside components).
 */
export function setupBackgroundMessageHandler() {
    try {
        const mod = require('@react-native-firebase/messaging');
        const fn = mod.default || mod;
        const msg = fn();
        msg.setBackgroundMessageHandler(async (remoteMessage: any) => {
            console.log('FCM background message:', remoteMessage);
        });
    } catch (e: any) {
        // Firebase not available (Expo Go) or not yet initialized (early startup)
        // This is fine — FCM still shows notification-payload messages natively.
        console.warn('Firebase background handler skipped:', e?.message);
    }
}

/**
 * Send a local notification
 */
export async function sendLocalNotification(
    title: string,
    body: string,
    data?: Record<string, any>
) {
    await Notifications.scheduleNotificationAsync({
        content: { title, body, data: data || {}, sound: 'default' },
        trigger: null,
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
        return sendLocalNotification(title, body, data);
    }

    return await Notifications.scheduleNotificationAsync({
        content: { title, body, data: data || {}, sound: 'default' },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: Math.floor(trigger / 1000),
        },
    });
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllScheduledNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
}

export async function setBadgeCount(count: number) {
    await Notifications.setBadgeCountAsync(count);
}

export async function clearBadge() {
    await Notifications.setBadgeCountAsync(0);
}

/**
 * Delete the push token (for logout/token invalidation)
 */
export async function deleteToken() {
    try {
        const fbMessaging = getFirebaseMessaging();
        if (fbMessaging) {
            await fbMessaging.deleteToken();
            console.log('FCM token deleted');
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            try {
                await supabase.from('profiles').update({ fcm_token: null }).eq('id', user.id);
            } catch {}
            await supabase.from('profiles').update({ expo_push_token: null }).eq('id', user.id);
        }
    } catch (error) {
        console.error('Error deleting push token:', error);
    }
}
