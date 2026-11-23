import { Stack } from 'expo-router';
import { colors } from '@/lib/theme';

export default function ApplicationsStack() {
  return (
    <Stack screenOptions={{ headerTintColor: colors.primary, headerStyle: { backgroundColor: colors.bg }, headerShadowVisible: false }}>
      <Stack.Screen name="index" options={{ title: 'Applications', headerLargeTitle: true }} />
      <Stack.Screen name="[id]" options={{ title: 'Application' }} />
    </Stack>
  );
}
