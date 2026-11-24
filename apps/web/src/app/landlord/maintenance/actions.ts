"use server";

import { revalidatePath } from "next/cache";
import { api, toActionState, type ActionState } from "@/lib/api";

export async function updateRequest(id: string, _prev: ActionState, f: FormData): Promise<ActionState> {
  const body: Record<string, unknown> = {};
  const status = String(f.get("status") ?? "");
  const priority = String(f.get("priority") ?? "");
  const assignee = f.get("assigneeId");
  if (status) body.status = status;
  if (priority) body.priority = priority;
  if (assignee !== null) body.assigneeId = String(assignee) || null;
  try {
    await api.patch(`/landlord/maintenance/${id}`, body);
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath(`/landlord/maintenance/${id}`);
  revalidatePath("/landlord/maintenance");
  return { ok: true };
}

export async function replyToRequest(id: string, _prev: ActionState, f: FormData): Promise<ActionState> {
  try {
    await api.post(`/landlord/maintenance/${id}/comments`, { body: String(f.get("body") ?? "").trim() });
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath(`/landlord/maintenance/${id}`);
  return { ok: true };
}
