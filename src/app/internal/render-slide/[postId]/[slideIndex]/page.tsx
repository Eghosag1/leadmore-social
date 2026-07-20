import { notFound } from "next/navigation";
import { DynamicTemplateRenderer } from "@/components/templates/DynamicTemplateRenderer";
import { getSlideRenderData } from "@/services/render/renderDataService";
import { getCompiledCssForTemplate } from "@/lib/render/compile-tailwind";
import { verifyRenderToken } from "@/lib/render/token";
import { getFormatScenes, resolveSceneForSlide } from "@/lib/scene/resolveScene";
import { resolveRenderHeight } from "@/lib/canvas-format";

/**
 * Bare, unauthenticated page rendered by browserRenderService's headless
 * Chromium instance (server-to-server, no user session — see
 * src/lib/render/token.ts for how it's authorized instead of requireRole()).
 * Shows exactly one slide's DynamicTemplateRenderer output at a 1080px-wide
 * canvas (`data-render-canvas`, what Puppeteer screenshots) — the height
 * comes from resolveRenderHeight() (src/lib/canvas-format.ts): a scene
 * template's chosen canvas_format if set, else the standard 1350 (4:5)
 * unless the post used the older canvas_mode 'original'. Templates are
 * already height-relative (flex/percentage-based), so no template needs to
 * know which case it's in.
 *
 * Three things make this deterministic, no CDN/DOM-scanning/blind waits
 * needed:
 *   1. CSS for the template's actual classNames is compiled server-side
 *      (getCompiledCssForTemplate, via Tailwind v4's `@source inline(...)`)
 *      and injected directly as a <style> tag, available before any client
 *      JS runs — admin templates are TSX strings in the database, so our
 *      normal build-time Tailwind never sees their classNames otherwise.
 *      Prefers the template's persisted `compiled_css` (set once by
 *      templateValidationService when the template was published) over
 *      recompiling live — only templates that passed validation are ever
 *      selectable for a real post, so this is normally already populated;
 *      recompiling here is just a defensive fallback for older data. Only
 *      applies to `componentSource` templates — a scene has nothing to
 *      compile at all (SceneRenderer paints inline styles).
 *   2. RenderImage (a plain `<img>`) replaces next/image for this page only
 *      — no lazy-loading/optimization behavior to race against. Only applies
 *      to the `componentSource` path; a scene imports next/image directly
 *      and relies on `priority` instead.
 */
export default async function RenderSlidePage({
  params,
  searchParams,
}: {
  params: Promise<{ postId: string; slideIndex: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { postId, slideIndex } = await params;
  const { token } = await searchParams;

  if (!token || !verifyRenderToken(postId, token)) notFound();

  const data = await getSlideRenderData(postId);
  if (!data || (!data.componentSource && !data.scenesByFormat)) notFound();

  const scene = data.scenesByFormat
    ? resolveSceneForSlide(getFormatScenes(data.scenesByFormat, data.canvasFormat), Number(slideIndex) || 0, data.slideCount)
    : undefined;
  // Scene templates paint inline styles, not Tailwind classNames — nothing to compile.
  const compiledCss = scene !== undefined ? null : (data.compiledCss ?? (await getCompiledCssForTemplate(data.componentSource!)));
  const canvasHeight = resolveRenderHeight({ canvasFormat: data.canvasFormat, canvasMode: data.canvasMode, canvasHeight: data.canvasHeight });

  return (
    <>
      {compiledCss && <style dangerouslySetInnerHTML={{ __html: compiledCss }} />}
      <div data-render-canvas="true" className="w-[1080px] overflow-hidden" style={{ height: canvasHeight }}>
        <DynamicTemplateRenderer
          {...(scene !== undefined ? { scene } : { source: data.componentSource! })}
          data={data.previewData}
          slideIndex={Number(slideIndex) || 0}
          className="rounded-none shadow-none"
          useRawImage
        />
      </div>
    </>
  );
}
