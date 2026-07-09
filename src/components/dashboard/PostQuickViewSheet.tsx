"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PhonePreview } from "@/components/dashboard/PhonePreview";
import { CancelPostButton } from "@/components/dashboard/CancelPostButton";
import { RenderFailedActions } from "@/components/dashboard/RenderFailedActions";
import { FieldBindingControl } from "@/components/dashboard/FieldBindingControl";
import { PostStatusBadge } from "@/components/shared/StatusBadge";
import { formatDateInputs } from "@/lib/date-inputs";
import { MANUAL_SOURCE, resolvePropertyField, type FieldSourceValue } from "@/lib/field-binding";
import { updatePostAction, cancelPostQuickAction, getPostQuickViewAction, type UpdatePostState } from "@/app/dashboard/posts/[id]/actions";
import type { PostDetailData } from "@/services/posts/postDetailService";
import type { Platform } from "@/types/enums";

const PLATFORM_LABEL: Record<Platform, string> = { facebook: "Facebook", instagram: "Instagram" };

function QuickViewForm({ data, onCancelled, onSaved }: { data: PostDetailData; onCancelled: () => void; onSaved: () => void }) {
  const [captionSource, setCaptionSource] = useState<FieldSourceValue>(MANUAL_SOURCE);
  const [caption, setCaption] = useState(data.initialCaption);
  const [slideIndex, setSlideIndex] = useState(0);
  const boundAction = updatePostAction.bind(null, data.postId);
  const [state, formAction, isPending] = useActionState(boundAction, { error: null } as UpdatePostState);
  const { dateValue, timeValue } = formatDateInputs(data.scheduledAt);
  const canEdit =
    data.status === "draft" ||
    data.status === "ready" ||
    data.status === "rendered" ||
    data.status === "scheduled" ||
    data.status === "render_failed" ||
    data.status === "publish_failed";
  const canCancel = data.status !== "cancelled" && data.status !== "published";

  function handleCaptionSourceChange(source: FieldSourceValue) {
    setCaptionSource(source);
    if (source !== MANUAL_SOURCE) setCaption(resolvePropertyField(data.property, source));
  }
  function handleCaptionChange(value: string) {
    setCaption(value);
    setCaptionSource(MANUAL_SOURCE);
  }

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!isPending && state.error === null) onSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending]);

  return (
    <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-4">
      <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Post:</span>
          <PostStatusBadge status={data.status} />
        </div>
        {data.jobs.map((job) => (
          <div key={job.platform} className="flex items-center gap-2" title={job.error_message ?? undefined}>
            <span className="text-sm text-muted-foreground">{PLATFORM_LABEL[job.platform]}:</span>
            <PostStatusBadge status={job.status} />
            {job.error_message && <span className="text-xs text-destructive">{job.error_message}</span>}
          </div>
        ))}
      </div>

      {data.status === "render_failed" && <RenderFailedActions postId={data.postId} renderError={data.renderError} />}
      {data.status !== "render_failed" && data.renderOverridden && (
        <Alert>
          <AlertDescription>
            Deze post toont bewust de originele foto zonder overlay — jouw keuze bij het inplannen.
          </AlertDescription>
        </Alert>
      )}

      {/* Always side-by-side — the sheet's own width (see PostQuickViewSheet) is set wide enough that this never needs to stack. */}
      <div className="grid grid-cols-[minmax(0,1fr)_280px] items-start gap-6">
        <div className="flex flex-col gap-4">
          {canEdit ? (
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
                  <Input id="scheduledDate" name="scheduledDate" type="date" defaultValue={dateValue} required />
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="scheduledTime">Uur</Label>
                  <Input id="scheduledTime" name="scheduledTime" type="time" defaultValue={timeValue} required />
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
                {canCancel && <CancelPostButton postId={data.postId} action={cancelPostQuickAction} onCancelled={onCancelled} />}
              </div>
            </form>
          ) : (
            canCancel && <CancelPostButton postId={data.postId} action={cancelPostQuickAction} onCancelled={onCancelled} />
          )}

          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/dashboard/posts/${data.postId}?from=dashboard`} />}>
            <Eye className="h-3.5 w-3.5" />
            Volledige pagina openen
          </Button>
        </div>

        <PhonePreview
          componentSource={data.componentSource}
          slideCount={data.slideCount}
          data={data.previewData}
          caption={caption}
          agencyName={data.agencyName}
          agencyLogo={data.agencyLogo}
          slideIndex={slideIndex}
          onSlideIndexChange={setSlideIndex}
        />
      </div>
    </div>
  );
}

export function PostQuickViewSheet({
  postId,
  open,
  onOpenChange,
}: {
  postId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [data, setData] = useState<PostDetailData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !postId) return;
    let cancelled = false;
    setLoading(true);
    setData(null);
    getPostQuickViewAction(postId).then((result) => {
      if (!cancelled) {
        setData(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, postId]);

  function handleCancelled() {
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* 50vw by default, but never narrower than fits the form-next-to-phone-preview layout below, and never wider than the viewport. */}
      <SheetContent
        side="right"
        style={{ width: "min(94vw, clamp(44rem, 50vw, 60vw))", maxWidth: "min(94vw, clamp(44rem, 50vw, 60vw))" }}
      >
        <SheetHeader>
          <SheetTitle>{data?.propertyTitle ?? "Post"}</SheetTitle>
          <SheetDescription>{data?.property.location ?? "Details laden..."}</SheetDescription>
        </SheetHeader>
        {loading ? (
          <div className="flex flex-col gap-3 px-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : data ? (
          <QuickViewForm data={data} onCancelled={handleCancelled} onSaved={() => router.refresh()} />
        ) : (
          <p className="px-4 text-sm text-muted-foreground">Deze post kon niet geladen worden.</p>
        )}
      </SheetContent>
    </Sheet>
  );
}
