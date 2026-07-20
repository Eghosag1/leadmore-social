import { getBoundingBox, getElementBox } from "@/lib/scene/geometry";
import { CANVAS_FORMAT_DIMENSIONS, type CanvasFormat, type SceneElement } from "@/types/scene";

export type AlignMode = "left" | "center-h" | "right" | "top" | "center-v" | "bottom";

/**
 * Pure — no React, easy to reason about/verify against exact expected
 * numbers. Only ever called with top-level (%-of-canvas) elements: aligning
 * across a mix of canvas-% and container-relative-px coordinate spaces
 * wouldn't be meaningful, so SceneEditor.tsx filters to `!el.parentId`
 * before calling in.
 */
export function alignElements(elements: SceneElement[], format: CanvasFormat, mode: AlignMode): { id: string; patch: Partial<SceneElement> }[] {
  if (elements.length < 2) return [];
  const overall = getBoundingBox(elements, format);
  const { width: NATIVE_WIDTH, height: NATIVE_HEIGHT } = CANVAS_FORMAT_DIMENSIONS[format];
  return elements.map((element) => {
    const box = getElementBox(element, format);
    switch (mode) {
      case "left":
        return { id: element.id, patch: { x: (overall.left / NATIVE_WIDTH) * 100 } };
      case "center-h":
        return { id: element.id, patch: { x: ((overall.left + (overall.width - box.width) / 2) / NATIVE_WIDTH) * 100 } };
      case "right":
        return { id: element.id, patch: { x: ((overall.left + overall.width - box.width) / NATIVE_WIDTH) * 100 } };
      case "top":
        return { id: element.id, patch: { y: (overall.top / NATIVE_HEIGHT) * 100 } };
      case "center-v":
        return { id: element.id, patch: { y: ((overall.top + (overall.height - box.height) / 2) / NATIVE_HEIGHT) * 100 } };
      case "bottom":
        return { id: element.id, patch: { y: ((overall.top + overall.height - box.height) / NATIVE_HEIGHT) * 100 } };
    }
  });
}

/**
 * Edge-gap-based distribution (equal spacing between adjacent bounding-box
 * edges), matching Figma's own default "distribute spacing" — deliberately
 * not center-to-center, which reads wrong for elements of differing sizes.
 * The first and last elements (by position along `axis`) end up back at
 * their own original position by construction (the gap is solved for
 * exactly that), only the elements between them move.
 */
export function distributeElements(
  elements: SceneElement[],
  format: CanvasFormat,
  axis: "horizontal" | "vertical",
): { id: string; patch: Partial<SceneElement> }[] {
  if (elements.length < 3) return [];
  const posKey = axis === "horizontal" ? "left" : "top";
  const sizeKey = axis === "horizontal" ? "width" : "height";
  const { width: NATIVE_WIDTH, height: NATIVE_HEIGHT } = CANVAS_FORMAT_DIMENSIONS[format];
  const nativeSize = axis === "horizontal" ? NATIVE_WIDTH : NATIVE_HEIGHT;

  const boxed = elements.map((element) => ({ element, box: getElementBox(element, format) })).sort((a, b) => a.box[posKey] - b.box[posKey]);
  const first = boxed[0];
  const last = boxed[boxed.length - 1];
  const totalSpan = last.box[posKey] + last.box[sizeKey] - first.box[posKey];
  const totalSize = boxed.reduce((sum, b) => sum + b.box[sizeKey], 0);
  const gap = (totalSpan - totalSize) / (boxed.length - 1);

  const patches: { id: string; patch: Partial<SceneElement> }[] = [];
  let cursor = first.box[posKey];
  for (const { element, box } of boxed) {
    if (Math.abs(cursor - box[posKey]) > 0.01) {
      patches.push({ id: element.id, patch: axis === "horizontal" ? { x: (cursor / nativeSize) * 100 } : { y: (cursor / nativeSize) * 100 } });
    }
    cursor += box[sizeKey] + gap;
  }
  return patches;
}
