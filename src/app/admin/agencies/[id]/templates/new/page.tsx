import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createSceneTemplateAction } from "../scene-actions";
import type { TemplateType } from "@/types/enums";

const TYPE_LABELS: Record<TemplateType, string> = { single: "Single post", carousel: "Carousel" };

/**
 * Templates are only ever authored visually now — the old "paste TSX
 * source" path (TemplateForm) was removed entirely per explicit admin
 * request, including for existing templates (no more edit UI for
 * component_source rows; they keep rendering exactly as before, they're
 * just no longer editable through this app). This page creates a blank
 * scene-based template and sends the admin straight into the editor.
 */
export default async function NewAgencyTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole(["super_admin"]);
  const supabase = await createClient();

  const { data: agency } = await supabase.from("agencies").select("id, name").eq("id", id).maybeSingle();
  if (!agency) notFound();

  const boundAction = createSceneTemplateAction.bind(null, id);

  return (
    <div>
      <PageHeader
        title={`Nieuwe template — ${agency.name}`}
        description="Bouw de template visueel met de scène-editor."
        backHref={`/admin/agencies/${id}`}
        backLabel={agency.name}
      />
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">Nieuwe template</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={boundAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Naam</Label>
              <Input id="name" name="name" placeholder="Bv. Nieuw pand — carousel" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Omschrijving (optioneel)</Label>
              <Input id="description" name="description" placeholder="Voor het kantoor, niet zichtbaar op de visual" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="type">Type</Label>
              <select id="type" name="type" className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm" defaultValue="carousel">
                {(["single", "carousel"] as TemplateType[]).map((type) => (
                  <option key={type} value={type}>
                    {TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="includedInPlan" name="includedInPlan" defaultChecked />
              <Label htmlFor="includedInPlan" className="text-sm">
                Inbegrepen in standaardpakket
              </Label>
            </div>
            <Button type="submit">Aanmaken en scènes bouwen</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
