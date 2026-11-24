import { Stack } from 'expo-router';
import { useResidence } from '@/lib/residence';
import { colors } from '@/lib/theme';

export default function MaintenanceStack() {
  const { residence } = useResidence();
  return (
    <Stack
      screenOptions={{ headerTintColor: residence.primaryColour, headerStyle: { backgroundColor: colors.bg }, headerShadowVisible: false }}>
      <Stack.Screen name="index" options={{ title: 'Maintenance', headerLargeTitle: true }} />
      <Stack.Screen name="new" options={{ title: 'Report a problem', presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: 'Request' }} />
    </Stack>
  );
}
