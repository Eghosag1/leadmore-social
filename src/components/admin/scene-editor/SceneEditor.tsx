"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, Copy, Minus, Plus, Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { cloneElements, createContainerElement, createEmptyScene, newElementId } from "@/lib/scene/elementDefaults";
import { getBoundingBox, inferLayoutDirection } from "@/lib/scene/geometry";
import { alignElements, distributeElements, type AlignMode } from "@/lib/scene/alignDistribute";
import { getDescendantIds, groupElementsByParent } from "@/lib/scene/resolveScene";
import { toParentedUnits, toTopLevelUnits } from "@/lib/scene/unitConversion";
import { SceneEditorCanvas } from "./SceneEditorCanvas";
import { ElementToolbox } from "./ElementToolbox";
import { LayerList } from "./LayerList";
import { PropertyPanel } from "./PropertyPanel";
import { MultiSelectionPanel } from "./MultiSelectionPanel";
import { saveTemplateScenesAction } from "@/app/admin/agencies/[id]/templates/scene-actions";
import { validateAgencyTemplateAction } from "@/app/admin/agencies/[id]/templates/actions";
import type { AgencyFontRow } from "@/types/database";
import type { CanvasFormat, TemplateStatus } from "@/types/enums";
import type { TemplateRenderProps } from "@/types/domain";
import {
  CANVAS_FORMAT_DIMENSIONS,
  EMPTY_TEMPLATE_SCENES,
  type Scene,
  type SceneElement,
  type ScenesByFormat,
  type TemplateScenes,
} from "@/types/scene";

const FORMATS: CanvasFormat[] = ["portrait", "square", "landscape"];

const ROLES = [
  { role: "cover" as const, label: "Cover (1e slide)", slideIndex: 0 },
  { role: "content" as const, label: "Inhoud (tussenliggende slides)", slideIndex: 1 },
  { role: "end" as const, label: "Eind (vaste afsluiter, geen foto)", slideIndex: 2 },
];

// Rapid-fire changes from the same UI control (typing in the text field,
// dragging a color/range input) collapse into one undo step instead of one
// per keystroke/tick — otherwise Cmd+Z would feel like it does almost
// nothing. A discrete gesture (add/delete/reorder/toggle a scene, or a full
// drag/resize/rotate on the canvas) always gets its own step regardless.
const COALESCE_WINDOW_MS = 700;
/** Arrow-key nudge distances, in native px at the 1080-wide canvas. */
const NUDGE_STEP = 1;
const NUDGE_STEP_LARGE = 10;

function hasAnyScene(scenes: TemplateScenes | undefined): boolean {
  return !!scenes && (!!scenes.cover || !!scenes.content || !!scenes.end);
}

