import "server-only";
import { createClient } from "@/lib/supabase/server";
import { compileTemplateSource } from "@/lib/dynamic-template";
import { getCompiledCssForTemplate, hashTemplateSource } from "@/lib/render/compile-tailwind";
import { signRenderToken } from "@/lib/render/token";
import { screenshotCanvas } from "@/lib/render/screenshotCanvas";
import { siteUrl } from "@/lib/site-url";

export interface TemplateValidationResult {
  ok: boolean;
  error?: string;
}

/**
 * Runs a template through the same steps the real render pipeline would hit
 * on the first post that ever used it — but now, at save time, against dummy
 * property data, so a broken template is caught by the admin instead of
 * discovered by an agency mid-post. Only on full success does the template
 * become `published` (and therefore selectable by an agency — see the
 * agency_templates_select RLS policy in 0007_template_validation.sql, which
 * enforces this at the database level, not just in the UI).
 *
 * A failed validation never touches the previously-persisted compiled_css/
 * compiled_css_hash — an admin experimenting with a broken edit shouldn't be
 * able to accidentally clobber the last known-good render output of an
 * already-published template.
 */
export async function validateAndPublishTemplate(templateId: string): Promise<TemplateValidationResult> {
  const supabase = await createClient();

  const { data: template } = await supabase.from("agency_templates").select("*").eq("id", templateId).maybeSingle();
  if (!template) return { ok: false, error: "Template niet gevonden." };

  await supabase.from("agency_templates").update({ status: "testing" }).eq("id", templateId);

  const fail = async (error: string): Promise<TemplateValidationResult> => {
    await supabase.from("agency_templates").update({ status: "failed", validation_error: error }).eq("id", templateId);
    return { ok: false, error };
  };

  // Step 1: does it compile at all? Cheap, no browser needed.
  try {
    compileTemplateSource(template.component_source);
  } catch (error) {
    return fail((error as Error).message);
  }

  // Step 2: does Tailwind generate CSS for its classNames without error?
  let compiledCss: string;
  try {
    compiledCss = await getCompiledCssForTemplate(template.component_source);
  } catch (error) {
    return fail(`Kon de Tailwind-CSS niet genereren: ${(error as Error).message}`);
  }

  // Step 3: does it actually render, per slide, against real dummy data?
  const token = signRenderToken(templateId);
  for (let slideIndex = 0; slideIndex < template.slide_count; slideIndex++) {
    const url = `${siteUrl()}/internal/render-template/${templateId}/${slideIndex}?token=${token}`;
    try {
      await screenshotCanvas(url, `template ${templateId} slide ${slideIndex} validation`);
    } catch (error) {
      return fail(`Test-render van slide ${slideIndex + 1} mislukte: ${(error as Error).message}`);
    }
  }

  const { error: publishError } = await supabase
    .from("agency_templates")
    .update({
      status: "published",
      compiled_css: compiledCss,
      compiled_css_hash: hashTemplateSource(template.component_source),
      validated_at: new Date().toISOString(),
      validation_error: null,
    })
    .eq("id", templateId);

  if (publishError) return fail(publishError.message);
  return { ok: true };
}
