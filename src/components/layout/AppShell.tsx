import type { ReactNode } from "react";
import Image from "next/image";
import { NavList } from "./NavList";
import { UserMenu } from "./UserMenu";

export interface AppShellProps {
  navVariant: "agency" | "admin";
  brandName: string;
  brandSubLabel: string;
  logoUrl?: string | null;
  user: { name: string; roleLabel: string };
  children: ReactNode;
}

export function AppShell({ navVariant, brandName, brandSubLabel, logoUrl, user, children }: AppShellProps) {
  return (
    <div className="flex w-full bg-neutral-50">
      {/* Sticky, viewport-height sidebar — the page scrolls normally (single
          document scroll container) instead of nesting a second overflow
          region in <main>, which broke `sticky` elements further down the
          page (e.g. the post preview panel). */}
      <aside className="sticky top-0 flex h-svh w-64 shrink-0 flex-col border-r border-neutral-200 bg-white">
        <div className="flex items-center gap-2.5 px-4 py-5">
          {logoUrl ? (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-neutral-100">
              <Image src={logoUrl} alt={brandName} width={32} height={32} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-neutral-900 text-xs font-semibold text-white">
              {brandName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-neutral-900">{brandName}</span>
            <span className="truncate text-xs text-muted-foreground">{brandSubLabel}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2">
          <NavList variant={navVariant} />
        </div>

        <div className="border-t border-neutral-200 p-2">
          <UserMenu name={user.name} roleLabel={user.roleLabel} />
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="mx-auto w-full max-w-6xl flex-1 px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
