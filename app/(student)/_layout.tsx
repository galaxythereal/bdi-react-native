import { Theme } from '@/constants/theme';
import { Tabs } from 'expo-router';
import { Bell, BookOpen, LayoutDashboard, Trophy, User } from 'lucide-react-native';
import { Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications } from '../../src/context/NotificationContext';
import { useLocalization } from '../../src/context/LocalizationContext';
import { useTheme } from '../../src/context/ThemeContext';

export default function StudentLayout() {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const { unreadCount } = useNotifications();
    const { t, isRTL } = useLocalization();

    // Calculate proper bottom padding for the tab bar
    const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 24);

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textTertiary,
                tabBarPosition: 'bottom',
                tabBarStyle: {
                    borderTopWidth: 0,
                    height: 60 + bottomPadding,
                    paddingBottom: bottomPadding,
                    paddingTop: Theme.spacing.sm,
                    backgroundColor: colors.surface,
                    borderTopLeftRadius: Theme.borderRadius.xl,
                    borderTopRightRadius: Theme.borderRadius.xl,
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    ...Theme.shadows[isDark ? 'dark' : 'light'].lg,
                },
                tabBarLabelStyle: {
                    fontSize: Theme.fontSize.xs,
                    fontWeight: Theme.fontWeight.semibold,
                    marginTop: Theme.spacing.xs,
                },
                tabBarIconStyle: {
                    marginTop: 2,
                },
                tabBarHideOnKeyboard: true,
                sceneStyle: {
                    backgroundColor: colors.background,
                    flex: 1,
                },
            }}
        >
                {/* ========== VISIBLE TABS (4 total) ========== */}
                <Tabs.Screen
                    name="dashboard"
                    options={{
                        title: t.home,
                        tabBarIcon: ({ color, focused }) => (
                            <View style={{ alignItems: 'center' }}>
                                <LayoutDashboard
                                    color={color}
                                    size={24}
                                    strokeWidth={focused ? 2.5 : 2}
                                />
                            </View>
                        ),
                    }}
                />
                <Tabs.Screen
                    name="courses"
                    options={{
                        title: t.learn,
                        tabBarIcon: ({ color, focused }) => (
                            <View style={{ alignItems: 'center' }}>
                                <BookOpen
                                    color={color}
                                    size={24}
                                    strokeWidth={focused ? 2.5 : 2}
                                />
                            </View>
                        ),
                    }}
                />
                <Tabs.Screen
                    name="leaderboard"
                    options={{
                        title: t.rankings,
                        tabBarIcon: ({ color, focused }) => (
                            <View style={{ alignItems: 'center' }}>
                                <Trophy
                                    color={color}
                                    size={24}
                                    strokeWidth={focused ? 2.5 : 2}
                                />
                            </View>
                        ),
                    }}
                />
                <Tabs.Screen
                    name="notifications"
                    options={{
                        title: t.alerts,
                        tabBarIcon: ({ color, focused }) => (
                            <View style={{ alignItems: 'center' }}>
                                <Bell
                                    color={color}
                                    size={24}
                                    strokeWidth={focused ? 2.5 : 2}
                                />
                                {unreadCount > 0 && (
                                    <View style={{
                                        position: 'absolute',
                                        top: -4,
                                        ...(isRTL ? { left: -8 } : { right: -8 }),
                                        backgroundColor: '#EF4444',
                                        borderRadius: 10,
                                        minWidth: 18,
                                        height: 18,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        paddingHorizontal: 4,
                                        borderWidth: 2,
                                        borderColor: colors.surface,
                                    }}>
                                        <Text style={{
                                            color: '#FFFFFF',
                                            fontSize: 10,
                                            fontWeight: Theme.fontWeight.bold,
                                        }}>
                                            {unreadCount > 99 ? '99+' : unreadCount}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        ),
                    }}
                />
                <Tabs.Screen
                    name="profile"
                    options={{
                        title: t.profile,
                        tabBarIcon: ({ color, focused }) => (
                            <View style={{ alignItems: 'center' }}>
                                <User
                                    color={color}
                                    size={24}
                                    strokeWidth={focused ? 2.5 : 2}
                                />
                            </View>
                        ),
                    }}
                />

                {/* ========== HIDDEN TABS (accessible via navigation) ========== */}
                <Tabs.Screen
                    name="catalog"
                    options={{
                        href: null, // Hidden - access from Home page
                    }}
                />
                <Tabs.Screen
                    name="live-sessions"
                    options={{
                        href: null, // Hidden - featured on Home page
                    }}
                />
                <Tabs.Screen
                    name="downloads"
                    options={{
                        href: null, // Hidden - access from Profile
                    }}
                />
                <Tabs.Screen
                    name="certificates"
                    options={{
                        href: null, // Hidden - access from Profile
                    }}
                />
                <Tabs.Screen
                    name="support"
                    options={{
                        href: null, // Hidden - access from Profile
                    }}
                />
            </Tabs>
    );
}
