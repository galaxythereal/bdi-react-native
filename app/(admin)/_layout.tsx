import { Theme } from '@/constants/theme';
import { Tabs } from 'expo-router';
import { BarChart3, Settings, Users } from 'lucide-react-native';
import { useTheme } from '../../src/context/ThemeContext';

export default function AdminLayout() {
    const { colors, isDark } = useTheme();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: colors.surface,
                    borderTopColor: colors.border,
                    borderTopWidth: 1,
                    paddingTop: 8,
                    paddingBottom: 8,
                    height: 70,
                },
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textSecondary,
                tabBarLabelStyle: {
                    fontSize: Theme.fontSize.xs,
                    fontWeight: Theme.fontWeight.semibold,
                    marginTop: Theme.spacing.xs,
                },
            }}
        >
            <Tabs.Screen
                name="dashboard"
                options={{
                    title: 'Dashboard',
                    tabBarIcon: ({ color, size }) => <BarChart3 color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="students"
                options={{
                    title: 'Students',
                    tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: 'Settings',
                    tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
                }}
            />
        </Tabs>
    );
}
