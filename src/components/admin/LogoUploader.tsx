"use client";

import { useState } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function LogoUploader({
  fieldName,
  initialUrl,
  pathPrefix,
}: {
  fieldName: string;
  initialUrl?: string | null;
  pathPrefix: string;
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const supabase = createClient();
    const extension = file.name.split(".").pop() ?? "png";
    const path = `${pathPrefix}/logo-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage.from("agency-logos").upload(path, file, { upsert: true });
    if (uploadError) {
      setError(`Upload mislukt: ${uploadError.message}`);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("agency-logos").getPublicUrl(path);
    setUrl(data.publicUrl);
    setUploading(false);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label>Logo</Label>
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
          {url ? (
            <Image src={url} alt="Logo" width={64} height={64} className="h-full w-full object-cover" />
          ) : uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <span className="text-[10px] text-muted-foreground">Geen logo</span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Input type="file" accept="image/*" onChange={handleFile} disabled={uploading} className="max-w-xs" />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </div>
      <input type="hidden" name={fieldName} value={url} />
    </div>
  );
}
