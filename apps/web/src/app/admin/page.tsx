import type { Metadata } from "next";
import { logout } from "@/app/auth-actions";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Platform admin" };

// Placeholder until the super admin console (phase 5).
export default function AdminHome() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <Card>
        <h1 className="text-xl font-semibold">Platform admin</h1>
        <p className="mt-2 text-sm text-slate-500">
          The super admin console (organisation verification, institutions, audit log, platform metrics) is coming in a later phase.
        </p>
        <form action={logout} className="mt-4">
          <button className="text-sm text-slate-600 underline">Sign out</button>
        </form>
      </Card>
    </main>
  );
}
