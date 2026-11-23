import { Stack } from 'expo-router';
import { colors } from '@/lib/theme';

export default function ResidencesStack() {
  return (
    <Stack screenOptions={{ headerTintColor: colors.primary, headerStyle: { backgroundColor: colors.bg }, headerShadowVisible: false }}>
      <Stack.Screen name="index" options={{ title: 'Residences', headerLargeTitle: true }} />
      <Stack.Screen name="[id]" options={{ title: '' }} />
    </Stack>
  );
}
