import { notFound } from "next/navigation";
import { DynamicTemplateRenderer } from "@/components/templates/DynamicTemplateRenderer";
import { getTemplateValidationRenderData } from "@/services/render/renderDataService";
import { getCompiledCssForTemplate } from "@/lib/render/compile-tailwind";
import { verifyRenderToken } from "@/lib/render/token";

/**
 * Bare, unauthenticated page rendered by templateValidationService's headless
 * Chromium instance (screenshotCanvas — same shared logic as the real
 * post-render page) while an admin is validating/publishing a template.
 * Renders the template against the same dummy property the admin's live
 * preview already uses (EXAMPLE_PROPERTY, see TemplateForm.tsx) — there is no
 * real post yet at this point, that's the whole point of validating before a
 * template is ever assigned to one.
 *
 * Deliberately always recompiles CSS live (getCompiledCssForTemplate) rather
 * than reading a persisted `compiled_css` column — validating *is* the step
 * that produces that column, so at this point it can't be trusted yet. Only
 * applies to `componentSource` (DB-string) templates — a scene has nothing
 * to compile at all (SceneRenderer paints inline styles), see
 * /internal/render-template-scene instead.
 */
export default async function RenderTemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string; slideIndex: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { templateId, slideIndex } = await params;
  const { token } = await searchParams;

  if (!token || !verifyRenderToken(templateId, token)) notFound();

  const data = await getTemplateValidationRenderData(templateId);
  if (!data) notFound();

  const compiledCss = await getCompiledCssForTemplate(data.componentSource);

  return (
    <>
      {compiledCss && <style dangerouslySetInnerHTML={{ __html: compiledCss }} />}
      <div data-render-canvas="true" className="h-[1350px] w-[1080px] overflow-hidden">
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
