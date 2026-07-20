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
import { computeClampedCanvasHeight } from "@/lib/canvas-format";
import { createAndSchedulePostAction, type CreatePostState } from "@/app/dashboard/create-post/[propertyId]/actions";
import type { AgencyFontRow, PropertyImageRow, PropertyRow } from "@/types/database";
import type { AgencyTemplateForCustomer } from "@/services/templates/templateService";
import { CANVAS_FORMATS, type CanvasFormat, type Platform, type PostCanvasMode, type TemplateType } from "@/types/enums";
import { CANVAS_FORMAT_DIMENSIONS, type ScenesByFormat, type TemplateScenes } from "@/types/scene";

const TYPE_LABELS: Record<TemplateType, string> = { single: "Single post", carousel: "Carousel" };
const PLATFORM_LABELS: Record<Platform, string> = { facebook: "Facebook", instagram: "Instagram" };
const POST_TYPES: TemplateType[] = ["single", "carousel"];
// Instagram's real hard carousel limit is 10 items. A template with a fixed
// "end scene" closing card (Phase C) reserves one of those slots for itself,
// so agency-picked photos are capped at 9 in that case — every other
// template (or "eigen foto's", which has no scenes at all) gets the full 10.

function hasAnyScene(scenes: TemplateScenes | undefined): boolean {
  return !!scenes && (!!scenes.cover || !!scenes.content || !!scenes.end);
}

function designedFormats(scenesByFormat: ScenesByFormat | null | undefined): CanvasFormat[] {
  return CANVAS_FORMATS.filter((format) => hasAnyScene(scenesByFormat?.[format]));
}

const initialState: CreatePostState = { error: null };

