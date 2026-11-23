import type { Metadata } from "next";
import Link from "next/link";
import { Badge, ButtonLink, Empty, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { residenceTypeLabel } from "@/lib/labels";
import type { ResidenceListItem } from "@/lib/types";

export const metadata: Metadata = { title: "Residences" };

export default async function ResidencesPage() {
  const residences = await api.get<ResidenceListItem[]>("/landlord/residences");

  return (
    <>
      <PageHeader title="Residences" actions={<ButtonLink href="/landlord/residences/new">Add residence</ButtonLink>} />
      {residences.length === 0 ? (
        <Empty title="No residences yet">Add a residence, then its room types, rooms and beds.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Residence</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Funding</th>
                <th className="px-4 py-3 text-right font-medium">Free beds</th>
                <th className="px-4 py-3 text-right font-medium">To review</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {residences.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/landlord/residences/${r.id}`} className="flex items-center gap-3 font-medium hover:underline">
                      <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: r.primaryColour }} aria-hidden />
                      <span>
                        {r.name}
                        <span className="block text-xs font-normal text-slate-500">
                          {r.addressLine}, {r.city}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">{residenceTypeLabel[r.type]}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {r.nsfasAccredited && <Badge tone="success">NSFAS</Badge>}
                      {r.bursaryFunded && <Badge tone="success">Bursary</Badge>}
                      {!r.nsfasAccredited && !r.bursaryFunded && <span className="text-slate-400">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.availableBeds}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.pendingApplications > 0 ? (
                      <Link href={`/landlord/applications?residenceId=${r.id}`} className="font-medium text-brand hover:underline">
                        {r.pendingApplications}
                      </Link>
                    ) : (
                      0
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.isPublished ? <Badge tone="success">Published</Badge> : <Badge>Draft</Badge>}
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
