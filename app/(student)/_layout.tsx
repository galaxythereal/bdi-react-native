import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Bell, BookOpen, LayoutDashboard, User } from 'lucide-react-native';
import { Platform, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/context/ThemeContext';
import { useNotifications } from '../../src/context/NotificationContext';

export default function StudentLayout() {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    const { unreadCount } = useNotifications();

    // Calculate proper bottom padding for the tab bar
    const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 24);

    return (
        <>
            <StatusBar
                style={isDark ? 'light' : 'dark'}
                backgroundColor={colors.background}
            />
            <Tabs
                screenOptions={{
                    headerShown: false,
                    tabBarActiveTintColor: colors.primary,
                    tabBarInactiveTintColor: colors.textTertiary,
                    tabBarStyle: {
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        borderTopWidth: 0,
                        height: 60 + bottomPadding,
                        paddingBottom: bottomPadding,
                        paddingTop: 8,
                        backgroundColor: colors.surface,
                        borderTopLeftRadius: 24,
                        borderTopRightRadius: 24,
                        shadowColor: isDark ? '#000' : '#000',
                        shadowOpacity: isDark ? 0.3 : 0.15,
                        shadowOffset: { width: 0, height: -4 },
                        shadowRadius: 16,
                        elevation: 24,
                    },
                    tabBarLabelStyle: {
                        fontSize: 11,
                        fontFamily: 'Inter-SemiBold',
                        marginTop: 4,
                    },
                    tabBarIconStyle: {
                        marginTop: 2,
                    },
                    tabBarHideOnKeyboard: true,
                    sceneStyle: {
                        backgroundColor: colors.background,
                    },
                }}
            >
                {/* ========== VISIBLE TABS (4 total) ========== */}
                <Tabs.Screen
                    name="dashboard"
                    options={{
                        title: 'Home',
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
                        title: 'Learn',
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
                    name="notifications"
                    options={{
                        title: 'Alerts',
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
                                        right: -8,
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
                                            fontFamily: 'Inter-Bold',
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
                        title: 'Profile',
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
        </>
    );
}
