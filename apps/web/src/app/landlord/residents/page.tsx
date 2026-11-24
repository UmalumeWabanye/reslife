import { formatZar, LeaseStatuses } from "@students/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { fmtDate, fullName, fundingLabel, leaseStatusMeta } from "@/lib/labels";
import type { LeaseListItem, ResidenceListItem } from "@/lib/types";
import { LeaseActions } from "./lease-actions";

export const metadata: Metadata = { title: "Residents" };

export default async function ResidentsPage({ searchParams }: PageProps<"/landlord/residents">) {
  const sp = await searchParams;
  const residenceId = typeof sp.residenceId === "string" && sp.residenceId ? sp.residenceId : undefined;
  const status = typeof sp.status === "string" && (LeaseStatuses as readonly string[]).includes(sp.status) ? sp.status : undefined;

  const qs = new URLSearchParams();
  if (residenceId) qs.set("residenceId", residenceId);
  if (status) qs.set("status", status);

  const [leases, residences] = await Promise.all([
    api.get<LeaseListItem[]>(`/landlord/leases?${qs}`),
    api.get<ResidenceListItem[]>("/landlord/residences"),
  ]);
  const awaiting = leases.filter((l) => l.status === "PENDING_MOVE_IN").length;

  return (
    <>
      <PageHeader
        title="Residents"
        description={
          status
            ? undefined
            : `${leases.length} current resident${leases.length === 1 ? "" : "s"}${awaiting ? ` · ${awaiting} awaiting move-in` : ""}. Move students in when they arrive so they can log maintenance.`
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-3" method="get">
        <div>
          <label htmlFor="residenceId" className="label">Residence</label>
          <select id="residenceId" name="residenceId" defaultValue={residenceId ?? ""} className="input">
            <option value="">All residences</option>
            {residences.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="label">Show</label>
          <select id="status" name="status" defaultValue={status ?? ""} className="input">
            <option value="">Current residents</option>
            <option value="PENDING_MOVE_IN">Awaiting move-in</option>
            <option value="ACTIVE">Living here</option>
            <option value="ENDED">Moved out</option>
            <option value="TERMINATED">Terminated</option>
          </select>
        </div>
        <button className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium hover:bg-slate-50">Filter</button>
        {(status || residenceId) && (
          <Link href="/landlord/residents" className="py-2 text-sm text-slate-500 hover:underline">
            Clear
          </Link>
        )}
      </form>

      {leases.length === 0 ? (
        <Empty title="No residents here">Students appear here once they accept an offer.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Room</th>
                <th className="px-4 py-3 font-medium">Lease</th>
                <th className="px-4 py-3 font-medium">Rent</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leases.map((l) => {
                const s = leaseStatusMeta[l.status];
                return (
                  <tr key={l.id} className="align-top">
                    <td className="px-4 py-3">
                      <span className="font-medium">{fullName(l.student.user)}</span>
                      <span className="block text-xs text-slate-500">
                        {l.student.studentNumber} · {l.student.institution.shortName}
                      </span>
                      <a href={`mailto:${l.student.user.email}`} className="block text-xs text-brand hover:underline">
                        {l.student.user.email}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      {l.bed.room.label} · bed {l.bed.label}
                      <span className="block text-xs text-slate-500">
                        {l.bed.room.roomType.residence.name} · {l.bed.room.roomType.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {fmtDate(l.startDate)} – {fmtDate(l.endDate)}
                      {l.movedInAt && <span className="block text-xs text-slate-500">In since {fmtDate(l.movedInAt)}</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatZar(l.monthlyRentCents)}
                      <span className="block text-xs text-slate-500">{fundingLabel[l.fundedBy]}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={s.tone}>{s.label}</Badge>
                      {l._count.maintenance > 0 && (
                        <Link href={`/landlord/maintenance?residenceId=${l.bed.room.roomType.residence.id}`} className="mt-1 block text-xs text-amber-700 hover:underline">
                          {l._count.maintenance} open request{l._count.maintenance === 1 ? "" : "s"}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <LeaseActions leaseId={l.id} status={l.status} studentName={l.student.user.firstName ?? "this student"} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
