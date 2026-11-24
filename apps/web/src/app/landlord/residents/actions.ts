"use server";

import { revalidatePath } from "next/cache";
import { api, toActionState, type ActionState } from "@/lib/api";

export async function moveIn(leaseId: string): Promise<ActionState> {
  try {
    await api.post(`/landlord/leases/${leaseId}/move-in`);
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath("/landlord", "layout");
  return { ok: true };
}

export async function endLease(leaseId: string, _prev: ActionState, f: FormData): Promise<ActionState> {
  try {
    await api.post(`/landlord/leases/${leaseId}/end`, {
      reason: f.get("reason") === "TERMINATED" ? "TERMINATED" : "ENDED",
      note: String(f.get("note") ?? "").trim() || undefined,
    });
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath("/landlord", "layout");
  return { ok: true };
}
