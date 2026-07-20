// The JSON-driven "scene" template shape — see PLAN_TEMPLATE_EDITOR.md Phase
// C. A Scene is authored visually (the editor, Phase E) and painted at
// render time by one shared component (SceneRenderer, src/templates/scene/)
// as plain absolutely-positioned HTML/CSS — no canvas library on the render
// path, only in the authoring UI. Persisted in
// agency_templates.scenes_by_format (one nullable jsonb column, keyed by
// CanvasFormat — see 0017_scene_canvas_formats.sql).

import type { BindablePropertyField } from "@/lib/field-binding";
import type { CanvasFormat } from "@/types/enums";

export type { CanvasFormat } from "@/types/enums";

/**
 * Pixel dimensions + display labels for each CanvasFormat (src/types/enums.ts).
 * Width is always 1080 (every render/editor canvas in this app is), only the
 * height differs. All three fall inside Instagram's accepted 4:5–1.91:1
 * range (src/lib/canvas-format.ts's CANVAS_MIN_HEIGHT/MAX_HEIGHT), so no new
 * range validation was needed for these specific values.
 */
export const CANVAS_FORMAT_DIMENSIONS: Record<CanvasFormat, { width: number; height: number; label: string; ratioLabel: string }> = {
  portrait: { width: 1080, height: 1350, label: "Portret", ratioLabel: "4:5" },
  square: { width: 1080, height: 1080, label: "Vierkant", ratioLabel: "1:1" },
  landscape: { width: 1080, height: 565, label: "Landschap", ratioLabel: "1.91:1" },
};

interface SceneElementBase {
  /** Stable id (not a DB id — generated client-side, e.g. nanoid), unique within one scene. Used as the React key, the layer-reorder identity, and the key for a per-post text override (see the agencyEditable note below). */
  id: string;
  /** % of that format's own canvas (always 1080 wide; height depends on CanvasFormat), top-left anchored. Each format's Scene is authored independently, so these percentages never need to be compared across formats. Ignored (but still stored/harmless) once `parentId` is set — a container's own auto-layout positions its children instead, see ContainerSceneElement. */
  x: number;
  y: number;
  /**
   * % of canvas width/height for a *top-level* element (no `parentId`).
   * For a *child* of a container, these switch meaning to literal px (at the
   * native 1080-wide canvas, same convention as fontSize) instead of %: a
   * flex child's CSS height can't resolve a percentage against a
   * "hug-sized" (auto-height) container, so px sidesteps that entirely, and
   * reads naturally as "this logo is 60px" regardless of canvas size. A
   * parented TextSceneElement's `height` is additionally ignored at render
   * time altogether — its box is always exactly as tall as the text needs
   * (no explicit height style applied), consistent with the auto-height
   * behavior top-level text already has.
   */
  width: number;
  height: number;
  /** Degrees. A "diamond" is just a rectangle authored with rotation ≈ 45 — no separate shape kind needed at render time. */
  rotation: number;
  /**
   * Id of a ContainerSceneElement this element is a child of — undefined
   * means "top-level", positioned normally by x/y. A parented element is
   * instead laid out by its container's auto-layout (direction/gap/padding),
   * in `scene.elements` array order among its siblings (same array, same
   * paint-order convention as everything else — no separate children array,
   * so reordering/undo/redo all keep working unchanged). Assigned via the
   * editor's PropertyPanel (a dropdown, not drag-and-drop reparenting — see
   * PLAN_TEMPLATE_EDITOR.md's auto-layout follow-up for why that scope was
   * deliberately cut). A container may itself be parented to another
   * container — nesting is unlimited in principle (`groupElementsByParent`
   * buckets purely by direct `parentId`, at any depth); `ContainerAssignment`
   * guards against the one real hazard, reparenting a container into one of
   * its own descendants, which would create a cycle.
   */
  parentId?: string;
  /** 0-1, undefined = 1 (fully opaque). Applies to every element type uniformly — see SceneRenderer.tsx's positionStyle helpers, the one shared place this is read at render time. */
  opacity?: number;
}

