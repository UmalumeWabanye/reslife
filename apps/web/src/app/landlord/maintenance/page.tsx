import { MaintenancePriorities, MaintenanceStatuses } from "@students/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { requestTime } from "@/lib/now";
import { fullName, maintenanceCategoryLabel, maintenanceStatusMeta, priorityMeta, timeAgo } from "@/lib/labels";
import type { MaintenanceListItem, ResidenceListItem } from "@/lib/types";

export const metadata: Metadata = { title: "Maintenance" };

export default async function MaintenancePage({ searchParams }: PageProps<"/landlord/maintenance">) {
  const now = await requestTime();
  const sp = await searchParams;
  const pick = (k: string, allowed?: readonly string[]) =>
    typeof sp[k] === "string" && sp[k] && (!allowed || allowed.includes(sp[k] as string)) ? (sp[k] as string) : undefined;
  const residenceId = pick("residenceId");
  const status = pick("status", MaintenanceStatuses);
  const priority = pick("priority", MaintenancePriorities);
  const view = pick("view", ["open", "all"]) ?? "open";

  const qs = new URLSearchParams({ view });
  if (residenceId) qs.set("residenceId", residenceId);
  if (status) qs.set("status", status);
  if (priority) qs.set("priority", priority);

  const [items, residences] = await Promise.all([
    api.get<MaintenanceListItem[]>(`/landlord/maintenance?${qs}`),
    api.get<ResidenceListItem[]>("/landlord/residences"),
  ]);

  return (
    <>
      <PageHeader title="Maintenance" description="Most urgent first, then oldest. Students see every status change and reply." />

      <form className="mb-4 flex flex-wrap items-end gap-3" method="get">
        <div>
          <label htmlFor="view" className="label">Show</label>
          <select id="view" name="view" defaultValue={view} className="input">
            <option value="open">Open requests</option>
            <option value="all">All requests</option>
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
        <div>
          <label htmlFor="status" className="label">Status</label>
          <select id="status" name="status" defaultValue={status ?? ""} className="input">
            <option value="">Any</option>
            {MaintenanceStatuses.map((s) => (
              <option key={s} value={s}>
                {maintenanceStatusMeta[s].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="priority" className="label">Priority</label>
          <select id="priority" name="priority" defaultValue={priority ?? ""} className="input">
            <option value="">Any</option>
            {MaintenancePriorities.map((p) => (
              <option key={p} value={p}>
                {priorityMeta[p].label}
              </option>
            ))}
          </select>
        </div>
        <button className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium hover:bg-slate-50">Filter</button>
        {(status || residenceId || priority || view !== "open") && (
          <Link href="/landlord/maintenance" className="py-2 text-sm text-slate-500 hover:underline">
            Clear
          </Link>
        )}
      </form>

      {items.length === 0 ? (
        <Empty title={view === "open" ? "No open requests" : "No requests"}>{view === "open" ? "Nothing waiting on your team." : null}</Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Request</th>
                <th className="px-4 py-3 font-medium">Where</th>
                <th className="px-4 py-3 font-medium">Reported</th>
                <th className="px-4 py-3 font-medium">Assigned</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Badge tone={priorityMeta[m.priority].tone}>{priorityMeta[m.priority].label}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/landlord/maintenance/${m.id}`} className="font-medium hover:underline">
                      {m.title}
                    </Link>
                    <span className="block text-xs text-slate-500">
                      {maintenanceCategoryLabel[m.category]}
                      {m._count.comments > 0 ? ` · ${m._count.comments} message${m._count.comments === 1 ? "" : "s"}` : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {m.location ?? `Room ${m.lease.bed.room.label}`}
                    <span className="block text-xs text-slate-500">{m.residence.name}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {timeAgo(m.createdAt, now)}
                    <span className="block text-xs text-slate-500">{fullName(m.reporter)}</span>
                  </td>
                  <td className="px-4 py-3">{m.assignee ? fullName(m.assignee) : <span className="text-slate-400">Unassigned</span>}</td>
                  <td className="px-4 py-3">
                    <Badge tone={maintenanceStatusMeta[m.status].tone}>{maintenanceStatusMeta[m.status].label}</Badge>
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
