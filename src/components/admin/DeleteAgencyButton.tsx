"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
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
import { deleteAgencyAction } from "@/app/admin/agencies/actions";
import { cn } from "@/lib/utils";

export function DeleteAgencyButton({ agencyId, agencyName }: { agencyId: string; agencyName: string }) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger className={cn(buttonVariants({ variant: "destructive", size: "sm" }))}>
        <Trash2 className="h-3.5 w-3.5" />
        Verwijderen
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{agencyName} verwijderen?</AlertDialogTitle>
          <AlertDialogDescription>
            Dit verwijdert alle panden, templates, posts en gebruikersaccounts van dit kantoor definitief. Deze
            actie kan niet ongedaan gemaakt worden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuleren</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={() => startTransition(() => deleteAgencyAction(agencyId))}
          >
            {isPending ? "Bezig..." : "Verwijderen"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
