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
 *
 * `createdBy` (a profiles.id, optional) is only used to attribute the
 * version snapshot this function takes on success — see the bottom of this
 * function. Only component_source templates get a snapshot — a scene
 * template has no component_source to snapshot at all.
 */
export async function validateAndPublishTemplate(templateId: string, createdBy?: string): Promise<TemplateValidationResult> {
  const supabase = await createClient();

  const { data: template } = await supabase.from("agency_templates").select("*").eq("id", templateId).maybeSingle();
  if (!template) return { ok: false, error: "Template niet gevonden." };

  await supabase.from("agency_templates").update({ status: "testing" }).eq("id", templateId);

  const fail = async (error: string): Promise<TemplateValidationResult> => {
    await supabase.from("agency_templates").update({ status: "failed", validation_error: error }).eq("id", templateId);
    return { ok: false, error };
  };

  // A scene-based template (Phase C) has no component_source to compile or
  // Tailwind-scan (SceneRenderer paints inline styles, not classNames), and
  // no fixed slide_count to loop — every defined scene, for every designed
  // CanvasFormat, is tested independently instead, see the scene branch of
  // step 3 below.
  const scenesByFormat = template.scenes_by_format ?? {};
  const isSceneTemplate = Object.values(scenesByFormat).some((scenes) => scenes && (scenes.cover || scenes.content || scenes.end));

  // Steps 1 and 2 (compile + generate Tailwind CSS) only apply to
  // componentSource templates — a scene template has no classNames to
  // compile at all (SceneRenderer paints inline styles).
  let compiledCss: string | null = null;
  if (!isSceneTemplate) {
    // Step 1: does it compile at all? Cheap, no browser needed.
    try {
      compileTemplateSource(template.component_source);
    } catch (error) {
      return fail((error as Error).message);
    }

    // Step 2: does Tailwind generate CSS for its classNames without error?
    try {
      compiledCss = await getCompiledCssForTemplate(template.component_source);
    } catch (error) {
      return fail(`Kon de Tailwind-CSS niet genereren: ${(error as Error).message}`);
    }
  }

  // Step 3: does it actually render against real dummy data?
  const token = signRenderToken(templateId);
  if (isSceneTemplate) {
    for (const format of Object.keys(scenesByFormat) as (keyof typeof scenesByFormat)[]) {
      const scenes = scenesByFormat[format];
      if (!scenes) continue;
      const definedRoles = (["cover", "content", "end"] as const).filter((role) => scenes[role]);
      for (const role of definedRoles) {
        const url = `${siteUrl()}/internal/render-template-scene/${templateId}/${format}/${role}?token=${token}`;
        try {
          await screenshotCanvas(url, `template ${templateId} ${format} scene ${role} validation`);
        } catch (error) {
          return fail(`Test-render van "${format}" / scène "${role}" mislukte: ${(error as Error).message}`);
        }
      }
    }
  } else {
    for (let slideIndex = 0; slideIndex < template.slide_count; slideIndex++) {
      const url = `${siteUrl()}/internal/render-template/${templateId}/${slideIndex}?token=${token}`;
      try {
        await screenshotCanvas(url, `template ${templateId} slide ${slideIndex} validation`);
      } catch (error) {
        return fail(`Test-render van slide ${slideIndex + 1} mislukte: ${(error as Error).message}`);
      }
    }
  }

  const { error: publishError } = await supabase
    .from("agency_templates")
    .update({
      status: "published",
      compiled_css: compiledCss,
      compiled_css_hash: isSceneTemplate ? null : hashTemplateSource(template.component_source),
      validated_at: new Date().toISOString(),
      validation_error: null,
    })
    .eq("id", templateId);

  if (publishError) return fail(publishError.message);

  // Templateversiebeheer geldt enkel voor component_source-templates — een
  // scene-template heeft geen component_source om te snapshotten (dat is
  // Phase E's domein, als scene-versiebeheer ooit nodig blijkt).
  if (!isSceneTemplate) {
    const { data: latest } = await supabase
      .from("agency_template_versions")
      .select("version")
      .eq("agency_template_id", templateId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = (latest?.version ?? 0) + 1;

    // Best-effort — a failed snapshot insert shouldn't undo an otherwise
    // successful publish (the template is already correctly `published`
    // above); it would just mean this one version is missing from history.
    const { error: versionError } = await supabase.from("agency_template_versions").insert({
      agency_template_id: templateId,
      version: nextVersion,
      component_source: template.component_source,
      slide_count: template.slide_count,
      config: template.config,
      created_by: createdBy ?? null,
    });
    if (versionError) console.error(`Kon templateversie niet opslaan voor ${templateId}:`, versionError.message);
  }

  return { ok: true };
}
