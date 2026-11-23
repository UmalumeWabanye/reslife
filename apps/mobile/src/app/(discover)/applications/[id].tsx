import { formatZar, type DocumentKind } from '@students/shared';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { Badge, Body, Button, Card, ErrorBanner, H1, H2, KeyValue, Loading, Row, Screen } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useSession } from '@/lib/session';
import { applicationStatus, colors, fundingLabel, space } from '@/lib/theme';
import type { Application, ApplicationDocument } from '@/lib/types';
import { pickDocument, uploadFile } from '@/lib/upload';
import { useApi } from '@/lib/use-api';

const docLabel: Record<DocumentKind, string> = {
  ID_DOCUMENT: 'ID or passport',
  PROOF_OF_REGISTRATION: 'Proof of registration',
  FUNDING_LETTER: 'Funding letter (NSFAS/bursary)',
  OTHER: 'Other supporting document',
};

function requiredDocs(a: Application): DocumentKind[] {
  const kinds: DocumentKind[] = ['ID_DOCUMENT', 'PROOF_OF_REGISTRATION'];
  if (a.fundingType === 'NSFAS' || a.fundingType === 'BURSARY') kinds.push('FUNDING_LETTER');
  return kinds;
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });

function confirm(title: string, message: string, action: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: action, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

export default function ApplicationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refresh } = useSession();
  const { data: a, setData, error, loading, reload } = useApi<Application>(`/applications/${id}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  if (loading && !a) return <Loading />;
  if (!a) return <Screen><ErrorBanner message={error ?? 'Application not found'} /></Screen>;

  const status = applicationStatus[a.status];
  const editable = a.status === 'DRAFT' || a.status === 'SUBMITTED';
  const withdrawable = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'WAITLISTED'].includes(a.status);
  const required = requiredDocs(a);
  const byKind = (k: DocumentKind) => a.documents.filter((d) => d.kind === k);
  const missing = required.filter((k) => byKind(k).length === 0);

  const upload = (kind: DocumentKind) =>
    run(`upload-${kind}`, async () => {
      const file = await pickDocument();
      if (!file) return;
      const fileKey = await uploadFile(file, 'application-document');
      const doc = await api.post<ApplicationDocument>(`/applications/${a.id}/documents`, { kind, fileKey, fileName: file.name });
      setData({ ...a, documents: [...a.documents, doc] });
    });

  const removeDoc = (doc: ApplicationDocument) =>
    run(`remove-${doc.id}`, async () => {
      await api.delete(`/applications/${a.id}/documents/${doc.id}`);
      setData({ ...a, documents: a.documents.filter((d) => d.id !== doc.id) });
    });

  const submit = () =>
    run('submit', async () => {
      await api.post(`/applications/${a.id}/submit`);
      await reload();
    });

  const withdraw = () =>
    run('withdraw', async () => {
      if (!(await confirm('Withdraw application?', `You'll need to apply again to ${a.residence.name}.`, 'Withdraw'))) return;
      await api.post(`/applications/${a.id}/withdraw`);
      await reload();
    });

  const respond = (accept: boolean) =>
    run(accept ? 'accept' : 'decline', async () => {
      if (accept) {
        const ok = await confirm(
          'Accept this offer?',
          `Your other open applications for ${a.academicYear} will be withdrawn.`,
          'Accept offer',
        );
        if (!ok) return;
      } else if (!(await confirm('Decline this offer?', 'The bed will be released to other students.', 'Decline'))) {
        return;
      }
      await api.post(`/applications/${a.id}/respond`, { accept });
      // Accepting switches the whole app into the residence space.
      if (accept) await refresh();
      else await reload();
    });

  return (
    <Screen>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: a.residence.primaryColour }} />
      <View style={{ gap: space.sm }}>
        <H1>{a.residence.name}</H1>
        <Badge label={status.label} tone={status.tone} />
      </View>

      <ErrorBanner message={actionError} />

      {a.status === 'ACCEPTED' && a.lease && (
        <Card style={{ borderColor: colors.success, borderWidth: 2, gap: space.md }}>
          <H2>🎉 You’ve been offered a room</H2>
          <KeyValue label="Room" value={`${a.lease.bed.room.label} · bed ${a.lease.bed.label}`} />
          <KeyValue label="Move in" value={fmtDate(a.lease.startDate)} />
          <KeyValue label="Lease ends" value={fmtDate(a.lease.endDate)} />
          <KeyValue label="Rent" value={`${formatZar(a.roomType.monthlyRentCents)}/mo`} />
          {a.reviewNote ? <Body muted>“{a.reviewNote}”</Body> : null}
          <Button title="Accept offer" color={a.residence.primaryColour} onPress={() => respond(true)} loading={busy === 'accept'} disabled={!!busy} />
          <Button title="Decline" variant="secondary" onPress={() => respond(false)} loading={busy === 'decline'} disabled={!!busy} />
        </Card>
      )}

      {(a.status === 'REJECTED' || a.status === 'WAITLISTED') && a.reviewNote ? (
        <Card>
          <H2>Note from the residence</H2>
          <Body>{a.reviewNote}</Body>
        </Card>
      ) : null}

      <Card>
        <KeyValue label="Room type" value={a.roomType.name} />
        <KeyValue label="Rent" value={`${formatZar(a.roomType.monthlyRentCents)}/mo`} />
        <KeyValue label="Academic year" value={a.academicYear} />
        <KeyValue label="Funding" value={fundingLabel[a.fundingType]} />
        {a.submittedAt ? <KeyValue label="Submitted" value={fmtDate(a.submittedAt)} /> : null}
      </Card>

      <Card style={{ gap: space.md }}>
        <H2>Documents</H2>
        {[...required, 'OTHER' as const].map((kind) => {
          const docs = byKind(kind);
          const isRequired = required.includes(kind);
          if (!editable && docs.length === 0) return null;
          return (
            <View key={kind} style={{ gap: space.xs }}>
              <Row>
                <Body style={{ flex: 1, fontWeight: '600' }}>
                  {docs.length ? '✓ ' : isRequired ? '• ' : ''}
                  {docLabel[kind]}
                  {isRequired ? '' : ' (optional)'}
                </Body>
                {editable && (
                  <Button title={docs.length ? 'Add' : 'Upload'} variant="secondary" onPress={() => upload(kind)} loading={busy === `upload-${kind}`} disabled={!!busy} />
                )}
              </Row>
              {docs.map((d) => (
                <Row key={d.id}>
                  <Body muted style={{ flex: 1 }}>
                    {d.fileName}
                  </Body>
                  {editable && (
                    <Button title="Remove" variant="danger" onPress={() => removeDoc(d)} loading={busy === `remove-${d.id}`} disabled={!!busy} />
                  )}
                </Row>
              ))}
            </View>
          );
        })}
      </Card>

      {a.status === 'DRAFT' && (
        <>
          {missing.length > 0 && <Body muted>Upload {missing.map((k) => docLabel[k].toLowerCase()).join(' and ')} to submit.</Body>}
          <Button title="Submit application" color={a.residence.primaryColour} onPress={submit} loading={busy === 'submit'} disabled={!!busy || missing.length > 0} />
        </>
      )}
      {withdrawable && <Button title="Withdraw application" variant="danger" onPress={withdraw} loading={busy === 'withdraw'} disabled={!!busy} />}
    </Screen>
  );
}
