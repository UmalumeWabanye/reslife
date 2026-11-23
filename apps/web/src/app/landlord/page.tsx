import type { Metadata } from "next";
import Link from "next/link";
import { Badge, ButtonLink, Card, Empty, PageHeader, Stat } from "@/components/ui";
import { api } from "@/lib/api";
import { fmtDate, fullName, statusMeta } from "@/lib/labels";
import type { ApplicationListItem, ResidenceListItem } from "@/lib/types";

export const metadata: Metadata = { title: "Overview" };

export default async function LandlordOverview() {
  const [residences, applications] = await Promise.all([
    api.get<ResidenceListItem[]>("/landlord/residences"),
    api.get<ApplicationListItem[]>("/landlord/applications"),
  ]);

  const toReview = applications.filter((a) => a.status === "SUBMITTED" || a.status === "UNDER_REVIEW");
  const offersOut = applications.filter((a) => a.status === "ACCEPTED").length;
  const availableBeds = residences.reduce((n, r) => n + r.availableBeds, 0);

  return (
    <>
      <PageHeader title="Overview" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Residences" value={residences.length} href="/landlord/residences" />
        <Stat label="Applications to review" value={toReview.length} href="/landlord/applications?status=SUBMITTED" />
        <Stat label="Offers awaiting student" value={offersOut} href="/landlord/applications?status=ACCEPTED" />
        <Stat label="Beds available" value={availableBeds} />
      </div>

      <Card className="mt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Needs review</h2>
          <Link href="/landlord/applications" className="text-sm text-brand hover:underline">
            All applications
          </Link>
        </div>
        {residences.length === 0 ? (
          <Empty title="Add your first residence">
            <p className="mb-4">Set up a residence with its rooms and beds so students can apply.</p>
            <ButtonLink href="/landlord/residences/new">Add residence</ButtonLink>
          </Empty>
        ) : toReview.length === 0 ? (
          <p className="text-sm text-slate-500">You&apos;re all caught up.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {toReview.slice(0, 8).map((a) => (
              <li key={a.id}>
                <Link href={`/landlord/applications/${a.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 hover:bg-slate-50">
                  <span className="min-w-40 flex-1 font-medium">{fullName(a.student.user)}</span>
                  <span className="text-sm text-slate-500">
                    {a.residence.name} · {a.roomType.name}
                  </span>
                  <span className="text-sm text-slate-500">{a.submittedAt ? fmtDate(a.submittedAt) : ""}</span>
                  <Badge tone={statusMeta[a.status].tone}>{statusMeta[a.status].label}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
