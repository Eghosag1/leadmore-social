import { notFound } from "next/navigation";
import { DynamicTemplateRenderer } from "@/components/templates/DynamicTemplateRenderer";
import { getSlideRenderData } from "@/services/render/renderDataService";
import { verifyRenderToken } from "@/lib/render/token";

/**
 * Bare, unauthenticated page rendered by browserRenderService's headless
 * Chromium instance (server-to-server, no user session — see
 * src/lib/render/token.ts for how it's authorized instead of requireRole()).
 * Shows exactly one slide's DynamicTemplateRenderer output at a fixed
 * 1080x1080 canvas, nothing else — this is what gets screenshotted.
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
    <div className="h-[1080px] w-[1080px] overflow-hidden">
      <DynamicTemplateRenderer
        source={data.componentSource!}
        data={data.previewData}
        slideIndex={Number(slideIndex) || 0}
        className="rounded-none shadow-none"
      />
    </div>
  );
}
