import { Stack } from 'expo-router';
import { colors } from '@/lib/theme';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerTintColor: colors.primary, headerShadowVisible: false, headerStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="verify" options={{ title: 'Verify your email' }} />
    </Stack>
  );
}