export function CreatePostForm({
  property,
  images,
  templates,
  agencyName,
  agencyLogo,
  fonts,
  metaConnected,
  returnTo,
  initialDate,
}: {
  property: PropertyRow;
  images: PropertyImageRow[];
  templates: AgencyTemplateForCustomer[];
  agencyName: string;
  agencyLogo?: string;
  fonts?: Pick<AgencyFontRow, "id" | "label" | "font_family" | "font_url">[];
  metaConnected: boolean;
  /** Where "Terug" should go — forwarded from the page that linked here (properties list vs. property detail). */
  returnTo?: string;
  /** Pre-fills the date field — set when this flow started from clicking a day on the calendar. */
  initialDate?: string;
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

  // Multi-select photo picking — was "own" mode only ("eigen foto's"), now
  // also applies to template carousels: today a templated carousel reused
  // the same single cover photo for every slide (agency_templates.slide_count
  // drove a fixed Array.from(...)), which is exactly the "1 foto voor hele
  // carousel is sowieso niet top" limitation confirmed with the user. See
  // PLAN_TEMPLATE_EDITOR.md Phase B.
  const isMultiPhotoCarousel = selectedType === "carousel" && (mode === "own" || mode === "template");
  const templateDesignedFormats = selectedTemplate ? designedFormats(selectedTemplate.scenes_by_format) : [];
  const isSceneTemplate = mode === "template" && templateDesignedFormats.length > 0;
  // Reserve a photo slot for a fixed "end scene" closing card if *any*
  // designed format has one — conservative (checked across all formats, not
  // just the one currently selected below) so the cap can never be
  // undercounted for whichever format the agency ends up picking.
  const maxCarouselPhotos =
    isSceneTemplate && templateDesignedFormats.some((format) => selectedTemplate!.scenes_by_format?.[format]?.end) ? 9 : 10;

  // Which of the template's designed CanvasFormats this post uses — only
  // meaningful for scene templates (isSceneTemplate); legacy componentSource
  // templates keep using canvasMode below instead. Reset whenever the
  // selected template changes, same "adjust state during render" pattern as
  // the rest of this component.
  const [canvasFormat, setCanvasFormat] = useState<CanvasFormat>(templateDesignedFormats[0] ?? "portrait");
  const [lastTemplateIdForFormat, setLastTemplateIdForFormat] = useState(selectedTemplate?.id ?? null);
  if (lastTemplateIdForFormat !== (selectedTemplate?.id ?? null)) {
    setLastTemplateIdForFormat(selectedTemplate?.id ?? null);
    if (templateDesignedFormats.length > 0 && !templateDesignedFormats.includes(canvasFormat)) {
      setCanvasFormat(templateDesignedFormats[0]);
    }
  }

  const [postNow, setPostNow] = useState(false);

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

  const [canvasMode, setCanvasMode] = useState<PostCanvasMode>("fixed");
  const [imageDimensions, setImageDimensions] = useState<Record<string, { width: number; height: number }>>({});
  const coverDims = coverImageUrl ? imageDimensions[coverImageUrl] : undefined;
  const computedCanvasHeight =
    mode === "template" && canvasMode === "original" && coverDims
      ? computeClampedCanvasHeight(coverDims.width, coverDims.height)
      : null;

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
    setCanvasMode("fixed");
  }

  function toggleOwnPhoto(url: string) {
    setSelectedPhotoUrls((prev) => {
      if (prev.includes(url)) return prev.filter((u) => u !== url);
      if (prev.length >= maxCarouselPhotos) return prev;
      return [...prev, url];
    });
  }

  const ownImages = isMultiPhotoCarousel ? selectedPhotoUrls : coverImageUrl ? [coverImageUrl] : [];

  const previewData =
    mode === "template" && selectedTemplate
      ? {
          ...buildTemplateRenderProps({
            property,
            images,
            config: selectedTemplate.config,
            agencyName,
            fonts,
            overrides: { title, description, coverImageUrl: coverImageUrl ?? undefined },
          }),
          // Override with the actually-chosen photos in the order the user
          // picked them — buildTemplateRenderProps's own `images` defaults to
          // every property photo (cover-first), which is the wrong list once
          // a carousel can use N distinct, user-ordered photos per slide.
          images: ownImages.length > 0 ? ownImages : images.map((i) => i.image_url),
        }
      : buildRawPhotoRenderProps({ property, images: ownImages, agencyName });

  const previewComponentSource = mode === "template" && selectedTemplate ? selectedTemplate.component_source : null;
  const previewScenesByFormat: ScenesByFormat | null = isSceneTemplate ? (selectedTemplate!.scenes_by_format ?? null) : null;
  // Real slide count is now however many photos were chosen (min 1), not the
  // template's own agency_templates.slide_count — see Phase B note above.
  const previewSlideCount = Math.max(ownImages.length, 1);
  // A scene template's chosen CanvasFormat always wins over the legacy
  // fixed/original canvasMode toggle below (which only applies to
  // componentSource templates) — see resolveRenderHeight's server-side
  // counterpart in src/lib/canvas-format.ts.
  const previewCanvasHeight = isSceneTemplate ? CANVAS_FORMAT_DIMENSIONS[canvasFormat].height : computedCanvasHeight;

  const hasValidSelection =
    (mode === "template" ? !!selectedTemplate : true) &&
    (isMultiPhotoCarousel ? selectedPhotoUrls.length > 0 : !!coverImageUrl) &&
    !(mode === "template" && !isSceneTemplate && canvasMode === "original" && !computedCanvasHeight);

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
        {isMultiPhotoCarousel && selectedPhotoUrls.map((url) => <input key={url} type="hidden" name="ownPhotoUrls" value={url} />)}
        <input type="hidden" name="caption" value={caption} />
        <input type="hidden" name="title" value={title} />
        <input type="hidden" name="titleSource" value={titleSource} />
        <input type="hidden" name="description" value={description} />
        <input type="hidden" name="descriptionSource" value={descriptionSource} />
        <input type="hidden" name="canvasMode" value={mode === "template" && !isSceneTemplate ? canvasMode : "fixed"} />
        {mode === "template" && !isSceneTemplate && canvasMode === "original" && computedCanvasHeight && (
          <input type="hidden" name="canvasHeight" value={computedCanvasHeight} />
        )}
        {isSceneTemplate && <input type="hidden" name="canvasFormat" value={canvasFormat} />}

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
                  setCanvasMode("fixed");
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
              <CardTitle className="text-base">4. {isMultiPhotoCarousel ? "Foto's" : "Foto"}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {isMultiPhotoCarousel && (
                <p className="text-xs text-muted-foreground">
                  Kies de foto&apos;s in de gewenste volgorde (max {maxCarouselPhotos}). Klik nogmaals om een foto te
                  verwijderen.
                </p>
              )}
              <div className="grid grid-cols-4 gap-2">
                {images.map((image) => {
                  const selected = isMultiPhotoCarousel ? selectedPhotoUrls.includes(image.image_url) : coverImageUrl === image.image_url;
                  const orderIndex = isMultiPhotoCarousel ? selectedPhotoUrls.indexOf(image.image_url) : -1;
                  return (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => (isMultiPhotoCarousel ? toggleOwnPhoto(image.image_url) : setCoverImageUrl(image.image_url))}
                      className={cn(
                        "relative aspect-square overflow-hidden rounded-md border-2",
                        selected ? "border-neutral-900" : "border-transparent",
                      )}
                    >
                      <Image
                        src={image.image_url}
                        alt=""
                        fill
                        sizes="120px"
                        className="object-cover"
                        onLoad={(e) => {
                          const img = e.currentTarget;
                          if (!img.naturalWidth || !img.naturalHeight) return;
                          setImageDimensions((prev) =>
                            prev[image.image_url] ? prev : { ...prev, [image.image_url]: { width: img.naturalWidth, height: img.naturalHeight } },
                          );
                        }}
                      />
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

          {mode === "template" && isSceneTemplate && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">5. Formaat</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex gap-2">
                  {templateDesignedFormats.map((format) => (
                    <button
                      key={format}
                      type="button"
                      onClick={() => setCanvasFormat(format)}
                      className={cn(
                        "rounded-md border px-4 py-2 text-sm font-medium transition-colors",
                        canvasFormat === format
                          ? "border-neutral-900 bg-neutral-900 text-white"
                          : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
                      )}
                    >
                      {CANVAS_FORMAT_DIMENSIONS[format].label} ({CANVAS_FORMAT_DIMENSIONS[format].ratioLabel})
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Deze template is ontworpen voor {templateDesignedFormats.length === 1 ? "dit formaat" : "deze formaten"} —
                  neem contact op met de platformbeheerder voor andere formaten.
                </p>
              </CardContent>
            </Card>
          )}

          {mode === "template" && !isSceneTemplate && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">5. Formaat</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCanvasMode("fixed")}
                    className={cn(
                      "rounded-md border px-4 py-2 text-sm font-medium transition-colors",
                      canvasMode === "fixed"
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
                    )}
                  >
                    Standaard (4:5)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCanvasMode("original")}
                    className={cn(
                      "rounded-md border px-4 py-2 text-sm font-medium transition-colors",
                      canvasMode === "original"
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
                    )}
                  >
                    Origineel formaat
                  </button>
                </div>
                {canvasMode === "original" && (
                  <p className="text-xs text-muted-foreground">
                    {computedCanvasHeight ? `Canvas wordt ongeveer 1080×${computedCanvasHeight}px, zonder bijsnijden.` : "Foto wordt gemeten..."}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">6. Platform</CardTitle>
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
              <CardTitle className="text-base">7. Wanneer</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPostNow(false)}
                  className={cn(
                    "rounded-md border px-4 py-2 text-sm font-medium transition-colors",
                    !postNow
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
                  )}
                >
                  Inplannen
                </button>
                <button
                  type="button"
                  onClick={() => setPostNow(true)}
                  className={cn(
                    "rounded-md border px-4 py-2 text-sm font-medium transition-colors",
                    postNow
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
                  )}
                >
                  Nu posten
                </button>
              </div>
              {postNow ? (
                <p className="text-xs text-muted-foreground">
                  De post wordt onmiddellijk gepubliceerd zodra hij klaar is met renderen, geen wachttijd.
                </p>
              ) : (
                <div className="flex gap-3">
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Label htmlFor="scheduledDate">Datum</Label>
                    <Input id="scheduledDate" name="scheduledDate" type="date" defaultValue={initialDate} required />
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Label htmlFor="scheduledTime">Uur</Label>
                    <Input id="scheduledTime" name="scheduledTime" type="time" required />
                  </div>
                </div>
              )}
              <input type="hidden" name="postNow" value={postNow ? "on" : ""} />
            </CardContent>
          </Card>

          {state.error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" size="lg" disabled={isPending || !metaConnected || !hasValidSelection} className="w-full">
            {isPending ? "Bezig..." : postNow ? "Nu posten" : "Post inplannen"}
          </Button>
        </div>

        <div className="lg:sticky lg:top-8 lg:self-start">
          {ownImages.length > 0 || (mode === "template" && selectedTemplate) ? (
            <PhonePreview
              componentSource={previewComponentSource}
              scenesByFormat={previewScenesByFormat}
              canvasFormat={isSceneTemplate ? canvasFormat : null}
              slideCount={previewSlideCount}
              data={previewData}
              caption={caption}
              agencyName={agencyName}
              agencyLogo={agencyLogo}
              slideIndex={slideIndex}
              onSlideIndexChange={setSlideIndex}
              canvasHeight={previewCanvasHeight}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Kies een template of foto om een preview te zien.</p>
          )}
        </div>
      </form>
    </div>
  );
}
