"use client";

import Image from "next/image";
import { Globe, MoreHorizontal, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScaledTemplateCanvas } from "@/components/templates/ScaledTemplateCanvas";
import { RawImageSlide } from "@/components/templates/RawImageSlide";
import type { TemplateRenderProps } from "@/types/domain";

export function FacebookPostMock({
  componentSource,
  slideCount,
  data,
  caption,
  agencyName,
  agencyLogo,
  slideIndex,
  onSlideIndexChange,
}: {
  /** Null in "eigen foto's" mode — renders the raw photo instead of a compiled template. */
  componentSource: string | null;
  slideCount: number;
  data: TemplateRenderProps;
  caption: string;
  agencyName: string;
  agencyLogo?: string;
  slideIndex: number;
  onSlideIndexChange: (index: number) => void;
}) {
  return (
    <div className="pb-4">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-200">
          {agencyLogo && <Image src={agencyLogo} alt="" width={32} height={32} className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-neutral-900">{agencyName || "Uw kantoor"}</p>
          <p className="flex items-center gap-1 text-[10px] text-neutral-500">
            Nu <Globe className="h-2.5 w-2.5" />
          </p>
        </div>
        <MoreHorizontal className="ml-auto h-4 w-4 text-neutral-500" />
      </div>

      {/* Facebook shows the caption above the photo. */}
      <p className="whitespace-pre-line px-3 pb-2.5 text-xs leading-snug text-neutral-900">
        {caption || "Uw bijschrift verschijnt hier..."}
      </p>

      <div className="relative w-full">
        {componentSource ? (
          <ScaledTemplateCanvas source={componentSource} data={data} slideIndex={slideIndex} className="rounded-none shadow-none" />
        ) : (
          <RawImageSlide imageUrl={data.images[slideIndex] ?? data.images[0]} className="rounded-none shadow-none" />
        )}
        {slideCount > 1 && (
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
            {Array.from({ length: slideCount }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSlideIndexChange(i)}
                aria-label={`Slide ${i + 1}`}
                className={cn("h-1.5 w-1.5 rounded-full transition-all", i === slideIndex ? "bg-white" : "bg-white/50")}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-3 pt-2 text-[11px] text-neutral-500">
        <span className="flex items-center gap-1">
          <ThumbsUp className="h-3 w-3 fill-blue-500 text-blue-500" /> Vind ik leuk
        </span>
        <span>Reageren · Delen</span>
      </div>
    </div>
  );
}
