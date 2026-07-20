"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { BINDABLE_FIELD_LABELS, BINDABLE_PROPERTY_FIELDS, MANUAL_SOURCE } from "@/lib/field-binding";
import { getDescendantIds } from "@/lib/scene/resolveScene";
import { toParentedUnits, toTopLevelUnits } from "@/lib/scene/unitConversion";
import type { AgencyFontRow } from "@/types/database";
import type { CanvasFormat } from "@/types/enums";
import type { ContainerSceneElement, SceneElement, ShapeSceneElement, TextSceneElement } from "@/types/scene";

const ALIGN_OPTIONS = [
  { value: "left", label: "Links" },
  { value: "center", label: "Midden" },
  { value: "right", label: "Rechts" },
] as const;

const CONTAINER_ALIGN_OPTIONS = [
  { value: "start", label: "Begin" },
  { value: "center", label: "Midden" },
  { value: "end", label: "Einde" },
] as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/**
 * Which container (if any) an element belongs to — reassigning here is the only way to (un)group elements, no
 * drag-and-drop reparenting, see ContainerSceneElement's doc comment. Works for a container itself too (nesting one
 * auto-layout frame inside another), not just leaf elements — with one guard: a container can never be assigned
 * into itself or one of its own descendants (`getDescendantIds`), which would create a cycle that both the render
 * path and this panel's own container list would recurse into forever.
 *
 * A top-level element's width/height are % of the canvas; a parented element's are literal px (see
 * SceneElementBase's doc comment on why) — so crossing that boundary must convert the stored numbers, not just
 * flip `parentId`. Left unconverted, a leftover top-level value like `84` (meant as 84%) gets reinterpreted as a
 * literal 84px box, wrapping any real text into dozens of lines and ballooning the container's auto-hug size.
 */
