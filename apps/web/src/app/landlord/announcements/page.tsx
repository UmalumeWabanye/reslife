import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { fmtDate, fullName } from "@/lib/labels";
import type { AnnouncementListItem, ResidenceListItem } from "@/lib/types";
import { deleteAnnouncement, setPinned } from "./actions";
import { Composer } from "./composer";

export const metadata: Metadata = { title: "Announcements" };

export default async function AnnouncementsPage({ searchParams }: PageProps<"/landlord/announcements">) {
  const sp = await searchParams;
  const residenceId = typeof sp.residenceId === "string" && sp.residenceId ? sp.residenceId : undefined;
  const [items, residences] = await Promise.all([
    api.get<AnnouncementListItem[]>(`/landlord/announcements${residenceId ? `?residenceId=${residenceId}` : ""}`),
    api.get<ResidenceListItem[]>("/landlord/residences"),
  ]);

  return (
    <>
      <PageHeader title="Announcements" description="News shows up in each residence's space in the student app." />

      {residences.length === 0 ? (
        <Empty title="Add a residence first" />
      ) : (
        <Card className="mb-6">
          <h2 className="mb-4 font-semibold">New announcement</h2>
          <Composer residences={residences} defaultResidenceId={residenceId} />
        </Card>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500">Show:</span>
        <Link href="/landlord/announcements" className={`rounded-full px-3 py-1 ${!residenceId ? "bg-brand-soft text-brand" : "hover:bg-slate-100"}`}>
          All
        </Link>
        {residences.map((r) => (
          <Link
            key={r.id}
            href={`/landlord/announcements?residenceId=${r.id}`}
            className={`rounded-full px-3 py-1 ${residenceId === r.id ? "bg-brand-soft text-brand" : "hover:bg-slate-100"}`}>
            {r.name}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <Empty title="Nothing posted yet" />
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <Card key={a.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{a.title}</h3>
                    {a.pinned && <Badge tone="info">Pinned</Badge>}
                    {a.emailed && <Badge>Emailed</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {a.residence.name} · {fmtDate(a.publishedAt)} · by {fullName(a.author)}
                  </p>
                </div>
                <p className="text-sm text-slate-600 tabular-nums" title="Residents who opened it in the app">
                  Read by {a.readCount}/{a.audience}
                </p>
              </div>
              <p className="mt-3 text-sm whitespace-pre-line">{a.body}</p>
              <div className="mt-3 flex gap-4 text-sm">
                <form action={setPinned.bind(null, a.id, !a.pinned)}>
                  <button className="text-brand hover:underline">{a.pinned ? "Unpin" : "Pin"}</button>
                </form>
                <form action={deleteAnnouncement.bind(null, a.id)}>
                  <button className="text-red-700 hover:underline">Delete</button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
