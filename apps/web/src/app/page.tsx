import { redirect } from "next/navigation";

// proxy.ts sends signed-in users to their area before this renders; this is the fallback.
export default function Home() {
  redirect("/login");
}
