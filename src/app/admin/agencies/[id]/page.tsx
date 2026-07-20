import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye, Plus, Settings } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listAgencyTemplatesForAdmin } from "@/services/templates/templateService";
import { TemplateStatusControl } from "@/components/admin/TemplateStatusControl";
import { DeleteTemplateButton } from "@/components/admin/DeleteTemplateButton";
import { AgencyUsersCard, type AgencyUserRow } from "@/components/admin/AgencyUsersCard";
import { inviteAgencyUserAction, removeAgencyUserAction } from "../actions";
import { isSceneTemplate as computeIsSceneTemplate } from "@/lib/scene/resolveScene";

export default async function AgencyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole(["super_admin"]);
  const supabase = await createClient();

  const { data: agency } = await supabase.from("agencies").select("id, name").eq("id", id).maybeSingle();
  if (!agency) notFound();

  const templates = await listAgencyTemplatesForAdmin(id);

  // Emails live on auth.users, not profiles — same admin.auth.admin.getUserById
  // lookup pattern as postFailureNotificationService.ts.
  const admin = createAdminClient();
  const { data: profiles } = await admin.from("profiles").select("user_id, full_name, role").eq("agency_id", id);
  const agencyUsers: AgencyUserRow[] = await Promise.all(
    (profiles ?? []).map(async (profile) => {
      const { data } = await admin.auth.admin.getUserById(profile.user_id);
      return { userId: profile.user_id, fullName: profile.full_name, email: data.user?.email ?? "—", role: profile.role };
    }),
  );

  const boundInviteAction = inviteAgencyUserAction.bind(null, id);
  const boundRemoveAction = removeAgencyUserAction.bind(null, id);

  return (
    <div>
      <PageHeader
        title={agency.name}
        description="Templates voor dit kantoor — elke template is rechtstreeks voor dit kantoor geschreven."
        backHref="/admin/agencies"
        backLabel="Vastgoedkantoren"
        actions={
          <>
            <Button variant="outline" nativeButton={false} render={<Link href={`/admin/agencies/${id}/settings`} />}>
              <Settings className="h-4 w-4" />
              Instellingen
            </Button>
            <Button nativeButton={false} render={<Link href={`/admin/agencies/${id}/templates/new`} />}>
              <Plus className="h-4 w-4" />
              Template toevoegen
            </Button>
          </>
        }
      />

      <div className="mb-6 max-w-2xl">
        <AgencyUsersCard agencyId={id} users={agencyUsers} inviteAction={boundInviteAction} removeAction={boundRemoveAction} />
      </div>

      {templates.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-200 py-16 text-center text-sm text-muted-foreground">
          Dit kantoor heeft nog geen templates. Maak er een aan via &quot;Template toevoegen&quot;.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Pakket</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Acties</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => {
              // A scene-based template (Phase C/E) has no meaningful
              // slide_count (real slide count always follows however many
              // photos the agency picks per post, see Phase B) and edits
              // through the visual editor, not the code form.
              const isSceneTemplate = computeIsSceneTemplate(template.scenes_by_format);
              return (
                <TableRow key={template.id}>
                  <TableCell>
                    <p className="font-medium text-neutral-900">{template.name}</p>
                    {template.description && <p className="text-xs text-muted-foreground">{template.description}</p>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {isSceneTemplate
                      ? template.type === "carousel"
                        ? "Carousel (scène)"
                        : "Single post (scène)"
                      : template.slide_count > 1
                        ? `Carousel (${template.slide_count} slides)`
                        : "Single post"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={template.billable_type === "included" ? "secondary" : "outline"}>
                      {template.billable_type === "included" ? "Inbegrepen" : "In regie"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <TemplateStatusControl
                      agencyId={id}
                      templateId={template.id}
                      status={template.status}
                      validationError={template.validation_error}
                    />
                  </TableCell>
                  <TableCell className="flex justify-end gap-2 text-right">
                    <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/admin/agencies/${id}/templates/${template.id}/preview`} />}>
                      <Eye className="h-3.5 w-3.5" />
                      Preview
                    </Button>
                    {/*
                      Always shown — the scene editor is the only way to create *or* edit a
                      template now (see templates/new/page.tsx and createSceneAgencyTemplate),
                      so gating this on isSceneTemplate (whether scenes_by_format already has
                      content) left a real gap: a just-created template has an empty
                      scenes_by_format until the first save, so "Bewerken" would disappear
                      entirely for it the moment you navigated away before saving once — no
                      other page links back into the editor. A pre-scene-editor
                      componentSource-only template (none left in this app's own data, but
                      possible from an earlier era) still opens the editor fine — it just
                      starts from a blank canvas, same as any other never-yet-designed
                      template; nothing here reads or depends on componentSource anymore.
                    */}
                    <Button size="sm" nativeButton={false} render={<Link href={`/admin/agencies/${id}/templates/${template.id}/editor`} />}>
                      Bewerken
                    </Button>
                    <DeleteTemplateButton agencyId={id} templateId={template.id} templateName={template.name} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
