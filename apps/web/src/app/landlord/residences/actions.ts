"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api, toActionState, type ActionState } from "@/lib/api";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => (str(f, k) === "" ? undefined : Number(str(f, k)));
const randsToCents = (f: FormData, k: string) => {
  const v = num(f, k);
  return v === undefined || Number.isNaN(v) ? undefined : Math.round(v * 100);
};

function residencePayload(f: FormData) {
  // Institutions come in as checkbox values plus a distance input per institution.
  const institutions = f.getAll("institutionIds").map((id) => {
    const d = num(f, `distance_${id}`);
    return { institutionId: String(id), ...(d !== undefined && !Number.isNaN(d) ? { distanceKm: d } : {}) };
  });
  return {
    name: str(f, "name"),
    description: str(f, "description"),
    type: str(f, "type"),
    genderPolicy: str(f, "genderPolicy"),
    nsfasAccredited: f.get("nsfasAccredited") === "on",
    bursaryFunded: f.get("bursaryFunded") === "on",
    addressLine: str(f, "addressLine"),
    city: str(f, "city"),
    latitude: num(f, "latitude") ?? 0,
    longitude: num(f, "longitude") ?? 0,
    amenities: str(f, "amenities")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    primaryColour: str(f, "primaryColour").toUpperCase(),
    ...(str(f, "logoUrl") ? { logoUrl: str(f, "logoUrl") } : {}),
    isPublished: f.get("isPublished") === "on",
    institutions,
  };
}

export async function createResidence(_prev: ActionState, f: FormData): Promise<ActionState> {
  let id: string;
  try {
    ({ id } = await api.post<{ id: string }>("/landlord/residences", residencePayload(f)));
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath("/landlord", "layout");
  redirect(`/landlord/residences/${id}`);
}

export async function updateResidence(id: string, _prev: ActionState, f: FormData): Promise<ActionState> {
  try {
    await api.patch(`/landlord/residences/${id}`, residencePayload(f));
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath(`/landlord/residences/${id}`);
  return { ok: true };
}

export async function setPublished(id: string, isPublished: boolean) {
  await api.patch(`/landlord/residences/${id}`, { isPublished });
  revalidatePath(`/landlord/residences/${id}`);
}

export async function addRoomType(residenceId: string, _prev: ActionState, f: FormData): Promise<ActionState> {
  try {
    await api.post(`/landlord/residences/${residenceId}/room-types`, {
      name: str(f, "name"),
      occupancy: num(f, "occupancy"),
      monthlyRentCents: randsToCents(f, "monthlyRent"),
      depositCents: randsToCents(f, "deposit") ?? 0,
      ...(str(f, "description") ? { description: str(f, "description") } : {}),
    });
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath(`/landlord/residences/${residenceId}`);
  return { ok: true };
}

/**
 * Adds one or more rooms in one go. "Room labels" accepts a comma list or a numeric range
 * like "101-110", so landlords can set up a whole floor at once.
 */
export async function addRooms(residenceId: string, roomTypeId: string, _prev: ActionState, f: FormData): Promise<ActionState> {
  const raw = str(f, "labels");
  const beds = Math.max(1, num(f, "bedsPerRoom") ?? 1);
  const range = raw.match(/^(\d+)\s*-\s*(\d+)$/);
  let labels: string[];
  if (range) {
    const [a, b] = [Number(range[1]), Number(range[2])];
    if (b < a || b - a > 200) return { error: "Use a range of up to 200 rooms, e.g. 101-120." };
    labels = Array.from({ length: b - a + 1 }, (_, i) => String(a + i));
  } else {
    labels = raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (!labels.length) return { error: "Enter at least one room label." };

  const bedLabels = Array.from({ length: beds }, (_, i) => String.fromCharCode(65 + i));
  const failed: string[] = [];
  for (const label of labels) {
    try {
      await api.post(`/landlord/room-types/${roomTypeId}/rooms`, { label, bedLabels });
    } catch {
      failed.push(label);
    }
  }
  revalidatePath(`/landlord/residences/${residenceId}`);
  if (failed.length) return { error: `Couldn't add ${failed.join(", ")} (they may already exist).` };
  return { ok: true };
}
