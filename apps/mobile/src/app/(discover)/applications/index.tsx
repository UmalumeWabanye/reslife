import { formatZar } from '@students/shared';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Badge, Body, Button, Card, Empty, ErrorBanner, H2, Loading, Row, Screen } from '@/components/ui';
import { applicationStatus, space } from '@/lib/theme';
import type { Application } from '@/lib/types';
import { useApi } from '@/lib/use-api';

export default function Applications() {
  const { data, error, loading, refreshing, reload } = useApi<Application[]>('/applications');

  return (
    <Screen onRefresh={reload} refreshing={refreshing}>
      <ErrorBanner message={error} />
      {loading && !data ? (
        <Loading />
      ) : data?.length === 0 ? (
        <>
          <Empty title="No applications yet" body="Browse residences near your campus and apply for a room." />
          <Button title="Browse residences" onPress={() => router.navigate('/residences')} />
        </>
      ) : (
        <View style={{ gap: space.md }}>
          {data?.map((a) => {
            const s = applicationStatus[a.status];
            return (
              <Card key={a.id} onPress={() => router.push(`/applications/${a.id}`)}>
                <Row>
                  <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: a.residence.primaryColour }} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <H2>{a.residence.name}</H2>
                    <Body muted>
                      {a.roomType.name} · {formatZar(a.roomType.monthlyRentCents)}/mo · {a.academicYear}
                    </Body>
                  </View>
                  <Badge label={s.label} tone={s.tone} />
                </Row>
                {a.status === 'ACCEPTED' && <Body style={{ fontWeight: '600' }}>You have an offer. Tap to respond.</Body>}
                {a.status === 'DRAFT' && <Body muted>Upload your documents and submit.</Body>}
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
