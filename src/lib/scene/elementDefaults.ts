import { getDescendantIds } from "@/lib/scene/resolveScene";
import type { ContainerSceneElement, PhotoSceneElement, Scene, SceneElement, ShapeSceneElement, TextSceneElement } from "@/types/scene";

// Client-safe (no "server-only") — used only by the editor UI (Phase E), never by the render path.

export function newElementId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `el-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createEmptyScene(): Scene {
  return { backgroundColor: "#111827", elements: [] };
}

/** New elements land centered-ish, at a size that's immediately visible and draggable — not a random guess, roughly a third of the canvas. */
export function createTextElement(): TextSceneElement {
  return {
    id: newElementId(),
    x: 8,
    y: 75,
    width: 84,
    height: 15,
    rotation: 0,
    type: "text",
    content: { mode: "field", field: "title" },
    agencyEditable: false,
    fontId: null,
    fontSize: 56,
    fontWeight: 700,
    color: "#ffffff",
    align: "left",
    sizing: "auto-height",
  };
}

export function createShapeElement(): ShapeSceneElement {
  return {
    id: newElementId(),
    x: 8,
    y: 8,
    width: 28,
    height: 7,
    rotation: 0,
    type: "shape",
    shape: "rectangle",
    fill: "#e11d48",
    cornerRadius: 6,
  };
}

export function createPhotoElement(): PhotoSceneElement {
  return { id: newElementId(), x: 0, y: 0, width: 100, height: 100, rotation: 0, type: "photo", focalX: 50, focalY: 50, zoom: 1 };
}

export function createLogoElement(): SceneElement {
  return { id: newElementId(), x: 5, y: 5, width: 20, height: 10, rotation: 0, type: "logo" };
}

/** width/height start at a placeholder guess — the editor's auto-hug measurement (SceneEditorCanvas.tsx) corrects them the moment it has an empty flex box to measure. */
export function createContainerElement(): ContainerSceneElement {
  return {
    id: newElementId(),
    x: 8,
    y: 8,
    width: 40,
    height: 10,
    rotation: 0,
    type: "container",
    direction: "row",
    gap: 16,
    padding: 16,
    align: "center",
  };
}

/**
 * Clones each of `rootIds` (must be top-level elements) together with its
 * full descendant subtree — any depth, since a container's children may
 * themselves be containers (see ContainerSceneElement's own doc comment on
 * nesting, and `getDescendantIds`) — assigning every clone (root and
 * descendants alike) a fresh id, including remapping a cloned child's
 * `parentId` to point at its *cloned* parent, not the original. Used by
 * Cmd+D (duplicate) and Cmd+V (paste from the in-memory clipboard) in
 * SceneEditor.tsx, which both use the default 2%-nudge `offsetPercent`
 * (Figma's own dupe-offset convention, so the clone doesn't sit exactly on
 * top of the original) — and by Alt/Option-drag-to-duplicate
 * (SceneEditorCanvas.tsx), which passes `offsetPercent: 0` instead, since
 * that clone is meant to sit exactly on top of the original at the moment
 * it's created (invisibly, since it's an identical copy) and only becomes
 * visually distinct once the live drag gesture — which keeps targeting the
 * *original* element throughout, see SceneEditorCanvas.tsx's own doc comment
 * on `onAltDuplicate` — moves the original away from it. Descendants keep
 * their relative (px-of-parent) position unchanged either way, since
 * they're still positioned relative to their (now cloned) container.
 */
export function cloneElements(elements: SceneElement[], rootIds: string[], offsetPercent = 2): SceneElement[] {
  const roots = elements.filter((el) => rootIds.includes(el.id));
  const subtreeIds = new Set<string>(rootIds);
  for (const root of roots) for (const id of getDescendantIds(elements, root.id)) subtreeIds.add(id);
  // Filtering the original array (not a per-root push) preserves each
  // element's original paint-order position relative to every other cloned
  // element, including across multiple roots' descendants interleaving.
  const subtree = elements.filter((el) => subtreeIds.has(el.id));

  const idMap = new Map<string, string>();
  for (const el of subtree) idMap.set(el.id, newElementId());

  return subtree.map((el) => {
    const isRoot = rootIds.includes(el.id);
    return {
      ...el,
      id: idMap.get(el.id)!,
      parentId: el.parentId ? idMap.get(el.parentId) : undefined,
      ...(isRoot && offsetPercent ? { x: el.x + offsetPercent, y: el.y + offsetPercent } : {}),
    } as SceneElement;
  });
}
