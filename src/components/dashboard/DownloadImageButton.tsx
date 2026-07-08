"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Downloads via a fetched blob + synthetic <a download> click rather than a
 * plain <a href download> — the image URL is a cross-origin Supabase Storage
 * URL, and browsers don't reliably honor the `download` attribute across
 * origins, so they'd just navigate to the image instead of saving it.
 */
export function DownloadImageButton({ imageUrl, fileName }: { imageUrl: string; fileName: string }) {
  const [isDownloading, setIsDownloading] = useState(false);

  async function handleDownload() {
    setIsDownloading(true);
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error("Download mislukt");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error("Afbeelding downloaden is mislukt.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleDownload} disabled={isDownloading}>
      <Download className="h-3.5 w-3.5" />
      {isDownloading ? "Bezig..." : "Afbeelding downloaden"}
    </Button>
  );
}
