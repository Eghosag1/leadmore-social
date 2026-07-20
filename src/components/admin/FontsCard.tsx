"use client";

import { useActionState, useState, useTransition } from "react";
import { Loader2, Trash2, Type } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { createClient } from "@/lib/supabase/client";
import type { AddAgencyFontState } from "@/app/admin/agencies/actions";
import type { AgencyFontRow } from "@/types/database";

/**
 * Replaces the old single-slot FontUploader.tsx — an agency can now upload
 * any number of fonts (title font, body font, ...), each with its own label,
 * selectable per text element once the scene editor exists (see
 * PLAN_TEMPLATE_EDITOR.md Phase A/E). List/add/remove pattern copied from
 * AgencyUsersCard.tsx.
 */
export function FontsCard({
  agencyId,
  fonts,
  addAction,
  removeAction,
}: {
  agencyId: string;
  fonts: AgencyFontRow[];
  addAction: (prev: AddAgencyFontState, formData: FormData) => Promise<AddAgencyFontState>;
  removeAction: (fontId: string) => Promise<void>;
}) {
  const [state, formAction, isPending] = useActionState(addAction, { error: null });
  const [isRemoving, startRemoving] = useTransition();

  const [label, setLabel] = useState("");
  const [fontUrl, setFontUrl] = useState("");
  const [fontFamily, setFontFamily] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    const supabase = createClient();
    const extension = file.name.split(".").pop() ?? "ttf";
    const path = `${agencyId}/font-${Date.now()}.${extension}`;

    const { error } = await supabase.storage.from("agency-fonts").upload(path, file);
    if (error) {
      setUploadError(`Upload mislukt: ${error.message}`);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("agency-fonts").getPublicUrl(path);
    setFontUrl(data.publicUrl);
    setUploading(false);
  }

  // Reset the add-form once a font was successfully added — adjust state
  // during render (not a useEffect), same pattern as AgencyUsersCard.tsx's
  // password dialog.
  const [lastFontCount, setLastFontCount] = useState(fonts.length);
  if (fonts.length !== lastFontCount) {
    setLastFontCount(fonts.length);
    if (fonts.length > lastFontCount) {
      setLabel("");
      setFontUrl("");
      setFontFamily("");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Fonts</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-xs text-muted-foreground">
          Upload zoveel lettertypes als je wil — bv. één voor titels, één voor gewone tekst. Kiesbaar per
          tekstelement in de template-editor.
        </p>

        {fonts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nog geen fonts voor dit kantoor.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {fonts.map((font) => (
              <div key={font.id} className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Type className="h-4 w-4 shrink-0 text-neutral-500" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-900">{font.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{font.font_family}</p>
                  </div>
                </div>
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
                      <AlertDialogTitle>{font.label} verwijderen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Templates die dit font gebruiken vallen terug op het standaardfont. Deze actie kan niet
                        ongedaan gemaakt worden.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuleren</AlertDialogCancel>
                      <AlertDialogAction disabled={isRemoving} onClick={() => startRemoving(() => removeAction(font.id))}>
                        Verwijderen
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}

        <form action={formAction} className="flex flex-col gap-3 border-t border-neutral-100 pt-4">
          <input type="hidden" name="fontUrl" value={fontUrl} />
          <div className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="label">Naam</Label>
              <Input
                id="label"
                name="label"
                placeholder="bv. Titel"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="fontFamily">CSS font-family</Label>
              <Input
                id="fontFamily"
                name="fontFamily"
                placeholder="bv. Ivy Presto"
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Input type="file" accept=".ttf,.otf,.woff,.woff2" onChange={handleFile} disabled={uploading} className="max-w-xs" />
            {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {fontUrl && !uploading && <span className="text-xs text-green-700">Bestand geüpload</span>}
          </div>
          {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
          <div>
            <Button type="submit" size="sm" variant="outline" disabled={isPending || uploading || !fontUrl}>
              {isPending ? "Bezig..." : "Font toevoegen"}
            </Button>
          </div>
          {state.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
