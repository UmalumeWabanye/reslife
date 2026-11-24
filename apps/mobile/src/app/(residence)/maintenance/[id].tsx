import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Badge, Body, Button, Card, ErrorBanner, Field, H1, H2, KeyValue, Loading, Row, Screen } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useResidence } from '@/lib/residence';
import { useSession } from '@/lib/session';
import { colors, maintenanceCategory, maintenanceStatus, priorityLabel, radius, space, timeAgo } from '@/lib/theme';
import type { MaintenanceDetail } from '@/lib/types';
import { useApi } from '@/lib/use-api';

export default function MaintenanceRequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { residence } = useResidence();
  const { me } = useSession();
  const { data: m, error, loading, reload } = useApi<MaintenanceDetail>(`/residence/maintenance/${id}`);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setActionError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  if (loading && !m) return <Loading />;
  if (!m) return <Screen><ErrorBanner message={error ?? 'Request not found'} /></Screen>;

  const s = maintenanceStatus[m.status];
  const brand = residence.primaryColour;

  return (
    <Screen>
      <View style={{ gap: space.sm }}>
        <H1>{m.title}</H1>
        <Row wrap>
          <Badge label={s.label} tone={s.tone} />
          {m.priority === 'URGENT' || m.priority === 'HIGH' ? <Badge label={priorityLabel[m.priority]} tone="danger" /> : null}
        </Row>
      </View>

      <ErrorBanner message={actionError} />

      {m.status === 'RESOLVED' && (
        <Card style={{ borderColor: colors.success, borderWidth: 2, gap: space.md }}>
          <H2>Is it fixed?</H2>
          <Body muted>The residence marked this as resolved. Let them know if it&apos;s sorted.</Body>
          <Button
            title="Yes, it's fixed"
            color={brand}
            onPress={() => run('fixed', () => api.post(`/residence/maintenance/${m.id}/confirm`, { fixed: true }))}
            loading={busy === 'fixed'}
            disabled={!!busy}
          />
          <Button
            title="No, still a problem"
            variant="secondary"
            onPress={() => run('notfixed', () => api.post(`/residence/maintenance/${m.id}/confirm`, { fixed: false }))}
            loading={busy === 'notfixed'}
            disabled={!!busy}
          />
        </Card>
      )}

      <Card>
        <KeyValue label="Category" value={maintenanceCategory[m.category]} />
        {m.location ? <KeyValue label="Where" value={m.location} /> : null}
        <KeyValue label="Reported" value={timeAgo(m.createdAt)} />
        <KeyValue label="Handled by" value={m.assignee ? [m.assignee.firstName, m.assignee.lastName].filter(Boolean).join(' ') : 'Not assigned yet'} />
        <Body style={{ marginTop: space.sm }}>{m.description}</Body>
      </Card>

      {m.photoUrls.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {m.photoUrls.map((url, i) => (
            // The wrapper carries the label: expo-image doesn't expose one to screen readers on web.
            <View key={url} role="img" aria-label={`Photo ${i + 1}`}>
              <Image
                source={url}
                style={{ width: 160, height: 160, borderRadius: radius.md, backgroundColor: colors.border }}
                contentFit="cover"
                accessible={false}
              />
            </View>
          ))}
        </ScrollView>
      )}

      <H2>Updates</H2>
      <View style={{ gap: space.sm }}>
        {m.comments.length === 0 && <Body muted>No updates yet. The residence team will reply here.</Body>}
        {m.comments.map((c) => {
          if (c.isSystem) {
            return (
              <Text key={c.id} style={{ color: colors.muted, fontSize: 13, textAlign: 'center' }}>
                {c.body} · {timeAgo(c.createdAt)}
              </Text>
            );
          }
          const mine = c.author.id === me?.id;
          return (
            <View
              key={c.id}
              style={{
                alignSelf: mine ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                backgroundColor: mine ? brand : colors.card,
                borderRadius: radius.lg,
                padding: space.md,
                borderWidth: mine ? 0 : 1,
                borderColor: colors.border,
              }}>
              {!mine && (
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 2 }}>
                  {c.author.firstName ?? 'Residence team'}
                </Text>
              )}
              <Text style={{ color: mine ? '#fff' : colors.text, fontSize: 15 }}>{c.body}</Text>
              <Text style={{ fontSize: 11, marginTop: 4, color: mine ? 'rgba(255,255,255,0.8)' : colors.muted }}>{timeAgo(c.createdAt)}</Text>
            </View>
          );
        })}
      </View>

      {m.status !== 'CLOSED' && (
        <Card style={{ gap: space.md }}>
          <Field label="Message the residence" value={message} onChangeText={setMessage} multiline placeholder="Add details or ask for an update" />
          <Button
            title="Send"
            color={brand}
            onPress={() =>
              run('send', async () => {
                await api.post(`/residence/maintenance/${m.id}/comments`, { body: message.trim() });
                setMessage('');
              })
            }
            loading={busy === 'send'}
            disabled={!message.trim() || !!busy}
          />
        </Card>
      )}
    </Screen>
  );
}
