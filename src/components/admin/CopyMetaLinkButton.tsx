"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMetaAuthorizationUrlAction } from "@/app/admin/agencies/actions";

/**
 * Alternative to clicking "Verbind met Facebook" directly (which redirects
 * the admin's own browser to Facebook) — copies the same authorization URL
 * to the clipboard so it can be forwarded to whoever at the agency actually
 * manages their Facebook Page.
 */
export function CopyMetaLinkButton({ agencyId }: { agencyId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleCopy() {
    startTransition(async () => {
      try {
        const url = await getMetaAuthorizationUrlAction(agencyId);
        await navigator.clipboard.writeText(url);
        toast.success("Link gekopieerd — kan doorgestuurd worden naar het kantoor.");
      } catch {
        toast.error("Kopiëren is mislukt.");
      }
    });
  }

  return (
    <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handleCopy}>
      <Copy className="h-3.5 w-3.5" />
      {isPending ? "Bezig..." : "Kopieer link"}
    </Button>
  );
}
