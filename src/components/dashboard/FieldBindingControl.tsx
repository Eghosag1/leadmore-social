"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BINDABLE_PROPERTY_FIELDS, BINDABLE_FIELD_LABELS, MANUAL_SOURCE, type FieldSourceValue } from "@/lib/field-binding";

/**
 * Always directly editable — picking a source in the dropdown just pre-fills
 * the text field with that property value; typing anything further switches
 * the source to "manual" automatically. No extra toggle step required. Used
 * for title/description/caption binding in both CreatePostForm and
 * PostDetailClient.
 */
export function FieldBindingControl({
  label,
  source,
  value,
  onSourceChange,
  onValueChange,
  multiline,
}: {
  label: string;
  source: FieldSourceValue;
  value: string;
  onSourceChange: (source: FieldSourceValue) => void;
  onValueChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        <select
          value={source}
          onChange={(e) => onSourceChange(e.target.value as FieldSourceValue)}
          className="h-7 rounded-md border border-input bg-background px-2 text-xs"
        >
          {BINDABLE_PROPERTY_FIELDS.map((field) => (
            <option key={field} value={field}>
              Uit CRM: {BINDABLE_FIELD_LABELS[field]}
            </option>
          ))}
          <option value={MANUAL_SOURCE}>Handmatig</option>
        </select>
      </div>
      {multiline ? (
        <Textarea rows={3} value={value} onChange={(e) => onValueChange(e.target.value)} />
      ) : (
        <Input value={value} onChange={(e) => onValueChange(e.target.value)} />
      )}
    </div>
  );
}
