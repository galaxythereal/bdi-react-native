import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BookOpen, LayoutDashboard, User } from 'lucide-react-native';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/context/ThemeContext';
import { SHADOWS } from '../../src/lib/constants';

export default function StudentLayout() {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    
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
                        elevation: 20,
                        height: 56 + bottomPadding,
                        paddingBottom: bottomPadding,
                        paddingTop: 6,
                        backgroundColor: colors.surface,
                        ...SHADOWS.lg,
                        borderTopLeftRadius: 20,
                        borderTopRightRadius: 20,
                        shadowColor: isDark ? '#000' : '#000',
                        shadowOpacity: isDark ? 0.3 : 0.12,
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
                }}
                sceneContainerStyle={{
                    backgroundColor: colors.background,
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
                    name="certificates"
                    options={{
                        title: 'Certificates',
                        tabBarIcon: ({ color }) => <Ionicons name="ribbon-outline" color={color} size={22} />,
                    }}
                />
                <Tabs.Screen
                    name="support"
                    options={{
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
