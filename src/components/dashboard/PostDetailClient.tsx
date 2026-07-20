"use client";

import { useActionState, useState } from "react";
import { formatDateInputs } from "@/lib/date-inputs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PhonePreview } from "@/components/dashboard/PhonePreview";
import { CancelPostButton } from "@/components/dashboard/CancelPostButton";
import { DownloadImageButton } from "@/components/dashboard/DownloadImageButton";
import { RenderFailedActions } from "@/components/dashboard/RenderFailedActions";
import { PublishFailedActions } from "@/components/dashboard/PublishFailedActions";
import { FieldBindingControl } from "@/components/dashboard/FieldBindingControl";
import { PostStatusBadge } from "@/components/shared/StatusBadge";
import { MANUAL_SOURCE, resolvePropertyField, type FieldSourceValue } from "@/lib/field-binding";
import { friendlyErrorMessage } from "@/lib/friendly-error";
import { updatePostAction, type UpdatePostState } from "@/app/dashboard/posts/[id]/actions";
import type { PropertyRow } from "@/types/database";
import type { TemplateRenderProps } from "@/types/domain";
import type { CanvasFormat, Platform, PostStatus } from "@/types/enums";
import type { ScenesByFormat } from "@/types/scene";

const PLATFORM_LABEL: Record<Platform, string> = { facebook: "Facebook", instagram: "Instagram" };

export function PostDetailClient({
  postId,
  property,
  initialCaption,
  scheduledAt,
  status,
  jobs,
  propertyTitle,
  componentSource,
  scenesByFormat,
  canvasFormat,
  canvasHeight,
  slideCount,
  previewData,
  agencyName,
  agencyLogo,
  renderError,
  renderOverridden,
  renderedImageUrls,
}: {
  postId: string;
  property: PropertyRow;
  initialCaption: string;
  scheduledAt: string | null;
  status: PostStatus;
  jobs: { platform: Platform; status: PostStatus; error_message: string | null }[];
  propertyTitle: string;
  componentSource: string | null;
  scenesByFormat?: ScenesByFormat | null;
  canvasFormat?: CanvasFormat | null;
  canvasHeight?: number | null;
  slideCount: number;
  previewData: TemplateRenderProps;
  agencyName: string;
  agencyLogo?: string;
  renderError: string | null;
  renderOverridden: boolean;
  renderedImageUrls: (string | null)[];
}) {
  const [captionSource, setCaptionSource] = useState<FieldSourceValue>(MANUAL_SOURCE);
  const [caption, setCaption] = useState(initialCaption);
  const [slideIndex, setSlideIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const boundAction = updatePostAction.bind(null, postId);
  const [state, formAction, isPending] = useActionState(boundAction, { error: null } as UpdatePostState);
  const { dateValue, timeValue } = formatDateInputs(scheduledAt);

  // Collapse the form back to the "Bewerken" button after a successful save.
  // Adjust state during render (not a useEffect) — comparing against the
  // previous isPending value and correcting in the same pass is React's
  // supported pattern for "derive state from a change", same as the
  // temp-password-dialog fix in AgencyUsersCard.tsx earlier this project.
  const [lastPending, setLastPending] = useState(isPending);
  if (lastPending !== isPending) {
    setLastPending(isPending);
    if (lastPending && !isPending && state.error === null) setIsEditing(false);
  }

  function handleCaptionSourceChange(source: FieldSourceValue) {
    setCaptionSource(source);
    if (source !== MANUAL_SOURCE) setCaption(resolvePropertyField(property, source));
  }
  function handleCaptionChange(value: string) {
    setCaption(value);
    setCaptionSource(MANUAL_SOURCE);
  }

  const canEdit =
    status === "draft" ||
    status === "ready" ||
    status === "rendered" ||
    status === "scheduled" ||
    status === "render_failed" ||
    status === "publish_failed";
  const canCancel = status !== "cancelled" && status !== "published";
  const currentSlideImageUrl = renderedImageUrls[slideIndex] ?? null;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex flex-col gap-6">
        {status === "render_failed" && <RenderFailedActions postId={postId} renderError={renderError} />}
        {status === "publish_failed" && <PublishFailedActions postId={postId} jobs={jobs} />}
        {status !== "render_failed" && renderOverridden && (
          <Alert>
            <AlertDescription>
              Deze post toont bewust de originele foto zonder overlay — jouw keuze bij het inplannen.
            </AlertDescription>
          </Alert>
        )}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Pand:</span>
              <span className="text-sm font-medium text-neutral-900">{propertyTitle}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Post:</span>
              <PostStatusBadge status={status} />
            </div>
            {jobs.map((job) => (
              <div key={job.platform} className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{PLATFORM_LABEL[job.platform]}:</span>
                <PostStatusBadge status={job.status} />
                {job.error_message && <span className="text-xs text-destructive">{friendlyErrorMessage(job.error_message)}</span>}
              </div>
            ))}
          </CardContent>
        </Card>

        {canEdit ? (
          isEditing ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bewerken</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={formAction} className="flex flex-col gap-4">
                  <input type="hidden" name="caption" value={caption} />
                  <FieldBindingControl
                    label="Bijschrift"
                    source={captionSource}
                    value={caption}
                    onSourceChange={handleCaptionSourceChange}
                    onValueChange={handleCaptionChange}
                    multiline
                  />
                  <div className="flex gap-3">
                    <div className="flex flex-1 flex-col gap-1.5">
                      <Label htmlFor="scheduledDate">Datum</Label>
                      <Input key={dateValue} id="scheduledDate" name="scheduledDate" type="date" defaultValue={dateValue} required />
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5">
                      <Label htmlFor="scheduledTime">Uur</Label>
                      <Input key={timeValue} id="scheduledTime" name="scheduledTime" type="time" defaultValue={timeValue} required />
                    </div>
                  </div>
                  {state.error && (
                    <Alert variant="destructive">
                      <AlertDescription>{state.error}</AlertDescription>
                    </Alert>
                  )}
                  <div className="flex items-center gap-2">
                    <Button type="submit" disabled={isPending}>
                      {isPending ? "Bezig..." : "Wijzigingen opslaan"}
                    </Button>
                    <Button type="button" variant="outline" disabled={isPending} onClick={() => setIsEditing(false)}>
                      Annuleren
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
            <div className="flex items-center gap-2">
              <Button type="button" onClick={() => setIsEditing(true)}>
                Bewerken
              </Button>
              {canCancel && <CancelPostButton postId={postId} />}
            </div>
          )
        ) : (
          canCancel && (
            <Card>
              <CardContent className="pt-6">
                <p className="mb-3 text-sm text-muted-foreground">Deze post kan niet meer bewerkt worden.</p>
                <CancelPostButton postId={postId} />
              </CardContent>
            </Card>
          )
        )}
      </div>

      <div className="lg:sticky lg:top-8 lg:self-start">
        <PhonePreview
          componentSource={componentSource}
          scenesByFormat={scenesByFormat}
          canvasFormat={canvasFormat}
          slideCount={slideCount}
          data={previewData}
          caption={caption}
          agencyName={agencyName}
          agencyLogo={agencyLogo}
          slideIndex={slideIndex}
          onSlideIndexChange={setSlideIndex}
          canvasHeight={canvasHeight}
        />
        {currentSlideImageUrl && (
          <div className="mt-4 flex justify-center">
            <DownloadImageButton
              imageUrl={currentSlideImageUrl}
              fileName={`${propertyTitle}-slide-${slideIndex + 1}.png`}
            />
          </div>
        )}
      </div>
    </div>
  );
}
