import { FundingTypes, type FundingType } from '@students/shared';
import { useState } from 'react';
import { View } from 'react-native';
import { Body, Button, Card, Chip, ErrorBanner, Field, Row, Screen } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useSession } from '@/lib/session';
import { fundingLabel, space } from '@/lib/theme';

export default function ProfileSetup() {
  const { me, refresh, signOut } = useSession();
  const [firstName, setFirstName] = useState(me?.firstName ?? '');
  const [lastName, setLastName] = useState(me?.lastName ?? '');
  const [phone, setPhone] = useState(me?.phone ?? '');
  const [fundingType, setFundingType] = useState<FundingType | null>(me?.studentProfile?.fundingType ?? null);
  const [year, setYear] = useState(me?.studentProfile?.yearOfStudy?.toString() ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.patch('/me/profile', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
        fundingType,
        yearOfStudy: year ? Number(year) : undefined,
      });
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Body muted>
        Signed in as {me?.email} ({me?.studentProfile?.institution.shortName}). Residences use these details when you apply.
      </Body>
      <ErrorBanner message={error} />
      <Card style={{ gap: space.lg }}>
        <Field label="First name" value={firstName} onChangeText={setFirstName} autoComplete="given-name" />
        <Field label="Last name" value={lastName} onChangeText={setLastName} autoComplete="family-name" />
        <Field label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />
        <Field
          label="Year of study (optional)"
          value={year}
          onChangeText={(v) => setYear(v.replace(/\D/g, '').slice(0, 1))}
          keyboardType="number-pad"
        />
        <View style={{ gap: space.sm }}>
          <Body style={{ fontWeight: '600' }}>How is your accommodation funded?</Body>
          <Row wrap>
            {FundingTypes.map((f) => (
              <Chip key={f} label={fundingLabel[f]} selected={fundingType === f} onPress={() => setFundingType(f)} />
            ))}
          </Row>
        </View>
        <Button title="Continue" onPress={save} loading={saving} disabled={!firstName.trim() || !lastName.trim() || !fundingType} />
      </Card>
      <Button title="Sign out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
