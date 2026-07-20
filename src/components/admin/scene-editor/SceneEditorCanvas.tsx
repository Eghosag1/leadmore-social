"use client";

import { useEffect, useRef, useState } from "react";
import Moveable from "react-moveable";
import Selecto from "react-selecto";
import { SceneElementView } from "@/templates/scene/SceneRenderer";
import { groupElementsByParent } from "@/lib/scene/resolveScene";
import { CANVAS_FORMAT_DIMENSIONS, type Scene, type SceneElement } from "@/types/scene";
import type { CanvasFormat } from "@/types/enums";
import type { TemplateRenderProps } from "@/types/domain";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const FIT_PADDING_FACTOR = 0.9;

function clampZoom(zoom: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/**
 * The interactive editing surface for one scene, at one specific
 * CanvasFormat. The artboard itself always renders at its true native CSS
 * size (e.g. exactly 1080×1350px) — zoom/pan are a pure CSS
 * `transform: translate() scale()` on an *ancestor* wrapper around it,
 * never on the artboard's own box. Two big simplifications fall out of
 * that:
 *
 * 1. `react-moveable` independently walks the live DOM/CSS transform chain
 *    between `target` and `container` to do its drag/resize/rotate math
 *    (confirmed by reading its source, not just its types) — so position
 *    math here can use the fixed NATIVE_WIDTH/NATIVE_HEIGHT constants
 *    directly, no `scaleFactor` needed anywhere. `zoom={zoom}` is passed to
 *    Moveable purely so its own overlay UI (handles/lines) render at the
 *    right visual size — it does NOT affect the position math (that's
 *    already correct via the transform-chain walk); omitting it would only
 *    make the handles look disproportionate, never produce wrong numbers.
 * 2. `offsetWidth`/`offsetHeight`/`scrollHeight` (used by the auto-hug
 *    effect below, deliberately not `getBoundingClientRect()` so it stays
 *    immune to an element's own `rotate()`) are pre-transform layout
 *    measurements — immune to the ancestor's `scale()` too, for the same
 *    reason. So those reads are already native px, no division needed.
 *
 * `SceneElementView` is always called with the implicit default
 * `scaleFactor={1}` here (never passed) — the ancestor `transform:scale()`
 * already visually shrinks/grows fontSize/gap/padding/etc. proportionally,
 * exactly like real browser zoom, so no manual multiplication is needed;
 * this now matches what the real render path (SceneRenderer's default
 * export) always did anyway.
 *
 * Deliberate non-option: Moveable's `useAccuratePosition` is documented as
 * incompatible with both an ancestor CSS transform and multi-target/group
 * mode — both apply here — don't reach for it later thinking it's "more
 * precise."
 *
 * Multi-select: only top-level elements are independently selectable
 * (container children stay flex-flow-only and non-interactive, same as
 * before). `selectedElementIds.length > 1` puts Moveable in its own
 * built-in multi-target "group" mode (an array passed to `target`) — its
 * group event payloads (`onDragGroupEnd` etc.) hand back one per-target
 * sub-event with the *same shape* as the single-target handlers, so the box
 * math (`computeBoxPatch`) is reused unchanged per sub-event via a node→id
 * reverse lookup. Marquee/rubber-band selection (`react-selecto`) is
 * scoped to top-level elements via a dynamically-built CSS selector, and
 * uses partial-overlap (`hitRate={0}`) to match Figma's own marquee feel
 * (touch it, it's selected) rather than the library's own full-containment
 * default.
 *
 * Real bug found and fixed while building this: a group gesture's several
 * sub-events must be committed via *one* `onUpdateElements(patches[])`
 * call, never a loop of single-element `onUpdateElement()` calls. Each of
 * those calls would otherwise independently derive its "next scenes" state
 * from the same pre-gesture `SceneEditor.tsx` closure (they all fire inside
 * one synchronous handler, before any state update has re-rendered that
 * closure) — React batches the resulting `setState` calls, and the *last*
 * one wins, silently discarding every other selected element's move. This
 * is the exact reason `SceneEditor.tsx` exposes a *batched* update function
 * at all.
 */
export function SceneEditorCanvas({
  scene,
  format,
  data,
  slideIndex,
  selectedElementIds,
  onSelectElement,
  onClearSelection,
  onSelectMany,
  onUpdateElement,
  onUpdateElements,
  onAltDuplicate,
  zoom,
  onZoomChange,
  fitToken,
}: {
  scene: Scene;
  format: CanvasFormat;
  data: TemplateRenderProps;
  slideIndex: number;
  selectedElementIds: string[];
  onSelectElement: (id: string, shiftKey: boolean) => void;
  onClearSelection: () => void;
  onSelectMany: (ids: string[]) => void;
  onUpdateElement: (id: string, patch: Partial<SceneElement>, opts?: { skipHistory?: boolean }) => void;
  /** Batched multi-element commit — required (not a loop of onUpdateElement) for group drag/resize/rotate, see this file's own doc comment above. */
  onUpdateElements: (patches: { id: string; patch: Partial<SceneElement> }[], opts?: { skipHistory?: boolean }) => void;
  /**
   * Alt/Option-drag-to-duplicate: called once, from `onDragStart`/
   * `onDragGroupStart`, with the id(s) about to be dragged. Creates a
   * zero-offset clone sitting exactly on top of each — deliberately without
   * touching selection (see SceneEditor.tsx's own doc comment on
   * `duplicateInPlace` for why). The rest of the gesture then proceeds
   * completely unmodified against the *original* elements (still the
   * Moveable target throughout), so the original visibly moves to the drop
   * position while the freshly-created, identical clone is left behind at
   * the start — same end result as Figma's alt-drag, without ever needing
   * to retarget a live gesture mid-flight.
   */
  onAltDuplicate: (ids: string[]) => void;
  /** Lifted to SceneEditor.tsx so the top toolbar can show/control it — pan stays local to this component. */
  zoom: number;
  onZoomChange: (zoom: number) => void;
  /** Bumped by the toolbar's "Fit" button to request a re-fit; also drives the one-time auto-fit on first mount/measurement — see the effect below. */
  fitToken: number;
}) {
  const { width: NATIVE_WIDTH, height: NATIVE_HEIGHT } = CANVAS_FORMAT_DIMENSIONS[format];
  // viewportEl: the outer, untransformed pan/zoom surface — measured for
  // computing the initial/"fit" zoom, and Selecto's drag container.
  // containerEl: the artboard root itself (native size, never transformed)
  // — this is what Moveable's `container` prop points at (see this file's
  // own doc comment above for why that's still correct once a scale sits
  // on an *ancestor* of it).
  const [viewportEl, setViewportEl] = useState<HTMLDivElement | null>(null);
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const elementNodesRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const idByNodeRef = useRef<Map<HTMLDivElement, string>>(new Map());
  const [selectedNodes, setSelectedNodes] = useState<HTMLDivElement[]>([]);
  const [guideNodes, setGuideNodes] = useState<HTMLDivElement[]>([]);
  const textContentNodesRef = useRef<Map<string, HTMLParagraphElement>>(new Map());
  // Ref-mirrors of the latest zoom/pan for the native wheel listener below,
  // which attaches once ([] deps) — same ref-mirror technique SceneEditor.tsx
  // already uses for its undo/redo keyboard listener.
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  useEffect(() => {
    zoomRef.current = zoom;
    panRef.current = pan;
  });
  // Belt-and-suspenders: Moveable's own documented fix for "the target's
  // rect changed without Moveable noticing" is `.updateRect()`. The actual
  // fix for the pan/zoom "ghost" selection bug (see the comment on
  // <Moveable> below) was rendering Moveable *inside* the same transformed
  // wrapper as the target, not this call — CSS transform inheritance alone
  // now keeps the overlay glued to the target on every pan/zoom frame. This
  // stays as a harmless safety net for any other case that changes the
  // target's rect without moving Moveable's own DOM position (e.g. a future
  // change to how a target's size is computed outside of a drag gesture).
  const moveableRef = useRef<Moveable>(null);
  useEffect(() => {
    moveableRef.current?.updateRect();
  }, [zoom, pan.x, pan.y]);
  // A native `click` DOM event always fires after `mouseup`, regardless of
  // whether the pointer actually moved — so a Selecto marquee-drag's own
  // `mouseup` is immediately followed by a `click` bubbling to the outer
  // viewport div below, which the click-out-to-deselect handler (correctly,
  // for an *actual* click) treats as "clicked empty space" and wipes the
  // selection Selecto just made. Selecto's own `onDragEnd` exposes
  // `isDrag: boolean` (see gesto's `OnDragEnd` type) — stash it here and
  // have the outer onClick consume-and-skip it once, for exactly the one
  // click that follows a genuine drag.
  const selectoDraggedRef = useRef(false);

  const { topLevel, childrenByParent } = groupElementsByParent(scene.elements);
  const singleSelected = selectedElementIds.length === 1 ? scene.elements.find((el) => el.id === selectedElementIds[0]) : undefined;
  // marginGuide is a literal native px value (same convention as
  // fontSize/cornerRadius) — no scaling needed, the artboard itself is
  // always native-size. Declared here (before the auto-hug effect below,
  // which reads it) rather than only where verticalGuidelines/
  // horizontalGuidelines need it, to avoid a "used before declared" lint
  // error from the effect's closure.
  const marginPx = scene.marginGuide ?? 0;

  useEffect(() => {
    if (!viewportEl) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setViewportSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(viewportEl);
    return () => observer.disconnect();
  }, [viewportEl]);

  // Auto-fit once viewport size is first known, and again whenever the
  // toolbar's "Fit" button bumps fitToken — but NOT on every subsequent
  // resize (e.g. the properties column opening/closing shouldn't yank the
  // user's own zoom/pan back to fit).
  const lastFitTokenRef = useRef<number | null>(null);
  useEffect(() => {
    if (viewportSize.width === 0 || viewportSize.height === 0) return;
    if (lastFitTokenRef.current === fitToken) return;
    lastFitTokenRef.current = fitToken;
    const fitZoom = clampZoom(Math.min(viewportSize.width / NATIVE_WIDTH, viewportSize.height / NATIVE_HEIGHT) * FIT_PADDING_FACTOR);
    onZoomChange(fitZoom);
    setPan({
      x: (viewportSize.width - NATIVE_WIDTH * fitZoom) / 2,
      y: (viewportSize.height - NATIVE_HEIGHT * fitZoom) / 2,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onZoomChange is a stable setState setter passed down; including it would just be noise.
  }, [viewportSize.width, viewportSize.height, fitToken, NATIVE_WIDTH, NATIVE_HEIGHT]);

  // Plain wheel = pan; ctrl/cmd+wheel (or a trackpad pinch, which browsers
  // report as a ctrlKey wheel event) = zoom around the cursor. A native
  // listener (not onWheel) so preventDefault() reliably stops the browser's
  // own page-zoom/scroll — React's synthetic wheel handler is passive by
  // default and can't reliably do that.
  useEffect(() => {
    const el = viewportEl;
    if (!el) return;
    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const rect = el!.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;
        const prevZoom = zoomRef.current;
        const prevPan = panRef.current;
        const artboardX = (cursorX - prevPan.x) / prevZoom;
        const artboardY = (cursorY - prevPan.y) / prevZoom;
        const nextZoom = clampZoom(prevZoom * Math.exp(-e.deltaY * 0.001));
        onZoomChange(nextZoom);
        setPan({ x: cursorX - artboardX * nextZoom, y: cursorY - artboardY * nextZoom });
      } else {
        setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      }
    }
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onZoomChange is a stable setState setter; zoom/pan are read via the ref-mirrors above so this listener never needs to re-attach.
  }, [viewportEl]);

  useEffect(() => {
    // Container children aren't independently draggable/resizable (their
    // position is flex-flow-determined) — only a top-level element ever
    // gets a Moveable target, selected or as a snap guide.
    const nodes = selectedElementIds
      .map((id) => scene.elements.find((el) => el.id === id))
      .filter((el): el is SceneElement => !!el && !el.parentId)
      .map((el) => elementNodesRef.current.get(el.id))
      .filter((node): node is HTMLDivElement => !!node);
    setSelectedNodes(nodes);
    setGuideNodes(
      Array.from(elementNodesRef.current.entries())
        .filter(([id]) => {
          if (selectedElementIds.includes(id)) return false;
          const el = scene.elements.find((e) => e.id === id);
          return !!el && !el.parentId;
        })
        .map(([, node]) => node),
    );
  }, [selectedElementIds, scene.elements]);

  // Auto-hug: a text element's `height`, and a container's whole
  // `width`+`height`, are never dragged directly (see renderDirections
  // below) — instead they're kept in sync here with whatever their content
  // actually renders at. skipHistory:true because this is a derived
  // correction, not a user action — it must never consume an undo step.
  // Converges in at most one extra pass: after committing the measured
  // size, re-measuring yields the same value, which then falls inside the
  // epsilon and stops.
  useEffect(() => {
    for (const element of scene.elements) {
      if (element.type === "text") {
        // Undefined = "auto-height", same as before this field existed — see TextSceneElement's own doc comment.
        const sizing = element.sizing ?? "auto-height";
        if (sizing === "fixed") continue; // both dimensions are manually authored — no auto-hug at all.
        const node = textContentNodesRef.current.get(element.id);
        if (!node) continue;
        // Parented text stores width/height in px (see SceneElementBase's
        // doc comment) — top-level text stores them as % of the canvas,
        // same as every other top-level element.
        const measuredHeight = element.parentId ? node.scrollHeight : (node.scrollHeight / NATIVE_HEIGHT) * 100;
        const heightChanged = Math.abs(measuredHeight - element.height) > 0.15;
        // "bottom" only makes sense for a top-level element — a parented
        // text's height is ignored entirely at render time (see
        // SceneElementBase's doc comment), so there's no edge to anchor.
        // `element.y`/`element.height`/`measuredHeight` are all already in
        // the *same* % units here (top-level-only), so this is a plain
        // subtraction — no native-px conversion needed.
        const yCompensation =
          !element.parentId && element.verticalAnchor === "bottom" && heightChanged ? { y: element.y - (measuredHeight - element.height) } : {};
        if (sizing === "auto-width") {
          // scrollWidth of a `white-space: nowrap` <p> is its natural,
          // unwrapped single-line width — set by SceneRenderer.tsx whenever
          // sizing is "auto-width", so this reads correctly regardless of
          // whatever the *previously* stored (possibly stale/small) width was.
          const measuredWidth = element.parentId ? node.scrollWidth : (node.scrollWidth / NATIVE_WIDTH) * 100;
          // A top-level auto-width box only ever grows from its left edge
          // (x stays fixed) — Moveable's `bounds` prop only constrains
          // drag/resize *gestures*, never this effect's own programmatic
          // resize, so growth alone could otherwise push the right edge
          // past the margin guide with nothing to stop it. Clamp position
          // (shift x left), never the measured size itself — same
          // "clamp position, not size" idea as verticalAnchor's y-compensation
          // above, just for the opposite axis and unconditional (no
          // opt-in field for this one — see TextSceneElement's own doc
          // comment on why only the vertical axis has an anchor choice).
          let nextX = element.x;
          if (!element.parentId && marginPx > 0) {
            const marginPercent = (marginPx / NATIVE_WIDTH) * 100;
            const maxRightEdge = 100 - marginPercent;
            const rightEdge = nextX + measuredWidth;
            if (rightEdge > maxRightEdge) nextX = Math.max(marginPercent, maxRightEdge - measuredWidth);
          }
          const xChanged = Math.abs(nextX - element.x) > 0.15;
          if (Math.abs(measuredWidth - element.width) > 0.15 || heightChanged || xChanged) {
            onUpdateElement(element.id, { width: measuredWidth, height: measuredHeight, x: nextX, ...yCompensation }, { skipHistory: true });
          }
        } else if (heightChanged) {
          onUpdateElement(element.id, { height: measuredHeight, ...yCompensation }, { skipHistory: true });
        }
      } else if (element.type === "container") {
        const node = elementNodesRef.current.get(element.id);
        if (!node) continue;
        // offsetWidth/Height (not getBoundingClientRect) — untransformed
        // layout size, unaffected by this element's own rotation AND by the
        // ancestor pan/zoom transform. A *nested* container (parentId set —
        // possible now that containers can nest, see ContainerSceneElement's
        // doc comment) stores width/height in native px, same convention as
        // every other parented element, not % — see SceneElementBase's doc
        // comment and the text branch above for the same parentId-aware split.
        const measuredWidth = element.parentId ? node.offsetWidth : (node.offsetWidth / NATIVE_WIDTH) * 100;
        const measuredHeight = element.parentId ? node.offsetHeight : (node.offsetHeight / NATIVE_HEIGHT) * 100;
        if (Math.abs(measuredWidth - element.width) > 0.15 || Math.abs(measuredHeight - element.height) > 0.15) {
          onUpdateElement(element.id, { width: measuredWidth, height: measuredHeight }, { skipHistory: true });
        }
      }
    }
  }, [scene.elements, NATIVE_WIDTH, NATIVE_HEIGHT, onUpdateElement]);

  const verticalGuidelines = [0, NATIVE_WIDTH / 2, NATIVE_WIDTH, ...(marginPx > 0 ? [marginPx, NATIVE_WIDTH - marginPx] : [])];
  const horizontalGuidelines = [0, NATIVE_HEIGHT / 2, NATIVE_HEIGHT, ...(marginPx > 0 ? [marginPx, NATIVE_HEIGHT - marginPx] : [])];

  function pxPosition(element: SceneElement) {
    return {
      position: "absolute" as const,
      left: (element.x / 100) * NATIVE_WIDTH,
      top: (element.y / 100) * NATIVE_HEIGHT,
      width: (element.width / 100) * NATIVE_WIDTH,
      height: (element.height / 100) * NATIVE_HEIGHT,
      transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
      opacity: element.opacity ?? 1,
    };
  }

  function registerRef(id: string, node: HTMLDivElement | null) {
    const prevNode = elementNodesRef.current.get(id);
    if (prevNode && prevNode !== node) idByNodeRef.current.delete(prevNode);
    if (node) {
      elementNodesRef.current.set(id, node);
      idByNodeRef.current.set(node, id);
      // Purely a hook for Puppeteer/e2e verification to assert selection
      // state via a DOM query instead of parsing computed outline styles —
      // never read by application code itself.
      if (selectedElementIds.includes(id)) node.setAttribute("data-selected", "true");
      else node.removeAttribute("data-selected");
    } else {
      elementNodesRef.current.delete(id);
    }
  }

  function registerTextContentRef(id: string, node: HTMLParagraphElement | null) {
    if (node) textContentNodesRef.current.set(id, node);
    else textContentNodesRef.current.delete(id);
  }

  /** Pure — returns the patch, doesn't commit it. Single-target handlers pass it straight to onUpdateElement; group handlers collect one of these per sub-event and commit them all together via onUpdateElements (see this file's own doc comment on why that batching is required). */
  function computeBoxPatch(target: HTMLElement | SVGElement): Partial<SceneElement> {
    const left = parseFloat(target.style.left || "0");
    const top = parseFloat(target.style.top || "0");
    // Fallback only (style.width/height should always be set already, via
    // pxPosition()'s own render or onResize below) — getBoundingClientRect()
    // is post-transform (visual) px, so it must be un-scaled by the current
    // zoom to land back in the artboard's own native coordinate space.
    const rect = target.getBoundingClientRect();
    const boxWidth = parseFloat(target.style.width || "0") || rect.width / zoomRef.current;
    const boxHeight = parseFloat(target.style.height || "0") || rect.height / zoomRef.current;
    return {
      x: (left / NATIVE_WIDTH) * 100,
      y: (top / NATIVE_HEIGHT) * 100,
      width: (boxWidth / NATIVE_WIDTH) * 100,
      height: (boxHeight / NATIVE_HEIGHT) * 100,
    };
  }

  /**
   * Same shape as computeBoxPatch, used specifically for a *resize* gesture
   * end (never drag/rotate) — also switches a text element's `sizing` to
   * `"fixed"` the instant the user manually resizes it via a handle,
   * regardless of which axis or which mode it was in before. Without this,
   * the auto-hug effect above would immediately re-measure on the next
   * render and silently snap whichever axis was still in an auto mode back
   * to its content-derived size, undoing the resize the user just did by
   * hand. Mirrors Figma's own "manually resizing switches Hug to Fixed."
   */
  function computeResizeBoxPatch(target: HTMLElement | SVGElement): Partial<SceneElement> {
    const boxPatch = computeBoxPatch(target);
    const id = idByNodeRef.current.get(target as HTMLDivElement);
    const element = id ? scene.elements.find((el) => el.id === id) : undefined;
    if (element?.type === "text" && (element.sizing ?? "auto-height") !== "fixed") {
      return { ...boxPatch, sizing: "fixed" };
    }
    return boxPatch;
  }

  function computeRotatePatch(target: HTMLElement | SVGElement): Partial<SceneElement> {
    const match = /rotate\(([-\d.]+)deg\)/.exec(target.style.transform || "");
    return { rotation: match ? Math.round(parseFloat(match[1])) : 0 };
  }

  /**
   * Figma-style "move in a straight line" — holding Shift while dragging
   * constrains movement to whichever axis has accumulated more total
   * distance since the drag started (`dist`, not the per-frame `delta`), so
   * the lock naturally follows the gesture's actual direction and stays
   * put even through small off-axis jitter. Recomputed every frame from
   * the *total* dist rather than decided once at drag-start — simpler,
   * and gives the same feel since dist only grows in the true direction of
   * movement.
   */
  function resolveAxisLockedPosition(e: { dist: number[]; left: number; top: number; inputEvent: unknown }): { left: number; top: number } {
    const shiftHeld = !!(e.inputEvent as { shiftKey?: boolean } | null)?.shiftKey;
    if (!shiftHeld) return { left: e.left, top: e.top };
    const [dx, dy] = e.dist;
    const axis: "x" | "y" = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
    return {
      left: axis === "y" ? e.left - dx : e.left,
      top: axis === "x" ? e.top - dy : e.top,
    };
  }

  /** Resolves each group sub-event's DOM node back to a scene element id and builds the batched patch list — shared by the drag/resize/rotate group-end handlers below. */
  function collectGroupPatches<T extends { target: HTMLElement | SVGElement; isDrag: boolean }>(
    events: T[],
    computePatch: (target: HTMLElement | SVGElement) => Partial<SceneElement>,
  ): { id: string; patch: Partial<SceneElement> }[] {
    const patches: { id: string; patch: Partial<SceneElement> }[] = [];
    for (const e of events) {
      if (!e.isDrag) continue;
      const id = idByNodeRef.current.get(e.target as HTMLDivElement);
      if (id) patches.push({ id, patch: computePatch(e.target) });
    }
    return patches;
  }

  const topLevelSelector = topLevel.map((el) => `[data-scene-element-id="${el.id}"]`).join(",") || "[data-scene-element-id-none]";

  // A container's whole box is fully hugged (both axes) — no resize handles
  // at all, only move + rotate. Every other element type — including text,
  // regardless of its current `sizing` mode — shows every handle (sides,
  // top, bottom, corners): manually dragging one is Figma's own "hand-
  // resizing switches Hug to Fixed" gesture, handled in
  // `computeResizeBoxPatch` below rather than by hiding handles for
  // whichever axis happens to be auto-hugged right now.
  const singleSelectedRenderDirections: boolean = singleSelected?.type !== "container";

  /**
   * Recurses into a container's children regardless of whether a child is
   * itself a container — nesting depth is unlimited (see
   * ContainerSceneElement's own doc comment). Only `isTopLevel` changes
   * `positionStyle`/cursor: a top-level element is dragged directly
   * (`pxPosition`, cursor "move"), a nested element is flex-flow-positioned
   * by its parent (cursor "pointer", same as before this became recursive).
   */
  function renderElementTree(element: SceneElement, isTopLevel: boolean) {
    const position = isTopLevel
      ? { ...pxPosition(element), cursor: "move" as const }
      : {
          position: "relative" as const,
          width: element.width,
          height: element.type === "text" ? undefined : element.height,
          transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
          cursor: "pointer" as const,
          opacity: element.opacity ?? 1,
        };
    return (
      <SceneElementView
        key={element.id}
        element={element}
        data={data}
        slideIndex={slideIndex}
        positionStyle={{
          ...position,
          outline: selectedElementIds.includes(element.id) ? "2px solid #2563eb" : "1px dashed rgba(0,0,0,0.25)",
        }}
        onRef={(node) => registerRef(element.id, node)}
        onTextContentRef={(node) => registerTextContentRef(element.id, node)}
        onClick={(e) => {
          e.stopPropagation();
          onSelectElement(element.id, e.shiftKey);
        }}
      >
        {element.type === "container" && (childrenByParent.get(element.id) ?? []).map((child) => renderElementTree(child, false))}
      </SceneElementView>
    );
  }

  return (
    <div
      ref={setViewportEl}
      className="relative h-full w-full overflow-hidden bg-neutral-100"
      onClick={(e) => {
        // Was `e.target === e.currentTarget` — too strict: any click that
        // happens to land on a *descendant* wrapper div (the pan/zoom
        // transform div itself, or one of Selecto's/Moveable's own overlay
        // nodes) failed that exact-identity check even though the user
        // very much clicked empty canvas space, so deselecting often
        // silently did nothing. Deselect on any click that isn't on a
        // scene element or Moveable's own control overlay — the same
        // guard Selecto's own onDragStart below already uses to decide
        // "is this actually empty space."
        if (selectoDraggedRef.current) {
          selectoDraggedRef.current = false;
          return;
        }
        const target = e.target as HTMLElement;
        if (!target.closest("[data-scene-element-id]") && !target.closest('[class*="moveable"]')) {
          onClearSelection();
        }
      }}
    >
      <div
        className="absolute left-0 top-0"
        style={{ transformOrigin: "0 0", transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      >
        <div
          ref={setContainerEl}
          className="relative overflow-hidden rounded-lg border border-neutral-200 shadow-sm"
          style={{ width: NATIVE_WIDTH, height: NATIVE_HEIGHT, backgroundColor: scene.backgroundColor }}
        >
          {topLevel.map((element) => renderElementTree(element, true))}

          {/* Painted last (= on top of every element, even a full-bleed photo) so the margin reference stays visible no matter what the scene contains — purely a visual aid, never part of the actual render output. */}
          {marginPx > 0 && (
            <div
              className="pointer-events-none absolute border border-dashed border-blue-500"
              style={{ left: marginPx, top: marginPx, width: NATIVE_WIDTH - marginPx * 2, height: NATIVE_HEIGHT - marginPx * 2 }}
            />
          )}
        </div>

        {/*
          Moveable renders *inside* this same pan/zoom-transformed wrapper
          (sibling to the artboard, not outside it) — a real bug, found and
          fixed here: rendering it outside left its own overlay (handles,
          selection outline) at a stale screen position whenever the user
          panned/zoomed without also dragging (a "ghost" selection box that
          didn't track the target — reported by the user, reproduced via a
          real pan gesture, confirmed via the actual DOM: the control-box's
          own handle elements stayed frozen in place). Even
          `.updateRect()` (Moveable's own documented fix for "target moved
          without Moveable noticing") didn't help — it still reads its own
          overlay position from a container/target relationship that's only
          valid when both share the same transformed ancestor. Rendering it
          *inside* means the browser's own CSS transform inheritance keeps
          the overlay glued to the target automatically, for every pan/zoom
          frame, with zero extra code — and no `zoom` prop needed either,
          since the ancestor `scale()` already visually resizes the
          handles/lines exactly like it does fontSize/gap/padding (same
          principle as this file's own top doc-comment on `scaleFactor`).
        */}
        {selectedNodes.length > 0 && (
          <Moveable
            ref={moveableRef}
            target={selectedNodes.length > 1 ? selectedNodes : selectedNodes[0]}
            container={containerEl}
            draggable
            resizable
            rotatable
            keepRatio={false}
            // Which dimensions a single selected element may be manually
            // resized on — "auto-hugged" dimensions (kept in sync with
            // content by the effect above, see also TextSceneElement's
            // `sizing` doc comment) never get a handle. A mixed multi-select
            // just shows every handle — there's no single "type" to key off.
            renderDirections={selectedNodes.length > 1 ? true : singleSelectedRenderDirections}
            throttleDrag={0}
            throttleResize={0}
            throttleRotate={0}
            snappable
            snapThreshold={6}
            snapGap={false}
            isDisplaySnapDigit={false}
            verticalGuidelines={verticalGuidelines}
            horizontalGuidelines={horizontalGuidelines}
            elementGuidelines={guideNodes}
            // A hard constraint (not just a snap guide) — dragging/resizing
            // an element can never cross the margin line, so a box pinned
            // near it (see TextSceneElement's own `verticalAnchor` for the
            // auto-hug half of this same problem) can't be dragged past it
            // by hand either. `position:"css"` measures right/bottom as
            // literal css offsets from `container`'s own edges (the artboard
            // root, exactly NATIVE_WIDTH×NATIVE_HEIGHT) — the same
            // reference frame every other position calculation here already
            // uses. `null` (no margin set) leaves dragging fully unconstrained.
            bounds={marginPx > 0 ? { left: marginPx, top: marginPx, right: marginPx, bottom: marginPx, position: "css" } : null}
            onDragStart={(e) => {
              if ((e.inputEvent as { altKey?: boolean } | null)?.altKey) onAltDuplicate(selectedElementIds);
            }}
            onDragGroupStart={(e) => {
              if ((e.inputEvent as { altKey?: boolean } | null)?.altKey) onAltDuplicate(selectedElementIds);
            }}
            onDrag={(e) => {
              const { left, top } = resolveAxisLockedPosition(e);
              e.target.style.left = `${left}px`;
              e.target.style.top = `${top}px`;
            }}
            onDragEnd={({ target, isDrag }) => {
              const id = idByNodeRef.current.get(target as HTMLDivElement);
              if (isDrag && id) onUpdateElement(id, computeBoxPatch(target));
            }}
            onDragGroup={(e) => {
              // The axis lock is decided once from the *group* gesture's own
              // total dist (not each sub-target's own), then applied
              // identically to every target — otherwise a rotated/offset
              // target's individual dist could disagree with the group's
              // overall drag direction and lock a different axis per element.
              const shiftHeld = !!(e.inputEvent as { shiftKey?: boolean } | null)?.shiftKey;
              const [groupDx, groupDy] = e.dist;
              const axis: "x" | "y" | null = !shiftHeld ? null : Math.abs(groupDx) >= Math.abs(groupDy) ? "x" : "y";
              for (const sub of e.events) {
                const [dx, dy] = sub.dist;
                sub.target.style.left = `${axis === "y" ? sub.left - dx : sub.left}px`;
                sub.target.style.top = `${axis === "x" ? sub.top - dy : sub.top}px`;
              }
            }}
            onDragGroupEnd={({ events }) => {
              const patches = collectGroupPatches(events, computeBoxPatch);
              if (patches.length > 0) onUpdateElements(patches);
            }}
            onResize={({ target, width: w, height: h, drag }) => {
              target.style.width = `${w}px`;
              target.style.height = `${h}px`;
              target.style.left = `${drag.left}px`;
              target.style.top = `${drag.top}px`;
            }}
            onResizeEnd={({ target, isDrag }) => {
              const id = idByNodeRef.current.get(target as HTMLDivElement);
              if (isDrag && id) onUpdateElement(id, computeResizeBoxPatch(target));
            }}
            onResizeGroup={({ events }) => {
              for (const e of events) {
                e.target.style.width = `${e.width}px`;
                e.target.style.height = `${e.height}px`;
                e.target.style.left = `${e.drag.left}px`;
                e.target.style.top = `${e.drag.top}px`;
              }
            }}
            onResizeGroupEnd={({ events }) => {
              const patches = collectGroupPatches(events, computeResizeBoxPatch);
              if (patches.length > 0) onUpdateElements(patches);
            }}
            onRotate={({ target, rotate }) => {
              target.style.transform = `rotate(${rotate}deg)`;
            }}
            onRotateEnd={({ target, isDrag }) => {
              const id = idByNodeRef.current.get(target as HTMLDivElement);
              if (isDrag && id) onUpdateElement(id, computeRotatePatch(target));
            }}
            onRotateGroup={({ events }) => {
              for (const e of events) {
                e.target.style.transform = `rotate(${e.rotate}deg)`;
              }
            }}
            onRotateGroupEnd={({ events }) => {
              const patches = collectGroupPatches(events, computeRotatePatch);
              if (patches.length > 0) onUpdateElements(patches);
            }}
          />
        )}
      </div>

      {viewportEl && (
        <Selecto
          container={viewportEl}
          selectableTargets={[topLevelSelector]}
          hitRate={0}
          toggleContinueSelect={[["shift"]]}
          onDragStart={(e) => {
            const target = e.inputEvent.target as HTMLElement;
            // Don't start a marquee-drag if the gesture began on an element
            // itself or on Moveable's own overlay — those are handled by
            // Moveable's draggable/resizable/rotatable above instead.
            if (target.closest("[data-scene-element-id]") || target.closest('[class*="moveable"]')) e.stop();
          }}
          onDragEnd={(e) => {
            selectoDraggedRef.current = e.isDrag;
          }}
          onSelect={(e) => {
            const ids = e.selected
              .map((el) => el.getAttribute("data-scene-element-id"))
              .filter((id): id is string => !!id);
            onSelectMany(ids);
          }}
        />
      )}
    </div>
  );
}
