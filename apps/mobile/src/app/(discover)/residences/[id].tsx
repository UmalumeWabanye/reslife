import { formatZar } from '@students/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Badge, Body, Button, Card, Chip, ErrorBanner, H1, H2, KeyValue, Loading, Row, Screen } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useSession } from '@/lib/session';
import { fundingLabel, residenceTypeLabel, space } from '@/lib/theme';
import type { Application, ResidenceDetail, RoomType } from '@/lib/types';
import { useApi } from '@/lib/use-api';

const genderLabel = { MIXED: 'Mixed', FEMALE_ONLY: 'Female only', MALE_ONLY: 'Male only' } as const;

/** Applications open for the coming academic year from roughly July. */
function academicYearOptions() {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() >= 6 ? [y + 1, y] : [y, y + 1];
}

export default function ResidenceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me } = useSession();
  const { data: r, error, loading } = useApi<ResidenceDetail>(`/residences/${id}`);
  const years = academicYearOptions();
  const [year, setYear] = useState(years[0]);
  const [selected, setSelected] = useState<RoomType | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const fundingType = me?.studentProfile?.fundingType;

  async function apply() {
    if (!r || !selected || !fundingType) return;
    setApplying(true);
    setApplyError(null);
    try {
      const created = await api.post<Application>('/applications', {
        residenceId: r.id,
        roomTypeId: selected.id,
        academicYear: year,
        fundingType,
      });
      router.push(`/applications/${created.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'DUPLICATE_APPLICATION') {
        setApplyError(`You've already applied here for ${year}. Find it under Applications.`);
      } else {
        setApplyError(errorMessage(e));
      }
    } finally {
      setApplying(false);
    }
  }

  if (loading && !r) return <Loading />;
  if (!r) return <Screen><ErrorBanner message={error ?? 'Residence not found'} /></Screen>;

  const distance = r.institutions.find((i) => i.institution.id === me?.studentProfile?.institution.id)?.distanceKm;
  const fundingMismatch = fundingType === 'NSFAS' && !r.nsfasAccredited;

  return (
    <Screen>
      <Stack.Screen options={{ title: r.name }} />
      <View style={{ height: 6, borderRadius: 3, backgroundColor: r.primaryColour }} />
      <View style={{ gap: space.sm }}>
        <H1>{r.name}</H1>
        <Body muted>
          {r.addressLine}, {r.city}
          {distance != null ? ` · ${distance} km from campus` : ''}
        </Body>
        <Row wrap>
          <Badge label={residenceTypeLabel[r.type]} />
          <Badge label={genderLabel[r.genderPolicy]} />
          {r.nsfasAccredited && <Badge label="NSFAS accredited" tone="success" />}
          {r.bursaryFunded && <Badge label="Bursary funded" tone="success" />}
        </Row>
      </View>

      <Body>{r.description}</Body>

      {r.amenities.length > 0 && (
        <Card>
          <H2>Amenities</H2>
          <Body muted>{r.amenities.join(' · ')}</Body>
        </Card>
      )}

      <H2>Rooms</H2>
      {r.roomTypes.map((rt) => (
        <Card
          key={rt.id}
          onPress={() => setSelected(rt)}
          style={selected?.id === rt.id ? { borderColor: r.primaryColour, borderWidth: 2 } : undefined}>
          <Row>
            <View style={{ flex: 1 }}>
              <Body style={{ fontWeight: '700' }}>{rt.name}</Body>
            </View>
            <Body style={{ fontWeight: '700' }}>{formatZar(rt.monthlyRentCents)}/mo</Body>
          </Row>
          {rt.description ? <Body muted>{rt.description}</Body> : null}
          <Row wrap>
            <Badge label={rt.occupancy === 1 ? 'Single' : `${rt.occupancy}-sharing`} />
            <Badge label={rt.availableBeds > 0 ? `${rt.availableBeds} beds free` : 'Full · waitlist'} tone={rt.availableBeds > 0 ? 'info' : 'warning'} />
            {rt.depositCents > 0 && <Badge label={`Deposit ${formatZar(rt.depositCents)}`} />}
          </Row>
        </Card>
      ))}

      <Card style={{ gap: space.md }}>
        <H2>Apply</H2>
        <KeyValue label="Room" value={selected?.name ?? 'Tap a room above'} />
        <KeyValue label="Funding" value={fundingType ? fundingLabel[fundingType] : '—'} />
        <View style={{ gap: space.sm }}>
          <Body muted>Academic year</Body>
          <Row>
            {years.map((y) => (
              <Chip key={y} label={String(y)} selected={year === y} onPress={() => setYear(y)} />
            ))}
          </Row>
        </View>
        {fundingMismatch && (
          <Body muted>This residence isn’t NSFAS accredited, so NSFAS may not cover the rent. You can still apply.</Body>
        )}
        <ErrorBanner message={applyError} />
        <Button title="Start application" color={r.primaryColour} onPress={apply} loading={applying} disabled={!selected} />
      </Card>

      <Card>
        <H2>Managed by</H2>
        <Body>{r.organisation.name}</Body>
        <Body muted>{[r.organisation.contactEmail, r.organisation.contactPhone].filter(Boolean).join(' · ')}</Body>
      </Card>
    </Screen>
  );
}
