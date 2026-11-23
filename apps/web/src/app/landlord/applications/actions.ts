"use server";

import { revalidatePath } from "next/cache";
import { api, toActionState, type ActionState } from "@/lib/api";

export async function markInReview(id: string) {
  await api.post(`/landlord/applications/${id}/review`);
  revalidatePath(`/landlord/applications/${id}`);
}

export async function decide(id: string, _prev: ActionState, f: FormData): Promise<ActionState> {
  const decision = String(f.get("decision"));
  const note = String(f.get("note") ?? "").trim() || undefined;
  const body =
    decision === "ACCEPT"
      ? { decision, note, bedId: String(f.get("bedId") ?? ""), startDate: f.get("startDate"), endDate: f.get("endDate") }
      : { decision, note };

  if (decision === "ACCEPT" && !body.bedId) return { error: "Choose a bed to allocate." };

  try {
    await api.post(`/landlord/applications/${id}/decision`, body);
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath("/landlord", "layout");
  return { ok: true };
}
