"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DynamicTemplateRenderer } from "@/components/templates/DynamicTemplateRenderer";
import { TEMPLATE_STARTERS } from "@/data/template-starters";
import { buildTemplateRenderProps } from "@/lib/template-render";
import { EXAMPLE_PROPERTY, EXAMPLE_PROPERTY_IMAGES } from "@/data/mock/example-property";
import type { TemplateConfig } from "@/types/domain";

export interface TemplateFormState {
  error: string | null;
}

export interface TemplateFormInitial {
  name: string;
  description: string;
  componentSource: string;
  slideCount: number;
  brandColor: string;
  secondaryColor: string;
  ctaText: string;
  badgeText: string;
  billableType: "included" | "regie";
}

const DEFAULT_INITIAL: TemplateFormInitial = {
  name: "",
  description: "",
  componentSource: "",
  slideCount: 1,
  brandColor: "#111827",
  secondaryColor: "#6b7280",
  ctaText: "",
  badgeText: "",
  billableType: "included",
};

/**
 * Shared by the admin's "create template" and "edit template" pages. The
 * admin writes/pastes real TSX per template — there's no shared layout
 * catalog to pick from anymore (see src/lib/dynamic-template.ts) — so this
 * form doubles as a live code editor with a WYSIWYG preview next to it,
 * using an example property so it works even before the agency has any
 * real panden synced.
 */
export function TemplateForm({
  action,
  agencyName,
  initial,
  mode,
}: {
  action: (prev: TemplateFormState, formData: FormData) => Promise<TemplateFormState>;
  agencyName: string;
  initial?: Partial<TemplateFormInitial>;
  mode: "create" | "edit";
}) {
  const values = { ...DEFAULT_INITIAL, ...initial };
  const [state, formAction, isPending] = useActionState(action, { error: null });

  const [source, setSource] = useState(values.componentSource);
  const [slideCount, setSlideCount] = useState(values.slideCount);
  const [brandColor, setBrandColor] = useState(values.brandColor);
  const [secondaryColor, setSecondaryColor] = useState(values.secondaryColor);
  const [ctaText, setCtaText] = useState(values.ctaText);
  const [badgeText, setBadgeText] = useState(values.badgeText);
  const [slideIndex, setSlideIndex] = useState(0);

  const previewData = useMemo(() => {
    const config: TemplateConfig = {
      brand: { brandColor, secondaryColor, ctaText: ctaText || undefined },
      fields: {
        showPrice: true,
        showBedrooms: true,
        showBathrooms: true,
        showSurface: true,
        showDescription: true,
        showAgentName: true,
      },
      defaultTexts: { badgeText: badgeText || undefined },
    };
    return buildTemplateRenderProps({ property: EXAMPLE_PROPERTY, images: EXAMPLE_PROPERTY_IMAGES, config, agencyName });
  }, [brandColor, secondaryColor, ctaText, badgeText, agencyName]);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <input type="hidden" name="componentSource" value={source} />
      <input type="hidden" name="brandColor" value={brandColor} />
      <input type="hidden" name="secondaryColor" value={secondaryColor} />

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Naam</Label>
          <Input id="name" name="name" defaultValue={values.name} placeholder="Nieuw pand" required />
          <p className="text-xs text-muted-foreground">
            Maak duidelijk waarvoor deze template dient, zodat het kantoor meteen weet welke te kiezen.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description">Omschrijving (intern)</Label>
          <Textarea id="description" name="description" rows={2} defaultValue={values.description} placeholder="Waarvoor wordt deze template gebruikt?" />
        </div>

        <div className="flex gap-4">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="brandColorInput">Hoofdkleur</Label>
            <input
              id="brandColorInput"
              type="color"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="h-9 w-14 rounded-md border border-input bg-transparent p-1"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="secondaryColorInput">Accentkleur</Label>
            <input
              id="secondaryColorInput"
              type="color"
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              className="h-9 w-14 rounded-md border border-input bg-transparent p-1"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="badgeText">Badge-tekst op de visual (optioneel)</Label>
          <Input id="badgeText" name="badgeText" value={badgeText} onChange={(e) => setBadgeText(e.target.value)} placeholder="Nieuw op de markt" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ctaText">CTA-tekst</Label>
          <Input id="ctaText" name="ctaText" value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="Neem contact met ons op" />
        </div>

        {mode === "create" ? (
          <div className="flex items-center gap-3">
            <Switch id="includedInPlan" name="includedInPlan" defaultChecked />
            <Label htmlFor="includedInPlan" className="text-sm">
              Onderdeel van het standaardpakket (inbegrepen, niet apart gefactureerd)
            </Label>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="billableType">Pakket</Label>
            <select
              id="billableType"
              name="billableType"
              defaultValue={values.billableType}
              className="h-9 w-fit rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="included">Inbegrepen in standaardpakket</option>
              <option value="regie">In regie (apart gefactureerd)</option>
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="componentSourceEditor">Broncode (TSX)</Label>
            {mode === "create" && (
              <div className="flex gap-1.5">
                {TEMPLATE_STARTERS.map((starter) => (
                  <button
                    key={starter.id}
                    type="button"
                    onClick={() => {
                      setSource(starter.source);
                      setSlideCount(starter.slideCount);
                    }}
                    className="rounded-md border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
                  >
                    {starter.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <textarea
            id="componentSourceEditor"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            spellCheck={false}
            rows={22}
            placeholder={'function Template({ data, slideIndex, className }) {\n  return <div>...</div>;\n}\n\nexport default Template;'}
            className="w-full rounded-md border border-input bg-neutral-950 p-3 font-mono text-[11px] leading-relaxed text-neutral-100"
          />
          <p className="text-xs text-muted-foreground">
            Schrijf een normale React-component en sluit af met <code>export default JouwComponent;</code>. Enkel{" "}
            <code>React</code> en next/image&apos;s <code>Image</code> staan ter beschikking — geen andere imports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="slideCount" className="shrink-0">
            Aantal slides
          </Label>
          <Input
            id="slideCount"
            name="slideCount"
            type="number"
            min={1}
            max={10}
            value={slideCount}
            onChange={(e) => setSlideCount(Math.max(1, Number(e.target.value) || 1))}
            className="w-20"
          />
          <span className="text-xs text-muted-foreground">1 = single post, meer = carousel</span>
        </div>

        {state.error && (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" disabled={isPending} className="w-fit">
          {isPending ? "Bezig..." : mode === "create" ? "Template aanmaken" : "Wijzigingen opslaan"}
        </Button>
      </div>

      <div className="lg:sticky lg:top-8 lg:self-start">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Live preview (voorbeeldpand)</p>
        <DynamicTemplateRenderer source={source} data={previewData} slideIndex={slideIndex} className="shadow-sm" />
        {slideCount > 1 && (
          <input
            type="range"
            min={0}
            max={slideCount - 1}
            value={Math.min(slideIndex, slideCount - 1)}
            onChange={(e) => setSlideIndex(Number(e.target.value))}
            className="mt-3 w-full"
          />
        )}
      </div>
    </form>
  );
}
