import { Body, Button, Card, H2, KeyValue } from '@/components/ui';
import { useSession } from '@/lib/session';
import { fundingLabel } from '@/lib/theme';

export function AccountPanel() {
  const { me, signOut } = useSession();
  if (!me) return null;
  const p = me.studentProfile;
  return (
    <>
      <Card>
        <H2>
          {me.firstName} {me.lastName}
        </H2>
        <Body muted>{me.email}</Body>
      </Card>
      <Card>
        <KeyValue label="Institution" value={p?.institution.name ?? '—'} />
        <KeyValue label="Student number" value={p?.studentNumber ?? '—'} />
        <KeyValue label="Funding" value={p?.fundingType ? fundingLabel[p.fundingType] : '—'} />
        {p?.yearOfStudy ? <KeyValue label="Year of study" value={p.yearOfStudy} /> : null}
        {me.phone ? <KeyValue label="Phone" value={me.phone} /> : null}
      </Card>
      <Button title="Sign out" variant="secondary" onPress={signOut} />
    </>
  );
}
