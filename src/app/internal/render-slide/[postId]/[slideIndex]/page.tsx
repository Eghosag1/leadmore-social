import { notFound } from "next/navigation";
import Script from "next/script";
import { DynamicTemplateRenderer } from "@/components/templates/DynamicTemplateRenderer";
import { RenderReadyWrapper } from "@/components/render/RenderReadyWrapper";
import { getSlideRenderData } from "@/services/render/renderDataService";
import { verifyRenderToken } from "@/lib/render/token";

/**
 * Bare, unauthenticated page rendered by browserRenderService's headless
 * Chromium instance (server-to-server, no user session — see
 * src/lib/render/token.ts for how it's authorized instead of requireRole()).
 * Shows exactly one slide's DynamicTemplateRenderer output at a fixed
 * 1080x1080 canvas, nothing else — this is what gets screenshotted.
 *
 * Loads Tailwind's Play CDN (only here, nowhere else in the app): admin
 * templates are TSX stored in the database, not files, so our normal
 * build-time-compiled Tailwind CSS never sees their classNames and generates
 * no CSS for them — text renders in the DOM but with no styling applied
 * (wrong color/position, effectively invisible against the photo). Play CDN
 * compiles classes live from whatever's actually in the DOM, sidestepping
 * that entirely. Not used app-wide on purpose — it's meant for exactly this
 * kind of dynamic-content scenario, not real user-facing traffic.
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
  if (!data) notFound();

  return (
    <>
      <Script src="https://cdn.tailwindcss.com" strategy="afterInteractive" />
      <div className="h-[1080px] w-[1080px] overflow-hidden">
        <RenderReadyWrapper>
          <DynamicTemplateRenderer
            source={data.componentSource!}
            data={data.previewData}
            slideIndex={Number(slideIndex) || 0}
            className="rounded-none shadow-none"
          />
        </RenderReadyWrapper>
      </div>
    </>
  );
}
