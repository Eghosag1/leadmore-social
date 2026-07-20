"use client";

import { ArrowDown, ArrowUp, Trash2, Image as ImageIcon, Type, Square, Building2, Rows3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { groupElementsByParent } from "@/lib/scene/resolveScene";
import { cn } from "@/lib/utils";
import type { SceneElement } from "@/types/scene";

const TYPE_ICON: Record<SceneElement["type"], typeof Type> = { text: Type, shape: Square, photo: ImageIcon, logo: Building2, container: Rows3 };
const TYPE_LABEL: Record<SceneElement["type"], string> = { text: "Tekst", shape: "Vorm", photo: "Foto", logo: "Logo", container: "Container" };

function elementLabel(element: SceneElement): string {
  if (element.type === "text") {
    return element.content.mode === "literal" ? element.content.value || "Tekst" : `Veld: ${element.content.field}`;
  }
  return TYPE_LABEL[element.type];
}

function LayerRow({
  element,
  depth,
  isSelected,
  onSelect,
  onReorder,
  onDelete,
  canMoveUp,
  canMoveDown,
}: {
  element: SceneElement;
  /** Nesting depth (0 = top-level) — indents this row and, recursively, its own children one step further. Unlimited since a container may itself be a container's child, see ContainerSceneElement's own doc comment. */
  depth: number;
  isSelected: boolean;
  onSelect: (id: string, shiftKey: boolean) => void;
  onReorder: (id: string, direction: "up" | "down") => void;
  onDelete: (id: string) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const Icon = TYPE_ICON[element.type];
  return (
    <li
      // Purely a hook for Puppeteer/e2e verification to select a specific
      // layer row (esp. a container — clicking a tightly content-hugging
      // container on the canvas itself almost always hits its child
      // instead) via a DOM query instead of fragile canvas coordinates —
      // never read by application code itself. Deliberately a *different*
      // attribute name than the canvas's own `data-scene-element-id`
      // (SceneRenderer.tsx's `elementDataAttr`) — reusing that name would
      // make `document.querySelector('[data-scene-element-id="X"]')`
      // ambiguously match whichever of the two (this row or the canvas
      // element) happens to come first in the DOM.
      data-layer-element-id={element.id}
      className={cn(
        "flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs",
        depth > 0 && "border-l-2 border-l-neutral-200",
        isSelected ? "border-neutral-900 bg-neutral-50" : "border-transparent hover:bg-neutral-50",
      )}
      style={depth > 0 ? { marginLeft: depth * 16 } : undefined}
    >
      <button
        type="button"
        onClick={(e) => onSelect(element.id, e.shiftKey)}
        className="flex flex-1 items-center gap-2 overflow-hidden text-left"
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{elementLabel(element)}</span>
      </button>
      <Button type="button" size="icon-sm" variant="ghost" disabled={!canMoveUp} onClick={() => onReorder(element.id, "up")} aria-label="Naar voor">
        <ArrowUp className="h-3 w-3" />
      </Button>
      <Button type="button" size="icon-sm" variant="ghost" disabled={!canMoveDown} onClick={() => onReorder(element.id, "down")} aria-label="Naar achter">
        <ArrowDown className="h-3 w-3" />
      </Button>
      <Button type="button" size="icon-sm" variant="ghost" onClick={() => onDelete(element.id)} aria-label="Verwijderen">
        <Trash2 className="h-3 w-3 text-destructive" />
      </Button>
    </li>
  );
}

/**
 * `elements` array order = paint order = layer order (later = on top, see
 * Scene's own doc comment) — but a layers panel conventionally lists the
 * frontmost layer first, so entries display reversed at every depth. A
 * container's children are shown indented directly below it, recursively —
 * a child may itself be a container with its own children (see
 * ContainerSceneElement's own doc comment), nesting depth is unlimited.
 * Reordering ("Naar voor"/"Naar achter") is scoped to siblings — a child
 * only ever swaps with another child of the *same* container, a top-level
 * element only with another top-level element — see SceneEditor.tsx's
 * reorderElement, which does the actual array-index swap this only signals.
 */
export function LayerList({
  elements,
  selectedElementIds,
  onSelect,
  onReorder,
  onDelete,
}: {
  elements: SceneElement[];
  selectedElementIds: string[];
  onSelect: (id: string, shiftKey: boolean) => void;
  onReorder: (id: string, direction: "up" | "down") => void;
  onDelete: (id: string) => void;
}) {
  if (elements.length === 0) {
    return <p className="text-xs text-muted-foreground">Nog geen elementen — voeg er een toe via de werktuigenbalk.</p>;
  }

  const { topLevel, childrenByParent } = groupElementsByParent(elements);

  function renderRows(siblings: SceneElement[], depth: number) {
    const reversed = [...siblings].reverse();
    return reversed.map((element) => {
      const children = childrenByParent.get(element.id) ?? [];
      return (
        <div key={element.id}>
          <LayerRow
            element={element}
            depth={depth}
            isSelected={selectedElementIds.includes(element.id)}
            onSelect={onSelect}
            onReorder={onReorder}
            onDelete={onDelete}
            canMoveUp={siblings.indexOf(element) < siblings.length - 1}
            canMoveDown={siblings.indexOf(element) > 0}
          />
          {children.length > 0 && <ul className="mt-1 flex flex-col gap-1">{renderRows(children, depth + 1)}</ul>}
        </div>
      );
    });
  }

  return <ul className="flex flex-col gap-1">{renderRows(topLevel, 0)}</ul>;
}
