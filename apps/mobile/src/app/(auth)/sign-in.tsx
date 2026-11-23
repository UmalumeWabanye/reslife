import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Body, Button, Card, Chip, ErrorBanner, Field, H1, Loading, Row, Screen } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { colors, space } from '@/lib/theme';
import type { Institution } from '@/lib/types';

export default function SignIn() {
  const [institutions, setInstitutions] = useState<Institution[] | null>(null);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<Institution[]>('/institutions').then(setInstitutions).catch((e) => setError(errorMessage(e)));
  }, []);

  const institution = institutions?.find((i) => i.id === institutionId);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (institutions ?? []).filter((i) => !q || i.name.toLowerCase().includes(q) || i.shortName.toLowerCase().includes(q));
  }, [institutions, query]);

  const emailDomain = email.split('@')[1]?.toLowerCase();
  const domainError =
    institution && emailDomain && email.includes('.') && !institution.emailDomains.includes(emailDomain)
      ? `Use your ${institution.shortName} student email (@${institution.emailDomains[0]})`
      : undefined;

  async function requestCode() {
    if (!institution) return;
    setSubmitting(true);
    setError(null);
    const identity = { institutionId: institution.id, studentNumber: studentNumber.trim(), email: email.trim().toLowerCase() };
    try {
      await api.post('/auth/student/otp/request', identity);
      router.push({ pathname: '/verify', params: identity });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Screen>
          <View style={{ gap: space.sm, marginTop: space.lg }}>
            <H1>Find your res</H1>
            <Body muted>Sign in with your student number. We’ll send a code to your university email.</Body>
          </View>

          <ErrorBanner message={error} />

          {!institutions ? (
            <Loading />
          ) : !institution ? (
            <Card>
              <Field label="Your institution" placeholder="Search e.g. UCT, Wits" value={query} onChangeText={setQuery} autoCorrect={false} />
              <View style={{ gap: space.sm }}>
                {filtered.map((i) => (
                  <Card key={i.id} onPress={() => setInstitutionId(i.id)} style={{ padding: space.md }}>
                    <Body style={{ fontWeight: '600' }}>{i.name}</Body>
                    <Body muted>
                      {i.shortName} · {i.city}
                    </Body>
                  </Card>
                ))}
                {filtered.length === 0 && <Body muted>No institutions match “{query}”.</Body>}
              </View>
            </Card>
          ) : (
            <Card style={{ gap: space.lg }}>
              <Row wrap>
                <Body muted>Institution</Body>
                <Chip label={`${institution.shortName} · change`} selected onPress={() => setInstitutionId(null)} />
              </Row>
              <Field
                label="Student number"
                value={studentNumber}
                onChangeText={setStudentNumber}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="e.g. DLMSIP001"
              />
              <Field
                label="Student email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder={`you@${institution.emailDomains[0]}`}
                error={domainError}
              />
              <Button
                title="Send code"
                onPress={requestCode}
                loading={submitting}
                disabled={studentNumber.trim().length < 3 || !emailDomain || !!domainError}
              />
            </Card>
          )}
        </Screen>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
