import { formatZar, type ApplicationStatus } from "@students/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { documentLabel, fmtDate, fullName, fundingLabel, statusMeta } from "@/lib/labels";
import type { ApplicationDetail, BedWithOccupant } from "@/lib/types";
import { markInReview } from "../actions";
import { DecisionForms } from "./decision-forms";

export const metadata: Metadata = { title: "Application" };

const DECIDABLE: ApplicationStatus[] = ["SUBMITTED", "UNDER_REVIEW", "WAITLISTED"];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

export default async function ApplicationPage({ params }: PageProps<"/landlord/applications/[id]">) {
  const { id } = await params;
  const a = await api.get<ApplicationDetail>(`/landlord/applications/${id}`);
  const canDecide = DECIDABLE.includes(a.status);
  const freeBeds = canDecide ? await api.get<BedWithOccupant[]>(`/landlord/residences/${a.residence.id}/beds?available=true`) : [];
  const s = statusMeta[a.status];

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/landlord/applications" className="text-slate-500 hover:underline">
          ← Applications
        </Link>
      </p>
      <PageHeader
        title={fullName(a.student.user)}
        description={`${a.residence.name} · ${a.roomType.name} · ${a.academicYear}`}
        actions={
          a.status === "SUBMITTED" ? (
            <form action={markInReview.bind(null, a.id)}>
              <Button variant="secondary">Mark as in review</Button>
            </form>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Student</h2>
              <Badge tone={s.tone}>{s.label}</Badge>
            </div>
            <dl className="divide-y divide-slate-100">
              <Row label="Student no.">{a.student.studentNumber}</Row>
              <Row label="Institution">{a.student.institution.shortName}</Row>
              {a.student.yearOfStudy ? <Row label="Year of study">{a.student.yearOfStudy}</Row> : null}
              <Row label="Email">
                <a href={`mailto:${a.student.user.email}`} className="text-brand hover:underline">
                  {a.student.user.email}
                </a>
              </Row>
              {a.student.user.phone ? <Row label="Phone">{a.student.user.phone}</Row> : null}
              <Row label="Funding">{fundingLabel[a.fundingType]}</Row>
              <Row label="Requested room">
                {a.roomType.name} ({formatZar(a.roomType.monthlyRentCents)}/mo)
              </Row>
              {a.submittedAt ? <Row label="Submitted">{fmtDate(a.submittedAt)}</Row> : null}
            </dl>
            {a.motivation ? (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-slate-500">Motivation</h3>
                <p className="mt-1 text-sm whitespace-pre-line">{a.motivation}</p>
              </div>
            ) : null}
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold">Documents</h2>
            {a.documents.length === 0 ? (
              <p className="text-sm text-slate-500">No documents.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {a.documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span>
                      <span className="font-medium">{documentLabel[d.kind]}</span>
                      <span className="block text-xs text-slate-500">{d.fileName}</span>
                    </span>
                    <a
                      href={`/landlord/applications/${a.id}/documents/${d.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-brand hover:underline">
                      Open
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card>
            <h2 className="mb-4 font-semibold">Decision</h2>
            {canDecide ? (
              <DecisionForms
                applicationId={a.id}
                freeBeds={freeBeds}
                preferredRoomTypeId={a.roomType.id}
                defaultStart={`${a.academicYear}-02-01`}
                defaultEnd={`${a.academicYear}-11-30`}
              />
            ) : (
              <div className="space-y-3 text-sm">
                <p>
                  Status: <Badge tone={s.tone}>{s.label}</Badge>
                  {a.decidedAt ? <span className="ml-2 text-slate-500">decided {fmtDate(a.decidedAt)}</span> : null}
                </p>
                {a.lease ? (
                  <p>
                    Allocated room <strong>{a.lease.bed.room.label}</strong>, bed <strong>{a.lease.bed.label}</strong> ·{" "}
                    {fmtDate(a.lease.startDate)} – {fmtDate(a.lease.endDate)}
                  </p>
                ) : null}
                {a.status === "ACCEPTED" ? <p className="text-slate-500">Waiting for the student to accept the offer in the app.</p> : null}
                {a.reviewNote ? <p className="text-slate-500">Note: “{a.reviewNote}”</p> : null}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