export function SceneEditor({
  agencyId,
  templateId,
  templateStatus,
  validationError,
  initialScenesByFormat,
  previewData,
  fonts,
}: {
  agencyId: string;
  templateId: string;
  templateStatus: TemplateStatus;
  validationError: string | null;
  initialScenesByFormat: ScenesByFormat;
  previewData: TemplateRenderProps;
  fonts: Pick<AgencyFontRow, "id" | "label" | "font_family" | "font_url">[];
}) {
  const [scenesByFormat, setScenesByFormat] = useState<ScenesByFormat>(initialScenesByFormat);
  const [activeFormat, setActiveFormat] = useState<CanvasFormat>(() => FORMATS.find((f) => hasAnyScene(initialScenesByFormat[f])) ?? "portrait");
  const [activeRole, setActiveRole] = useState<"cover" | "content" | "end">(() => {
    const scenes = initialScenesByFormat[FORMATS.find((f) => hasAnyScene(initialScenesByFormat[f])) ?? "portrait"];
    return scenes?.cover ? "cover" : scenes?.content ? "content" : scenes?.end ? "end" : "cover";
  });
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  // Lifted here (not local to SceneEditorCanvas) so the top toolbar can show
  // a live % readout and +/- buttons. Pan stays local to the canvas — the
  // toolbar never needs to read/set it directly.
  const [zoom, setZoom] = useState(1);
  const [fitToken, setFitToken] = useState(0);
  const [isSaving, startSaving] = useTransition();
  const [isValidating, startValidating] = useTransition();
  const [lastValidationError, setLastValidationError] = useState(validationError);
  const [lastStatus, setLastStatus] = useState(templateStatus);

  const undoStack = useRef<ScenesByFormat[]>([]);
  const redoStack = useRef<ScenesByFormat[]>([]);
  const coalesceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  // Same-tab-only clipboard for Cmd+C/Cmd+V — not the OS clipboard, avoids
  // async Clipboard API permission complexity for what's purely an
  // in-session convenience. Holds a raw snapshot (not yet re-id'd); every
  // paste re-clones it fresh via cloneElements() so pasting twice never
  // collides on ids.
  const clipboardRef = useRef<SceneElement[] | null>(null);

  const activeFormatScenes = scenesByFormat[activeFormat] ?? EMPTY_TEMPLATE_SCENES;
  const activeScene = activeFormatScenes[activeRole];
  const activeRoleMeta = ROLES.find((r) => r.role === activeRole)!;
  const slideIndex = Math.min(activeRoleMeta.slideIndex, Math.max(previewData.images.length - 1, 0));
  const selectedElements = activeScene?.elements.filter((el) => selectedElementIds.includes(el.id)) ?? [];
  const singleSelectedElement = selectedElements.length === 1 ? selectedElements[0] : null;
  const hasPhoto = activeScene?.elements.some((el) => el.type === "photo") ?? true;

  function commitScenes(next: ScenesByFormat, opts?: { coalesce?: boolean; skipHistory?: boolean }) {
    // skipHistory: for derived/computed corrections (e.g. the auto-height
    // text measurement in SceneEditorCanvas.tsx) — not a user action, so it
    // shouldn't consume an undo step or show up as something to undo.
    if (opts?.skipHistory) {
      setScenesByFormat(next);
      return;
    }
    const coalescing = !!opts?.coalesce && coalesceTimer.current !== null;
    if (!coalescing) {
      undoStack.current.push(scenesByFormat);
      redoStack.current = [];
      setCanUndo(true);
      setCanRedo(false);
    }
    if (opts?.coalesce) {
      if (coalesceTimer.current) clearTimeout(coalesceTimer.current);
      coalesceTimer.current = setTimeout(() => {
        coalesceTimer.current = null;
      }, COALESCE_WINDOW_MS);
    }
    setScenesByFormat(next);
  }

  function undo() {
    const prev = undoStack.current.pop();
    if (prev === undefined) return;
    redoStack.current.push(scenesByFormat);
    setScenesByFormat(prev);
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(true);
    setSelectedElementIds([]);
  }

  function redo() {
    const next = redoStack.current.pop();
    if (next === undefined) return;
    undoStack.current.push(scenesByFormat);
    setScenesByFormat(next);
    setCanRedo(redoStack.current.length > 0);
    setCanUndo(true);
    setSelectedElementIds([]);
  }

  function updateActiveScene(patch: Partial<Scene>, opts?: { coalesce?: boolean; skipHistory?: boolean }) {
    const currentScene = activeFormatScenes[activeRole];
    if (!currentScene) return;
    commitScenes(
      { ...scenesByFormat, [activeFormat]: { ...activeFormatScenes, [activeRole]: { ...currentScene, ...patch } } },
      opts,
    );
  }

  function toggleRole(enabled: boolean) {
    setSelectedElementIds([]);
    if (enabled) {
      // Turning a role on cascades to every format at once — additive
      // only, never overwrites a format that already has this role
      // designed. Makes "turn on Cover" a one-click way to make the role
      // available everywhere, instead of having to flip to each format
      // tab and toggle it on individually before you can start designing.
      // Turning off is deliberately NOT symmetric — it only clears the
      // currently-active format, since cascading a destructive action
      // across formats you aren't even looking at risks silently deleting
      // work designed elsewhere.
      const next: ScenesByFormat = { ...scenesByFormat };
      for (const format of FORMATS) {
        const formatScenes = next[format] ?? EMPTY_TEMPLATE_SCENES;
        if (!formatScenes[activeRole]) {
          next[format] = { ...formatScenes, [activeRole]: createEmptyScene() };
        }
      }
      commitScenes(next);
    } else {
      commitScenes({
        ...scenesByFormat,
        [activeFormat]: { ...activeFormatScenes, [activeRole]: null },
      });
    }
  }

  /**
   * Explicit, on-demand replication of the *current* scene (elements,
   * background, margin) into every other format for this same role —
   * unlike `toggleRole`'s automatic cascade (which only ever creates an
   * empty scene shell so each format can be designed independently), this
   * is the "give me a head start" action for actually populating the other
   * formats with the same layout, so the admin doesn't have to recreate
   * every element by hand per format. Safe to copy as-is with zero unit
   * conversion: a top-level element's x/y/width/height are already %-of-
   * that-format's-own-canvas (format-agnostic by construction — see
   * SceneElementBase's own doc comment), and a parented element's are
   * literal native px (also format-agnostic, same convention as fontSize).
   * Fresh ids per format/element (same reasoning as `addElement`'s
   * cascade) so each format's copy is independently editable afterward.
   * Unlike `toggleRole`, this DOES overwrite whatever's already designed in
   * the other formats for this role — confirmed via a dialog, since it's a
   * bigger blast radius than any other single action here (though still
   * one Cmd+Z away like everything else in this editor).
   */
  function copySceneToOtherFormats() {
    if (!activeScene) return;
    const next: ScenesByFormat = { ...scenesByFormat };
    for (const format of FORMATS) {
      if (format === activeFormat) continue;
      const formatScenes = next[format] ?? EMPTY_TEMPLATE_SCENES;
      // A fresh id map per target format — each format's copy stays fully
      // independent of both the source and every other format's copy.
      const idMap = new Map<string, string>();
      for (const el of activeScene.elements) idMap.set(el.id, newElementId());
      const elements = activeScene.elements.map(
        (el) => ({ ...el, id: idMap.get(el.id)!, parentId: el.parentId ? idMap.get(el.parentId) : undefined }) as SceneElement,
      );
      next[format] = {
        ...formatScenes,
        [activeRole]: { backgroundColor: activeScene.backgroundColor, marginGuide: activeScene.marginGuide, elements },
      };
    }
    commitScenes(next);
    toast.success("Scène gekopieerd naar de andere formaten.");
  }

  function addElements(newElements: SceneElement[]) {
    if (!activeScene) return;
    updateActiveScene({ elements: [...activeScene.elements, ...newElements] });
    // Only top-level roots become selected — children (e.g. of a duplicated
    // container) were never independently selectable to begin with.
    setSelectedElementIds(newElements.filter((el) => !el.parentId).map((el) => el.id));
  }

  /**
   * Only used by ElementToolbox's "add a new element" buttons — cascades a
   * fresh copy of the new element into the same *role*'s scene across
   * every format that already has it enabled (fresh id per format, so
   * each format's copy is independently editable afterward, exactly like
   * every format's Scene already is its own independent object — see
   * ScenesByFormat's own doc comment). Saves having to recreate the same
   * element 3 times by hand across Portret/Vierkant/Landschap.
   *
   * Duplicate (Cmd+D) and paste (Cmd+V) deliberately do NOT cascade — see
   * `addElements` below, which they use instead — those are format-
   * specific refinements of an already-existing design, not "start a
   * brand new element everywhere."
   */
  function addElement(element: SceneElement) {
    if (!activeScene) return;
    const next: ScenesByFormat = { ...scenesByFormat };
    for (const format of FORMATS) {
      const formatScenes = next[format];
      const targetScene = formatScenes?.[activeRole];
      if (!targetScene) continue; // this role isn't enabled for this format — nothing to add to.
      const clone = format === activeFormat ? element : { ...element, id: newElementId() };
      next[format] = { ...formatScenes, [activeRole]: { ...targetScene, elements: [...targetScene.elements, clone] } };
    }
    commitScenes(next);
    setSelectedElementIds([element.id]);
  }

  /**
   * Alt/Option-drag-to-duplicate (SceneEditorCanvas.tsx's `onAltDuplicate`,
   * fired from `onDragStart`/`onDragGroupStart`): creates zero-offset
   * clones sitting exactly on top of `ids`, but — unlike `addElements` —
   * deliberately does NOT change `selectedElementIds`. The live Moveable
   * gesture that's about to run is still bound to the *original* elements'
   * DOM nodes; reassigning selection here would swap Moveable's `target`
   * mid-gesture, which is exactly the kind of retargeting react-moveable
   * doesn't reliably support. Instead the original keeps being dragged as
   * normal for the rest of the gesture, and the freshly-created clone is
   * left behind, quietly identical, at the start position — visually and
   * functionally indistinguishable from "the copy stayed behind, you're
   * now dragging the original," which is all that actually matters to the
   * user.
   */
  function duplicateInPlace(ids: string[]) {
    if (!activeScene || ids.length === 0) return;
    const clones = cloneElements(activeScene.elements, ids, 0);
    updateActiveScene({ elements: [...activeScene.elements, ...clones] });
  }

  function updateElements(patches: { id: string; patch: Partial<SceneElement> }[], opts?: { coalesce?: boolean; skipHistory?: boolean }) {
    if (!activeScene || patches.length === 0) return;
    const patchById = new Map(patches.map((p) => [p.id, p.patch]));
    updateActiveScene(
      { elements: activeScene.elements.map((el) => (patchById.has(el.id) ? ({ ...el, ...patchById.get(el.id) } as SceneElement) : el)) },
      opts,
    );
  }

  function updateElement(id: string, patch: Partial<SceneElement>, opts?: { coalesce?: boolean; skipHistory?: boolean }) {
    updateElements([{ id, patch }], opts);
  }

  function deleteElements(ids: string[]) {
    if (!activeScene || ids.length === 0) return;
    const idSet = new Set(ids);
    const elementsById = new Map(activeScene.elements.map((el) => [el.id, el]));
    // Deleting a container orphans its children to the nearest *surviving*
    // ancestor rather than cascading the delete — losing a whole group of
    // carefully-placed elements because their container got removed would
    // be a nasty surprise, and "un-parented" is always a safe, recoverable
    // state (same as never having been assigned to a container). Since
    // containers can now nest (see ContainerSceneElement's own doc comment),
    // that "nearest surviving ancestor" isn't necessarily top-level — a
    // child of a *nested* container whose immediate parent is deleted moves
    // up to that container's own parent (which might itself be another
    // surviving container), walking further up only if the whole chain is
    // being deleted at once (e.g. a multi-select that includes both a
    // container and its parent). Only the final landing on top-level needs
    // a px→% conversion (see unitConversion.ts) — reparenting from one
    // still-parented container to another keeps px as px throughout, since
    // that's the same unit regardless of nesting depth.
    function nearestSurvivingParentId(startParentId: string): string | undefined {
      let current: string | undefined = startParentId;
      while (current && idSet.has(current)) {
        current = elementsById.get(current)?.parentId;
      }
      return current;
    }
    updateActiveScene({
      elements: activeScene.elements
        .filter((el) => !idSet.has(el.id))
        .map((el) => {
          if (!el.parentId || !idSet.has(el.parentId)) return el;
          const newParentId = nearestSurvivingParentId(el.parentId);
          return newParentId ? { ...el, parentId: newParentId } : { ...toTopLevelUnits(el, activeFormat), parentId: undefined };
        }),
    });
    setSelectedElementIds((prev) => prev.filter((id) => !idSet.has(id)));
  }

  function deleteElement(id: string) {
    deleteElements([id]);
  }

  /** Swaps `id` with its neighboring *sibling* (same parentId, i.e. same container or both top-level) one step toward the front ("up") or back ("down") — never crosses into a different container's children or between a child and a top-level element. */
  function reorderElement(id: string, direction: "up" | "down") {
    if (!activeScene) return;
    const element = activeScene.elements.find((el) => el.id === id);
    if (!element) return;
    const siblings = activeScene.elements.filter((el) => el.parentId === element.parentId);
    const siblingIndex = siblings.indexOf(element);
    const swapWith = direction === "up" ? siblings[siblingIndex + 1] : siblings[siblingIndex - 1];
    if (!swapWith) return;
    const elements = [...activeScene.elements];
    const i = elements.indexOf(element);
    const j = elements.indexOf(swapWith);
    [elements[i], elements[j]] = [elements[j], elements[i]];
    updateActiveScene({ elements });
  }

  // --- Selection ---

  function selectElement(id: string, shiftKey: boolean) {
    setSelectedElementIds((prev) => {
      if (!shiftKey) return [id];
      return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    });
  }

  function clearSelection() {
    setSelectedElementIds([]);
  }

  function selectAllTopLevel() {
    if (!activeScene) return;
    setSelectedElementIds(activeScene.elements.filter((el) => !el.parentId).map((el) => el.id));
  }

  // --- Duplicate / copy / paste ---

  function duplicateSelection() {
    if (!activeScene || selectedElementIds.length === 0) return;
    addElements(cloneElements(activeScene.elements, selectedElementIds));
  }

  function copySelection() {
    if (!activeScene || selectedElementIds.length === 0) return;
    const { topLevel } = groupElementsByParent(activeScene.elements);
    const roots = topLevel.filter((el) => selectedElementIds.includes(el.id));
    // Any depth — a copied container's own nested containers (and their
    // children) must come along too, see getDescendantIds/ContainerSceneElement.
    const subtreeIds = new Set<string>(roots.map((el) => el.id));
    for (const root of roots) for (const id of getDescendantIds(activeScene.elements, root.id)) subtreeIds.add(id);
    clipboardRef.current = activeScene.elements.filter((el) => subtreeIds.has(el.id));
  }

  function pasteClipboard() {
    const clipboard = clipboardRef.current;
    if (!activeScene || !clipboard || clipboard.length === 0) return;
    const rootIds = clipboard.filter((el) => !el.parentId).map((el) => el.id);
    addElements(cloneElements(clipboard, rootIds));
  }

  // --- Nudge (arrow keys) ---

  function nudgeSelection(dxNative: number, dyNative: number) {
    if (!activeScene || selectedElementIds.length === 0) return;
    const { width: NATIVE_WIDTH, height: NATIVE_HEIGHT } = CANVAS_FORMAT_DIMENSIONS[activeFormat];
    const patches = selectedElements
      .filter((el) => !el.parentId) // only top-level elements have a meaningful, independently-nudgeable position
      .map((el) => ({ id: el.id, patch: { x: el.x + (dxNative / NATIVE_WIDTH) * 100, y: el.y + (dyNative / NATIVE_HEIGHT) * 100 } }));
    updateElements(patches, { coalesce: true });
  }

  // --- Shift+A: wrap the selection in a new auto-layout container ---

  /**
   * Every selected top-level element — including an already-existing
   * container — becomes a direct child of a freshly created wrapper
   * container, genuinely nested (see ContainerSceneElement's own doc
   * comment: nesting depth is unlimited, `groupElementsByParent` and both
   * render paths already recurse). A selected container keeps its own
   * direction/gap/padding/backgroundColor completely untouched — only its
   * position/parentId change, exactly like any other reparented element
   * (`toParentedUnits`, %-of-canvas → px). Earlier this flattened/discarded
   * any selected container instead of nesting it, because nesting wasn't
   * supported yet anywhere in the render path — now that it is, there's no
   * reason to lose the inner container's own styling.
   */
  function wrapSelectionInContainer() {
    if (!activeScene) return;
    const selectedTopLevel = selectedElements.filter((el) => !el.parentId);
    if (selectedTopLevel.length === 0) {
      addElement(createContainerElement());
      return;
    }
    const box = getBoundingBox(selectedTopLevel, activeFormat);
    const { width: NATIVE_WIDTH, height: NATIVE_HEIGHT } = CANVAS_FORMAT_DIMENSIONS[activeFormat];
    const container = {
      ...createContainerElement(),
      x: (box.left / NATIVE_WIDTH) * 100,
      y: (box.top / NATIVE_HEIGHT) * 100,
      width: (box.width / NATIVE_WIDTH) * 100,
      height: (box.height / NATIVE_HEIGHT) * 100,
      direction: inferLayoutDirection(selectedTopLevel, activeFormat),
    };
    const reparented: SceneElement[] = selectedTopLevel.map(
      (el) => ({ ...toParentedUnits(el, activeFormat), parentId: container.id }) as SceneElement,
    );
    const reparentedIds = new Set(reparented.map((el) => el.id));
    updateActiveScene({
      elements: [...activeScene.elements.filter((el) => !reparentedIds.has(el.id)), container, ...reparented],
    });
    setSelectedElementIds([container.id]);
  }

  // --- Align / distribute (top-level elements only — a uniform %-of-canvas
  // coordinate space, no mixed-unit concerns with container children) ---

  function alignSelection(mode: AlignMode) {
    const selected = selectedElements.filter((el) => !el.parentId);
    updateElements(alignElements(selected, activeFormat, mode));
  }

  function distributeSelection(axis: "horizontal" | "vertical") {
    const selected = selectedElements.filter((el) => !el.parentId);
    updateElements(distributeElements(selected, activeFormat, axis));
  }

  // Keyboard shortcuts need the *latest* state/actions on every keypress,
  // but the listener itself should only attach once — a ref mirror,
  // refreshed via its own effect (deps-less, so it reruns after every
  // render but never during render itself), lets the listener-attaching
  // effect stay at `[]` deps instead of re-subscribing on every keystroke.
  const actionsRef = useRef({
    undo,
    redo,
    deleteElements,
    duplicateSelection,
    copySelection,
    pasteClipboard,
    nudgeSelection,
    selectAllTopLevel,
    clearSelection,
    wrapSelectionInContainer,
    getSelectedIds: () => selectedElementIds,
  });
  useEffect(() => {
    actionsRef.current = {
      undo,
      redo,
      deleteElements,
      duplicateSelection,
      copySelection,
      pasteClipboard,
      nudgeSelection,
      selectAllTopLevel,
      clearSelection,
      wrapSelectionInContainer,
      getSelectedIds: () => selectedElementIds,
    };
  });

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      // Let native text-field editing (typing, its own undo, arrow keys to
      // move the caret) work as usual — only intercept shortcuts when focus
      // is on the canvas itself or nothing in particular.
      const isEditableTarget = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (isEditableTarget) return;
      const actions = actionsRef.current;
      const meta = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (meta && key === "z") {
        e.preventDefault();
        if (e.shiftKey) actions.redo();
        else actions.undo();
        return;
      }
      if (meta && key === "d") {
        e.preventDefault();
        actions.duplicateSelection();
        return;
      }
      if (meta && key === "c") {
        e.preventDefault();
        actions.copySelection();
        return;
      }
      if (meta && key === "v") {
        e.preventDefault();
        actions.pasteClipboard();
        return;
      }
      if (meta && key === "a") {
        e.preventDefault();
        actions.selectAllTopLevel();
        return;
      }
      if (!meta && e.shiftKey && key === "a") {
        e.preventDefault();
        actions.wrapSelectionInContainer();
        return;
      }
      if (!meta && (key === "delete" || key === "backspace")) {
        const ids = actions.getSelectedIds();
        if (ids.length === 0) return;
        e.preventDefault();
        actions.deleteElements(ids);
        return;
      }
      if (!meta && key === "escape") {
        actions.clearSelection();
        return;
      }
      if (!meta && ["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key)) {
        if (actions.getSelectedIds().length === 0) return;
        e.preventDefault();
        const step = e.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP;
        const dx = key === "arrowleft" ? -step : key === "arrowright" ? step : 0;
        const dy = key === "arrowup" ? -step : key === "arrowdown" ? step : 0;
        actions.nudgeSelection(dx, dy);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function handleSave() {
    startSaving(async () => {
      const result = await saveTemplateScenesAction(agencyId, templateId, scenesByFormat);
      if (result.ok) {
        toast.success("Concept opgeslagen.");
        setLastStatus("draft");
      } else {
        toast.error(result.error ?? "Opslaan mislukt.");
      }
    });
  }

  function handleValidate() {
    startValidating(async () => {
      const saveResult = await saveTemplateScenesAction(agencyId, templateId, scenesByFormat);
      if (!saveResult.ok) {
        toast.error(saveResult.error ?? "Opslaan mislukt — validatie overgeslagen.");
        return;
      }
      const result = await validateAgencyTemplateAction(agencyId, templateId);
      setLastValidationError(result.error ?? null);
      setLastStatus(result.ok ? "published" : "failed");
      if (result.ok) toast.success("Gevalideerd en gepubliceerd.");
      else toast.error("Validatie mislukt — zie de foutmelding hieronder.");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Top toolbar: format/role pills, undo/redo, zoom, scene-enabled toggle — a persistent strip above the canvas, Figma-style, instead of chrome squeezed next to the artboard. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 p-1 text-sm">
            {FORMATS.map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => {
                  setActiveFormat(format);
                  setSelectedElementIds([]);
                }}
                className={cn(
                  "rounded-full px-3 py-1.5 font-medium transition-colors",
                  activeFormat === format ? "bg-white text-neutral-900 shadow-sm" : "text-muted-foreground",
                  hasAnyScene(scenesByFormat[format]) && "underline decoration-2 underline-offset-4",
                )}
              >
                {CANVAS_FORMAT_DIMENSIONS[format].label} ({CANVAS_FORMAT_DIMENSIONS[format].ratioLabel})
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 p-1 text-sm">
            {ROLES.map(({ role, label }) => (
              <button
                key={role}
                type="button"
                onClick={() => {
                  setActiveRole(role);
                  setSelectedElementIds([]);
                }}
                className={cn(
                  "rounded-full px-3 py-1.5 font-medium transition-colors",
                  activeRole === role ? "bg-white text-neutral-900 shadow-sm" : "text-muted-foreground",
                  activeFormatScenes[role] && "underline decoration-2 underline-offset-4",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Button type="button" size="icon-sm" variant="outline" disabled={!canUndo} onClick={undo} aria-label="Terug (Cmd/Ctrl+Z)">
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon-sm" variant="outline" disabled={!canRedo} onClick={redo} aria-label="Opnieuw (Cmd/Ctrl+Shift+Z)">
              <Redo2 className="h-4 w-4" />
            </Button>
          </div>
          {activeScene && (
            <div className="flex items-center gap-1">
              <Button type="button" size="icon-sm" variant="outline" onClick={() => setZoom((z) => Math.max(0.1, z / 1.2))} aria-label="Uitzoomen">
                <Minus className="h-4 w-4" />
              </Button>
              <button
                type="button"
                onClick={() => setFitToken((t) => t + 1)}
                className="w-12 text-center text-xs text-muted-foreground hover:text-neutral-900"
                title="Klik om te passen in het canvas"
              >
                {Math.round(zoom * 100)}%
              </button>
              <Button type="button" size="icon-sm" variant="outline" onClick={() => setZoom((z) => Math.min(4, z * 1.2))} aria-label="Inzoomen">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Switch checked={!!activeScene} onCheckedChange={toggleRole} />
            <span className="text-sm text-muted-foreground">Deze scène gebruiken</span>
          </div>
        </div>
      </div>

      {!activeScene ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Deze scène is niet ingesteld voor dit formaat — een slide op deze positie toont dan gewoon de kale foto,
            zonder overlay.
          </CardContent>
        </Card>
      ) : (
        <>
          {!hasPhoto && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Deze scène heeft geen foto-element — een post met deze scène toont enkel de achtergrondkleur, geen
                pandfoto. Voeg een &quot;Foto&quot;-element toe als dat niet de bedoeling is.
              </AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-2">
            <ElementToolbox onAdd={addElement} />
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="marginGuide" className="text-xs text-muted-foreground">
                  Marge (px)
                </Label>
                <Input
                  id="marginGuide"
                  type="number"
                  min={0}
                  max={300}
                  value={activeScene.marginGuide ?? 0}
                  onChange={(e) => updateActiveScene({ marginGuide: Number(e.target.value) || 0 }, { coalesce: true })}
                  className="h-8 w-20"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Achtergrond</label>
                <input
                  type="color"
                  value={activeScene.backgroundColor}
                  onChange={(e) => updateActiveScene({ backgroundColor: e.target.value }, { coalesce: true })}
                  className="h-8 w-8 rounded border border-neutral-200 p-0.5"
                />
              </div>
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button type="button" size="sm" variant="outline">
                      <Copy className="h-3.5 w-3.5" />
                      Kopieer naar andere formaten
                    </Button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Deze scène naar de andere formaten kopiëren?</AlertDialogTitle>
                    <AlertDialogDescription>
                      De elementen, achtergrondkleur en marge van deze scène (
                      {CANVAS_FORMAT_DIMENSIONS[activeFormat].label}) vervangen wat er nu voor deze rol staat bij{" "}
                      {FORMATS.filter((f) => f !== activeFormat)
                        .map((f) => CANVAS_FORMAT_DIMENSIONS[f].label)
                        .join(" en ")}
                      . Nog niet opgeslagen? Dan verlies je die andere formaten hun huidige inhoud voor deze rol —
                      met Cmd/Ctrl+Z meteen ongedaan te maken.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuleren</AlertDialogCancel>
                    <AlertDialogAction onClick={copySceneToOtherFormats}>Kopiëren</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* Fixed-height 3-column shell (Figma-style): Lagen | canvas (fills the rest) | Eigenschappen. Height is a viewport fraction rather than intrinsic content size — the canvas is a pan/zoom surface, not flowing content. */}
          <div className="flex h-[70vh] min-h-[520px] gap-3">
            <div className="flex w-60 shrink-0 flex-col gap-2 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Lagen</p>
              <LayerList
                elements={activeScene.elements}
                selectedElementIds={selectedElementIds}
                onSelect={selectElement}
                onReorder={reorderElement}
                onDelete={deleteElement}
              />
            </div>

            <div className="min-w-0 flex-1 overflow-hidden rounded-lg border border-neutral-200">
              <SceneEditorCanvas
                key={`${activeFormat}-${activeRole}`}
                scene={activeScene}
                format={activeFormat}
                data={previewData}
                slideIndex={slideIndex}
                selectedElementIds={selectedElementIds}
                onSelectElement={selectElement}
                onClearSelection={clearSelection}
                onSelectMany={setSelectedElementIds}
                onUpdateElement={updateElement}
                onUpdateElements={updateElements}
                onAltDuplicate={duplicateInPlace}
                zoom={zoom}
                onZoomChange={setZoom}
                fitToken={fitToken}
              />
            </div>

            <div className="w-72 shrink-0 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Eigenschappen</p>
              {singleSelectedElement ? (
                <PropertyPanel
                  element={singleSelectedElement}
                  elements={activeScene.elements}
                  format={activeFormat}
                  fonts={fonts}
                  onChange={(patch) => updateElement(singleSelectedElement.id, patch, { coalesce: true })}
                />
              ) : selectedElements.length > 1 ? (
                <MultiSelectionPanel
                  count={selectedElements.length}
                  onDelete={() => deleteElements(selectedElementIds)}
                  onDuplicate={duplicateSelection}
                  onAlign={alignSelection}
                  onDistribute={distributeSelection}
                />
              ) : (
                <p className="text-xs text-muted-foreground">Selecteer een element om de eigenschappen te bewerken.</p>
              )}
            </div>
          </div>
        </>
      )}

      <div className="flex items-center gap-3 border-t border-neutral-200 pt-4">
        <Button type="button" variant="outline" disabled={isSaving || isValidating} onClick={handleSave}>
          {isSaving ? "Bezig..." : "Opslaan als concept"}
        </Button>
        <Button type="button" disabled={isSaving || isValidating} onClick={handleValidate}>
          {isValidating ? "Bezig..." : "Opslaan, valideren en publiceren"}
        </Button>
        <span className="text-xs text-muted-foreground">Status: {lastStatus}</span>
      </div>
      {lastStatus === "failed" && lastValidationError && <p className="text-xs text-destructive">{lastValidationError}</p>}
    </div>
  );
}
