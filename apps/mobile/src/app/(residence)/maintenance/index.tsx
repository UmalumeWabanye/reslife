import { router } from 'expo-router';
import { View } from 'react-native';
import { Badge, Body, Button, Card, Empty, ErrorBanner, H2, Loading, Row, Screen } from '@/components/ui';
import { useRefreshResidencyOnFocus, useResidence } from '@/lib/residence';
import { maintenanceCategory, maintenanceStatus, space, timeAgo } from '@/lib/theme';
import type { MaintenanceSummary } from '@/lib/types';
import { useApi } from '@/lib/use-api';

export default function MaintenanceList() {
  const { residence, lease } = useResidence();
  useRefreshResidencyOnFocus();
  const { data, error, loading, refreshing, reload } = useApi<MaintenanceSummary[]>('/residence/maintenance');
  const movedIn = lease.status === 'ACTIVE';

  const open = data?.filter((m) => m.status !== 'CLOSED') ?? [];
  const closed = data?.filter((m) => m.status === 'CLOSED') ?? [];

  return (
    <Screen onRefresh={reload} refreshing={refreshing}>
      {movedIn ? (
        <Button title="Report a problem" color={residence.primaryColour} onPress={() => router.push('/maintenance/new')} />
      ) : (
        <Card>
          <H2>Available after move-in</H2>
          <Body muted>Once the residence checks you in, you can report problems with your room here.</Body>
        </Card>
      )}
      <ErrorBanner message={error} />
      {loading && !data ? (
        <Loading />
      ) : data?.length === 0 ? (
        movedIn ? <Empty title="No requests" body="Something broken? Report it and follow the fix here." /> : null
      ) : (
        <>
          {[
            { title: 'Open', items: open },
            { title: 'Closed', items: closed },
          ].map((group) =>
            group.items.length ? (
              <View key={group.title} style={{ gap: space.md }}>
                <Body muted style={{ fontWeight: '600' }}>
                  {group.title}
                </Body>
                {group.items.map((m) => {
                  const s = maintenanceStatus[m.status];
                  return (
                    <Card key={m.id} onPress={() => router.push(`/maintenance/${m.id}`)}>
                      <Row>
                        <View style={{ flex: 1 }}>
                          <H2>{m.title}</H2>
                        </View>
                        <Badge label={s.label} tone={s.tone} />
                      </Row>
                      <Body muted style={{ fontSize: 13 }}>
                        {maintenanceCategory[m.category]} · updated {timeAgo(m.updatedAt)}
                        {m._count.comments > 0 ? ` · ${m._count.comments} message${m._count.comments === 1 ? '' : 's'}` : ''}
                      </Body>
                      {m.status === 'RESOLVED' && <Body style={{ fontWeight: '600' }}>Marked as fixed. Tap to confirm.</Body>}
                    </Card>
                  );
                })}
              </View>
            ) : null,
          )}
        </>
      )}
    </Screen>
  );
}
