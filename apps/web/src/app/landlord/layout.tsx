import { logout } from "@/app/auth-actions";
import { Alert } from "@/components/ui";
import { api } from "@/lib/api";
import { fullName } from "@/lib/labels";
import type { Me } from "@/lib/types";
import { LandlordNav } from "./nav";

export default async function LandlordLayout({ children }: LayoutProps<"/landlord">) {
  const me = await api.get<Me>("/auth/me");
  const org = me.memberships[0]?.organisation;

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="border-b border-slate-200 bg-white md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex h-full flex-col gap-4 p-4 md:sticky md:top-0 md:max-h-screen">
          <div>
            <p className="text-xs font-semibold tracking-wide text-brand uppercase">ResLife Partners</p>
            <p className="mt-1 truncate font-semibold">{org?.name ?? "No organisation"}</p>
          </div>
          <LandlordNav />
          <div className="mt-auto hidden border-t border-slate-200 pt-4 text-sm md:block">
            <p className="truncate font-medium">{fullName(me)}</p>
            <p className="truncate text-slate-500">{me.email}</p>
            <form action={logout} className="mt-2">
              <button className="text-slate-600 underline-offset-2 hover:underline">Sign out</button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-6xl">
          {org?.status === "PENDING" && (
            <div className="mb-6">
              <Alert tone="warning">
                Your organisation is awaiting verification. You can set up residences now; students will see them once we&apos;ve
                verified your details.
              </Alert>
            </div>
          )}
          {org?.status === "SUSPENDED" && (
            <div className="mb-6">
              <Alert>Your organisation is suspended. Contact support.</Alert>
            </div>
          )}
          {children}
          <form action={logout} className="mt-10 md:hidden">
            <button className="text-sm text-slate-600 underline">Sign out</button>
          </form>
        </div>
      </main>
    </div>
  );
}
