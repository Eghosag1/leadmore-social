"use client";

import Image from "next/image";
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { DynamicTemplateRenderer } from "@/components/templates/DynamicTemplateRenderer";
import { RawImageSlide } from "@/components/templates/RawImageSlide";
import type { TemplateRenderProps } from "@/types/domain";

export function InstagramPostMock({
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
  const handle = agencyName ? agencyName.toLowerCase().replace(/\s+/g, "") : "uw_kantoor";

  return (
    <div className="pb-4">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-200">
          {agencyLogo && <Image src={agencyLogo} alt="" width={28} height={28} className="h-full w-full object-cover" />}
        </div>
        <span className="text-xs font-semibold text-neutral-900">{handle}</span>
        <MoreHorizontal className="ml-auto h-4 w-4 text-neutral-500" />
      </div>

      <div className="relative w-full">
        {componentSource ? (
          <DynamicTemplateRenderer source={componentSource} data={data} slideIndex={slideIndex} className="rounded-none shadow-none" />
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

      <div className="flex items-center gap-3 px-3 pt-2.5 text-neutral-900">
        <Heart className="h-5 w-5" />
        <MessageCircle className="h-5 w-5" />
        <Send className="h-5 w-5" />
        <Bookmark className="ml-auto h-5 w-5" />
      </div>

      <div className="px-3 pt-2 text-xs leading-snug text-neutral-900">
        <span className="font-semibold">{handle}</span>{" "}
        <span className="whitespace-pre-line text-neutral-700">{caption || "Uw bijschrift verschijnt hier..."}</span>
      </div>
    </div>
  );
}
