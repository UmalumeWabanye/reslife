import { formatZar } from "@students/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { fmtDate, fullName, residenceTypeLabel } from "@/lib/labels";
import type { BedWithOccupant, Institution, ResidenceDetail } from "@/lib/types";
import { setPublished, updateResidence } from "../actions";
import { ResidenceForm } from "../residence-form";
import { AddRoomsForm, AddRoomTypeForm } from "./room-forms";

export async function generateMetadata({ params }: PageProps<"/landlord/residences/[id]">): Promise<Metadata> {
  const { id } = await params;
  const r = await api.get<ResidenceDetail>(`/landlord/residences/${id}`);
  return { title: r.name };
}

export default async function ResidencePage({ params }: PageProps<"/landlord/residences/[id]">) {
  const { id } = await params;
  const [residence, beds, institutions] = await Promise.all([
    api.get<ResidenceDetail>(`/landlord/residences/${id}`),
    api.get<BedWithOccupant[]>(`/landlord/residences/${id}/beds`),
    api.get<Institution[]>("/institutions"),
  ]);

  const occupantByBed = new Map(beds.map((b) => [b.id, b.occupant]));
  const totalBeds = beds.length;
  const occupied = beds.filter((b) => b.occupant).length;

  return (
    <>
      <PageHeader
        title={residence.name}
        description={
          <>
            {residenceTypeLabel[residence.type]} · {residence.addressLine}, {residence.city} · {occupied}/{totalBeds} beds allocated
          </>
        }
        actions={
          <>
            <Link href={`/landlord/applications?residenceId=${residence.id}`} className="self-center text-sm text-brand hover:underline">
              Applications
            </Link>
            <form action={setPublished.bind(null, residence.id, !residence.isPublished)}>
              <Button variant={residence.isPublished ? "secondary" : "primary"}>{residence.isPublished ? "Unpublish" : "Publish"}</Button>
            </form>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="space-y-6 xl:col-span-3">
          <Card>
            <h2 className="mb-1 font-semibold">Rooms & beds</h2>
            <p className="mb-4 text-sm text-slate-500">Add a room type (price + beds per room), then add its rooms.</p>

            {residence.roomTypes.length === 0 && <p className="mb-4 text-sm text-slate-500">No room types yet.</p>}

            <div className="space-y-6">
              {residence.roomTypes.map((rt) => {
                const bedCount = rt.rooms.reduce((n, r) => n + r.beds.length, 0);
                return (
                  <div key={rt.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-medium">{rt.name}</h3>
                      <p className="text-sm">
                        <span className="font-semibold">{formatZar(rt.monthlyRentCents)}</span>
                        <span className="text-slate-500">/month · {rt.occupancy === 1 ? "single" : `${rt.occupancy}-sharing`}</span>
                        {rt.depositCents > 0 && <span className="text-slate-500"> · deposit {formatZar(rt.depositCents)}</span>}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {rt.rooms.length} rooms · {bedCount} beds
                    </p>

                    {rt.rooms.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {rt.rooms.map((room) => (
                          <div key={room.id} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs">
                            <span className="font-medium">{room.label}</span>
                            <span className="ml-2 inline-flex gap-1">
                              {room.beds.map((bed) => {
                                const occ = occupantByBed.get(bed.id);
                                return (
                                  <span
                                    key={bed.id}
                                    title={occ ? `${fullName(occ.student.user)} (${occ.student.studentNumber}) · ${fmtDate(occ.startDate)}–${fmtDate(occ.endDate)}` : "Free"}
                                    className={`inline-flex size-5 items-center justify-center rounded ${occ ? "bg-slate-800 text-white" : "bg-emerald-100 text-emerald-800"}`}>
                                    {bed.label}
                                  </span>
                                );
                              })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-4">
                      <AddRoomsForm residenceId={residence.id} roomTypeId={rt.id} occupancy={rt.occupancy} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 border-t border-slate-200 pt-4">
              <h3 className="mb-3 text-sm font-semibold">New room type</h3>
              <AddRoomTypeForm residenceId={residence.id} />
            </div>
            <p className="mt-4 flex items-center gap-3 text-xs text-slate-500">
              <span className="inline-flex size-4 rounded bg-emerald-100" /> Free
              <span className="inline-flex size-4 rounded bg-slate-800" /> Allocated (hover for student)
            </p>
          </Card>
        </div>

        <div className="xl:col-span-2">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Details</h2>
              {residence.isPublished ? <Badge tone="success">Published</Badge> : <Badge>Draft</Badge>}
            </div>
            <ResidenceForm
              action={updateResidence.bind(null, residence.id)}
              institutions={institutions}
              residence={residence}
              submitLabel="Save changes"
            />
          </Card>
        </div>
      </div>
    </>
  );
}
