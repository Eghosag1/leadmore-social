import { notFound } from "next/navigation";
import { DynamicTemplateRenderer } from "@/components/templates/DynamicTemplateRenderer";
import { getSlideRenderData } from "@/services/render/renderDataService";
import { getCompiledCssForTemplate } from "@/lib/render/compile-tailwind";
import { verifyRenderToken } from "@/lib/render/token";

/**
 * Bare, unauthenticated page rendered by browserRenderService's headless
 * Chromium instance (server-to-server, no user session — see
 * src/lib/render/token.ts for how it's authorized instead of requireRole()).
 * Shows exactly one slide's DynamicTemplateRenderer output at a fixed
 * 1080x1080 canvas (`data-render-canvas`, what Puppeteer screenshots).
 *
 * Two things make this deterministic, no CDN/DOM-scanning/blind waits
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
 *      recompiling here is just a defensive fallback for older data.
 *   2. RenderImage (a plain `<img>`) replaces next/image for this page only
 *      — no lazy-loading/optimization behavior to race against.
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
  if (!data || !data.componentSource) notFound();

  const compiledCss = data.compiledCss ?? (await getCompiledCssForTemplate(data.componentSource));

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: compiledCss }} />
      <div data-render-canvas="true" className="h-[1080px] w-[1080px] overflow-hidden">
        <DynamicTemplateRenderer
          source={data.componentSource}
          data={data.previewData}
          slideIndex={Number(slideIndex) || 0}
          className="rounded-none shadow-none"
          useRawImage
        />
      </div>
    </>
  );
}
