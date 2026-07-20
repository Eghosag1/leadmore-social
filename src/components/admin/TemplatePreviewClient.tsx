"use client";

import { useMemo, useState } from "react";
import { buildTemplateRenderProps } from "@/lib/template-render";
import { ScaledTemplateCanvas } from "@/components/templates/ScaledTemplateCanvas";
import { getFormatScenes, isSceneTemplate, resolveSceneForSlide } from "@/lib/scene/resolveScene";
import { cn } from "@/lib/utils";
import type { AgencyFontRow, PropertyImageRow, PropertyRow } from "@/types/database";
import { CANVAS_FORMATS, type CanvasFormat, type TemplateType } from "@/types/enums";
import type { TemplateConfig } from "@/types/domain";
import { CANVAS_FORMAT_DIMENSIONS, type ScenesByFormat } from "@/types/scene";

export interface PreviewPropertyOption {
  property: PropertyRow;
  images: PropertyImageRow[];
}

export function TemplatePreviewClient({
  componentSource,
  scenesByFormat,
  slideCount,
  type,
  config,
  agencyName,
  fonts,
  properties,
}: {
  componentSource: string | null;
  /** Set (non-null) for scene-based templates (Phase C) — mutually exclusive with componentSource. */
  scenesByFormat?: ScenesByFormat | null;
  slideCount: number;
  type: TemplateType;
  config: TemplateConfig;
  agencyName: string;
  fonts?: Pick<AgencyFontRow, "id" | "label" | "font_family" | "font_url">[];
  properties: PreviewPropertyOption[];
}) {
  const [propertyIndex, setPropertyIndex] = useState(0);
  const [slideIndex, setSlideIndex] = useState(0);
  const isScene = isSceneTemplate(scenesByFormat);
  const designedFormats = isScene ? CANVAS_FORMATS.filter((format) => scenesByFormat?.[format]) : [];
  const [canvasFormat, setCanvasFormat] = useState<CanvasFormat>(designedFormats[0] ?? "portrait");

  const selected = properties[propertyIndex];
  // agency_templates.slide_count is meaningless for a scene template (real
  // slide count always follows the post's own photo count, see Phase B) —
  // cycle through 3 preview slides instead, enough to show cover/content/end.
  const effectiveSlideCount = isScene ? 3 : slideCount;
  const scene = isScene ? resolveSceneForSlide(getFormatScenes(scenesByFormat, canvasFormat), slideIndex, effectiveSlideCount) : undefined;
  const canvasHeight = isScene ? CANVAS_FORMAT_DIMENSIONS[canvasFormat].height : undefined;

  const previewData = useMemo(() => {
    if (!selected) return null;
    return buildTemplateRenderProps({
      property: selected.property,
      images: selected.images,
      config,
      agencyName,
      fonts,
    });
  }, [selected, config, agencyName, fonts]);

  if (!previewData) {
    return <p className="text-sm text-muted-foreground">Geen voorbeeldpand beschikbaar.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {properties.length > 1 && (
        <select
          className="h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm"
          value={propertyIndex}
          onChange={(e) => {
            setPropertyIndex(Number(e.target.value));
            setSlideIndex(0);
          }}
        >
          {properties.map((option, index) => (
            <option key={option.property.id} value={index}>
              {option.property.title}
            </option>
          ))}
        </select>
      )}

      {designedFormats.length > 1 && (
        <div className="inline-flex w-fit rounded-full border border-neutral-200 bg-neutral-50 p-1 text-sm">
          {designedFormats.map((format) => (
            <button
              key={format}
              type="button"
              onClick={() => setCanvasFormat(format)}
              className={cn(
                "rounded-full px-3 py-1 font-medium transition-colors",
                canvasFormat === format ? "bg-white text-neutral-900 shadow-sm" : "text-muted-foreground",
              )}
            >
              {CANVAS_FORMAT_DIMENSIONS[format].label}
            </button>
          ))}
        </div>
      )}

      <div className="max-w-sm">
        <ScaledTemplateCanvas
          {...(scene !== undefined ? { scene } : { source: componentSource! })}
          data={previewData}
          slideIndex={slideIndex}
          className="shadow-sm"
          canvasHeight={canvasHeight}
        />
        {effectiveSlideCount > 1 && (
          <div className="mt-3 flex justify-center gap-1.5">
            {Array.from({ length: effectiveSlideCount }, (_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setSlideIndex(index)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  index === slideIndex ? "w-6 bg-neutral-900" : "w-1.5 bg-neutral-200",
                )}
                aria-label={`Slide ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Type: {type === "single" ? "Single post" : "Carousel"}</p>
    </div>
  );
}
