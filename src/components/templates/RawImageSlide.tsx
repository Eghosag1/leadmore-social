"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/** "Eigen foto's" mode: renders one photo as-is, no template overlay — already published unmodified (see browserRenderService.renderSlide), so the preview shows the photo's real natural aspect ratio instead of a fixed crop. */
export function RawImageSlide({ imageUrl, className }: { imageUrl?: string; className?: string }) {
  const [ratio, setRatio] = useState<number | null>(null);

  return (
    <div className={cn("relative w-full bg-neutral-100", className)} style={{ aspectRatio: ratio ?? 1 }}>
      {imageUrl && (
        <Image
          src={imageUrl}
          alt=""
          fill
          sizes="400px"
          className="object-cover"
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth && img.naturalHeight) setRatio(img.naturalWidth / img.naturalHeight);
          }}
        />
      )}
    </div>
  );
}
