import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SessionProvider, useSession } from '@/lib/session';

SplashScreen.preventAutoHideAsync();

/**
 * Which part of the app a student sees is decided here, from server state:
 *   signed out            → (auth)       institution + student number + email OTP
 *   profile incomplete    → profile-setup
 *   no accepted residence → (discover)   browse residences, apply, track applications
 *   accepted residence    → (residence)  that residence's branded space
 */
function RootNavigator() {
  const { isLoading, me, needsProfile, residency } = useSession();

  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

  if (isLoading) return null;

  const signedIn = !!me;
  const ready = signedIn && !needsProfile;
  const inResidence = ready && residency?.mode === 'residence';

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Unguarded anchor: redirects to the right area whenever a guard changes. */}
      <Stack.Screen name="index" />
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && needsProfile}>
        <Stack.Screen name="profile-setup" options={{ headerShown: true, title: 'Your details' }} />
      </Stack.Protected>
      <Stack.Protected guard={ready && !inResidence}>
        <Stack.Screen name="(discover)" />
      </Stack.Protected>
      <Stack.Protected guard={inResidence}>
        <Stack.Screen name="(residence)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <RootNavigator />
    </SessionProvider>
  );
}
