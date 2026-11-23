import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Body, Button, Card, ErrorBanner, Field, Screen } from '@/components/ui';
import { api, errorMessage, type Tokens } from '@/lib/api';
import { useSession } from '@/lib/session';

const RESEND_SECONDS = 60;

export default function Verify() {
  const identity = useLocalSearchParams<{ institutionId: string; studentNumber: string; email: string }>();
  const { signIn } = useSession();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function verify(value = code) {
    setVerifying(true);
    setError(null);
    try {
      const tokens = await api.post<Tokens>('/auth/student/otp/verify', { ...identity, code: value });
      // The root layout switches to the next part of the app once the session loads.
      await signIn(tokens);
    } catch (e) {
      setError(errorMessage(e));
      setVerifying(false);
    }
  }

  async function resend() {
    setError(null);
    setNotice(null);
    try {
      await api.post('/auth/student/otp/request', identity);
      setCooldown(RESEND_SECONDS);
      setNotice('New code sent.');
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Screen>
      <Body>
        Enter the 6-digit code we sent to <Body style={{ fontWeight: '700' }}>{identity.email}</Body>. It expires in 10
        minutes.
      </Body>
      <ErrorBanner message={error} />
      <Card style={{ gap: 16 }}>
        <Field
          label="Verification code"
          value={code}
          onChangeText={(v) => {
            const digits = v.replace(/\D/g, '').slice(0, 6);
            setCode(digits);
            if (digits.length === 6) verify(digits);
          }}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center' }}
        />
        <Button title="Verify" onPress={() => verify()} loading={verifying} disabled={code.length !== 6} />
        <Button
          title={cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          variant="secondary"
          onPress={resend}
          disabled={cooldown > 0}
        />
        {notice ? <Body muted>{notice}</Body> : null}
      </Card>
    </Screen>
  );
}
