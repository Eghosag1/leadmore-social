import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Fallback for a scene-template slide whose role (cover/content/end) has no
 * scene defined for it (see resolveSceneForSlide()) — shows the plain,
 * unbranded photo filling the full canvas, the same "no overlay" behavior
 * "eigen foto's" posts already have. Unlike RawImageSlide.tsx (which shows
 * the photo's own natural aspect ratio in a floating preview box), this
 * fills whatever fixed canvas the surrounding scene slides already use
 * (object-cover), so a mix of "has a scene" / "no scene" slides in the same
 * carousel stay visually consistent in size.
 *
 * Uses next/image directly (not the RenderImage/useRawImage swap
 * compileTemplateSource()-compiled templates need) — same as SceneRenderer
 * already does, relying on `priority` + screenshotCanvas.ts's img.complete
 * readiness check, which is already proven to work for the real Puppeteer
 * render path.
 */
export function PlainPhotoSlide({ imageUrl, className }: { imageUrl?: string; className?: string }) {
  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-neutral-100", className)}>
      {imageUrl && <Image src={imageUrl} alt="" fill sizes="1080px" className="object-cover" priority />}
    </div>
  );
}