function ContainerAssignment({
  element,
  elements,
  format,
  onChange,
}: {
  element: SceneElement;
  elements: SceneElement[];
  format: CanvasFormat;
  onChange: (patch: Partial<SceneElement>) => void;
}) {
  const descendantIds = element.type === "container" ? getDescendantIds(elements, element.id) : new Set<string>();
  const containers = elements.filter(
    (el): el is ContainerSceneElement => el.type === "container" && el.id !== element.id && !descendantIds.has(el.id),
  );
  if (containers.length === 0) return null;

  function handleChange(rawValue: string) {
    const newParentId = rawValue || undefined;
    const wasParented = !!element.parentId;
    const willBeParented = !!newParentId;
    if (wasParented === willBeParented) {
      onChange({ parentId: newParentId });
      return;
    }
    const converted = willBeParented ? toParentedUnits(element, format) : toTopLevelUnits(element, format);
    onChange({ parentId: newParentId, width: converted.width, height: converted.height });
  }

  return (
    <Field label="Container">
      <select
        className="h-9 rounded-md border border-neutral-200 bg-white px-2 text-sm"
        value={element.parentId ?? ""}
        onChange={(e) => handleChange(e.target.value)}
      >
        <option value="">Geen (vrij positioneren)</option>
        {containers.map((container, index) => (
          <option key={container.id} value={container.id}>
            Container {index + 1}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** Shared across every element type (opacity lives on SceneElementBase, not per-type) — see SceneElementBase's own doc comment. */
function OpacityField({ element, onChange }: { element: SceneElement; onChange: (patch: Partial<SceneElement>) => void }) {
  return (
    <Field label="Dekking">
      <Input type="range" min={0} max={1} step={0.05} value={element.opacity ?? 1} onChange={(e) => onChange({ opacity: Number(e.target.value) })} />
    </Field>
  );
}

/**
 * A parented element isn't draggable/resizable on the canvas (its container's auto-layout positions it) — width
 * (and, except for text, height) become plain number inputs instead. Px at the native 1080-wide canvas, see
 * SceneElementBase's doc comment on why parented elements use px instead of %. `hideWidth` additionally hides the
 * width input for a parented text element in "auto-width" sizing mode — its width is auto-managed too, just like
 * a top-level auto-width text never gets a resize handle on the canvas (see TextSceneElement's `sizing` doc
 * comment).
 */
function ParentedSize({ element, onChange, hideWidth }: { element: SceneElement; onChange: (patch: Partial<SceneElement>) => void; hideWidth?: boolean }) {
  const hideHeight = element.type === "text";
  if (hideWidth && hideHeight) return null;
  return (
    <div className="grid grid-cols-2 gap-3">
      {!hideWidth && (
        <Field label="Breedte (px)">
          <Input type="number" min={1} value={Math.round(element.width)} onChange={(e) => onChange({ width: Number(e.target.value) || 1 })} />
        </Field>
      )}
      {!hideHeight && (
        <Field label="Hoogte (px)">
          <Input type="number" min={1} value={Math.round(element.height)} onChange={(e) => onChange({ height: Number(e.target.value) || 1 })} />
        </Field>
      )}
    </div>
  );
}

/** Position/size/rotation of a top-level element are driven by dragging on the canvas (SceneEditorCanvas) — this panel only exposes type-specific content fields and, for a parented element, the width/height it can't drag directly (see ParentedSize). */
export function PropertyPanel({
  element,
  elements,
  format,
  fonts,
  onChange,
}: {
  element: SceneElement;
  /** Every element in the active scene — used to list available containers to assign this element to. */
  elements: SceneElement[];
  /** Active canvas format — needed to convert width/height between % (top-level) and px (parented) when (un)assigning a container, see ContainerAssignment. */
  format: CanvasFormat;
  fonts: Pick<AgencyFontRow, "id" | "label" | "font_family" | "font_url">[];
  onChange: (patch: Partial<SceneElement>) => void;
}) {
  if (element.type === "container") {
    return (
      <div className="flex flex-col gap-3">
        <ContainerAssignment element={element} elements={elements} format={format} onChange={onChange} />
        <OpacityField element={element} onChange={onChange} />
        <Field label="Richting">
          <select
            className="h-9 rounded-md border border-neutral-200 bg-white px-2 text-sm"
            value={element.direction}
            onChange={(e) => onChange({ direction: e.target.value as ContainerSceneElement["direction"] })}
          >
            <option value="row">Horizontaal (rij)</option>
            <option value="column">Verticaal (kolom)</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tussenruimte (px)">
            <Input type="number" min={0} value={element.gap} onChange={(e) => onChange({ gap: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="Padding (px)">
            <Input type="number" min={0} value={element.padding} onChange={(e) => onChange({ padding: Number(e.target.value) || 0 })} />
          </Field>
        </div>
        <Field label="Uitlijning">
          <select
            className="h-9 rounded-md border border-neutral-200 bg-white px-2 text-sm"
            value={element.align}
            onChange={(e) => onChange({ align: e.target.value as ContainerSceneElement["align"] })}
          >
            {CONTAINER_ALIGN_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex items-center gap-2">
          <Switch
            checked={!!element.backgroundColor}
            onCheckedChange={(checked) => onChange({ backgroundColor: checked ? "#111827" : undefined })}
          />
          <span className="text-sm">Achtergrond</span>
          {element.backgroundColor && (
            <Input
              type="color"
              value={element.backgroundColor}
              onChange={(e) => onChange({ backgroundColor: e.target.value })}
              className="h-8 w-8 p-1"
            />
          )}
        </div>
        <p className="-mt-1 text-xs text-muted-foreground">
          Breedte en hoogte passen zich automatisch aan op basis van de elementen erin — ken elementen toe aan deze
          container via hun eigen eigenschappenpaneel.
        </p>
      </div>
    );
  }

  if (element.type === "text") {
    const source = element.content.mode === "literal" ? MANUAL_SOURCE : element.content.field;
    const sizing = element.sizing ?? "auto-height";
    return (
      <div className="flex flex-col gap-3">
        <ContainerAssignment element={element} elements={elements} format={format} onChange={onChange} />
        <OpacityField element={element} onChange={onChange} />
        {element.parentId && <ParentedSize element={element} onChange={onChange} hideWidth={sizing === "auto-width"} />}
        <Field label="Grootte">
          <select
            className="h-9 rounded-md border border-neutral-200 bg-white px-2 text-sm"
            value={sizing}
            onChange={(e) => onChange({ sizing: e.target.value as TextSceneElement["sizing"] })}
          >
            <option value="auto-width">Automatische breedte</option>
            <option value="auto-height">Automatische hoogte</option>
            <option value="fixed">Vaste grootte</option>
          </select>
        </Field>
        <p className="-mt-2 text-xs text-muted-foreground">
          {sizing === "auto-width"
            ? "Het tekstkader past breedte én hoogte automatisch aan op de tekst, zonder terug te lopen."
            : sizing === "fixed"
              ? "Breedte en hoogte zijn vast — tekst loopt terug of wordt afgekapt binnen het kader."
              : "Het tekstkader past zijn hoogte automatisch aan op grootte, regelhoogte en inhoud."}
        </p>
        {!element.parentId && sizing !== "fixed" && (
          <Field label="Groeit vanaf">
            <select
              className="h-9 rounded-md border border-neutral-200 bg-white px-2 text-sm"
              value={element.verticalAnchor ?? "top"}
              onChange={(e) => onChange({ verticalAnchor: e.target.value as TextSceneElement["verticalAnchor"] })}
            >
              <option value="top">Bovenkant (groeit naar onder)</option>
              <option value="bottom">Onderkant (groeit naar boven)</option>
            </select>
          </Field>
        )}
        {!element.parentId && sizing !== "fixed" && element.verticalAnchor === "bottom" && (
          <p className="-mt-2 text-xs text-muted-foreground">
            Handig voor een kader onderaan tegen de marge — bij langere tekst groeit het kader naar boven in plaats
            van over de marge heen.
          </p>
        )}
        <Field label="Inhoud">
          <select
            className="h-9 rounded-md border border-neutral-200 bg-white px-2 text-sm"
            value={source}
            onChange={(e) => {
              const value = e.target.value;
              if (value === MANUAL_SOURCE) onChange({ content: { mode: "literal", value: element.content.mode === "literal" ? element.content.value : "" } });
              else onChange({ content: { mode: "field", field: value as (typeof BINDABLE_PROPERTY_FIELDS)[number] } });
            }}
          >
            <option value={MANUAL_SOURCE}>Vaste tekst</option>
            {BINDABLE_PROPERTY_FIELDS.map((field) => (
              <option key={field} value={field}>
                Pandveld: {BINDABLE_FIELD_LABELS[field]}
              </option>
            ))}
          </select>
        </Field>
        {element.content.mode === "literal" && (
          <Field label="Tekst">
            <Input value={element.content.value} onChange={(e) => onChange({ content: { mode: "literal", value: e.target.value } })} />
          </Field>
        )}
        <Field label="Font">
          <select
            className="h-9 rounded-md border border-neutral-200 bg-white px-2 text-sm"
            value={element.fontId ?? ""}
            onChange={(e) => onChange({ fontId: e.target.value || null })}
          >
            <option value="">Standaard</option>
            {fonts.map((font) => (
              <option key={font.id} value={font.id}>
                {font.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Grootte (px)">
            <Input type="number" min={1} value={element.fontSize} onChange={(e) => onChange({ fontSize: Number(e.target.value) || 1 })} />
          </Field>
          <Field label="Gewicht">
            <select
              className="h-9 rounded-md border border-neutral-200 bg-white px-2 text-sm"
              value={element.fontWeight}
              onChange={(e) => onChange({ fontWeight: Number(e.target.value) })}
            >
              {[400, 500, 600, 700, 800].map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Regelhoogte">
          <Input
            type="number"
            min={0.8}
            max={3}
            step={0.1}
            value={element.lineHeight ?? 1.2}
            onChange={(e) => onChange({ lineHeight: Number(e.target.value) || 1.2 })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kleur">
            <Input type="color" value={element.color} onChange={(e) => onChange({ color: e.target.value })} className="h-9 p-1" />
          </Field>
          <Field label="Uitlijning">
            <select
              className="h-9 rounded-md border border-neutral-200 bg-white px-2 text-sm"
              value={element.align}
              onChange={(e) => onChange({ align: e.target.value as TextSceneElement["align"] })}
            >
              {ALIGN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Switch checked={!!element.agencyEditable} onCheckedChange={(checked) => onChange({ agencyEditable: checked })} />
          <div>
            <p className="text-sm">Kantoor mag dit aanpassen</p>
            <p className="text-xs text-muted-foreground">Anders vast, net als de meeste velden vandaag.</p>
          </div>
        </div>
      </div>
    );
  }

  if (element.type === "shape") {
    return (
      <div className="flex flex-col gap-3">
        <ContainerAssignment element={element} elements={elements} format={format} onChange={onChange} />
        <OpacityField element={element} onChange={onChange} />
        {element.parentId && <ParentedSize element={element} onChange={onChange} />}
        <Field label="Vorm">
          <select
            className="h-9 rounded-md border border-neutral-200 bg-white px-2 text-sm"
            value={element.shape}
            onChange={(e) => onChange({ shape: e.target.value as ShapeSceneElement["shape"] })}
          >
            <option value="rectangle">Rechthoek</option>
            <option value="circle">Cirkel</option>
            <option value="diamond">Ruit (draai de rechthoek 45°)</option>
          </select>
        </Field>
        <Field label="Kleur">
          <Input type="color" value={element.fill} onChange={(e) => onChange({ fill: e.target.value })} className="h-9 p-1" />
        </Field>
        {element.shape === "rectangle" && (
          <Field label="Ronde hoeken (px)">
            <Input type="number" min={0} value={element.cornerRadius ?? 0} onChange={(e) => onChange({ cornerRadius: Number(e.target.value) || 0 })} />
          </Field>
        )}
      </div>
    );
  }

  if (element.type === "photo") {
    return (
      <div className="flex flex-col gap-3">
        <ContainerAssignment element={element} elements={elements} format={format} onChange={onChange} />
        <OpacityField element={element} onChange={onChange} />
        {element.parentId && <ParentedSize element={element} onChange={onChange} />}
        <p className="text-xs text-muted-foreground">Toont de foto van de post op deze slide. Pan/zoom bepaalt welk deel van de foto zichtbaar is.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Focus horizontaal">
            <Input type="range" min={0} max={100} value={element.focalX} onChange={(e) => onChange({ focalX: Number(e.target.value) })} />
          </Field>
          <Field label="Focus verticaal">
            <Input type="range" min={0} max={100} value={element.focalY} onChange={(e) => onChange({ focalY: Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Zoom">
          <Input type="range" min={1} max={2} step={0.05} value={element.zoom} onChange={(e) => onChange({ zoom: Number(e.target.value) })} />
        </Field>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ContainerAssignment element={element} elements={elements} format={format} onChange={onChange} />
      <OpacityField element={element} onChange={onChange} />
      {element.parentId && <ParentedSize element={element} onChange={onChange} />}
      <p className="text-xs text-muted-foreground">Toont automatisch het kantoorlogo. Geen extra instellingen — positie/grootte sleep je op het canvas.</p>
    </div>
  );
}
