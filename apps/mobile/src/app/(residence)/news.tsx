import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Body, Card, Empty, ErrorBanner, H1, H2, Loading, Row, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { useResidence } from '@/lib/residence';
import { colors, space, timeAgo } from '@/lib/theme';
import type { Announcement } from '@/lib/types';
import { useApi } from '@/lib/use-api';

export default function News() {
  const { residence } = useResidence();
  const { data, setData, error, loading, refreshing, reload } = useApi<Announcement[]>('/residence/announcements');
  const [open, setOpen] = useState<string | null>(null);

  function toggle(a: Announcement) {
    setOpen(open === a.id ? null : a.id);
    if (!a.read && data) {
      setData(data.map((x) => (x.id === a.id ? { ...x, read: true } : x)));
      api.post(`/residence/announcements/${a.id}/read`).catch(() => {});
    }
  }

  const unread = data?.filter((a) => !a.read).length ?? 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Screen onRefresh={reload} refreshing={refreshing}>
        <View style={{ gap: space.xs }}>
          <H1>News</H1>
          <Body muted>
            From {residence.name}
            {unread > 0 ? ` · ${unread} unread` : ''}
          </Body>
        </View>
        <ErrorBanner message={error} />
        {loading && !data ? (
          <Loading />
        ) : data?.length === 0 ? (
          <Empty title="No news yet" body="Announcements from your residence will show up here." />
        ) : (
          data?.map((a) => {
            const expanded = open === a.id;
            return (
              <Card
                key={a.id}
                onPress={() => toggle(a)}
                style={a.pinned ? { borderColor: residence.primaryColour, borderWidth: 1.5 } : undefined}>
                <Row>
                  {!a.read && (
                    <View
                      accessibilityLabel="Unread"
                      style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: residence.primaryColour }}
                    />
                  )}
                  <View style={{ flex: 1 }}>
                    <H2>{a.title}</H2>
                  </View>
                  {a.pinned && <Badge label="Pinned" tone="info" />}
                </Row>
                <Body muted style={{ fontSize: 13 }}>
                  {timeAgo(a.publishedAt)}
                  {a.author.firstName ? ` · ${a.author.firstName}` : ''}
                </Body>
                <Body>{expanded ? a.body : a.body.length > 140 ? `${a.body.slice(0, 140)}…` : a.body}</Body>
              </Card>
            );
          })
        )}
      </Screen>
    </SafeAreaView>
  );
}
