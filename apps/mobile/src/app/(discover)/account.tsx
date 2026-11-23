import { SafeAreaView } from 'react-native-safe-area-context';
import { AccountPanel } from '@/components/account-panel';
import { H1, Screen } from '@/components/ui';
import { colors } from '@/lib/theme';

export default function Account() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Screen>
        <H1>Account</H1>
        <AccountPanel />
      </Screen>
    </SafeAreaView>
  );
}
