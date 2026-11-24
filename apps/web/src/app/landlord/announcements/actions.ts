"use server";

import { revalidatePath } from "next/cache";
import { api, toActionState, type ActionState } from "@/lib/api";

export type PostState = (ActionState & { recipients?: number }) | undefined;

export async function postAnnouncement(_prev: PostState, f: FormData): Promise<PostState> {
  let recipients: number;
  try {
    ({ recipients } = await api.post<{ recipients: number }>("/landlord/announcements", {
      residenceId: String(f.get("residenceId") ?? ""),
      title: String(f.get("title") ?? "").trim(),
      body: String(f.get("body") ?? "").trim(),
      pinned: f.get("pinned") === "on",
      sendEmail: f.get("sendEmail") === "on",
    }));
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath("/landlord/announcements");
  return { ok: true, recipients };
}

export async function setPinned(id: string, pinned: boolean) {
  await api.patch(`/landlord/announcements/${id}`, { pinned });
  revalidatePath("/landlord/announcements");
}

export async function deleteAnnouncement(id: string) {
  await api.delete(`/landlord/announcements/${id}`);
  revalidatePath("/landlord/announcements");
}