export interface TextSceneElement extends SceneElementBase {
  type: "text";
  content: { mode: "literal"; value: string } | { mode: "field"; field: BindablePropertyField };
  /**
   * Default false: the element is 100% fixed by the admin, exactly like
   * price/bedrooms/etc. already are in every existing template — nothing
   * agency-side to configure. Set true to let the agency override this one
   * element per post, the same way title/description already work today
   * (FieldBindingControl) — implies a future post-creation UI change to
   * render one control per agencyEditable element (not built in Phase C,
   * flagged as a later follow-up in PLAN_TEMPLATE_EDITOR.md).
   */
  agencyEditable?: boolean;
  /** agency_fonts.id, or null = app default font. */
  fontId: string | null;
  /** px, at the native 1080-wide canvas. */
  fontSize: number;
  fontWeight: number;
  /** Unitless CSS line-height multiplier (1.2 if undefined — the CSS default). Drives the auto-height box below just as much as fontSize does. */
  lineHeight?: number;
  color: string;
  align: "left" | "center" | "right";
  /**
   * Figma-style text sizing mode — undefined behaves as `"auto-height"`
   * (this field was added after `createTextElement()`'s original default,
   * so existing saved templates without it must keep behaving exactly as
   * before).
   * - `"auto-height"`: width is manually draggable (see SceneEditorCanvas's
   *   `renderDirections`, `["w","e"]` handles only), height is NOT — the
   *   editor keeps it in sync with the *actual* rendered text height
   *   (fontSize × lineHeight × wrapped line count at the current width).
   * - `"auto-width"`: neither dimension is draggable — both width AND
   *   height are kept in sync with the text's natural, unwrapped
   *   single-line size (`white-space: nowrap` at render time, see
   *   SceneRenderer.tsx). Exactly Figma's "auto width" text box.
   * - `"fixed"`: both dimensions are manually draggable, no auto-hug at
   *   all — text wraps/clips within whatever box the admin authored.
   *
   * Whichever mode is active, the resulting `width`/`height` are still
   * *persisted* (never computed at render time) so the real render path
   * and any other consumer never needs a live DOM measurement of its own —
   * see SceneEditorCanvas.tsx's measurement effect for how they're kept
   * current while authoring.
   */
  sizing?: "auto-width" | "auto-height" | "fixed";
  /**
   * Which edge stays put when auto-hug changes this element's height (only
   * meaningful for `sizing` `"auto-height"`/`"auto-width"`, ignored for
   * `"fixed"` since that never auto-hugs at all). Undefined behaves as
   * `"top"` — today's original behavior: `y` never moves, so growth always
   * extends downward. Set to `"bottom"` for e.g. a price/title pinned near
   * the bottom margin, so a longer post's extra line pushes the box
   * *upward* (keeping `y + height` constant) instead of past the margin —
   * the concrete case a real user reported. `x`/width work identically
   * already via `sizing: "auto-width"`, no separate horizontal-anchor field
   * exists (not asked for, and this one column-anchor field already covers
   * the reported use case).
   */
  verticalAnchor?: "top" | "bottom";
}

export interface ShapeSceneElement extends SceneElementBase {
  type: "shape";
  shape: "rectangle" | "circle" | "diamond";
  fill: string;
  /** Rectangle only. */
  cornerRadius?: number;
}

export interface PhotoSceneElement extends SceneElementBase {
  type: "photo";
  /** 0-100, object-position-equivalent pan within the frame. */
  focalX: number;
  focalY: number;
  /** >=1, object-fit:cover baseline at 1. */
  zoom: number;
}

/** No extra fields — always renders data.agencyLogo, object-fit:contain. */
export interface LogoSceneElement extends SceneElementBase {
  type: "logo";
}

/**
 * A Figma-style auto-layout frame: arranges its children (other elements
 * with `parentId` set to this container's id) in a row or column with a
 * fixed gap and padding, instead of each child needing its own manually
 * dragged x/y. A child may itself be a container — nesting an auto-layout
 * frame inside another auto-layout frame keeps its own direction/gap/
 * padding/backgroundColor entirely independent of its parent's, exactly like
 * Figma's own nested auto-layout frames.
 *
 * `width`/`height` are NOT independently draggable, same "auto-hug" idea as
 * TextSceneElement's height — the editor measures the actual rendered
 * flex-box size (children + gap + padding) and keeps them in sync. Only
 * position (x/y) and rotation are ever dragged directly; see
 * SceneEditorCanvas.tsx's measurement effect.
 */
export interface ContainerSceneElement extends SceneElementBase {
  type: "container";
  direction: "row" | "column";
  /** px, at the native 1080-wide canvas — same convention as fontSize. */
  gap: number;
  padding: number;
  /** Cross-axis alignment of children (perpendicular to `direction`). */
  align: "start" | "center" | "end";
  /** Undefined/empty = transparent. */
  backgroundColor?: string;
}

export type SceneElement = TextSceneElement | ShapeSceneElement | PhotoSceneElement | LogoSceneElement | ContainerSceneElement;

export interface Scene {
  backgroundColor: string;
  /** Paint order = array order (later = on top) — no separate z-index field, one less thing to get out of sync. The editor's layer list (Phase E) reorders this array directly. */
  elements: SceneElement[];
  /**
   * Editor-only authoring aid: px inset from each canvas edge (at the native
   * 1080-wide canvas — same convention as fontSize/cornerRadius, scaled by
   * scaleFactor for display), shown as a permanent dashed guide in
   * SceneEditorCanvas and fed into Moveable's snap guidelines. A literal px
   * value (not %) so the same margin reads as the same visual inset
   * regardless of this format's height — deliberately NOT read by
   * SceneRenderer or anything on the real render path, it never affects a
   * published post's actual pixels, it's purely "where should new elements
   * tend to line up." Undefined/0 = no margin guide.
   */
  marginGuide?: number;
}

/** The three scene roles a template can independently have, for one specific CanvasFormat. */
export interface TemplateScenes {
  cover: Scene | null;
  content: Scene | null;
  end: Scene | null;
}

/** agency_templates.scenes_by_format — a format key is present only once the admin has actually designed something for it; an absent key behaves exactly like `{cover: null, content: null, end: null}` (nothing designed, every slide falls back to the plain photo). */
export type ScenesByFormat = Partial<Record<CanvasFormat, TemplateScenes>>;

export const EMPTY_TEMPLATE_SCENES: TemplateScenes = { cover: null, content: null, end: null };
