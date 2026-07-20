import { CANVAS_FORMAT_DIMENSIONS, type CanvasFormat, type SceneElement } from "@/types/scene";

/**
 * Every place an element crosses the top-level (%-of-canvas) / parented
 * (literal native px) boundary — see SceneElementBase's doc comment on
 * `width`/`height` — must convert the stored numbers through these two
 * functions, never just flip `parentId`. Left unconverted, a leftover
 * top-level value like `84` (meant as 84%) gets reinterpreted as a literal
 * 84px box, wrapping any real text into dozens of lines and ballooning a
 * container's auto-hug size. Found and fixed once already in
 * `ContainerAssignment` (PropertyPanel.tsx); `deleteElement`'s
 * container-orphan branch had the same bug in the opposite direction.
 */

/** %-of-canvas → literal native px (becoming a container child). */
export function toParentedUnits<T extends SceneElement>(element: T, format: CanvasFormat): T {
  const { width: NATIVE_WIDTH, height: NATIVE_HEIGHT } = CANVAS_FORMAT_DIMENSIONS[format];
  return {
    ...element,
    width: (element.width / 100) * NATIVE_WIDTH,
    height: element.type === "text" ? element.height : (element.height / 100) * NATIVE_HEIGHT,
  };
}

/** literal native px → %-of-canvas (leaving/orphaned from a container). */
export function toTopLevelUnits<T extends SceneElement>(element: T, format: CanvasFormat): T {
  const { width: NATIVE_WIDTH, height: NATIVE_HEIGHT } = CANVAS_FORMAT_DIMENSIONS[format];
  return {
    ...element,
    width: (element.width / NATIVE_WIDTH) * 100,
    height: element.type === "text" ? element.height : (element.height / NATIVE_HEIGHT) * 100,
  };
}
