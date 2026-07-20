"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { deleteAgencyTemplateAction } from "@/app/admin/agencies/[id]/templates/actions";

export function DeleteTemplateButton({ agencyId, templateId, templateName }: { agencyId: string; templateId: string; templateName: string }) {
  const [isDeleting, startDeleting] = useTransition();

  function handleDelete() {
    startDeleting(async () => {
      const result = await deleteAgencyTemplateAction(agencyId, templateId);
      if (!result.ok) toast.error(result.error ?? "Verwijderen mislukt.");
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button type="button" size="icon-sm" variant="ghost" aria-label="Template verwijderen">
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>&quot;{templateName}&quot; verwijderen?</AlertDialogTitle>
          <AlertDialogDescription>
            Dit verwijdert de template definitief. Deze actie kan niet ongedaan gemaakt worden. Is de template al ooit
            in een post gebruikt, dan weigert het systeem de verwijdering — archiveer die dan in plaats daarvan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuleren</AlertDialogCancel>
          <AlertDialogAction disabled={isDeleting} onClick={handleDelete}>
            Verwijderen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
