import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { requestTime } from "@/lib/now";
import { fmtDate, fullName, maintenanceCategoryLabel, maintenanceStatusMeta, priorityMeta, timeAgo } from "@/lib/labels";
import type { MaintenanceDetail } from "@/lib/types";
import { ReplyForm, UpdateForm } from "./request-forms";

export const metadata: Metadata = { title: "Maintenance request" };

export default async function MaintenanceRequestPage({ params }: PageProps<"/landlord/maintenance/[id]">) {
  const now = await requestTime();
  const { id } = await params;
  const m = await api.get<MaintenanceDetail>(`/landlord/maintenance/${id}`);
  const s = maintenanceStatusMeta[m.status];

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/landlord/maintenance" className="text-slate-500 hover:underline">
          ← Maintenance
        </Link>
      </p>
      <PageHeader
        title={m.title}
        description={`${maintenanceCategoryLabel[m.category]} · ${m.location ?? `Room ${m.lease.bed.room.label}`} · ${m.residence.name}`}
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge tone={s.tone}>{s.label}</Badge>
              <Badge tone={priorityMeta[m.priority].tone}>{priorityMeta[m.priority].label} priority</Badge>
              <span className="text-xs text-slate-500">Reported {fmtDate(m.createdAt)}</span>
            </div>
            <p className="text-sm whitespace-pre-line">{m.description}</p>
            {m.photoUrls.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-3">
                {m.photoUrls.map((url, i) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block">
                    {/* Presigned, short-lived URLs from our own storage; next/image optimisation isn't useful here. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Photo ${i + 1} of the problem`} className="size-32 rounded-lg border border-slate-200 object-cover" />
                  </a>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-4 font-semibold">Conversation</h2>
            <ol className="mb-4 space-y-3">
              {m.comments.length === 0 && <li className="text-sm text-slate-500">No messages yet.</li>}
              {m.comments.map((c) =>
                c.isSystem ? (
                  <li key={c.id} className="text-center text-xs text-slate-500">
                    {c.body} · {fullName(c.author)} · {timeAgo(c.createdAt, now)}
                  </li>
                ) : (
                  <li
                    key={c.id}
                    className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm ${
                      c.author.role === "STUDENT" ? "bg-slate-100" : "ml-auto bg-brand-soft"
                    }`}>
                    <p className="text-xs font-medium text-slate-500">
                      {fullName(c.author)}
                      {c.author.role === "STUDENT" ? " (student)" : ""} · {timeAgo(c.createdAt, now)}
                    </p>
                    <p className="mt-0.5 whitespace-pre-line">{c.body}</p>
                  </li>
                ),
              )}
            </ol>
            {m.status !== "CLOSED" ? <ReplyForm id={m.id} /> : <p className="text-sm text-slate-500">This request is closed.</p>}
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h2 className="mb-4 font-semibold">Manage</h2>
            <UpdateForm
              id={m.id}
              status={m.status}
              allowedStatuses={m.allowedStatuses}
              priority={m.priority}
              assigneeId={m.assignee?.id ?? null}
              staff={m.staff}
            />
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold">Reported by</h2>
            <p className="text-sm font-medium">{fullName(m.reporter)}</p>
            <p className="text-sm text-slate-500">
              Room {m.lease.bed.room.label} · bed {m.lease.bed.label}
            </p>
            <a href={`mailto:${m.reporter.email}`} className="block text-sm text-brand hover:underline">
              {m.reporter.email}
            </a>
            {m.reporter.phone && (
              <a href={`tel:${m.reporter.phone}`} className="block text-sm text-brand hover:underline">
                {m.reporter.phone}
              </a>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
