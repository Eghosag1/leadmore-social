// Client-safe (no "server-only") — used both by the real render pipeline
// (server) and the live preview / editor (client), same reasoning as
// template-render.ts and field-binding.ts: one shared implementation so
// preview and real render can never drift.

import { formatPrice, formatSurface, propertyStatusLabel, propertyTypeLabel } from "@/lib/format";
import type { BindablePropertyField } from "@/lib/field-binding";
import type { CanvasFormat } from "@/types/enums";
import type { TemplateRenderProps } from "@/types/domain";
import { EMPTY_TEMPLATE_SCENES, type Scene, type SceneElement, type ScenesByFormat, type TemplateScenes } from "@/types/scene";

/**
 * Picks the (cover/content/end) scene set for one specific CanvasFormat —
 * the first of two resolution steps, run before resolveSceneForSlide below.
 * A format simply absent from scenesByFormat (never designed) behaves
 * exactly like one present with all three roles null.
 */
export function getFormatScenes(scenesByFormat: ScenesByFormat | null | undefined, format: CanvasFormat | null | undefined): TemplateScenes {
  if (!scenesByFormat || !format) return EMPTY_TEMPLATE_SCENES;
  return scenesByFormat[format] ?? EMPTY_TEMPLATE_SCENES;
}

/** True once at least one role, for at least one format, has actually been designed — the shared "is this agency_templates row a scene template at all" check (used both for UI branching and, equivalently, in templateValidationService). */
export function isSceneTemplate(scenesByFormat: ScenesByFormat | null | undefined): boolean {
  if (!scenesByFormat) return false;
  return Object.values(scenesByFormat).some((scenes) => !!scenes && (!!scenes.cover || !!scenes.content || !!scenes.end));
}

/**
 * Picks which of a template's (up to 3) scenes applies to one specific
 * slide, given the post's real total slide count — this must run *before*
 * DynamicTemplateRenderer, which only ever sees the current `slideIndex`,
 * never the total (same reasoning documented on DynamicTemplateRenderer's
 * TemplateReference union). `null` means "no scene defined for this slide's
 * role" — the caller falls back to the plain, unbranded photo (see
 * PlainPhotoSlide.tsx), the same rendering "eigen foto's" already uses.
 */
export function resolveSceneForSlide(scenes: TemplateScenes, slideIndex: number, totalSlideCount: number): Scene | null {
  const isLast = slideIndex === totalSlideCount - 1;
  // A single-slide post only ever shows the cover role — content/end never
  // apply when there's nothing "in the middle" or "at the end" to speak of.
  if (totalSlideCount === 1) return scenes.cover;
  if (slideIndex === 0) return scenes.cover;
  if (isLast && scenes.end) return scenes.end;
  return scenes.content;
}

/**
 * Splits a Scene's flat elements array into top-level elements (no
 * `parentId`, positioned normally) and a lookup of each container's
 * children (in their original array order = paint order among siblings) —
 * the one shared grouping used by both the real render path
 * (SceneRenderer.tsx) and the editor (SceneEditorCanvas.tsx) so a container
 * always resolves its children identically in both places. Buckets purely by
 * each element's own direct `parentId`, so this already works at any nesting
 * depth — a container's children may themselves be containers with their own
 * children, see ContainerSceneElement's own docs. Callers that only ever
 * rendered one level deep must recurse into `childrenByParent` themselves to
 * support that (see SceneRenderer.tsx's/SceneEditorCanvas.tsx's recursive
 * render helpers).
 */
export function groupElementsByParent(elements: SceneElement[]): { topLevel: SceneElement[]; childrenByParent: Map<string, SceneElement[]> } {
  const topLevel: SceneElement[] = [];
  const childrenByParent = new Map<string, SceneElement[]>();
  for (const element of elements) {
    if (element.parentId) {
      const siblings = childrenByParent.get(element.parentId) ?? [];
      siblings.push(element);
      childrenByParent.set(element.parentId, siblings);
    } else {
      topLevel.push(element);
    }
  }
  return { topLevel, childrenByParent };
}

/**
 * All ids reachable by following `parentId` chains downward from `rootId`
 * (not including `rootId` itself) — used to guard against creating a cycle
 * when reparenting a container into one of its own descendants (which would
 * make `groupElementsByParent`'s consumers recurse forever). See
 * PropertyPanel.tsx's `ContainerAssignment`, the only place a user can
 * reparent an element.
 */
export function getDescendantIds(elements: SceneElement[], rootId: string): Set<string> {
  const { childrenByParent } = groupElementsByParent(elements);
  const result = new Set<string>();
  const stack = [...(childrenByParent.get(rootId) ?? [])];
  while (stack.length > 0) {
    const el = stack.pop()!;
    if (result.has(el.id)) continue;
    result.add(el.id);
    stack.push(...(childrenByParent.get(el.id) ?? []));
  }
  return result;
}

/**
 * Resolves a text element's "bound to property field X" choice against the
 * already-computed TemplateRenderProps (not a raw PropertyRow) — at render
 * time every field a scene could bind to is already sitting on `data` in
 * its final display form, the same values every other template already
 * reads directly (data.title, data.price, ...). Mirrors field-binding.ts's
 * resolvePropertyField() one level up the pipeline.
 */
export function resolveFieldFromRenderProps(data: TemplateRenderProps, field: BindablePropertyField): string {
  switch (field) {
    case "title":
      return data.title;
    case "location":
      return data.location;
    case "description":
      return data.description ?? "";
    case "price":
      return formatPrice(data.price);
    case "propertyType":
      return propertyTypeLabel(data.propertyType);
    case "bedrooms":
      return data.bedrooms !== null ? String(data.bedrooms) : "";
    case "bathrooms":
      return data.bathrooms !== null ? String(data.bathrooms) : "";
    case "surface":
      return formatSurface(data.surface);
    case "status":
      return propertyStatusLabel(data.status);
  }
}
