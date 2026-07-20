"use client";

import { Type, Square, Image as ImageIcon, Building2, Rows3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createContainerElement, createLogoElement, createPhotoElement, createShapeElement, createTextElement } from "@/lib/scene/elementDefaults";
import type { SceneElement } from "@/types/scene";

export function ElementToolbox({ onAdd }: { onAdd: (element: SceneElement) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" onClick={() => onAdd(createTextElement())}>
        <Type className="h-3.5 w-3.5" />
        Tekst
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => onAdd(createShapeElement())}>
        <Square className="h-3.5 w-3.5" />
        Vorm
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => onAdd(createPhotoElement())}>
        <ImageIcon className="h-3.5 w-3.5" />
        Foto
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => onAdd(createLogoElement())}>
        <Building2 className="h-3.5 w-3.5" />
        Logo
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => onAdd(createContainerElement())}>
        <Rows3 className="h-3.5 w-3.5" />
        Container
      </Button>
    </div>
  );
}
