"use client";

import { useTransition } from "react";
import { XCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { cancelPostAction } from "@/app/dashboard/posts/[id]/actions";

export function CancelPostButton({
  postId,
  action = cancelPostAction,
  onCancelled,
}: {
  postId: string;
  /** Defaults to the redirecting full-page action; pass cancelPostQuickAction for in-place use (e.g. the calendar sheet). */
  action?: (postId: string) => Promise<void>;
  onCancelled?: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <AlertDialog>
      <AlertDialogTrigger className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
        <XCircle className="h-3.5 w-3.5" />
        Post annuleren
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Post annuleren?</AlertDialogTitle>
          <AlertDialogDescription>
            De post wordt niet meer ingepland of gepubliceerd. Dit kan niet ongedaan gemaakt worden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Terug</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await action(postId);
                onCancelled?.();
              })
            }
          >
            {isPending ? "Bezig..." : "Annuleren"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
