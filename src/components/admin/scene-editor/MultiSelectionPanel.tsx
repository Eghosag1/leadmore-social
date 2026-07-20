"use client";

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceBetween,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceBetween,
  Copy,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AlignMode } from "@/lib/scene/alignDistribute";

const ALIGN_BUTTONS: { mode: AlignMode; label: string; Icon: typeof AlignStartVertical }[] = [
  { mode: "left", label: "Links uitlijnen", Icon: AlignStartVertical },
  { mode: "center-h", label: "Horizontaal centreren", Icon: AlignCenterVertical },
  { mode: "right", label: "Rechts uitlijnen", Icon: AlignEndVertical },
  { mode: "top", label: "Boven uitlijnen", Icon: AlignStartHorizontal },
  { mode: "center-v", label: "Verticaal centreren", Icon: AlignCenterHorizontal },
  { mode: "bottom", label: "Onder uitlijnen", Icon: AlignEndHorizontal },
];

/** Shown in the Eigenschappen column instead of PropertyPanel whenever more than one element is selected — per-element fields don't make sense across a mixed selection, so this stays deliberately minimal (bulk actions + align/distribute). */
export function MultiSelectionPanel({
  count,
  onDelete,
  onDuplicate,
  onAlign,
  onDistribute,
}: {
  count: number;
  onDelete: () => void;
  onDuplicate: () => void;
  onAlign: (mode: AlignMode) => void;
  onDistribute: (axis: "horizontal" | "vertical") => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">{count} elementen geselecteerd.</p>

      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Uitlijnen</p>
        <div className="grid grid-cols-6 gap-1">
          {ALIGN_BUTTONS.map(({ mode, label, Icon }) => (
            <Button key={mode} type="button" size="icon-sm" variant="outline" onClick={() => onAlign(mode)} aria-label={label} title={label}>
              <Icon className="h-3.5 w-3.5" />
            </Button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Verdelen</p>
        <div className="flex gap-1">
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={count < 3}
            onClick={() => onDistribute("horizontal")}
            aria-label="Horizontaal verdelen"
            title="Horizontaal verdelen (min. 3 elementen)"
          >
            <AlignHorizontalSpaceBetween className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={count < 3}
            onClick={() => onDistribute("vertical")}
            aria-label="Verticaal verdelen"
            title="Verticaal verdelen (min. 3 elementen)"
          >
            <AlignVerticalSpaceBetween className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onDuplicate}>
          <Copy className="h-3.5 w-3.5" />
          Dupliceren
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
          Verwijderen
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Tip: Shift+A wrapt de selectie in een auto-layout-container.</p>
    </div>
  );
}
