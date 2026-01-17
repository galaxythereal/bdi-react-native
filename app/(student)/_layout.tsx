import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Bell, BookOpen, LayoutDashboard, User } from 'lucide-react-native';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/context/ThemeContext';
import { useNotifications } from '../../src/context/NotificationContext';
import { SHADOWS } from '../../src/lib/constants';

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
                        height: 56 + bottomPadding,
                        paddingBottom: bottomPadding,
                        paddingTop: 6,
                        backgroundColor: colors.surface,
                        borderTopLeftRadius: 20,
                        borderTopRightRadius: 20,
                        shadowColor: isDark ? '#000' : '#000',
                        shadowOpacity: isDark ? 0.3 : 0.12,
                        shadowOffset: { width: 0, height: -4 },
                        shadowRadius: 12,
                        elevation: 20,
                    },
                    tabBarLabelStyle: {
                        fontSize: 10,
                        fontFamily: 'Inter-SemiBold',
                        marginTop: 2,
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
                <Tabs.Screen
                    name="dashboard"
                    options={{
                        title: 'Home',
                        tabBarIcon: ({ color }) => <LayoutDashboard color={color} size={22} />,
                    }}
                />
                <Tabs.Screen
                    name="courses"
                    options={{
                        title: 'Courses',
                        tabBarIcon: ({ color }) => <BookOpen color={color} size={22} />,
                    }}
                />
                <Tabs.Screen
                    name="notifications"
                    options={{
                        title: 'Alerts',
                        tabBarIcon: ({ color }) => (
                            <View>
                                <Bell color={color} size={22} />
                                {unreadCount > 0 && (
                                    <View style={{
                                        position: 'absolute',
                                        top: -4,
                                        right: -6,
                                        backgroundColor: '#EF4444',
                                        borderRadius: 8,
                                        minWidth: 16,
                                        height: 16,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        paddingHorizontal: 4,
                                    }}>
                                        <View style={{
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}>
                                            <View>
                                                {/* Badge text handled inline for simplicity */}
                                            </View>
                                        </View>
                                    </View>
                                )}
                            </View>
                        ),
                        tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
                        tabBarBadgeStyle: {
                            backgroundColor: '#EF4444',
                            fontSize: 10,
                            fontFamily: 'Inter-Bold',
                            minWidth: 18,
                            height: 18,
                            borderRadius: 9,
                        },
                    }}
                />
                <Tabs.Screen
                    name="downloads"
                    options={{
                        title: 'Downloads',
                        tabBarIcon: ({ color }) => <Ionicons name="cloud-download-outline" color={color} size={22} />,
                    }}
                />
                <Tabs.Screen
                    name="certificates"
                    options={{
                        href: null, // Hide from tab bar, access from profile
                        title: 'Certificates',
                        tabBarIcon: ({ color }) => <Ionicons name="ribbon-outline" color={color} size={22} />,
                    }}
                />
                <Tabs.Screen
                    name="support"
                    options={{
                        href: null, // Hide from tab bar, access from profile
                        title: 'Support',
                        tabBarIcon: ({ color }) => <Ionicons name="chatbubbles-outline" color={color} size={22} />,
                    }}
                />
                <Tabs.Screen
                    name="profile"
                    options={{
                        title: 'Profile',
                        tabBarIcon: ({ color }) => <User color={color} size={20} />,
                    }}
                />
            </Tabs>
        </>
    );
}
