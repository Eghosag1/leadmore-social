import { notFound } from "next/navigation";
import { DynamicTemplateRenderer } from "@/components/templates/DynamicTemplateRenderer";
import { getTemplateValidationRenderData } from "@/services/render/renderDataService";
import { verifyRenderToken } from "@/lib/render/token";
import { CANVAS_FORMAT_DIMENSIONS } from "@/types/scene";
import { CANVAS_FORMATS, type CanvasFormat } from "@/types/enums";

const SCENE_ROLES = ["cover", "content", "end"] as const;
type SceneRole = (typeof SCENE_ROLES)[number];

/**
 * Bare, unauthenticated page rendered by templateValidationService's headless
 * Chromium instance while an admin is validating/publishing a scene-based
 * template (Phase C/D, formats follow-up) — the counterpart of
 * /internal/render-template for legacy component_source templates. Renders
 * exactly one named scene (cover/content/end) for one specific CanvasFormat
 * in isolation, against the same dummy property EXAMPLE_PROPERTY the
 * admin's live preview already uses.
 *
 * No Tailwind compilation step here: SceneRenderer paints inline styles, not
 * classNames — the sole reason /internal/render-template needs a compiled
 * `<style>` tag at all. `useRawImage` is skipped too — a scene always
 * imports next/image directly and relies on `priority` + the shared
 * img.complete readiness check in screenshotCanvas.ts.
 */
export default async function RenderTemplateScenePage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string; format: string; sceneRole: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { templateId, format, sceneRole } = await params;
  const { token } = await searchParams;

  if (!token || !verifyRenderToken(templateId, token)) notFound();
  if (!CANVAS_FORMATS.includes(format as CanvasFormat)) notFound();
  if (!SCENE_ROLES.includes(sceneRole as SceneRole)) notFound();

  const data = await getTemplateValidationRenderData(templateId);
  if (!data || !data.scenesByFormat) notFound();

  const formatScenes = data.scenesByFormat[format as CanvasFormat];
  const scene = formatScenes?.[sceneRole as SceneRole];
  if (!scene) notFound();

  const { width, height } = CANVAS_FORMAT_DIMENSIONS[format as CanvasFormat];

  return (
    <div data-render-canvas="true" className="overflow-hidden" style={{ width, height }}>
      <DynamicTemplateRenderer scene={scene} data={data.previewData} slideIndex={0} className="rounded-none shadow-none" />
    </div>
  );
}
