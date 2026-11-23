import { formatZar, ResidenceTypes, type ResidenceType } from '@students/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Badge, Body, Card, Chip, Empty, ErrorBanner, Field, H2, Loading, Row, Screen } from '@/components/ui';
import { useSession } from '@/lib/session';
import { colors, residenceTypeLabel, space } from '@/lib/theme';
import type { Paged, ResidenceSummary } from '@/lib/types';
import { useApi } from '@/lib/use-api';

const RENT_CAPS = [300000, 450000, 600000];

export default function Residences() {
  const { me } = useSession();
  const [type, setType] = useState<ResidenceType | null>(null);
  const [nsfas, setNsfas] = useState(me?.studentProfile?.fundingType === 'NSFAS');
  const [bursary, setBursary] = useState(false);
  const [maxRent, setMaxRent] = useState<number | null>(null);
  const [q, setQ] = useState('');

  const path = useMemo(() => {
    const p = new URLSearchParams({ pageSize: '50' });
    if (type) p.set('type', type);
    if (nsfas) p.set('nsfasAccredited', 'true');
    if (bursary) p.set('bursaryFunded', 'true');
    if (maxRent) p.set('maxRentCents', String(maxRent));
    if (q.trim().length >= 2) p.set('q', q.trim());
    return `/residences?${p}`;
  }, [type, nsfas, bursary, maxRent, q]);

  const { data, error, loading, refreshing, reload } = useApi<Paged<ResidenceSummary>>(path);

  return (
    <Screen onRefresh={reload} refreshing={refreshing}>
      <Body muted>Residences serving {me?.studentProfile?.institution.name}</Body>
      <Field label="Search" placeholder="Name or street" value={q} onChangeText={setQ} autoCorrect={false} />

      <View style={{ gap: space.sm }}>
        <Row wrap>
          <Chip label="All types" selected={!type} onPress={() => setType(null)} />
          {ResidenceTypes.map((t) => (
            <Chip key={t} label={residenceTypeLabel[t]} selected={type === t} onPress={() => setType(type === t ? null : t)} />
          ))}
        </Row>
        <Row wrap>
          <Chip label="NSFAS accredited" selected={nsfas} onPress={() => setNsfas(!nsfas)} />
          <Chip label="Bursary funded" selected={bursary} onPress={() => setBursary(!bursary)} />
        </Row>
        <Row wrap>
          {RENT_CAPS.map((c) => (
            <Chip key={c} label={`Under ${formatZar(c).replace(/,00$/, '')}`} selected={maxRent === c} onPress={() => setMaxRent(maxRent === c ? null : c)} />
          ))}
        </Row>
      </View>

      <ErrorBanner message={error} />
      {loading && !data ? (
        <Loading />
      ) : data && data.items.length === 0 ? (
        <Empty title="No residences match" body="Try removing some filters." />
      ) : (
        <View style={{ gap: space.md }}>
          {data?.items.map((r) => <ResidenceCard key={r.id} r={r} />)}
        </View>
      )}
    </Screen>
  );
}

function ResidenceCard({ r }: { r: ResidenceSummary }) {
  return (
    <Card onPress={() => router.push(`/residences/${r.id}`)} style={{ padding: 0, overflow: 'hidden' }}>
      <View style={{ height: 8, backgroundColor: r.primaryColour }} />
      <View style={{ padding: space.lg, gap: space.sm }}>
        <Row>
          <View style={{ flex: 1 }}>
            <H2>{r.name}</H2>
          </View>
          {r.fromRentCents !== null && (
            <Body style={{ fontWeight: '700' }}>
              {formatZar(r.fromRentCents)}
              <Body muted>/mo</Body>
            </Body>
          )}
        </Row>
        <Body muted>
          {r.addressLine}
          {r.distanceKm !== null ? ` · ${r.distanceKm} km from campus` : ''}
        </Body>
        <Row wrap>
          <Badge label={residenceTypeLabel[r.type]} />
          {r.nsfasAccredited && <Badge label="NSFAS" tone="success" />}
          {r.bursaryFunded && <Badge label="Bursary" tone="success" />}
          <Badge label={r.availableBeds > 0 ? `${r.availableBeds} beds free` : 'Full · waitlist'} tone={r.availableBeds > 0 ? 'info' : 'warning'} />
        </Row>
        {r.amenities.length > 0 && (
          <Body muted style={{ fontSize: 13, color: colors.muted }}>
            {r.amenities.slice(0, 4).join(' · ')}
          </Body>
        )}
      </View>
    </Card>
  );
}
