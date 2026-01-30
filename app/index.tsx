import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../src/features/auth/AuthContext';
import { COLORS } from '../src/lib/constants';

export default function Index() {
    const { session, isLoading, userRole, isAdmin } = useAuth();

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    if (session) {
        // Route based on user role
        if (isAdmin || userRole === 'admin' || userRole === 'instructor') {
            return <Redirect href="/(admin)/dashboard" />;
        }
        // Default to student dashboard
        return <Redirect href="/(student)/dashboard" />;
    }

    return <Redirect href="/(auth)/login" />;
}
