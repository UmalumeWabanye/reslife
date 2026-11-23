import { Redirect } from 'expo-router';
import { useSession } from '@/lib/session';

/**
 * Entry point and fallback: protected screens redirect here when their guard flips
 * (signing in, finishing the profile, accepting an offer), and this sends the student
 * to the right place for their current state.
 */
export default function Index() {
  const { me, needsProfile, residency } = useSession();
  if (!me) return <Redirect href="/sign-in" />;
  if (needsProfile) return <Redirect href="/profile-setup" />;
  if (residency?.mode === 'residence') return <Redirect href="/home" />;
  return <Redirect href="/residences" />;
}
