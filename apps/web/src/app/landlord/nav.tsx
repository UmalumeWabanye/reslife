"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/landlord", label: "Overview", exact: true },
  { href: "/landlord/residences", label: "Residences" },
  { href: "/landlord/applications", label: "Applications" },
];

export function LandlordNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto md:flex-col">
      {links.map((l) => {
        const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap ${
              active ? "bg-brand-soft text-brand" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
