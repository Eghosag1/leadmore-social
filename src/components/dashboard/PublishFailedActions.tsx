"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { retryPublishAction } from "@/app/dashboard/posts/[id]/actions";
import type { Platform, PostStatus } from "@/types/enums";

const PLATFORM_LABEL: Record<Platform, string> = { facebook: "Facebook", instagram: "Instagram" };

/**
 * Shown when a post is `publish_failed` — every platform rejected the post
 * at Meta (e.g. a permission error), not a render problem, so there's no
 * "use original photo" escape hatch here like RenderFailedActions has —
 * just a way to try scheduling again once the underlying issue (usually a
 * Meta-side connection/permission problem) is resolved.
 */
export function PublishFailedActions({
  postId,
  jobs,
}: {
  postId: string;
  jobs: { platform: Platform; status: PostStatus; error_message: string | null }[];
}) {
  const [isPending, startTransition] = useTransition();
  const errors = jobs
    .filter((job) => job.status === "failed" && job.error_message)
    .map((job) => `${PLATFORM_LABEL[job.platform]}: ${job.error_message}`)
    .join(" — ");

  function handleRetry() {
    startTransition(async () => {
      const result = await retryPublishAction(postId);
      if (!result.ok) toast.error(result.error ?? "Opnieuw proberen is mislukt.");
    });
  }

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        <p className="mb-3">Inplannen bij Meta is mislukt{errors ? `: ${errors}` : "."}</p>
        <Button size="sm" disabled={isPending} onClick={handleRetry}>
          {isPending ? "Bezig..." : "Opnieuw proberen"}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
