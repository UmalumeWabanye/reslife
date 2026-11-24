import { formatZar, SELF_PAYING_FUNDING } from '@students/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Body, Card, H2, KeyValue, Row, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { useRefreshResidencyOnFocus, useResidence } from '@/lib/residence';
import { colors, fundingLabel, radius, space, timeAgo } from '@/lib/theme';
import type { Announcement, AppNotification } from '@/lib/types';
import { useApi } from '@/lib/use-api';

type NotificationsResponse = { unread: number; items: AppNotification[] };

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });

export default function ResidenceHome() {
  const { residence, lease } = useResidence();
  const brand = residence.primaryColour;
  const selfPaying = SELF_PAYING_FUNDING.includes(lease.fundedBy);
  const [now] = useState(() => Date.now());
  const daysToMoveIn = Math.ceil((new Date(lease.startDate).getTime() - now) / 86_400_000);

  useRefreshResidencyOnFocus();
  const { data: notifications, setData: setNotifications, refreshing, reload } = useApi<NotificationsResponse>('/me/notifications');
  const { data: news } = useApi<Announcement[]>('/residence/announcements');
  const latest = news?.[0];
  const unreadNews = news?.filter((a) => !a.read).length ?? 0;

  function markAllRead() {
    if (!notifications) return;
    setNotifications({ unread: 0, items: notifications.items.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) });
    api.post('/me/notifications/read-all').catch(() => {});
  }

  function openNotification(n: AppNotification) {
    if (n.data?.type === 'maintenance' && n.data.id) router.navigate(`/maintenance/${n.data.id}`);
    else if (n.data?.type === 'announcement') router.navigate('/news');
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: brand }}>
        <View style={{ padding: space.lg, paddingBottom: space.xl, gap: space.sm, flexDirection: 'row', alignItems: 'center' }}>
          {residence.logoUrl ? (
            <Image source={residence.logoUrl} style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: '#fff' }} />
          ) : (
            <View style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>{residence.name[0]}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>Welcome to</Text>
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700' }}>{residence.name}</Text>
          </View>
        </View>
      </SafeAreaView>

      <Screen onRefresh={reload} refreshing={refreshing}>
        {lease.status === 'PENDING_MOVE_IN' && (
          <Card style={{ borderColor: brand, borderWidth: 2 }}>
            <H2>{daysToMoveIn > 0 ? `Move-in in ${daysToMoveIn} day${daysToMoveIn === 1 ? '' : 's'}` : 'Move-in day is here'}</H2>
            <Body muted>{fmtDate(lease.startDate)}. Bring your ID and proof of registration to the front desk.</Body>
          </Card>
        )}

        {notifications && notifications.items.length > 0 && (
          <Card>
            <Row>
              <View style={{ flex: 1 }}>
                <H2>Updates</H2>
              </View>
              {notifications.unread > 0 && (
                <Pressable accessibilityRole="button" onPress={markAllRead} hitSlop={8}>
                  <Text style={{ color: brand, fontWeight: '600' }}>Mark all read</Text>
                </Pressable>
              )}
            </Row>
            {notifications.items.slice(0, 4).map((n) => (
              <Pressable
                key={n.id}
                accessibilityRole="button"
                onPress={() => openNotification(n)}
                style={{ paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: colors.border, gap: 2 }}>
                <Row>
                  {!n.readAt && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: brand }} />}
                  <Text style={{ flex: 1, fontWeight: n.readAt ? '500' : '700', color: colors.text }}>{n.title}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{timeAgo(n.createdAt)}</Text>
                </Row>
                <Text numberOfLines={2} style={{ color: colors.muted }}>
                  {n.body}
                </Text>
              </Pressable>
            ))}
          </Card>
        )}

        {latest && (
          <Card onPress={() => router.navigate('/news')}>
            <Row>
              <View style={{ flex: 1 }}>
                <Body muted style={{ fontSize: 13 }}>
                  Latest news · {timeAgo(latest.publishedAt)}
                </Body>
              </View>
              {unreadNews > 0 && <Badge label={`${unreadNews} unread`} tone="info" />}
            </Row>
            <H2>{latest.title}</H2>
            <Body muted>{latest.body.length > 120 ? `${latest.body.slice(0, 120)}…` : latest.body}</Body>
          </Card>
        )}

        <Card>
          <H2>Your room</H2>
          <KeyValue label="Room" value={`${lease.room} · bed ${lease.bed}`} />
          <KeyValue label="Type" value={lease.roomType} />
          <KeyValue label="Lease" value={`${fmtDate(lease.startDate)} – ${fmtDate(lease.endDate)}`} />
          <KeyValue label="Status" value={<Badge label={lease.status === 'ACTIVE' ? 'Active' : 'Awaiting move-in'} tone={lease.status === 'ACTIVE' ? 'success' : 'info'} />} />
        </Card>

        <Card>
          <H2>Rent</H2>
          <KeyValue label="Monthly rent" value={formatZar(lease.monthlyRentCents)} />
          <KeyValue label="Paid by" value={fundingLabel[lease.fundedBy]} />
          <Body muted>
            {selfPaying
              ? 'Rent payments in the app are coming soon. Your residence will send your first invoice before move-in.'
              : `Your rent is paid by ${fundingLabel[lease.fundedBy]} directly to the residence.`}
          </Body>
        </Card>

        <Card>
          <H2>Residence office</H2>
          <Body>{residence.organisation.name}</Body>
          <Body muted>
            {residence.addressLine}, {residence.city}
          </Body>
          <Body muted>{[residence.organisation.contactEmail, residence.organisation.contactPhone].filter(Boolean).join(' · ')}</Body>
        </Card>
      </Screen>
    </View>
  );
}
