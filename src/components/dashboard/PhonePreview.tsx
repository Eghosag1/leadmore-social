"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { InstagramPostMock } from "./InstagramPostMock";
import { FacebookPostMock } from "./FacebookPostMock";
import type { TemplateRenderProps } from "@/types/domain";

type PreviewPlatform = "instagram" | "facebook";

/** iPhone-frame post preview that toggles between Instagram and Facebook chrome, similar to Meta Ads Manager's placement preview. */
export function PhonePreview({
  componentSource,
  templateKey,
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
  /** Set when the selected template is git-managed (src/templates/registry.ts) instead of a DB-string. */
  templateKey?: string | null;
  slideCount: number;
  data: TemplateRenderProps;
  caption: string;
  agencyName: string;
  agencyLogo?: string;
  slideIndex: number;
  onSlideIndexChange: (index: number) => void;
}) {
  const [platform, setPlatform] = useState<PreviewPlatform>("instagram");
  const isCarousel = slideCount > 1;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 p-1 text-sm">
        {(["instagram", "facebook"] as PreviewPlatform[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setPlatform(option)}
            className={cn(
              "rounded-full px-3 py-1 font-medium capitalize transition-colors",
              platform === option ? "bg-white text-neutral-900 shadow-sm" : "text-muted-foreground",
            )}
          >
            {option === "instagram" ? "Instagram" : "Facebook"}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {isCarousel && (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Vorige slide"
            disabled={slideIndex === 0}
            onClick={() => onSlideIndexChange(Math.max(0, slideIndex - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}

        {/* Fixed real-iPhone proportions (~9:19.5) so the frame never grows/shrinks
            with content — the screen area scrolls internally instead. Border
            width is uniform on all 4 sides, so the bottom bezel matches the sides. */}
        <div className="relative aspect-[9/19.5] w-[280px] overflow-hidden rounded-[2.5rem] border-[10px] border-neutral-900 bg-neutral-900 shadow-xl">
          <div className="absolute left-1/2 top-0 z-20 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-neutral-900" />

          <div className="absolute inset-0 overflow-y-auto bg-white pb-6">
            <div className="flex items-center justify-between px-5 pb-1 pt-3 text-[11px] font-medium text-neutral-900">
              <span>9:41</span>
              <span className="text-neutral-400">●●●</span>
            </div>
            {platform === "instagram" ? (
              <InstagramPostMock
                componentSource={componentSource}
                templateKey={templateKey}
                slideCount={slideCount}
                data={data}
                caption={caption}
                agencyName={agencyName}
                agencyLogo={agencyLogo}
                slideIndex={slideIndex}
                onSlideIndexChange={onSlideIndexChange}
              />
            ) : (
              <FacebookPostMock
                componentSource={componentSource}
                templateKey={templateKey}
                slideCount={slideCount}
                data={data}
                caption={caption}
                agencyName={agencyName}
                agencyLogo={agencyLogo}
                slideIndex={slideIndex}
                onSlideIndexChange={onSlideIndexChange}
              />
            )}
          </div>

          <div className="absolute bottom-1.5 left-1/2 z-20 h-1 w-24 -translate-x-1/2 rounded-full bg-neutral-500" />
        </div>

        {isCarousel && (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Volgende slide"
            disabled={slideIndex === slideCount - 1}
            onClick={() => onSlideIndexChange(Math.min(slideCount - 1, slideIndex + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {isCarousel && (
        <p className="text-xs text-muted-foreground">
          Slide {slideIndex + 1} van {slideCount}
        </p>
      )}
    </div>
  );
}
