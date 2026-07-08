"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Consistent "back" link used across every detail/sub page. Prefers
 * `returnTo` (typically forwarded from a `?returnTo=` search param set by
 * whichever page linked here) so pages reachable from more than one place
 * return the user to where they actually came from, instead of a hardcoded
 * route. Falls back to `fallbackHref` — the page's single logical parent —
 * when no returnTo is available.
 */
export function BackButton({
  label = "Terug",
  returnTo,
  fallbackHref,
  onBack,
  className,
}: {
  label?: string;
  returnTo?: string;
  fallbackHref: string;
  onBack?: () => void;
  className?: string;
}) {
  const href = returnTo || fallbackHref;

  return (
    <Link
      href={href}
      onClick={onBack}
      className={cn("mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-neutral-900", className)}
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}
