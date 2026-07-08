"use client";

import { useMemo, useState } from "react";
import { buildTemplateRenderProps } from "@/lib/template-render";
import { DynamicTemplateRenderer } from "@/components/templates/DynamicTemplateRenderer";
import { cn } from "@/lib/utils";
import type { PropertyImageRow, PropertyRow } from "@/types/database";
import type { TemplateType } from "@/types/enums";
import type { TemplateConfig } from "@/types/domain";

export interface PreviewPropertyOption {
  property: PropertyRow;
  images: PropertyImageRow[];
}

export function TemplatePreviewClient({
  componentSource,
  slideCount,
  type,
  config,
  agencyName,
  properties,
}: {
  componentSource: string;
  slideCount: number;
  type: TemplateType;
  config: TemplateConfig;
  agencyName: string;
  properties: PreviewPropertyOption[];
}) {
  const [propertyIndex, setPropertyIndex] = useState(0);
  const [slideIndex, setSlideIndex] = useState(0);

  const selected = properties[propertyIndex];

  const previewData = useMemo(() => {
    if (!selected) return null;
    return buildTemplateRenderProps({
      property: selected.property,
      images: selected.images,
      config,
      agencyName,
    });
  }, [selected, config, agencyName]);

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

      <div className="max-w-sm">
        <DynamicTemplateRenderer source={componentSource} data={previewData} slideIndex={slideIndex} className="shadow-sm" />
        {slideCount > 1 && (
          <div className="mt-3 flex justify-center gap-1.5">
            {Array.from({ length: slideCount }, (_, index) => (
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
