import { CANVAS_FORMAT_DIMENSIONS, type CanvasFormat, type SceneElement } from "@/types/scene";

/** Native-px (at the format's 1080-wide canvas), axis-aligned — rotation is deliberately ignored, same simplification Figma itself falls back to for align/distribute/group-wrap bounding boxes. */
export interface BoundingBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** A single top-level (%-of-canvas) element's own box, in native px. */
export function getElementBox(element: SceneElement, format: CanvasFormat): BoundingBox {
  const { width: NATIVE_WIDTH, height: NATIVE_HEIGHT } = CANVAS_FORMAT_DIMENSIONS[format];
  return {
    left: (element.x / 100) * NATIVE_WIDTH,
    top: (element.y / 100) * NATIVE_HEIGHT,
    width: (element.width / 100) * NATIVE_WIDTH,
    height: (element.height / 100) * NATIVE_HEIGHT,
  };
}

/** The combined bounding box of one or more top-level elements, in native px — used to seed a new Shift+A container's position/size (elementDefaults.ts) and, in Fase 3, align/distribute. */
export function getBoundingBox(elements: SceneElement[], format: CanvasFormat): BoundingBox {
  const boxes = elements.map((element) => getElementBox(element, format));
  const left = Math.min(...boxes.map((box) => box.left));
  const top = Math.min(...boxes.map((box) => box.top));
  const right = Math.max(...boxes.map((box) => box.left + box.width));
  const bottom = Math.max(...boxes.map((box) => box.top + box.height));
  return { left, top, width: right - left, height: bottom - top };
}

/**
 * Heuristic starting direction for a new Shift+A auto-layout container: are
 * the selected elements arranged mostly side-by-side (row) or mostly
 * stacked (column)? Compares how spread out their centers are on each axis
 * — whichever axis has more spread is the one they're "laid out along".
 * Just a starting value (defaults to "row" for <2 elements or a tie) — the
 * admin can always change it afterward in PropertyPanel.
 */
export function inferLayoutDirection(elements: SceneElement[], format: CanvasFormat): "row" | "column" {
  if (elements.length < 2) return "row";
  const boxes = elements.map((element) => getElementBox(element, format));
  const centersX = boxes.map((box) => box.left + box.width / 2);
  const centersY = boxes.map((box) => box.top + box.height / 2);
  const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
  return spread(centersX) >= spread(centersY) ? "row" : "column";
}
