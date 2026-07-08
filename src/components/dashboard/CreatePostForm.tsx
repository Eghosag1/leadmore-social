"use client";

import { useActionState, useMemo, useState } from "react";
import Image from "next/image";
import { AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/shared/PageHeader";
import { PhonePreview } from "@/components/dashboard/PhonePreview";
import { FieldBindingControl } from "@/components/dashboard/FieldBindingControl";
import { cn } from "@/lib/utils";
import { buildRawPhotoRenderProps, buildTemplateRenderProps } from "@/lib/template-render";
import { MANUAL_SOURCE, resolvePropertyField, type FieldSourceValue } from "@/lib/field-binding";
import { createAndSchedulePostAction, type CreatePostState } from "@/app/dashboard/create-post/[propertyId]/actions";
import type { PropertyImageRow, PropertyRow } from "@/types/database";
import type { AgencyTemplateForCustomer } from "@/services/templates/templateService";
import type { Platform, TemplateType } from "@/types/enums";

const TYPE_LABELS: Record<TemplateType, string> = { single: "Single post", carousel: "Carousel" };
const PLATFORM_LABELS: Record<Platform, string> = { facebook: "Facebook", instagram: "Instagram" };
const POST_TYPES: TemplateType[] = ["single", "carousel"];

const initialState: CreatePostState = { error: null };

export function CreatePostForm({
  property,
  images,
  templates,
  agencyName,
  agencyLogo,
  metaConnected,
  returnTo,
}: {
  property: PropertyRow;
  images: PropertyImageRow[];
  templates: AgencyTemplateForCustomer[];
  agencyName: string;
  agencyLogo?: string;
  metaConnected: boolean;
  /** Where "Terug" should go — forwarded from the page that linked here (properties list vs. property detail). */
  returnTo?: string;
}) {
  const availableTypes = useMemo(
    () => [...new Set(templates.map((t) => t.type))] as TemplateType[],
    [templates],
  );

  const [selectedType, setSelectedType] = useState<TemplateType>(availableTypes[0] ?? "single");
  const templatesForType = templates.filter((t) => t.type === selectedType);
  const [mode, setMode] = useState<"template" | "own">(templatesForType.length > 0 ? "template" : "own");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(templatesForType[0]?.id ?? null);
  const selectedTemplate =
    mode === "template" ? (templates.find((t) => t.id === selectedTemplateId) ?? templatesForType[0] ?? null) : null;

  const isOwnCarousel = mode === "own" && selectedType === "carousel";

  const [titleSource, setTitleSource] = useState<FieldSourceValue>("title");
  const [title, setTitle] = useState(property.title);
  const [descriptionSource, setDescriptionSource] = useState<FieldSourceValue>("description");
  const [description, setDescription] = useState(property.description ?? "");

  function handleTitleSourceChange(source: FieldSourceValue) {
    setTitleSource(source);
    if (source !== MANUAL_SOURCE) setTitle(resolvePropertyField(property, source));
  }
  function handleTitleChange(value: string) {
    setTitle(value);
    setTitleSource(MANUAL_SOURCE);
  }
  function handleDescriptionSourceChange(source: FieldSourceValue) {
    setDescriptionSource(source);
    if (source !== MANUAL_SOURCE) setDescription(resolvePropertyField(property, source));
  }
  function handleDescriptionChange(value: string) {
    setDescription(value);
    setDescriptionSource(MANUAL_SOURCE);
  }

  const [captionSource, setCaptionSource] = useState<FieldSourceValue>(MANUAL_SOURCE);
  const [caption, setCaption] = useState(
    `${property.title} — ${property.location}. Interesse? Neem contact met ons op!`,
  );

  function handleCaptionSourceChange(source: FieldSourceValue) {
    setCaptionSource(source);
    if (source !== MANUAL_SOURCE) setCaption(resolvePropertyField(property, source));
  }
  function handleCaptionChange(value: string) {
    setCaption(value);
    setCaptionSource(MANUAL_SOURCE);
  }
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(images[0]?.image_url ?? null);
  const [selectedPhotoUrls, setSelectedPhotoUrls] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<Set<Platform>>(new Set());
  const [slideIndex, setSlideIndex] = useState(0);

  const boundAction = createAndSchedulePostAction.bind(null, property.id);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);

  function handleTypeChange(type: TemplateType) {
    setSelectedType(type);
    const first = templates.find((t) => t.type === type);
    if (first) {
      setMode("template");
      setSelectedTemplateId(first.id);
    } else {
      setMode("own");
      setSelectedTemplateId(null);
    }
    setSlideIndex(0);
    setSelectedPhotoUrls([]);
  }

  function toggleOwnPhoto(url: string) {
    setSelectedPhotoUrls((prev) => (prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]));
  }

  const ownImages = isOwnCarousel ? selectedPhotoUrls : coverImageUrl ? [coverImageUrl] : [];

  const previewData =
    mode === "template" && selectedTemplate
      ? buildTemplateRenderProps({
          property,
          images,
          config: selectedTemplate.config,
          agencyName,
          overrides: { title, description, coverImageUrl: coverImageUrl ?? undefined },
        })
      : buildRawPhotoRenderProps({ property, images: ownImages, agencyName });

  const previewComponentSource = mode === "template" && selectedTemplate ? selectedTemplate.component_source : null;
  const previewSlideCount = mode === "template" && selectedTemplate ? selectedTemplate.slide_count : Math.max(ownImages.length, 1);

  const hasValidSelection = mode === "template" ? !!selectedTemplate && !!coverImageUrl : isOwnCarousel ? selectedPhotoUrls.length > 0 : !!coverImageUrl;

  function togglePlatform(platform: Platform) {
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) next.delete(platform);
      else next.add(platform);
      return next;
    });
  }

  return (
    <div>
      <PageHeader
        title="Post maken"
        description={property.location}
        backHref={`/dashboard/properties/${property.id}`}
        backReturnTo={returnTo}
        backLabel={returnTo === "/dashboard/properties" ? "Panden" : property.title}
      />

      <form action={formAction} className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <input type="hidden" name="mode" value={mode} />
        <input type="hidden" name="templateId" value={mode === "template" ? selectedTemplate?.id ?? "" : ""} />
        <input type="hidden" name="postType" value={selectedType} />
        <input type="hidden" name="coverImageUrl" value={coverImageUrl ?? ""} />
        {isOwnCarousel && selectedPhotoUrls.map((url) => <input key={url} type="hidden" name="ownPhotoUrls" value={url} />)}
        <input type="hidden" name="caption" value={caption} />
        <input type="hidden" name="title" value={title} />
        <input type="hidden" name="titleSource" value={titleSource} />
        <input type="hidden" name="description" value={description} />
        <input type="hidden" name="descriptionSource" value={descriptionSource} />

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">1. Type post</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-2">
              {POST_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleTypeChange(type)}
                  className={cn(
                    "rounded-md border px-4 py-2 text-sm font-medium transition-colors",
                    selectedType === type
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
                  )}
                >
                  {TYPE_LABELS[type]}
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">2. Template</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {templatesForType.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => {
                    setMode("template");
                    setSelectedTemplateId(template.id);
                    setSlideIndex(0);
                  }}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-lg border p-3 text-left text-sm transition-colors",
                    mode === "template" && selectedTemplate?.id === template.id
                      ? "border-neutral-900 ring-1 ring-neutral-900"
                      : "border-neutral-200 hover:bg-neutral-50",
                  )}
                >
                  <span className="flex w-full items-center justify-between font-medium text-neutral-900">
                    {template.name}
                    {mode === "template" && selectedTemplate?.id === template.id && <Check className="h-4 w-4" />}
                  </span>
                  {template.description && <span className="text-xs text-muted-foreground">{template.description}</span>}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setMode("own");
                  setSelectedTemplateId(null);
                  setSlideIndex(0);
                  setSelectedPhotoUrls([]);
                }}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-lg border border-dashed p-3 text-left text-sm transition-colors",
                  mode === "own" ? "border-neutral-900 ring-1 ring-neutral-900" : "border-neutral-300 hover:bg-neutral-50",
                )}
              >
                <span className="flex w-full items-center justify-between font-medium text-neutral-900">
                  Eigen foto&apos;s
                  {mode === "own" && <Check className="h-4 w-4" />}
                </span>
                <span className="text-xs text-muted-foreground">
                  Geen template — kies zelf {selectedType === "carousel" ? "meerdere foto's" : "1 foto"} voor deze post.
                </span>
              </button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">3. Tekst</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {mode === "template" && (
                <>
                  <FieldBindingControl
                    label="Titel op de visual"
                    source={titleSource}
                    value={title}
                    onSourceChange={handleTitleSourceChange}
                    onValueChange={handleTitleChange}
                  />
                  {selectedTemplate?.config.fields.showDescription && (
                    <FieldBindingControl
                      label="Beschrijving op de visual"
                      source={descriptionSource}
                      value={description}
                      onSourceChange={handleDescriptionSourceChange}
                      onValueChange={handleDescriptionChange}
                      multiline
                    />
                  )}
                </>
              )}
              <FieldBindingControl
                label="Bijschrift bij de post"
                source={captionSource}
                value={caption}
                onSourceChange={handleCaptionSourceChange}
                onValueChange={handleCaptionChange}
                multiline
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">4. {isOwnCarousel ? "Foto's" : "Foto"}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {isOwnCarousel && (
                <p className="text-xs text-muted-foreground">
                  Kies de foto&apos;s in de gewenste volgorde. Klik nogmaals om een foto te verwijderen.
                </p>
              )}
              <div className="grid grid-cols-4 gap-2">
                {images.map((image) => {
                  const selected = isOwnCarousel ? selectedPhotoUrls.includes(image.image_url) : coverImageUrl === image.image_url;
                  const orderIndex = isOwnCarousel ? selectedPhotoUrls.indexOf(image.image_url) : -1;
                  return (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => (isOwnCarousel ? toggleOwnPhoto(image.image_url) : setCoverImageUrl(image.image_url))}
                      className={cn(
                        "relative aspect-square overflow-hidden rounded-md border-2",
                        selected ? "border-neutral-900" : "border-transparent",
                      )}
                    >
                      <Image src={image.image_url} alt="" fill sizes="120px" className="object-cover" />
                      {orderIndex >= 0 && (
                        <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-[11px] font-semibold text-white">
                          {orderIndex + 1}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">5. Platform</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {!metaConnected && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Geen actieve Facebook/Instagram-koppeling voor uw kantoor. Neem contact op met de platformbeheerder.
                  </AlertDescription>
                </Alert>
              )}
              <div className="flex gap-2">
                {(["facebook", "instagram"] as Platform[]).map((platform) => (
                  <label
                    key={platform}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium",
                      platforms.has(platform) ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200",
                    )}
                  >
                    <input
                      type="checkbox"
                      name="platforms"
                      value={platform}
                      checked={platforms.has(platform)}
                      onChange={() => togglePlatform(platform)}
                      className="sr-only"
                    />
                    {PLATFORM_LABELS[platform]}
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">6. Datum en uur</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-3">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="scheduledDate">Datum</Label>
                <Input id="scheduledDate" name="scheduledDate" type="date" required />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="scheduledTime">Uur</Label>
                <Input id="scheduledTime" name="scheduledTime" type="time" required />
              </div>
            </CardContent>
          </Card>

          {state.error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" size="lg" disabled={isPending || !metaConnected || !hasValidSelection} className="w-full">
            {isPending ? "Bezig met inplannen..." : "Post inplannen"}
          </Button>
        </div>

        <div className="lg:sticky lg:top-8 lg:self-start">
          {ownImages.length > 0 || (mode === "template" && selectedTemplate) ? (
            <PhonePreview
              componentSource={previewComponentSource}
              slideCount={previewSlideCount}
              data={previewData}
              caption={caption}
              agencyName={agencyName}
              agencyLogo={agencyLogo}
              slideIndex={slideIndex}
              onSlideIndexChange={setSlideIndex}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Kies een template of foto om een preview te zien.</p>
          )}
        </div>
      </form>
    </div>
  );
}
