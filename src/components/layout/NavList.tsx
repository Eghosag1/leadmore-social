"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ADMIN_NAV_ITEMS, AGENCY_NAV_ITEMS } from "@/lib/nav";

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard" || href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Takes a `variant` instead of the nav items array itself: the items contain
 * Lucide icon component references, and passing component references as a
 * prop from a Server Component (AppShell) into a Client Component crashes
 * with "Only plain objects can be passed to Client Components". Resolving
 * the array here, inside the client boundary, avoids that entirely.
 */
export function NavList({ variant }: { variant: "agency" | "admin" }) {
  const items = variant === "agency" ? AGENCY_NAV_ITEMS : ADMIN_NAV_ITEMS;
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
