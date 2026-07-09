"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { retryRenderAction, useOriginalPhotoAction } from "@/app/dashboard/posts/[id]/actions";

/**
 * Shown when a post is `render_failed` — the render pipeline no longer
 * silently falls back to the unbranded source photo (see
 * browserRenderService.ts), so the user needs a visible, explicit way to
 * resolve it: try again, or knowingly publish the original photo as-is.
 * Used by both PostDetailClient and PostQuickViewSheet (same cross-surface
 * pattern as CancelPostButton).
 */
export function RenderFailedActions({ postId, renderError }: { postId: string; renderError: string | null }) {
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<"retry" | "override" | null>(null);

  function handleRetry() {
    setPendingAction("retry");
    startTransition(async () => {
      const result = await retryRenderAction(postId);
      if (!result.ok) toast.error(result.error ?? "Opnieuw proberen is mislukt.");
    });
  }

  function handleUseOriginal() {
    setPendingAction("override");
    startTransition(async () => {
      const result = await useOriginalPhotoAction(postId);
      if (!result.ok) toast.error(result.error ?? "Inplannen met de originele foto is mislukt.");
    });
  }

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        <p className="mb-3">Renderen van deze post is mislukt{renderError ? `: ${renderError}` : "."}</p>
        <div className="flex gap-2">
          <Button size="sm" disabled={isPending} onClick={handleRetry}>
            {isPending && pendingAction === "retry" ? "Bezig..." : "Opnieuw proberen"}
          </Button>
          <Button size="sm" variant="outline" disabled={isPending} onClick={handleUseOriginal}>
            {isPending && pendingAction === "override" ? "Bezig..." : "Toch originele foto gebruiken"}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
