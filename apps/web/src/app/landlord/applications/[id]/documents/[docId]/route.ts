import { redirect } from "next/navigation";
import { api } from "@/lib/api";

/** Opens an application document via a short-lived presigned URL (access checked by the API). */
export async function GET(_req: Request, { params }: RouteContext<"/landlord/applications/[id]/documents/[docId]">) {
  const { id, docId } = await params;
  const { url } = await api.get<{ url: string }>(`/landlord/applications/${id}/documents/${docId}/url`);
  redirect(url);
}
