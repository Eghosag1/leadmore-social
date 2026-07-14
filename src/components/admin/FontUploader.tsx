"use client";

import { useState } from "react";
import { Loader2, Type } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

/**
 * Uploads a custom font file for this agency (agency-fonts bucket) and lets
 * the admin name the CSS font-family to declare for it — same
 * upload-then-hidden-input pattern as LogoUploader.tsx. Every template of
 * this agency picks the font up automatically via the fixed `.font-brand`
 * class (see DynamicTemplateRenderer.tsx), so there's nothing per-template
 * to configure here.
 */
export function FontUploader({
  urlFieldName,
  familyFieldName,
  initialUrl,
  initialFamily,
  pathPrefix,
}: {
  urlFieldName: string;
  familyFieldName: string;
  initialUrl?: string | null;
  initialFamily?: string | null;
  pathPrefix: string;
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [family, setFamily] = useState(initialFamily ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const supabase = createClient();
    const extension = file.name.split(".").pop() ?? "ttf";
    const path = `${pathPrefix}/font-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage.from("agency-fonts").upload(path, file, { upsert: true });
    if (uploadError) {
      setError(`Upload mislukt: ${uploadError.message}`);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("agency-fonts").getPublicUrl(path);
    setUrl(data.publicUrl);
    setUploading(false);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label>Huisstijlfont (optioneel)</Label>
      <p className="text-xs text-muted-foreground">
        Geldt voor alle templates van dit kantoor — een template gebruikt dit font via de vaste{" "}
        <code className="rounded bg-neutral-100 px-1 py-0.5">font-brand</code>-klasse.
      </p>
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : url ? (
            <Type className="h-6 w-6 text-neutral-500" />
          ) : (
            <span className="text-[10px] text-muted-foreground">Geen font</span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Input type="file" accept=".ttf,.otf,.woff,.woff2" onChange={handleFile} disabled={uploading} className="max-w-xs" />
          <Input
            value={family}
            onChange={(e) => setFamily(e.target.value)}
            placeholder="Naam van het lettertype, bv. Ivy Presto"
            className="max-w-xs"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </div>
      <input type="hidden" name={urlFieldName} value={url} />
      <input type="hidden" name={familyFieldName} value={family} />
    </div>
  );
}
