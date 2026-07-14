"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, Trash2, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { InviteAgencyUserState } from "@/app/admin/agencies/actions";
import type { ProfileRole } from "@/types/enums";

const ROLE_LABELS: Record<"agency_admin" | "agency_user", string> = { agency_admin: "Beheerder", agency_user: "Medewerker" };

export interface AgencyUserRow {
  userId: string;
  fullName: string;
  email: string;
  role: ProfileRole;
}

export function AgencyUsersCard({
  agencyId,
  users,
  inviteAction,
  removeAction,
}: {
  agencyId: string;
  users: AgencyUserRow[];
  inviteAction: (prev: InviteAgencyUserState, formData: FormData) => Promise<InviteAgencyUserState>;
  removeAction: (userId: string) => Promise<void>;
}) {
  const [state, formAction, isPending] = useActionState(inviteAction, { error: null, tempPassword: null });
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [isRemoving, startRemoving] = useTransition();

  // Open the dialog the moment a fresh tempPassword shows up in the action
  // state — adjusting state during render (React's recommended pattern for
  // "derived state that resets when a prop changes") instead of an effect,
  // since setState-in-effect triggers an extra render pass for no benefit here.
  const [lastSeenPassword, setLastSeenPassword] = useState<string | null>(null);
  if (state.tempPassword !== lastSeenPassword) {
    setLastSeenPassword(state.tempPassword);
    if (state.tempPassword) setPasswordDialogOpen(true);
  }

  async function handleCopyPassword() {
    if (!state.tempPassword) return;
    await navigator.clipboard.writeText(state.tempPassword);
    toast.success("Wachtwoord gekopieerd.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Gebruikers</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nog geen gebruikers voor dit kantoor.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {users.map((user) => (
              <div key={user.userId} className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-900">{user.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="secondary">{ROLE_LABELS[user.role as "agency_admin" | "agency_user"] ?? user.role}</Badge>
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button type="button" size="icon-sm" variant="ghost">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      }
                    />
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{user.fullName} verwijderen?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Dit verwijdert de login van deze gebruiker definitief. Deze actie kan niet ongedaan gemaakt worden.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuleren</AlertDialogCancel>
                        <AlertDialogAction
                          disabled={isRemoving}
                          onClick={() => startRemoving(() => removeAction(user.userId))}
                        >
                          Verwijderen
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}

        <form action={formAction} className="flex flex-col gap-3 border-t border-neutral-100 pt-4">
          <input type="hidden" name="agencyId" value={agencyId} />
          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="fullName">Naam</Label>
              <Input id="fullName" name="fullName" placeholder="Voornaam Achternaam" required />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" placeholder="naam@kantoor.be" required />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role">Rol</Label>
              <select
                id="role"
                name="role"
                defaultValue="agency_user"
                className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="agency_user">Medewerker</option>
                <option value="agency_admin">Beheerder</option>
              </select>
            </div>
            <Button type="submit" size="sm" variant="outline" disabled={isPending}>
              <UserPlus className="h-3.5 w-3.5" />
              {isPending ? "Bezig..." : "Gebruiker toevoegen"}
            </Button>
          </div>
          {state.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gebruiker aangemaakt</DialogTitle>
            <DialogDescription>
              Dit tijdelijke wachtwoord wordt maar één keer getoond — deel het met de gebruiker. Ze kunnen het
              nadien zelf wijzigen via &quot;Wachtwoord vergeten&quot; op de inlogpagina.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-sm">
            {state.tempPassword}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCopyPassword}>
              <Copy className="h-3.5 w-3.5" />
              Kopieer wachtwoord
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
