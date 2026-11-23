import { ApplicationStatuses, type ApplicationStatus } from "@students/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { fmtDate, fullName, fundingLabel, statusMeta } from "@/lib/labels";
import type { ApplicationListItem, ResidenceListItem } from "@/lib/types";

export const metadata: Metadata = { title: "Applications" };

const FILTERABLE = ApplicationStatuses.filter((s) => s !== "DRAFT");

export default async function ApplicationsPage({ searchParams }: PageProps<"/landlord/applications">) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" && (FILTERABLE as readonly string[]).includes(sp.status) ? (sp.status as ApplicationStatus) : undefined;
  const residenceId = typeof sp.residenceId === "string" ? sp.residenceId : undefined;

  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  if (residenceId) qs.set("residenceId", residenceId);

  const [applications, residences] = await Promise.all([
    api.get<ApplicationListItem[]>(`/landlord/applications?${qs}`),
    api.get<ResidenceListItem[]>("/landlord/residences"),
  ]);

  return (
    <>
      <PageHeader title="Applications" description="Review documents, then accept with a bed, waitlist or reject." />

      <form className="mb-4 flex flex-wrap items-end gap-3" method="get">
        <div>
          <label htmlFor="status" className="label">Status</label>
          <select id="status" name="status" defaultValue={status ?? ""} className="input">
            <option value="">All</option>
            {FILTERABLE.map((s) => (
              <option key={s} value={s}>
                {statusMeta[s].label}
              </option>
            ))}
          </select>
        </div>
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
        <button className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium hover:bg-slate-50">Filter</button>
        {(status || residenceId) && (
          <Link href="/landlord/applications" className="py-2 text-sm text-slate-500 hover:underline">
            Clear
          </Link>
        )}
      </form>

      {applications.length === 0 ? (
        <Empty title="No applications">{status || residenceId ? "Try clearing the filters." : "Applications appear here when students submit them."}</Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Residence / room</th>
                <th className="px-4 py-3 font-medium">Funding</th>
                <th className="px-4 py-3 font-medium">Year</th>
                <th className="px-4 py-3 font-medium">Submitted</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {applications.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/landlord/applications/${a.id}`} className="font-medium hover:underline">
                      {fullName(a.student.user)}
                    </Link>
                    <span className="block text-xs text-slate-500">
                      {a.student.studentNumber} · {a.student.institution.shortName}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {a.residence.name}
                    <span className="block text-xs text-slate-500">{a.roomType.name}</span>
                  </td>
                  <td className="px-4 py-3">{fundingLabel[a.fundingType]}</td>
                  <td className="px-4 py-3 tabular-nums">{a.academicYear}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{a.submittedAt ? fmtDate(a.submittedAt) : "—"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusMeta[a.status].tone}>{statusMeta[a.status].label}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
