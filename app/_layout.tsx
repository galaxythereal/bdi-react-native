import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ImpersonationProvider } from '../src/context/ImpersonationContext';
import { LocalizationProvider } from '../src/context/LocalizationContext';
import { NotificationProvider } from '../src/context/NotificationContext';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { AuthProvider, useAuth } from '../src/features/auth/AuthContext';

SplashScreen.preventAutoHideAsync();

function RootLayoutContent() {
  const { colors, isDark } = useTheme();

  return (
    <>
      <StatusBar
        style={isDark ? 'light' : 'dark'}
        backgroundColor={colors.background}
        translucent={Platform.OS === 'android'}
      />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(admin)" options={{ headerShown: false }} />
        <Stack.Screen name="(student)" options={{ headerShown: false }} />
        <Stack.Screen name="course/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="diploma/[id]" options={{ presentation: 'modal', headerShown: false }} />
      </Stack>
    </>
  );
}

// Wrapper to provide impersonation context with user ID
function ImpersonationWrapper({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  return (
    <ImpersonationProvider currentUserId={session?.user?.id || null}>
      {children}
    </ImpersonationProvider>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    // Inter font family
    'Inter-Thin': require('../assets/fonts/Inter-Thin.ttf'),
    'Inter-ExtraLight': require('../assets/fonts/Inter-ExtraLight.ttf'),
    'Inter-Light': require('../assets/fonts/Inter-Light.ttf'),
    'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
    'Inter-Medium': require('../assets/fonts/Inter-Medium.ttf'),
    'Inter-SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
    'Inter-Bold': require('../assets/fonts/Inter-Bold.ttf'),
    'Inter-ExtraBold': require('../assets/fonts/Inter-ExtraBold.ttf'),
    'Inter-Black': require('../assets/fonts/Inter-Black.ttf'),
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    // Ideally this should use a theme color, but context might not be ready if it's inside ThemeProvider
    // However, since this check is inside RootLayout which returns the provider, we can't use useTheme here.
    // We can import Colors directly for this loader state.
    const { Colors } = require('@/constants/theme');
    return <View style={{ flex: 1, backgroundColor: Colors.light.background }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <LocalizationProvider>
            <AuthProvider>
              <ImpersonationWrapper>
                <NotificationProvider>
                  <RootLayoutContent />
                </NotificationProvider>
              </ImpersonationWrapper>
            </AuthProvider>
          </LocalizationProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
